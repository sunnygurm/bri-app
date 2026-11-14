/**
 * Tab 3: Standings & Tie-Breakers
 */
function computeStandings() {
  const enabledStats = getEnabledStatDefinitions();
  const map = {};
  state.players.forEach(p => {
    const statTotals = {};
    enabledStats.forEach(st => { statTotals[st.key] = 0; });
    map[p.id] = {
      playerId: p.id,
      name: p.name,
      wins: 0,
      losses: 0,
      games: 0,
      winPct: 0,
      statTotals,
      netStatScore: 0
    };
  });

  state.rounds.forEach(round => {
    round.matches.forEach(match => {
      if (match.status !== 'completed' || !match.winner) return;
      const winners = match.winner === 'A' ? match.teamA : match.teamB;
      const losers = match.winner === 'A' ? match.teamB : match.teamA;

      winners.forEach(pid => {
        if (map[pid]) {
          map[pid].wins++;
          map[pid].games++;
        }
      });
      losers.forEach(pid => {
        if (map[pid]) {
          map[pid].losses++;
          map[pid].games++;
        }
      });

      [...match.teamA, ...match.teamB].forEach(pid => {
        if (map[pid] && match.stats[pid]) {
          enabledStats.forEach(st => {
            map[pid].statTotals[st.key] += (match.stats[pid][st.key] || 0);
          });
        }
      });
    });
  });

  const list = Object.values(map).map(entry => {
    entry.winPct = entry.games > 0 ? (entry.wins / entry.games) : 0;
    entry.netStatScore = enabledStats.reduce((acc, st) => {
      return acc + (entry.statTotals[st.key] || 0) * st.weight;
    }, 0);
    return entry;
  });

  list.sort((a, b) => {
    if (Math.abs(b.winPct - a.winPct) > 0.00001) return b.winPct - a.winPct;
    if (b.netStatScore !== a.netStatScore) return b.netStatScore - a.netStatScore;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.name.localeCompare(b.name);
  });

  return list;
}

/**
 * Tab 4: High-Low Playoff Team Seeding & Single-Elimination Bracket
 */
function generatePlayoffTeamsFromStandings(silent = false) {
  const standings = computeStandings();
  const teams = [];
  let seedCounter = 1;

  for (let i = 0; i < standings.length; i += 2) {
    const p1 = standings[i];
    const p2 = standings[i + 1];

    if (p2) {
      teams.push({
        id: generateId('team'),
        seed: seedCounter++,
        name: `${p1.name} & ${p2.name}`,
        playerIds: [p1.playerId, p2.playerId],
        ranks: [i + 1, i + 2],
        isSolo: false
      });
    } else {
      teams.push({
        id: generateId('team'),
        seed: seedCounter++,
        name: `${p1.name} (Solo)`,
        playerIds: [p1.playerId],
        ranks: [i + 1],
        isSolo: true
      });
    }
  }

  state.playoffTeams = teams;
  if (!silent) saveState();
  return teams;
}

function seedAndLaunchBracket() {
  generatePlayoffTeamsFromStandings(true);
  buildPlayoffBracket(true);
  saveState();
  switchTab('bracket');
  showToast(`Paired ${state.playoffTeams.length} Playoff Teams & launched Bracket!`, 'success');
}

function promptReseedPlayoffs() {
  openConfirmModal(
    'Re-Seed Playoff Teams & Reset Bracket?',
    'This will recalculate High-Low playoff pairs from current Standings and reset all playoff series scores.',
    () => {
      generatePlayoffTeamsFromStandings(true);
      buildPlayoffBracket(true);
      saveState();
      renderBracket();
      showToast('Playoff teams re-seeded and bracket rebuilt.', 'info');
    }
  );
}
