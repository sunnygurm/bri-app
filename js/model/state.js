const STORAGE_KEY = 'pongmaster_bri_tournament_v2';

const MIN_PLAYERS = 4;
const MAX_PLAYERS = 30;

const DEFAULT_STAT_DEFINITIONS = [
  { key: 'cups', label: 'Cups Hit', shortLabel: 'Cups', weight: 1, enabled: true, color: 'text-emerald-300' },
  { key: 'def', label: 'Defensive Plays', shortLabel: 'Def', weight: 1, enabled: true, color: 'text-sky-300' },
  { key: 'arm', label: 'Armageddons', shortLabel: 'Arm', weight: 1, enabled: true, color: 'text-amber-300' },
  { key: 'cujo', label: 'Cujo', shortLabel: 'Cujo', weight: 1, enabled: true, color: 'text-purple-300' },
  { key: 'err', label: 'Errors', shortLabel: 'Err', weight: -1, enabled: true, color: 'text-rose-400' }
];

const SAMPLE_NAMES = [
  'Alex', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Morgan',
  'Sam', 'Quinn', 'Avery', 'Cameron', 'Drew', 'Logan',
  'Blake', 'Parker', 'Reese', 'Hayden', 'Dakota', 'Skyler',
  'Peyton', 'Rowan', 'Charlie', 'Finley', 'Emerson', 'Sawyer',
  'Kendall', 'Tatum', 'Phoenix', 'River', 'Micah', 'Justice'
];

function createDefaultState() {
  return {
    schemaVersion: 2,
    activeTab: 'setup',
    players: [],
    config: {
      format: 'rotating',
      numTables: 2,
      maxGamesPerPlayer: 12,
      unevenMode: 'playin',
      suddenDeathCups: 1,
      statDefinitions: JSON.parse(JSON.stringify(DEFAULT_STAT_DEFINITIONS))
    },
    fixedPairs: [],
    scheduleFormat: 'rotating',
    scheduleTeams: [],
    rounds: [],
    roundFilter: 'all',
    playoffTeams: [],
    bracket: null
  };
}

let state = createDefaultState();

/**
 * Defensive Schema Migration & LocalStorage Persistence
 */
function normalizeState(raw) {
  const base = createDefaultState();
  if (!raw || typeof raw !== 'object') return base;

  const validTabs = new Set(['setup', 'roundrobin', 'standings', 'bracket']);
  const merged = {
    ...base,
    ...raw,
    schemaVersion: 2,
    activeTab: validTabs.has(raw.activeTab) ? raw.activeTab : 'setup',
    players: Array.isArray(raw.players) ? raw.players.filter(p => p && p.id && p.name) : [],
    rounds: Array.isArray(raw.rounds) ? raw.rounds : [],
    roundFilter: raw.roundFilter !== undefined ? raw.roundFilter : 'all',
    playoffTeams: Array.isArray(raw.playoffTeams) ? raw.playoffTeams : [],
    bracket: (raw.bracket && Array.isArray(raw.bracket.rounds)) ? raw.bracket : null
  };

  const rawCfg = (raw.config && typeof raw.config === 'object') ? raw.config : {};
  merged.config = {
    format: rawCfg.format === 'fixed' ? 'fixed' : 'rotating',
    numTables: Math.min(6, Math.max(1, parseInt(rawCfg.numTables, 10) || 2)),
    maxGamesPerPlayer: rawCfg.maxGamesPerPlayer === 'full'
      ? 'full'
      : (parseInt(rawCfg.maxGamesPerPlayer, 10) || 12),
    unevenMode: rawCfg.unevenMode === 'byes' ? 'byes' : 'playin',
    suddenDeathCups: parseInt(rawCfg.suddenDeathCups, 10) === 3 ? 3 : 1,
    statDefinitions: Array.isArray(rawCfg.statDefinitions) && rawCfg.statDefinitions.length > 0
      ? rawCfg.statDefinitions.map(sd => ({
          key: String(sd.key || 'stat_' + Math.random().toString(36).slice(2, 6)),
          label: String(sd.label || 'Stat'),
          shortLabel: String(sd.shortLabel || sd.label || 'Stat').slice(0, 6),
          weight: Number(sd.weight) === -1 ? -1 : 1,
          enabled: Boolean(sd.enabled),
          color: String(sd.color || (Number(sd.weight) === -1 ? 'text-rose-400' : 'text-emerald-300'))
        }))
      : JSON.parse(JSON.stringify(DEFAULT_STAT_DEFINITIONS))
  };

  if (!merged.config.statDefinitions.some(s => s.enabled)) {
    merged.config.statDefinitions[0].enabled = true;
  }

  const playerIds = new Set(merged.players.map(p => p.id));
  const pairedIds = new Set();
  merged.fixedPairs = (Array.isArray(raw.fixedPairs) ? raw.fixedPairs : []).filter(pair => {
    if (!Array.isArray(pair) || pair.length !== 2 || pair[0] === pair[1]) return false;
    if (!pair.every(id => playerIds.has(id) && !pairedIds.has(id))) return false;
    pair.forEach(id => pairedIds.add(id));
    return true;
  });
  merged.scheduleFormat = raw.scheduleFormat === 'fixed' ? 'fixed' : 'rotating';
  merged.scheduleTeams = Array.isArray(raw.scheduleTeams)
    ? raw.scheduleTeams.filter(team => Array.isArray(team) && team.length > 0)
    : [];

  let seq = 1;
  merged.rounds = merged.rounds.map((r, rIdx) => {
    const matches = Array.isArray(r.matches) ? r.matches.map(m => {
      const teamA = Array.isArray(m.teamA) ? m.teamA : [];
      const teamB = Array.isArray(m.teamB) ? m.teamB : [];
      const stats = (m.stats && typeof m.stats === 'object') ? m.stats : {};
      [...teamA, ...teamB].forEach(pid => {
        if (!stats[pid] || typeof stats[pid] !== 'object') stats[pid] = {};
        merged.config.statDefinitions.forEach(sd => {
          if (typeof stats[pid][sd.key] !== 'number' || Number.isNaN(stats[pid][sd.key])) {
            stats[pid][sd.key] = 0;
          }
        });
      });

      const status = (m.status === 'active' || m.status === 'completed' || m.status === 'pending')
        ? m.status
        : (m.winner ? 'completed' : 'pending');

      const otLevel = (typeof m.otLevel === 'number' && m.otLevel >= 0)
        ? m.otLevel
        : (m.suddenDeath ? 1 : 0);

      return {
        id: m.id || generateId('m'),
        seqIndex: typeof m.seqIndex === 'number' ? m.seqIndex : seq++,
        teamA,
        teamB,
        winner: (m.winner === 'A' || m.winner === 'B') ? m.winner : null,
        status,
        tableNumber: status === 'active' ? (parseInt(m.tableNumber, 10) || 1) : null,
        skipped: Boolean(m.skipped),
        otLevel,
        isRevising: status === 'completed' ? Boolean(m.isRevising) : false,
        stats
      };
    }) : [];

    return {
      roundNumber: typeof r.roundNumber === 'number' ? r.roundNumber : (rIdx + 1),
      matches,
      sitOuts: Array.isArray(r.sitOuts) ? r.sitOuts : []
    };
  });

  return merged;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    flashAutoSaveIndicator();
  } catch (err) {
    console.warn('Unable to save state to localStorage:', err);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = normalizeState(JSON.parse(raw));
    }
  } catch (err) {
    console.warn('Resetting corrupted localStorage state:', err);
    state = createDefaultState();
    saveState();
  }
}

