/**
 * Tab 2: Rotating-Partner 2v2 Round-Robin Scheduler
 */
function startRoundRobinTournament() {
  if (state.players.length < 10 || state.players.length > 30) {
    showToast('Please register between 10 and 30 participants first.', 'error');
    return;
  }

  const executeGeneration = () => {
    state.rounds = buildRotatingPartnerSchedule(state.players, state.config.maxGamesPerPlayer);
    state.roundFilter = 'all';
    state.playoffTeams = [];
    state.bracket = null;
    saveState();
    switchTab('roundrobin');
    showToast(`Generated ${state.rounds.length} Round-Robin rounds across ${state.config.numTables} table(s)!`, 'success');
  };

  if (state.rounds.length > 0) {
    openConfirmModal(
      'Regenerate Round-Robin Schedule?',
      'This will overwrite existing Round-Robin match results, standings, and playoff brackets.',
      executeGeneration
    );
  } else {
    executeGeneration();
  }
}

function buildRotatingPartnerSchedule(players, maxGamesSetting) {
  const n = players.length;
  const maxGames = maxGamesSetting === 'full' ? (n - 1) : Math.min(maxGamesSetting, n - 1);

  const gamesPlayed = {};
  const sitOutCount = {};
  const partneredWith = {};
  const opposedCount = {};

  players.forEach(p => {
    gamesPlayed[p.id] = 0;
    sitOutCount[p.id] = 0;
    partneredWith[p.id] = new Set();
    opposedCount[p.id] = {};
  });

  const rounds = [];
  let roundNum = 1;
  let globalMatchSeq = 1;
  const maxSafetyRounds = maxGames + 6;

  while (roundNum <= maxSafetyRounds) {
    const eligible = players.filter(p => gamesPlayed[p.id] < maxGames);
    if (eligible.length < 4) break;

    eligible.sort((a, b) => {
      if (gamesPlayed[a.id] !== gamesPlayed[b.id]) return gamesPlayed[a.id] - gamesPlayed[b.id];
      if (sitOutCount[b.id] !== sitOutCount[a.id]) return sitOutCount[b.id] - sitOutCount[a.id];
      return Math.random() - 0.5;
    });

    const activeCapacity = Math.floor(eligible.length / 4) * 4;
    const activePlayers = eligible.slice(0, activeCapacity);
    const activeIds = new Set(activePlayers.map(p => p.id));

    const sitOuts = players.filter(p => !activeIds.has(p.id)).map(p => p.id);
    sitOuts.forEach(id => { sitOutCount[id]++; });

    const unpaired = [...activePlayers];
    const pairs = [];

    while (unpaired.length >= 2) {
      const p1 = unpaired.shift();
      let bestIdx = 0;
      let bestScore = Infinity;

      for (let i = 0; i < unpaired.length; i++) {
        const p2 = unpaired[i];
        const alreadyPartnered = partneredWith[p1.id].has(p2.id) ? 1000 : 0;
        const score = alreadyPartnered + Math.random() * 5;
        if (score < bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }

      const partner = unpaired.splice(bestIdx, 1)[0];
      partneredWith[p1.id].add(partner.id);
      partneredWith[partner.id].add(p1.id);
      pairs.push([p1, partner]);
    }

    const remainingPairs = [...pairs];
    const matches = [];

    while (remainingPairs.length >= 2) {
      const pairA = remainingPairs.shift();
      let bestPairIdx = 0;
      let lowestOppScore = Infinity;

      for (let i = 0; i < remainingPairs.length; i++) {
        const pairB = remainingPairs[i];
        const oppScore =
          (opposedCount[pairA[0].id][pairB[0].id] || 0) +
          (opposedCount[pairA[0].id][pairB[1].id] || 0) +
          (opposedCount[pairA[1].id][pairB[0].id] || 0) +
          (opposedCount[pairA[1].id][pairB[1].id] || 0) +
          Math.random() * 0.5;

        if (oppScore < lowestOppScore) {
          lowestOppScore = oppScore;
          bestPairIdx = i;
        }
      }

      const pairB = remainingPairs.splice(bestPairIdx, 1)[0];

      [pairA[0].id, pairA[1].id].forEach(idA => {
        gamesPlayed[idA]++;
        [pairB[0].id, pairB[1].id].forEach(idB => {
          opposedCount[idA][idB] = (opposedCount[idA][idB] || 0) + 1;
          opposedCount[idB][idA] = (opposedCount[idB][idA] || 0) + 1;
        });
      });
      [pairB[0].id, pairB[1].id].forEach(idB => {
        gamesPlayed[idB]++;
      });

      const stats = {};
      const statDefs = state.config.statDefinitions || DEFAULT_STAT_DEFINITIONS;
      [pairA[0].id, pairA[1].id, pairB[0].id, pairB[1].id].forEach(pid => {
        stats[pid] = {};
        statDefs.forEach(sd => { stats[pid][sd.key] = 0; });
      });

      matches.push({
        id: generateId('m'),
        seqIndex: globalMatchSeq++,
        teamA: [pairA[0].id, pairA[1].id],
        teamB: [pairB[0].id, pairB[1].id],
        winner: null,
        status: 'pending',
        tableNumber: null,
        skipped: false,
        otLevel: 0,
        isRevising: false,
        stats
      });
    }

    if (matches.length > 0) {
      rounds.push({
        roundNumber: roundNum,
        matches,
        sitOuts
      });
    }
    roundNum++;
  }

  return rounds;
}

function setRoundFilter(filterVal) {
  state.roundFilter = filterVal;
  saveState();
  renderRoundRobin();
}

/**
 * Multi-Table Queue, Effective Cups, Consecutive OT & Match Revision Logic
 */
function getAllMatchesFlat() {
  const flat = [];
  state.rounds.forEach((round, roundIdx) => {
    round.matches.forEach((match, matchIdx) => {
      flat.push({ round, roundIdx, match, matchIdx });
    });
  });
  return flat;
}

function getActiveMatches() {
  return getAllMatchesFlat()
    .filter(item => item.match.status === 'active')
    .sort((a, b) => (a.match.tableNumber || 99) - (b.match.tableNumber || 99));
}

function getBusyPlayerIds() {
  const busy = new Set();
  getActiveMatches().forEach(({ match }) => {
    match.teamA.forEach(id => busy.add(id));
    match.teamB.forEach(id => busy.add(id));
  });
  return busy;
}

function getAvailableTableNumber() {
  const numTables = state.config.numTables || 2;
  const usedTables = new Set(getActiveMatches().map(item => item.match.tableNumber));
  for (let t = 1; t <= numTables; t++) {
    if (!usedTables.has(t)) return t;
  }
  return null;
}

function getSuggestedNextMatches() {
  const busyPlayers = getBusyPlayerIds();
  const pending = getAllMatchesFlat().filter(item => item.match.status === 'pending');

  const playable = pending.filter(({ match }) => {
    const participants = [...match.teamA, ...match.teamB];
    return participants.every(pid => !busyPlayers.has(pid));
  });

  playable.sort((a, b) => {
    const aSkipped = a.match.skipped ? 0 : 1;
    const bSkipped = b.match.skipped ? 0 : 1;
    if (aSkipped !== bSkipped) return aSkipped - bSkipped;
    return (a.match.seqIndex || 0) - (b.match.seqIndex || 0);
  });

  return playable;
}

function startMatchOnTable(roundIdx, matchIdx) {
  const numTables = state.config.numTables || 2;
  const activeMatches = getActiveMatches();
  if (activeMatches.length >= numTables) {
    showToast(`All ${numTables} table(s) are currently occupied! Finish a live game first.`, 'warning');
    return;
  }

  const match = state.rounds[roundIdx].matches[matchIdx];
  if (!match || match.status !== 'pending') return;

  const busyPlayers = getBusyPlayerIds();
  const matchPlayers = [...match.teamA, ...match.teamB];
  const conflictingPlayer = matchPlayers.find(pid => busyPlayers.has(pid));
  if (conflictingPlayer) {
    showToast(`${getPlayerName(conflictingPlayer)} is currently playing on another table!`, 'error');
    return;
  }

  const tableNum = getAvailableTableNumber();
  if (!tableNum) return;

  getAllMatchesFlat().forEach(({ match: other }) => {
    if (other.status === 'pending' && other.id !== match.id && (other.seqIndex || 0) < (match.seqIndex || 0)) {
      other.skipped = true;
    }
  });

  match.status = 'active';
  match.tableNumber = tableNum;
  match.skipped = false;

  saveState();
  renderRoundRobin();
  showToast(`Game #${match.seqIndex} started on Table ${tableNum}!`, 'success');
}

function cancelActiveMatch(roundIdx, matchIdx) {
  const match = state.rounds[roundIdx].matches[matchIdx];
  if (!match || match.status !== 'active') return;
  const freedTable = match.tableNumber;
  match.status = 'pending';
  match.tableNumber = null;
  match.skipped = true;
  saveState();
  renderRoundRobin();
  showToast(`Game #${match.seqIndex} paused & returned to queue (Table ${freedTable} open).`, 'info');
}

function formatOtStageLabel(otLevel) {
  if (!otLevel || otLevel <= 0) return 'Regulation';
  return otLevel === 1 ? 'OT' : `${otLevel}OT`;
}

function getMatchMaxCupsPerPairing(match) {
  const sdBonus = state.config.suddenDeathCups === 3 ? 3 : 1;
  const otLevel = (match && typeof match.otLevel === 'number') ? match.otLevel : 0;
  return 10 + (otLevel * sdBonus);
}

function getPairingCupTotal(match, side) {
  const pairIds = side === 'A' ? match.teamA : match.teamB;
  return pairIds.reduce((sum, pid) => sum + ((match.stats[pid] && match.stats[pid].cups) || 0), 0);
}

function getPairingOpponentErrors(match, side) {
  const oppIds = side === 'A' ? match.teamB : match.teamA;
  return oppIds.reduce((sum, pid) => sum + ((match.stats[pid] && match.stats[pid].err) || 0), 0);
}

function getPairingEffectiveCups(match, side) {
  return getPairingCupTotal(match, side) + getPairingOpponentErrors(match, side);
}

function canPairingWinMatch(match, side) {
  const target = getMatchMaxCupsPerPairing(match);
  const effSelf = getPairingEffectiveCups(match, side);
  const oppSide = side === 'A' ? 'B' : 'A';
  const effOpp = getPairingEffectiveCups(match, oppSide);
  const stageName = formatOtStageLabel(match.otLevel || 0);

  if (effSelf !== target) {
    const diff = target - effSelf;
    return {
      allowed: false,
      reason: `Pair ${side} needs ${diff} more effective cup${diff === 1 ? '' : 's'} (Cups + Opp Errors) to reach ${target} (${stageName}).`
    };
  }
  if (effOpp >= effSelf) {
    const nextOtLabel = formatOtStageLabel((match.otLevel || 0) + 1);
    return {
      allowed: false,
      reason: `Both pairings are tied at ${target} (${stageName})! Click "Start ${nextOtLabel}" to continue.`
    };
  }
  return { allowed: true, reason: '' };
}

function finishActiveMatchWithWinner(roundIdx, matchIdx, winningTeam) {
  const match = state.rounds[roundIdx].matches[matchIdx];
  if (!match) return;

  const winCheck = canPairingWinMatch(match, winningTeam);
  if (!winCheck.allowed) {
    showToast(winCheck.reason, 'warning');
    return;
  }

  const freedTable = match.tableNumber;
  match.winner = winningTeam;
  match.status = 'completed';
  match.tableNumber = null;
  match.skipped = false;
  match.isRevising = false;

  saveState();
  renderRoundRobin();

  const nextSuggestions = getSuggestedNextMatches();
  if (nextSuggestions.length > 0 && freedTable) {
    const nextMatch = nextSuggestions[0].match;
    const pNames = `${getPlayerName(nextMatch.teamA[0])} & ${getPlayerName(nextMatch.teamA[1])} vs ${getPlayerName(nextMatch.teamB[0])} & ${getPlayerName(nextMatch.teamB[1])}`;
    showToast(`Table ${freedTable} open! Next up: Game #${nextMatch.seqIndex} (${pNames})`, 'success');
  } else {
    showToast(`Game #${match.seqIndex} completed!`, 'success');
  }
}

function advanceMatchOvertime(roundIdx, matchIdx) {
  const match = state.rounds[roundIdx].matches[matchIdx];
  if (!match) return;
  if (match.status === 'completed' && !match.isRevising) return;

  const currentTarget = getMatchMaxCupsPerPairing(match);
  const effA = getPairingEffectiveCups(match, 'A');
  const effB = getPairingEffectiveCups(match, 'B');
  const currentStage = formatOtStageLabel(match.otLevel || 0);

  if (effA !== currentTarget || effB !== currentTarget) {
    showToast(
      `Both pairings must tie at ${currentTarget} effective cups in ${currentStage} before starting the next OT.`,
      'warning'
    );
    return;
  }

  match.otLevel = (match.otLevel || 0) + 1;
  saveState();
  renderRoundRobin();
  const newTarget = getMatchMaxCupsPerPairing(match);
  const newStage = formatOtStageLabel(match.otLevel);
  showToast(`🔥 ${newStage} started for Game #${match.seqIndex}! Target is now ${newTarget} effective cups.`, 'info');
}

function undoMatchOvertime(roundIdx, matchIdx) {
  const match = state.rounds[roundIdx].matches[matchIdx];
  if (!match || !match.otLevel || match.otLevel <= 0) return;
  if (match.status === 'completed' && !match.isRevising) return;

  const sdBonus = state.config.suddenDeathCups === 3 ? 3 : 1;
  const prevTarget = 10 + ((match.otLevel - 1) * sdBonus);
  const effA = getPairingEffectiveCups(match, 'A');
  const effB = getPairingEffectiveCups(match, 'B');
  const prevStage = formatOtStageLabel(match.otLevel - 1);

  if (effA > prevTarget || effB > prevTarget) {
    showToast(`Reduce both pairings to ${prevTarget} effective cups or fewer before returning to ${prevStage}.`, 'warning');
    return;
  }

  match.otLevel = match.otLevel - 1;
  saveState();
  renderRoundRobin();
  showToast(`Returned Game #${match.seqIndex} to ${prevStage} (Target: ${prevTarget}).`, 'info');
}

function toggleReviseCompletedMatch(roundIdx, matchIdx) {
  const match = state.rounds[roundIdx].matches[matchIdx];
  if (!match || match.status !== 'completed') return;
  match.isRevising = !match.isRevising;
  saveState();
  renderRoundRobin();
  if (match.isRevising) {
    showToast(`Revision unlocked for Game #${match.seqIndex}.`, 'info');
  } else {
    showToast(`Revisions saved & Game #${match.seqIndex} locked.`, 'success');
  }
}

function toggleCompletedMatchWinner(roundIdx, matchIdx) {
  const match = state.rounds[roundIdx].matches[matchIdx];
  if (!match || match.status !== 'completed' || !match.isRevising) return;
  const newWinner = match.winner === 'A' ? 'B' : 'A';
  const winCheck = canPairingWinMatch(match, newWinner);
  if (!winCheck.allowed) {
    showToast(winCheck.reason, 'warning');
    return;
  }
  match.winner = newWinner;
  saveState();
  renderRoundRobin();
  showToast(`Updated Game #${match.seqIndex} winner to Pair ${match.winner}.`, 'info');
}

function reopenCompletedMatch(roundIdx, matchIdx) {
  const match = state.rounds[roundIdx].matches[matchIdx];
  if (!match || match.status !== 'completed') return;
  match.winner = null;
  match.status = 'pending';
  match.tableNumber = null;
  match.skipped = true;
  match.isRevising = false;
  saveState();
  renderRoundRobin();
  showToast(`Game #${match.seqIndex} reopened and placed at top of queue.`, 'info');
}

function adjustMatchStat(roundIdx, matchIdx, playerId, statKey, delta) {
  const match = state.rounds[roundIdx].matches[matchIdx];
  if (!match || (match.status === 'completed' && !match.isRevising)) return;
  if (!match.stats[playerId]) {
    match.stats[playerId] = {};
  }
  const current = match.stats[playerId][statKey] || 0;
  const next = Math.max(0, current + delta);
  const sdBonus = state.config.suddenDeathCups === 3 ? 3 : 1;
  const otLevel = match.otLevel || 0;
  const stageName = formatOtStageLabel(otLevel);
  const nextStageName = formatOtStageLabel(otLevel + 1);

  if (statKey === 'cups' && delta > 0) {
    const side = match.teamA.includes(playerId) ? 'A' : 'B';
    const effSide = getPairingEffectiveCups(match, side);
    const maxCups = getMatchMaxCupsPerPairing(match);
    if (effSide >= maxCups) {
      showToast(
        `${stageName} cap reached (${maxCups} effective cups = Cups + Opp Errors). If tied, click "Start ${nextStageName}" (+${sdBonus}).`,
        'warning'
      );
      return;
    }
  }

  if (statKey === 'err' && delta > 0) {
    const benefittingSide = match.teamA.includes(playerId) ? 'B' : 'A';
    const effBenefitting = getPairingEffectiveCups(match, benefittingSide);
    const maxCups = getMatchMaxCupsPerPairing(match);
    if (effBenefitting >= maxCups) {
      showToast(
        `Pair ${benefittingSide} is already at ${maxCups} effective cups (${stageName}). Click "Start ${nextStageName}" (+${sdBonus}) if tied.`,
        'warning'
      );
      return;
    }
  }

  match.stats[playerId][statKey] = next;
  saveState();
  renderRoundRobin();
}

function simulateRemainingMatches() {
  let simulatedCount = 0;
  const enabledStats = getEnabledStatDefinitions();
  const sdBonus = state.config.suddenDeathCups === 3 ? 3 : 1;

  state.rounds.forEach(round => {
    round.matches.forEach(match => {
      if (match.status !== 'completed') {
        match.winner = Math.random() < 0.5 ? 'A' : 'B';
        match.status = 'completed';
        match.tableNumber = null;
        match.skipped = false;
        match.isRevising = false;

        const roll = Math.random();
        const otRounds = roll < 0.14 ? 1 : (roll < 0.19 ? 2 : 0);
        match.otLevel = otRounds;

        const winPair = match.winner === 'A' ? match.teamA : match.teamB;
        const losePair = match.winner === 'A' ? match.teamB : match.teamA;

        const targetAllowed = 10 + (otRounds * sdBonus);
        const loseErrTotal = Math.floor(Math.random() * 2);
        const winCupsNeeded = Math.max(0, targetAllowed - loseErrTotal);
        const winP1Cups = Math.floor(Math.random() * (winCupsNeeded + 1));
        const winP2Cups = winCupsNeeded - winP1Cups;

        const loseTargetEff = otRounds > 0
          ? (targetAllowed - 1)
          : (Math.floor(Math.random() * 8) + 2);
        const winErrTotal = Math.min(1, loseTargetEff);
        const loseCupsNeeded = Math.max(0, loseTargetEff - winErrTotal);
        const loseP1Cups = Math.floor(Math.random() * (loseCupsNeeded + 1));
        const loseP2Cups = loseCupsNeeded - loseP1Cups;

        winPair.forEach((pid, idx) => {
          match.stats[pid] = {};
          enabledStats.forEach(st => {
            if (st.key === 'cups') match.stats[pid][st.key] = idx === 0 ? winP1Cups : winP2Cups;
            else if (st.key === 'err') match.stats[pid][st.key] = idx === 0 ? winErrTotal : 0;
            else if (st.weight < 0) match.stats[pid][st.key] = Math.floor(Math.random() * 2);
            else match.stats[pid][st.key] = Math.floor(Math.random() * 3);
          });
        });

        losePair.forEach((pid, idx) => {
          match.stats[pid] = {};
          enabledStats.forEach(st => {
            if (st.key === 'cups') match.stats[pid][st.key] = idx === 0 ? loseP1Cups : loseP2Cups;
            else if (st.key === 'err') match.stats[pid][st.key] = idx === 0 ? loseErrTotal : 0;
            else if (st.weight < 0) match.stats[pid][st.key] = Math.floor(Math.random() * 2);
            else match.stats[pid][st.key] = Math.floor(Math.random() * 2);
          });
        });

        simulatedCount++;
      }
    });
  });

  if (simulatedCount === 0) {
    showToast('All Round-Robin matches are already completed!', 'info');
  } else {
    saveState();
    renderRoundRobin();
    showToast(`Simulated ${simulatedCount} remaining match${simulatedCount > 1 ? 'es' : ''}!`, 'success');
  }
}
