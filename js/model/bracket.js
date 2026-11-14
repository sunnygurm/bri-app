function buildPlayoffBracket(silent = false) {
  const teams = [...state.playoffTeams];
  const T = teams.length;
  if (T < 2) {
    if (!silent) showToast('Need at least 2 playoff teams to build a bracket.', 'error');
    return;
  }

  let lowerPow2 = 1;
  while (lowerPow2 * 2 <= T) lowerPow2 *= 2;

  const rounds = [];

  if (T === lowerPow2) {
    const mainSeedOrder = getSeedOrderForBracket(T);
    const initialMatches = [];
    for (let i = 0; i < mainSeedOrder.length; i += 2) {
      const tA = teams[mainSeedOrder[i] - 1];
      const tB = teams[mainSeedOrder[i + 1] - 1];
      initialMatches.push(createBracketMatch(tA, tB, T === 2 ? 5 : 3));
    }
    rounds.push({
      title: getRoundTitle(T),
      bestOf: T === 2 ? 5 : 3,
      matches: initialMatches
    });
  } else if (state.config.unevenMode === 'playin') {
    const numPlayInMatches = T - lowerPow2;
    const safeCount = T - 2 * numPlayInMatches;
    const playInTeams = teams.slice(safeCount);
    const playInMatches = [];

    for (let i = 0; i < numPlayInMatches; i++) {
      const highPlayIn = playInTeams[i];
      const lowPlayIn = playInTeams[playInTeams.length - 1 - i];
      playInMatches.push(createBracketMatch(highPlayIn, lowPlayIn, 3, true));
    }

    rounds.push({
      title: 'Play-In Round',
      bestOf: 3,
      matches: playInMatches
    });

    const mainSeedOrder = getSeedOrderForBracket(lowerPow2);
    const mainMatches = [];
    for (let i = 0; i < mainSeedOrder.length; i += 2) {
      const seedA = mainSeedOrder[i];
      const seedB = mainSeedOrder[i + 1];

      const matchObj = createBracketMatch(
        seedA <= safeCount ? teams[seedA - 1] : null,
        seedB <= safeCount ? teams[seedB - 1] : null,
        lowerPow2 === 2 ? 5 : 3
      );

      if (seedA > safeCount) {
        const piIdx = seedA - safeCount - 1;
        matchObj.sourceA = { roundIdx: 0, matchIdx: piIdx };
        matchObj.placeholderA = `Winner Play-In #${piIdx + 1}`;
      }
      if (seedB > safeCount) {
        const piIdx = seedB - safeCount - 1;
        matchObj.sourceB = { roundIdx: 0, matchIdx: piIdx };
        matchObj.placeholderB = `Winner Play-In #${piIdx + 1}`;
      }

      mainMatches.push(matchObj);
    }

    rounds.push({
      title: getRoundTitle(lowerPow2),
      bestOf: lowerPow2 === 2 ? 5 : 3,
      matches: mainMatches
    });
  } else {
    const upperPow2 = lowerPow2 * 2;
    const mainSeedOrder = getSeedOrderForBracket(upperPow2);
    const firstRoundMatches = [];

    for (let i = 0; i < mainSeedOrder.length; i += 2) {
      const seedA = mainSeedOrder[i];
      const seedB = mainSeedOrder[i + 1];
      const tA = seedA <= T ? teams[seedA - 1] : null;
      const tB = seedB <= T ? teams[seedB - 1] : null;

      const m = createBracketMatch(tA, tB, upperPow2 === 2 ? 5 : 3);
      if (tA && !tB) {
        m.isBye = true;
        m.winnerTeamId = tA.id;
      } else if (!tA && tB) {
        m.isBye = true;
        m.winnerTeamId = tB.id;
      }
      firstRoundMatches.push(m);
    }

    rounds.push({
      title: getRoundTitle(upperPow2),
      bestOf: upperPow2 === 2 ? 5 : 3,
      matches: firstRoundMatches
    });
  }

  while (rounds[rounds.length - 1].matches.length > 1) {
    const prevRoundIdx = rounds.length - 1;
    const prevMatches = rounds[prevRoundIdx].matches;
    const nextMatchCount = prevMatches.length / 2;
    const isFinals = nextMatchCount === 1;
    const bestOf = isFinals ? 5 : 3;
    const nextMatches = [];

    for (let i = 0; i < nextMatchCount; i++) {
      const m = createBracketMatch(null, null, bestOf);
      m.sourceA = { roundIdx: prevRoundIdx, matchIdx: i * 2 };
      m.sourceB = { roundIdx: prevRoundIdx, matchIdx: i * 2 + 1 };
      m.placeholderA = `Winner ${rounds[prevRoundIdx].title} #${i * 2 + 1}`;
      m.placeholderB = `Winner ${rounds[prevRoundIdx].title} #${i * 2 + 2}`;
      nextMatches.push(m);
    }

    rounds.push({
      title: getRoundTitle(nextMatchCount * 2),
      bestOf,
      matches: nextMatches
    });
  }

  state.bracket = { rounds };
  propagateBracketWinners();
  if (!silent) {
    saveState();
    switchTab('bracket');
    showToast('Playoff Bracket generated!', 'success');
  }
}