function exportTournamentJson() {
  const payload = {
    app: 'PongMasterPro_BRI',
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    tournament: state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bri-pongmaster-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Tournament backup exported as JSON.', 'success');
}

function triggerImportJson() {
  const input = document.getElementById('import-json-input');
  if (input) input.click();
}

function handleImportJsonFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const candidate = parsed && parsed.tournament ? parsed.tournament : parsed;
      if (!candidate || !Array.isArray(candidate.players)) {
        throw new Error('Invalid tournament backup JSON file.');
      }
      state = normalizeState(candidate);
      saveState();
      switchTab(state.activeTab || 'setup');
      showToast(`Imported tournament (${state.players.length} players).`, 'success');
    } catch (err) {
      showToast(err.message || 'Could not import JSON file.', 'error');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateId(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
}

function getPlayerName(playerId) {
  const p = state.players.find(pl => pl.id === playerId);
  return p ? p.name : 'Unknown';
}

function formatTeamNames(playerIds) {
  return playerIds.map(getPlayerName).join(' & ');
}

function getEnabledStatDefinitions() {
  const defs = (state.config && Array.isArray(state.config.statDefinitions))
    ? state.config.statDefinitions
    : DEFAULT_STAT_DEFINITIONS;
  const enabled = defs.filter(d => d.enabled);
  return enabled.length > 0 ? enabled : defs.slice(0, 1);
}

/**
 * Tab 1: Setup, Roster & Configurable Stats
 */
function handleAddPlayer(e) {
  e.preventDefault();
  const input = document.getElementById('single-player-input');
  const name = input.value.trim();
  if (!name) return;

  if (state.players.length >= MAX_PLAYERS) {
    showToast(`Maximum ${MAX_PLAYERS} participants allowed.`, 'error');
    return;
  }
  if (state.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    showToast(`"${name}" is already in the roster.`, 'warning');
    return;
  }

  state.players.push({ id: generateId('p'), name });
  input.value = '';
  saveState();
  renderSetup();
}

function handleBulkAddPlayers() {
  const textarea = document.getElementById('bulk-player-input');
  const raw = textarea.value.trim();
  if (!raw) return;

  const names = raw.split(/[\n,]+/).map(n => n.trim()).filter(Boolean);
  let added = 0;

  for (const name of names) {
    if (state.players.length >= MAX_PLAYERS) break;
    const cleanName = name.slice(0, 28);
    if (!state.players.some(p => p.name.toLowerCase() === cleanName.toLowerCase())) {
      state.players.push({ id: generateId('p'), name: cleanName });
      added++;
    }
  }

  textarea.value = '';
  saveState();
  renderSetup();
  if (added > 0) {
    showToast(`Added ${added} participant${added > 1 ? 's' : ''}.`, 'success');
  } else {
    showToast(`No new unique participants added (Max ${MAX_PLAYERS}).`, 'warning');
  }
}

function removePlayer(playerId) {
  state.players = state.players.filter(p => p.id !== playerId);
  state.fixedPairs = state.fixedPairs.filter(pair => !pair.includes(playerId));
  saveState();
  renderSetup();
}

function clearRoster() {
  state.players = [];
  state.fixedPairs = [];
  saveState();
  renderSetup();
}

function loadSampleRoster(count) {
  const slice = SAMPLE_NAMES.slice(0, Math.min(MAX_PLAYERS, count));
  state.players = slice.map(name => ({ id: generateId('p'), name }));
  state.fixedPairs = [];
  saveState();
  renderSetup();
  showToast(`Loaded ${slice.length} sample participants.`, 'info');
}

function getUnpairedPlayers() {
  const paired = new Set(state.fixedPairs.flat());
  return state.players.filter(p => !paired.has(p.id));
}

function handleCreatePair() {
  const idA = document.getElementById('pair-player-a').value;
  const idB = document.getElementById('pair-player-b').value;
  const unpairedIds = new Set(getUnpairedPlayers().map(p => p.id));
  if (!idA || !idB || idA === idB || !unpairedIds.has(idA) || !unpairedIds.has(idB)) {
    showToast('Pick two different unpaired players.', 'warning');
    return;
  }
  state.fixedPairs.push([idA, idB]);
  saveState();
  renderSetup();
}

function removePair(pairIdx) {
  state.fixedPairs.splice(pairIdx, 1);
  saveState();
  renderSetup();
}

function updateConfig() {
  state.config.format = document.getElementById('config-format').value === 'fixed' ? 'fixed' : 'rotating';
  const numTablesVal = parseInt(document.getElementById('config-num-tables').value, 10) || 2;
  const maxGamesVal = document.getElementById('config-max-games').value;
  const unevenVal = document.getElementById('config-uneven-mode').value;
  const suddenDeathVal = parseInt(document.getElementById('config-sudden-death').value, 10);

  state.config.numTables = Math.min(6, Math.max(1, numTablesVal));
  state.config.maxGamesPerPlayer = maxGamesVal === 'full' ? 'full' : (parseInt(maxGamesVal, 10) || 12);
  state.config.unevenMode = unevenVal === 'byes' ? 'byes' : 'playin';
  state.config.suddenDeathCups = suddenDeathVal === 3 ? 3 : 1;

  saveState();
  renderSetup();
}

function toggleStatDefinition(statKey) {
  const defs = state.config.statDefinitions || [];
  const target = defs.find(d => d.key === statKey);
  if (!target) return;
  const enabledCount = defs.filter(d => d.enabled).length;
  if (target.enabled && enabledCount <= 1) {
    showToast('At least one game stat must remain enabled.', 'warning');
    return;
  }
  target.enabled = !target.enabled;
  saveState();
  renderSetup();
}

function handleAddCustomStat() {
  const input = document.getElementById('new-stat-label');
  const weightSelect = document.getElementById('new-stat-weight');
  const label = input.value.trim();
  if (!label) return;

  const defs = state.config.statDefinitions || [];
  if (defs.some(d => d.label.toLowerCase() === label.toLowerCase())) {
    showToast(`"${label}" is already in the tracked stats list.`, 'warning');
    return;
  }

  const weight = parseInt(weightSelect.value, 10) === -1 ? -1 : 1;
  const key = 'stat_' + label.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Math.random().toString(36).slice(2, 5);
  defs.push({
    key,
    label,
    shortLabel: label.slice(0, 6),
    weight,
    enabled: true,
    color: weight < 0 ? 'text-rose-400' : 'text-teal-300'
  });

  input.value = '';
  saveState();
  renderSetup();
  showToast(`Added custom stat "${label}" (${weight > 0 ? '+1' : '-1'}).`, 'success');
}

function removeCustomStat(statKey) {
  const defs = state.config.statDefinitions || [];
  const target = defs.find(d => d.key === statKey);
  if (!target) return;
  if (target.enabled && defs.filter(d => d.enabled).length <= 1) {
    showToast('At least one game stat must remain enabled.', 'warning');
    return;
  }
  state.config.statDefinitions = defs.filter(d => d.key !== statKey);
  saveState();
  renderSetup();
}

function resetDefaultStats() {
  state.config.statDefinitions = JSON.parse(JSON.stringify(DEFAULT_STAT_DEFINITIONS));
  saveState();
  renderSetup();
  showToast('Restored default stats (Cups Hit, Defense, Armageddons, Cujo, Errors).', 'info');
}

/**
 * Reset Entire Tournament
 */
function promptResetTournament() {
  openConfirmModal(
    'Reset Entire Tournament?',
    'This will clear all players, Round-Robin schedules, stats, and playoff brackets.',
    () => {
      localStorage.removeItem(STORAGE_KEY);
      state = createDefaultState();
      saveState();
      switchTab('setup');
      showToast('Tournament reset.', 'info');
    }
  );
}
