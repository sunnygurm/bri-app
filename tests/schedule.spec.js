const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect } = require('@playwright/test');

const PLAYER_COUNTS = Array.from({ length: 27 }, (_, i) => i + 4);
const ROTATING_TRIALS = 25;

function loadScheduler() {
  const context = {
    console,
    localStorage: { getItem: () => null, setItem: () => {} },
    document: { getElementById: () => null }
  };
  vm.createContext(context);
  for (const file of ['js/model/state.js', 'js/model/schedule.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  }
  return context;
}

function makePlayers(count) {
  return Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `Player ${i}` }));
}

function pairInOrder(players) {
  const teams = [];
  for (let i = 0; i < players.length; i += 2) {
    teams.push(players.slice(i, i + 2).map(p => p.id));
  }
  return teams;
}

function teamKey(team) {
  return [...team].sort().join('+');
}

const app = loadScheduler();

test.describe('fixed partners: every team plays every other team exactly once', () => {
  for (const count of PLAYER_COUNTS) {
    test(`${count} players`, () => {
      const teams = pairInOrder(makePlayers(count));
      const teamCount = teams.length;
      const rounds = app.buildFixedPartnerSchedule(teams);

      expect(teams.filter(t => t.length === 1)).toHaveLength(count % 2);
      expect(rounds).toHaveLength(teamCount % 2 === 0 ? teamCount - 1 : teamCount);

      const meetings = new Map();
      const gamesPerTeam = new Map(teams.map(t => [teamKey(t), 0]));
      const byesPerTeam = new Map(teams.map(t => [teamKey(t), 0]));

      for (const round of rounds) {
        const seenThisRound = new Set();
        for (const match of round.matches) {
          const a = teamKey(match.teamA);
          const b = teamKey(match.teamB);
          expect(a).not.toBe(b);
          expect(seenThisRound.has(a) || seenThisRound.has(b)).toBe(false);
          seenThisRound.add(a);
          seenThisRound.add(b);

          const key = [a, b].sort().join(' vs ');
          meetings.set(key, (meetings.get(key) || 0) + 1);
          gamesPerTeam.set(a, gamesPerTeam.get(a) + 1);
          gamesPerTeam.set(b, gamesPerTeam.get(b) + 1);
        }
        if (round.sitOuts.length > 0) {
          const bye = teamKey(round.sitOuts);
          expect(seenThisRound.has(bye)).toBe(false);
          byesPerTeam.set(bye, byesPerTeam.get(bye) + 1);
        }
      }

      expect(meetings.size).toBe(teamCount * (teamCount - 1) / 2);
      for (const times of meetings.values()) expect(times).toBe(1);
      for (const games of gamesPerTeam.values()) expect(games).toBe(teamCount - 1);
      for (const byes of byesPerTeam.values()) expect(byes).toBe(teamCount % 2);
    });
  }
});

test.describe('rotating partners: balanced games and no double-booking', () => {
  for (const count of PLAYER_COUNTS) {
    test(`${count} players`, () => {
      const players = makePlayers(count);
      const cap = Math.min(12, count - 1);

      for (let trial = 0; trial < ROTATING_TRIALS; trial++) {
        const rounds = app.buildRotatingPartnerSchedule(players, 12);
        const games = new Map(players.map(p => [p.id, 0]));

        for (const round of rounds) {
          const busy = new Set();
          for (const match of round.matches) {
            const seats = [...match.teamA, ...match.teamB];
            expect(new Set(seats).size).toBe(4);
            for (const pid of seats) {
              expect(busy.has(pid)).toBe(false);
              busy.add(pid);
              games.set(pid, games.get(pid) + 1);
            }
          }
          for (const pid of round.sitOuts) expect(busy.has(pid)).toBe(false);
          expect(busy.size + round.sitOuts.length).toBe(count);
        }

        const totals = [...games.values()];
        expect(Math.max(...totals)).toBeLessThanOrEqual(cap);
        expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(1);
      }
    });
  }
});