function createBracketMatch(teamA, teamB, bestOf, isPlayIn = false) {
  return {
    id: generateId('bm'),
    teamA,
    teamB,
    scoreA: 0,
    scoreB: 0,
    bestOf,
    winnerTeamId: null,
    isPlayIn,
    isBye: false,
    sourceA: null,
    sourceB: null,
    placeholderA: 'TBD',
    placeholderB: 'TBD'
  };
}

function getSeedOrderForBracket(size) {
  let seeds = [1, 2];
  while (seeds.length < size) {
    const nextSum = seeds.length * 2 + 1;
    const expanded = [];
    for (const s of seeds) {
      expanded.push(s, nextSum - s);
    }
    seeds = expanded;
  }
  return seeds;
}

function getRoundTitle(numTeamsInRound) {
  if (numTeamsInRound === 2) return 'Championship Finals';
  if (numTeamsInRound === 4) return 'Semifinals';
  if (numTeamsInRound === 8) return 'Quarterfinals';
  return `Round of ${numTeamsInRound}`;
}

function adjustSeriesScore(roundIdx, matchIdx, side, delta) {
  const match = state.bracket.rounds[roundIdx].matches[matchIdx];
  if (!match || !match.teamA || !match.teamB || match.isBye) return;

  const winsNeeded = Math.ceil(match.bestOf / 2);

  if (side === 'A') {
    match.scoreA = Math.max(0, Math.min(winsNeeded, match.scoreA + delta));
    if (match.scoreA === winsNeeded && match.scoreB === winsNeeded) {
      match.scoreB = winsNeeded - 1;
    }
  } else {
    match.scoreB = Math.max(0, Math.min(winsNeeded, match.scoreB + delta));
    if (match.scoreB === winsNeeded && match.scoreA === winsNeeded) {
      match.scoreA = winsNeeded - 1;
    }
  }

  if (match.scoreA >= winsNeeded) {
    match.winnerTeamId = match.teamA.id;
  } else if (match.scoreB >= winsNeeded) {
    match.winnerTeamId = match.teamB.id;
  } else {
    match.winnerTeamId = null;
  }

  propagateBracketWinners();
  saveState();
  renderBracket();
}

function propagateBracketWinners() {
  if (!state.bracket) return;
  const rounds = state.bracket.rounds;

  for (let r = 1; r < rounds.length; r++) {
    for (const match of rounds[r].matches) {
      if (match.sourceA) {
        const srcMatch = rounds[match.sourceA.roundIdx].matches[match.sourceA.matchIdx];
        const resolvedTeam = getWinnerTeamObject(srcMatch);
        if ((match.teamA && match.teamA.id) !== (resolvedTeam && resolvedTeam.id)) {
          match.teamA = resolvedTeam;
          match.scoreA = 0;
          match.scoreB = 0;
          match.winnerTeamId = null;
        }
      }
      if (match.sourceB) {
        const srcMatch = rounds[match.sourceB.roundIdx].matches[match.sourceB.matchIdx];
        const resolvedTeam = getWinnerTeamObject(srcMatch);
        if ((match.teamB && match.teamB.id) !== (resolvedTeam && resolvedTeam.id)) {
          match.teamB = resolvedTeam;
          match.scoreA = 0;
          match.scoreB = 0;
          match.winnerTeamId = null;
        }
      }
    }
  }
}

function getWinnerTeamObject(match) {
  if (!match || !match.winnerTeamId) return null;
  if (match.teamA && match.teamA.id === match.winnerTeamId) return match.teamA;
  if (match.teamB && match.teamB.id === match.winnerTeamId) return match.teamB;
  return null;
}
