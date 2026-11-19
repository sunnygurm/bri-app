function flashAutoSaveIndicator() {
  const badge = document.getElementById('autosave-status');
  if (!badge) return;
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> Saved ${timeStr}`;
  badge.classList.add('border-emerald-500/40', 'text-emerald-300');
  clearTimeout(badge._timer);
  badge._timer = setTimeout(() => {
    badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Saved`;
    badge.classList.remove('border-emerald-500/40', 'text-emerald-300');
  }, 1600);
}

/**
 * UI Helpers: Toasts, Confirmation Modal, Escaping
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  const styles = {
    success: 'bg-emerald-950/95 border-emerald-500/60 text-emerald-200',
    error: 'bg-rose-950/95 border-rose-500/60 text-rose-200',
    warning: 'bg-amber-950/95 border-amber-500/60 text-amber-200',
    info: 'bg-slate-900/95 border-slate-600 text-slate-100'
  };
  const icons = {
    success: '✅',
    error: '⚠️',
    warning: '⚡',
    info: '🏓'
  };
  toast.className = `pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl border shadow-2xl text-xs sm:text-sm font-medium transition-all duration-300 transform translate-y-2 opacity-0 ${styles[type] || styles.info}`;
  toast.innerHTML = `<span class="text-base leading-none">${icons[type] || '🏓'}</span><span class="flex-1">${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3600);
}

function openConfirmModal(title, message, onConfirm) {
  const modal = document.getElementById('confirm-modal');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  const cancelBtn = document.getElementById('confirm-cancel-btn');
  const okBtn = document.getElementById('confirm-ok-btn');

  const cleanup = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    cancelBtn.onclick = null;
    okBtn.onclick = null;
  };

  cancelBtn.onclick = cleanup;
  okBtn.onclick = () => {
    cleanup();
    onConfirm();
  };
}

/**
 * Navigation & Tab Routing
 */
function switchTab(tabName) {
  if (tabName === 'roundrobin' && state.rounds.length === 0) {
    showToast('Generate the Round-Robin schedule first.', 'warning');
    tabName = 'setup';
  }
  if (tabName === 'standings' && state.rounds.length === 0) {
    showToast('Generate or play Round-Robin games first.', 'warning');
    tabName = 'setup';
  }
  if (tabName === 'bracket') {
    if (state.rounds.length === 0) {
      showToast('Complete Round Robin & Standings before launching the Playoff Bracket.', 'warning');
      tabName = 'setup';
    } else if (!state.bracket || state.playoffTeams.length < 2) {
      generatePlayoffTeamsFromStandings(true);
      buildPlayoffBracket(true);
    }
  }

  state.activeTab = tabName;
  saveState();

  document.querySelectorAll('.tab-view').forEach(el => el.classList.add('hidden'));
  const targetView = document.getElementById(`view-${tabName}`);
  if (targetView) targetView.classList.remove('hidden');

  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.className = 'nav-tab px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap text-slate-400 hover:text-white hover:bg-slate-800/80';
  });
  const activeNav = document.getElementById(`nav-${tabName}`);
  if (activeNav) {
    activeNav.className = 'nav-tab px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap bg-emerald-600 text-white shadow-md shadow-emerald-950';
  }

  if (tabName === 'setup') renderSetup();
  if (tabName === 'roundrobin') renderRoundRobin();
  if (tabName === 'standings') renderStandings();
  if (tabName === 'bracket') renderBracket();
}

function renderSetup() {
  const isFixed = state.config.format === 'fixed';
  document.getElementById('config-format').value = state.config.format;
  document.getElementById('config-max-games-wrap').classList.toggle('hidden', isFixed);
  document.getElementById('config-num-tables').value = String(state.config.numTables || 2);
  document.getElementById('config-max-games').value = String(state.config.maxGamesPerPlayer);
  document.getElementById('config-uneven-mode').value = state.config.unevenMode;
  document.getElementById('config-sudden-death').value = String(state.config.suddenDeathCups === 3 ? 3 : 1);

  const statsListEl = document.getElementById('stat-definitions-list');
  const defs = state.config.statDefinitions || DEFAULT_STAT_DEFINITIONS;
  const defaultKeys = new Set(DEFAULT_STAT_DEFINITIONS.map(d => d.key));

  statsListEl.innerHTML = defs.map(st => {
    const isCustom = !defaultKeys.has(st.key);
    return `
      <div class="flex items-center justify-between gap-2 bg-slate-900/90 border ${st.enabled ? 'border-slate-700' : 'border-slate-800/60 opacity-60'} rounded-xl px-3 py-2 transition">
        <label class="flex items-center gap-2.5 cursor-pointer flex-1 select-none">
          <input
            type="checkbox"
            ${st.enabled ? 'checked' : ''}
            onchange="toggleStatDefinition('${st.key}')"
            class="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
          />
          <span class="text-xs font-bold ${st.color || 'text-slate-200'}">${escapeHtml(st.label)}</span>
        </label>
        <div class="flex items-center gap-2">
          <span class="px-1.5 py-0.5 rounded text-[10px] font-extrabold ${st.weight > 0 ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'}">
            ${st.weight > 0 ? '+1' : '-1'}
          </span>
          ${isCustom ? `
            <button type="button" onclick="removeCustomStat('${st.key}')" class="text-slate-500 hover:text-rose-400 text-xs font-bold px-1" title="Remove custom stat">✕</button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  const count = state.players.length;
  const badge = document.getElementById('player-count-badge');
  badge.textContent = `${count} / ${MAX_PLAYERS} Players ${count < MIN_PLAYERS ? `(Min ${MIN_PLAYERS})` : '✓ Ready'}`;
  badge.className = count >= MIN_PLAYERS
    ? 'px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 self-start sm:self-auto'
    : 'px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 self-start sm:self-auto';

  const grid = document.getElementById('roster-grid');
  if (count === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-10 text-center border border-dashed border-slate-800 rounded-xl text-slate-500 text-sm">
        No participants added yet. Add ${MIN_PLAYERS} to ${MAX_PLAYERS} players above or click a Quick Test Roster button.
      </div>
    `;
  } else {
    grid.innerHTML = state.players.map((player, idx) => `
      <div class="flex items-center justify-between bg-slate-950/90 border border-slate-800 hover:border-slate-700 rounded-xl px-3 py-2 text-sm transition">
        <div class="flex items-center gap-2 truncate">
          <span class="text-xs font-bold text-slate-500 w-5">${idx + 1}.</span>
          <span class="font-semibold text-slate-200 truncate">${escapeHtml(player.name)}</span>
        </div>
        <button type="button" onclick="removePlayer('${player.id}')" class="text-slate-500 hover:text-rose-400 p-1 rounded-lg transition" title="Remove player">
          ✕
        </button>
      </div>
    `).join('');
  }

  renderFixedTeamsPanel(isFixed);

  const previewBox = document.getElementById('schedule-preview-box');
  if (count < MIN_PLAYERS) {
    const needed = MIN_PLAYERS - count;
    previewBox.innerHTML = `<div class="text-amber-300 font-medium">Add at least <strong>${needed} more player${needed === 1 ? '' : 's'}</strong> to unlock schedule generation.</div>`;
  } else {
    const numTables = state.config.numTables || 2;
    const maxPartnerCombos = count - 1;
    const targetGames = state.config.maxGamesPerPlayer === 'full'
      ? maxPartnerCombos
      : Math.min(state.config.maxGamesPerPlayer, maxPartnerCombos);
    const playoffTeamsCount = Math.ceil(count / 2);
    const hasSolo = count % 2 === 1;
    const sdBonus = state.config.suddenDeathCups === 3 ? 3 : 1;
    const gamesRow = isFixed
      ? `<div class="flex justify-between"><span>Round-Robin Games / Team:</span> <strong class="text-white">${playoffTeamsCount - 1} games (every team once)</strong></div>`
      : `<div class="flex justify-between"><span>Round-Robin Games / Player:</span> <strong class="text-white">~${targetGames} games</strong></div>`;

    previewBox.innerHTML = `
      <div class="flex justify-between"><span>Courts / Tables:</span> <strong class="text-emerald-300">${numTables} Table${numTables > 1 ? 's' : ''} (${numTables * 4} players active max)</strong></div>
      ${gamesRow}
      <div class="flex justify-between"><span>Effective Cup Target:</span> <strong class="text-sky-300">10 Reg / +${sdBonus} per OT (OT, 2OT, 3OT...)</strong></div>
      <div class="flex justify-between"><span>Playoff Teams:</span> <strong class="text-emerald-400">${playoffTeamsCount} Teams ${hasSolo ? '(incl. 1 Solo)' : '(All Pairs)'}</strong></div>
      <div class="flex justify-between"><span>Playoff Series:</span> <strong class="text-amber-300">Bo3 Rounds &rarr; Bo5 Finals</strong></div>
    `;
  }
}

function renderFixedTeamsPanel(isFixed) {
  const panel = document.getElementById('fixed-teams-panel');
  panel.classList.toggle('hidden', !isFixed);
  if (!isFixed) return;

  const unpaired = getUnpairedPlayers();
  const options = unpaired.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  const teamsHtml = state.fixedPairs.length === 0
    ? '<div class="text-xs text-slate-500">No teams yet. Pick two players and press + Pair Team.</div>'
    : state.fixedPairs.map((pair, idx) => `
      <div class="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 text-sm">
        <span class="font-semibold text-slate-200 truncate">Team ${idx + 1}: ${escapeHtml(formatTeamNames(pair))}</span>
        <button type="button" onclick="removePair(${idx})" class="text-slate-500 hover:text-rose-400 p-1 rounded-lg transition" title="Split team">✕</button>
      </div>
    `).join('');

  let unpairedNote = '';
  if (unpaired.length === 1) {
    unpairedNote = `<div class="text-xs text-amber-300">${escapeHtml(unpaired[0].name)} will play as a solo team.</div>`;
  } else if (unpaired.length > 1) {
    unpairedNote = `<div class="text-xs text-slate-400">Unpaired: ${escapeHtml(unpaired.map(p => p.name).join(', '))}</div>`;
  }

  panel.innerHTML = `
    <div class="text-xs font-bold uppercase tracking-wider text-slate-400">Fixed Teams</div>
    ${unpaired.length > 1 ? `
      <div class="flex flex-wrap gap-2">
        <select id="pair-player-a" class="flex-1 min-w-[8rem] bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none">${options}</select>
        <select id="pair-player-b" class="flex-1 min-w-[8rem] bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none">${options}</select>
        <button type="button" onclick="handleCreatePair()" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition">+ Pair Team</button>
      </div>
    ` : ''}
    ${unpairedNote}
    <div class="space-y-1.5">${teamsHtml}</div>
  `;

  const selectB = document.getElementById('pair-player-b');
  if (selectB && unpaired[1]) selectB.value = unpaired[1].id;
}

function renderRoundRobin() {
  const numTables = state.config.numTables || 2;
  const sdBonus = state.config.suddenDeathCups === 3 ? 3 : 1;
  const activeMatches = getActiveMatches();
  const suggestedQueue = getSuggestedNextMatches();

  const activeSection = document.getElementById('active-tables-section');
  let activeHtml = '';
  for (let t = 1; t <= numTables; t++) {
    const liveEntry = activeMatches.find(item => item.match.tableNumber === t);
    if (liveEntry) {
      const { round, roundIdx, match, matchIdx } = liveEntry;
      const otLevel = match.otLevel || 0;
      const otLabel = formatOtStageLabel(otLevel);
      const nextOtLabel = formatOtStageLabel(otLevel + 1);
      const prevOtLabel = formatOtStageLabel(otLevel - 1);
      const maxCups = getMatchMaxCupsPerPairing(match);
      const nextTarget = maxCups + sdBonus;
      const prevTarget = Math.max(10, maxCups - sdBonus);

      const cupsA = getPairingCupTotal(match, 'A');
      const cupsB = getPairingCupTotal(match, 'B');
      const effA = getPairingEffectiveCups(match, 'A');
      const effB = getPairingEffectiveCups(match, 'B');
      const winCheckA = canPairingWinMatch(match, 'A');
      const winCheckB = canPairingWinMatch(match, 'B');
      const canAdvanceOt = (effA === maxCups && effB === maxCups);
      const canUndoOt = otLevel > 0 && effA <= prevTarget && effB <= prevTarget;

      activeHtml += `
        <div class="bg-slate-900/95 border-2 ${otLevel > 0 ? 'border-amber-500/80' : 'border-emerald-500/70'} rounded-2xl p-5 shadow-2xl space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div class="flex flex-wrap items-center gap-2">
              <span class="px-3 py-1 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider">
                Table ${t} (LIVE)
              </span>
              <span class="text-xs font-bold text-slate-300">Round ${round.roundNumber} &bull; Game #${match.seqIndex}</span>
              <span class="px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold ${
                otLevel > 0
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }">
                ${otLevel > 0 ? `🔥 ${otLabel} • Target ${maxCups}` : 'Regulation • Target 10'}
              </span>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              ${otLevel > 0 ? `
                <button
                  type="button"
                  onclick="undoMatchOvertime(${roundIdx}, ${matchIdx})"
                  ${canUndoOt ? '' : 'disabled'}
                  class="px-2.5 py-1.5 rounded-xl text-xs font-bold border transition ${
                    canUndoOt
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600 cursor-pointer'
                      : 'bg-slate-900/70 text-slate-600 border-slate-800 cursor-not-allowed'
                  }"
                  title="${canUndoOt ? `Step back to ${prevOtLabel}` : `Reduce effective cups to ${prevTarget} or fewer to undo ${otLabel}`}">
                  ↩ ${prevOtLabel}
                </button>
              ` : ''}
              <button
                type="button"
                onclick="advanceMatchOvertime(${roundIdx}, ${matchIdx})"
                ${canAdvanceOt ? '' : 'disabled'}
                class="px-3 py-1.5 rounded-xl text-xs font-extrabold border transition ${
                  canAdvanceOt
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 shadow-md shadow-amber-950/60 cursor-pointer animate-pulse'
                    : 'bg-slate-900/80 text-slate-500 border-slate-800 cursor-not-allowed'
                }"
                title="${canAdvanceOt ? `Both tied at ${maxCups}! Advance to ${nextOtLabel} (Target ${nextTarget})` : `Unlocks when BOTH pairings tie at ${maxCups} effective cups`}">
                🔥 Start ${nextOtLabel} (${nextTarget})
              </button>
              <button type="button" onclick="cancelActiveMatch(${roundIdx}, ${matchIdx})" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition">
                ⏸ Pause
              </button>
            </div>
          </div>

          <!-- Live Stat Steppers -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Pair A -->
            <div class="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="text-xs font-extrabold uppercase tracking-wider text-emerald-400">Pair A</span>
                  <span class="px-2 py-0.5 rounded-md text-[11px] font-extrabold ${effA >= maxCups ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-900 text-slate-300 border border-slate-800'}" title="Pairing Cups Hit + Opposing Pairing Errors">
                    Eff: ${effA}/${maxCups} (${cupsA}C + ${getPairingOpponentErrors(match, 'A')}E)
                  </span>
                </div>
                <button
                  type="button"
                  onclick="finishActiveMatchWithWinner(${roundIdx}, ${matchIdx}, 'A')"
                  ${winCheckA.allowed ? '' : 'disabled'}
                  title="${winCheckA.allowed ? 'Finish match with Pair A as winner' : escapeHtml(winCheckA.reason)}"
                  class="px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition ${
                    winCheckA.allowed
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/60 cursor-pointer'
                      : 'bg-slate-800/80 text-slate-500 border border-slate-700/70 cursor-not-allowed'
                  }">
                  ${winCheckA.allowed ? '🏆 Pair A Wins & Finish' : `🔒 Need ${maxCups} (${effA}/${maxCups})`}
                </button>
              </div>
              <div class="text-sm font-bold text-white">${escapeHtml(formatTeamNames(match.teamA))}</div>
              <div class="space-y-2">
                ${match.teamA.map(pid => renderPlayerStatStepperRow(roundIdx, matchIdx, pid, match.stats[pid], false)).join('')}
              </div>
            </div>

            <!-- Pair B -->
            <div class="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="text-xs font-extrabold uppercase tracking-wider text-emerald-400">Pair B</span>
                  <span class="px-2 py-0.5 rounded-md text-[11px] font-extrabold ${effB >= maxCups ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-900 text-slate-300 border border-slate-800'}" title="Pairing Cups Hit + Opposing Pairing Errors">
                    Eff: ${effB}/${maxCups} (${cupsB}C + ${getPairingOpponentErrors(match, 'B')}E)
                  </span>
                </div>
                <button
                  type="button"
                  onclick="finishActiveMatchWithWinner(${roundIdx}, ${matchIdx}, 'B')"
                  ${winCheckB.allowed ? '' : 'disabled'}
                  title="${winCheckB.allowed ? 'Finish match with Pair B as winner' : escapeHtml(winCheckB.reason)}"
                  class="px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition ${
                    winCheckB.allowed
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/60 cursor-pointer'
                      : 'bg-slate-800/80 text-slate-500 border border-slate-700/70 cursor-not-allowed'
                  }">
                  ${winCheckB.allowed ? '🏆 Pair B Wins & Finish' : `🔒 Need ${maxCups} (${effB}/${maxCups})`}
                </button>
              </div>
              <div class="text-sm font-bold text-white">${escapeHtml(formatTeamNames(match.teamB))}</div>
              <div class="space-y-2">
                ${match.teamB.map(pid => renderPlayerStatStepperRow(roundIdx, matchIdx, pid, match.stats[pid], false)).join('')}
              </div>
            </div>
          </div>
        </div>
      `;
    } else {
      activeHtml += `
        <div class="bg-slate-900/55 border border-dashed border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="px-3 py-1 rounded-xl bg-slate-800 text-slate-400 font-bold text-xs uppercase tracking-wider">
              Table ${t} (Open)
            </span>
            <span class="text-xs text-slate-400">Ready for next match — press <strong class="text-slate-200">▶ Game Started</strong> below.</span>
          </div>
          ${suggestedQueue.length > 0 ? `
            <button type="button" onclick="startMatchOnTable(${suggestedQueue[0].roundIdx}, ${suggestedQueue[0].matchIdx})" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-md shadow-emerald-950/50 transition self-start sm:self-auto">
              ▶ Start Game #${suggestedQueue[0].match.seqIndex} on Table ${t}
            </button>
          ` : ''}
        </div>
      `;
    }
  }
  activeSection.innerHTML = activeHtml;

  const queueSection = document.getElementById('smart-queue-section');
  const openTablesCount = Math.max(0, numTables - activeMatches.length);
  if (suggestedQueue.length === 0) {
    const anyPending = getAllMatchesFlat().some(item => item.match.status === 'pending');
    queueSection.innerHTML = `
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-extrabold uppercase tracking-wider text-emerald-400">Up Next — Smart Table Queue</h3>
        <span class="text-xs text-slate-400">${openTablesCount} Open Table(s)</span>
      </div>
      <p class="text-xs text-slate-400">
        ${anyPending
          ? 'All remaining queued games have players currently active on a live table. Finish a live game to free them up.'
          : 'All Round-Robin games are completed! Head over to Standings & Seeding to lock rankings.'}
      </p>
    `;
  } else {
    const topSuggestions = suggestedQueue.slice(0, Math.max(3, numTables + 1));
    queueSection.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 class="text-sm font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
            <span>🎯 Up Next — Smart Table Queue</span>
            <span class="px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              ${suggestedQueue.length} Ready Match${suggestedQueue.length === 1 ? '' : 'es'}
            </span>
          </h3>
          <p class="text-xs text-slate-400 mt-0.5">
            Filtered to players not at another active table. Skipped games are prioritized first.
          </p>
        </div>
        <span class="text-xs font-bold ${openTablesCount > 0 ? 'text-emerald-300' : 'text-amber-300'}">
          ${openTablesCount > 0 ? `${openTablesCount} Table${openTablesCount > 1 ? 's' : ''} Open Now` : 'All Tables Full'}
        </span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        ${topSuggestions.map(({ round, roundIdx, match, matchIdx }, idx) => {
          const pA = formatTeamNames(match.teamA);
          const pB = formatTeamNames(match.teamB);
          const canStart = openTablesCount > 0;
          return `
            <div class="bg-slate-950/90 border ${match.skipped ? 'border-amber-500/60' : (idx === 0 ? 'border-emerald-500/50' : 'border-slate-800')} rounded-xl p-3.5 flex flex-col justify-between gap-3">
              <div class="space-y-1.5">
                <div class="flex items-center justify-between gap-1.5">
                  <span class="text-[11px] font-bold text-slate-400">Round ${round.roundNumber} &bull; Game #${match.seqIndex}</span>
                  ${match.skipped
                    ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40">⚡ Skipped Priority</span>'
                    : (idx === 0 ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">Next Recommended</span>' : '')}
                </div>
                <div class="text-xs font-bold text-white leading-snug">
                  ${escapeHtml(pA)} <span class="text-slate-500 font-normal">vs</span> ${escapeHtml(pB)}
                </div>
              </div>
              <button
                type="button"
                onclick="startMatchOnTable(${roundIdx}, ${matchIdx})"
                ${canStart ? '' : 'disabled'}
                class="w-full py-2 px-3 rounded-xl text-xs font-extrabold transition ${
                  canStart
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/50 cursor-pointer'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }">
                ${canStart ? `▶ Game Started (Table ${getAvailableTableNumber()})` : 'Waiting for Open Table'}
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  let totalMatches = 0;
  let completedMatches = 0;
  state.rounds.forEach(r => {
    r.matches.forEach(m => {
      totalMatches++;
      if (m.status === 'completed') completedMatches++;
    });
  });
  document.getElementById('rr-progress-badge').textContent = `${completedMatches} / ${totalMatches} Completed`;
  document.getElementById('rr-table-usage-badge').textContent = `${activeMatches.length} / ${numTables} Tables Active`;

  const filterBar = document.getElementById('round-filter-bar');
  let filterHtml = `
    <button type="button" onclick="setRoundFilter('all')" class="px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${state.roundFilter === 'all' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}">
      All Rounds (${state.rounds.length})
    </button>
  `;
  state.rounds.forEach(r => {
    const doneCount = r.matches.filter(m => m.status === 'completed').length;
    const isAllDone = doneCount === r.matches.length;
    const isActive = String(state.roundFilter) === String(r.roundNumber);
    filterHtml += `
      <button type="button" onclick="setRoundFilter(${r.roundNumber})" class="px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${isActive ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'}">
        <span>Round ${r.roundNumber}</span>
        <span class="text-[10px] px-1.5 py-0.2 rounded-full ${isAllDone ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}">${doneCount}/${r.matches.length}</span>
      </button>
    `;
  });
  filterBar.innerHTML = filterHtml;

  const container = document.getElementById('rr-matches-container');
  const visibleRounds = state.roundFilter === 'all'
    ? state.rounds
    : state.rounds.filter(r => String(r.roundNumber) === String(state.roundFilter));

  const busyPlayers = getBusyPlayerIds();

  container.innerHTML = visibleRounds.map(round => {
    const roundIdx = state.rounds.findIndex(r => r.roundNumber === round.roundNumber);
    const sitOutNames = round.sitOuts.map(id => getPlayerName(id));

    const matchesHtml = round.matches.map((match, matchIdx) => {
      const isCompleted = match.status === 'completed';
      const isActive = match.status === 'active';
      const isRevising = isCompleted && Boolean(match.isRevising);
      const isLocked = isCompleted && !isRevising;

      const otLevel = match.otLevel || 0;
      const otLabel = formatOtStageLabel(otLevel);
      const nextOtLabel = formatOtStageLabel(otLevel + 1);
      const prevOtLabel = formatOtStageLabel(otLevel - 1);
      const maxCups = getMatchMaxCupsPerPairing(match);
      const nextTarget = maxCups + sdBonus;
      const prevTarget = Math.max(10, maxCups - sdBonus);

      const cupsA = getPairingCupTotal(match, 'A');
      const cupsB = getPairingCupTotal(match, 'B');
      const effA = getPairingEffectiveCups(match, 'A');
      const effB = getPairingEffectiveCups(match, 'B');
      const canAdvanceOt = (effA === maxCups && effB === maxCups);
      const canUndoOt = otLevel > 0 && effA <= prevTarget && effB <= prevTarget;

      const participants = [...match.teamA, ...match.teamB];
      const busyConflictNames = participants.filter(pid => busyPlayers.has(pid)).map(pid => getPlayerName(pid));
      const canStartNow = !isCompleted && !isActive && (activeMatches.length < numTables) && busyConflictNames.length === 0;

      let cardBorder = 'border-slate-800';
      let statusBadge = '<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400">Queued</span>';
      if (isCompleted && isRevising) {
        cardBorder = 'border-amber-500/70';
        statusBadge = '<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">✎ Revising Results</span>';
      } else if (isCompleted) {
        cardBorder = 'border-emerald-500/40';
        statusBadge = '<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">🔒 Completed</span>';
      } else if (isActive) {
        cardBorder = 'border-emerald-400';
        statusBadge = `<span class="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500 text-slate-950">LIVE on Table ${match.tableNumber}</span>`;
      } else if (match.skipped) {
        cardBorder = 'border-amber-500/40';
        statusBadge = '<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">⚡ Skipped Priority</span>';
      } else if (busyConflictNames.length > 0) {
        statusBadge = `<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-amber-300/90">Waiting on ${escapeHtml(busyConflictNames.join(', '))}</span>`;
      }

      return `
        <div class="bg-slate-950/90 border ${cardBorder} rounded-2xl p-4 sm:p-5 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs font-extrabold uppercase tracking-wider text-slate-300">Game #${match.seqIndex}</span>
              ${statusBadge}
              ${otLevel > 0 ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40">🔥 ${otLabel} (Target ${maxCups})</span>` : ''}
            </div>

            <div class="flex flex-wrap items-center gap-2">
              ${isCompleted ? (
                isRevising ? `
                  ${otLevel > 0 ? `
                    <button
                      type="button"
                      onclick="undoMatchOvertime(${roundIdx}, ${matchIdx})"
                      ${canUndoOt ? '' : 'disabled'}
                      class="px-2.5 py-1.5 rounded-xl text-xs font-bold border transition ${
                        canUndoOt
                          ? 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700 cursor-pointer'
                          : 'bg-slate-900/60 text-slate-600 border-slate-800 cursor-not-allowed'
                      }">
                      ↩ ${prevOtLabel}
                    </button>
                  ` : ''}
                  <button
                    type="button"
                    onclick="advanceMatchOvertime(${roundIdx}, ${matchIdx})"
                    ${canAdvanceOt ? '' : 'disabled'}
                    class="px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                      canAdvanceOt
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400/60 cursor-pointer'
                        : 'bg-slate-900/70 text-slate-500 border-slate-800 cursor-not-allowed'
                    }">
                    🔥 Start ${nextOtLabel} (${nextTarget})
                  </button>
                  <button type="button" onclick="toggleCompletedMatchWinner(${roundIdx}, ${matchIdx})" class="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 transition">
                    ⇄ Swap Winner
                  </button>
                  <button type="button" onclick="reopenCompletedMatch(${roundIdx}, ${matchIdx})" class="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition">
                    Reopen Match
                  </button>
                  <button type="button" onclick="toggleReviseCompletedMatch(${roundIdx}, ${matchIdx})" class="px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/50 transition">
                    ✓ Done Revising
                  </button>
                ` : `
                  <button type="button" onclick="toggleReviseCompletedMatch(${roundIdx}, ${matchIdx})" class="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700 hover:border-amber-500/40 transition">
                    ✎ Revise Results
                  </button>
                `
              ) : isActive ? `
                <span class="text-xs font-bold text-emerald-400">Live scoring on Table ${match.tableNumber} above &uarr;</span>
              ` : `
                <button
                  type="button"
                  onclick="startMatchOnTable(${roundIdx}, ${matchIdx})"
                  ${canStartNow ? '' : 'disabled'}
                  class="px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition ${
                    canStartNow
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/50 cursor-pointer'
                      : 'bg-slate-800/80 text-slate-500 cursor-not-allowed'
                  }">
                  ${canStartNow ? `▶ Game Started (Table ${getAvailableTableNumber()})` : (activeMatches.length >= numTables ? 'All Tables Busy' : 'Players Busy')}
                </button>
              `}
            </div>
          </div>

          <!-- Pair A vs Pair B -->
          <div class="grid grid-cols-1 lg:grid-cols-11 gap-4 items-stretch">
            <!-- Pair A -->
            <div class="lg:col-span-5 rounded-xl p-3.5 border transition ${match.winner === 'A' ? 'bg-emerald-950/35 border-emerald-500/60' : 'bg-slate-900/70 border-slate-800'}">
              <div class="flex items-center justify-between mb-2.5">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold uppercase tracking-wider ${match.winner === 'A' ? 'text-emerald-400' : 'text-slate-400'}">Pair A</span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-950 text-slate-300 border border-slate-800">Eff: ${effA}/${maxCups} (${cupsA}C+${getPairingOpponentErrors(match, 'A')}E)</span>
                </div>
                ${match.winner === 'A' ? '<span class="px-2 py-0.5 rounded-md bg-emerald-500 text-slate-950 text-[10px] font-black">WINNER</span>' : ''}
              </div>
              <div class="text-sm font-bold text-white mb-3">${escapeHtml(formatTeamNames(match.teamA))}</div>
              <div class="space-y-2">
                ${match.teamA.map(pid => renderPlayerStatStepperRow(roundIdx, matchIdx, pid, match.stats[pid], isLocked)).join('')}
              </div>
            </div>

            <!-- VS -->
            <div class="lg:col-span-1 flex items-center justify-center">
              <span class="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-black text-slate-400">VS</span>
            </div>

            <!-- Pair B -->
            <div class="lg:col-span-5 rounded-xl p-3.5 border transition ${match.winner === 'B' ? 'bg-emerald-950/35 border-emerald-500/60' : 'bg-slate-900/70 border-slate-800'}">
              <div class="flex items-center justify-between mb-2.5">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold uppercase tracking-wider ${match.winner === 'B' ? 'text-emerald-400' : 'text-slate-400'}">Pair B</span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-950 text-slate-300 border border-slate-800">Eff: ${effB}/${maxCups} (${cupsB}C+${getPairingOpponentErrors(match, 'B')}E)</span>
                </div>
                ${match.winner === 'B' ? '<span class="px-2 py-0.5 rounded-md bg-emerald-500 text-slate-950 text-[10px] font-black">WINNER</span>' : ''}
              </div>
              <div class="text-sm font-bold text-white mb-3">${escapeHtml(formatTeamNames(match.teamB))}</div>
              <div class="space-y-2">
                ${match.teamB.map(pid => renderPlayerStatStepperRow(roundIdx, matchIdx, pid, match.stats[pid], isLocked)).join('')}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
            <span class="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs text-emerald-400">R${round.roundNumber}</span>
            <span>Round ${round.roundNumber}</span>
          </h3>
          ${sitOutNames.length > 0 ? `
            <div class="text-xs text-slate-400 bg-slate-950 border border-slate-800 px-3 py-1 rounded-full">
              <span class="text-slate-500 font-semibold">Bye / Resting:</span> ${escapeHtml(sitOutNames.join(', '))}
            </div>
          ` : ''}
        </div>
        <div class="space-y-4">
          ${matchesHtml}
        </div>
      </div>
    `;
  }).join('');
}

function renderPlayerStatStepperRow(roundIdx, matchIdx, playerId, pStats, isLocked = false) {
  const s = pStats || {};
  const enabledStats = getEnabledStatDefinitions();
  return `
    <div class="bg-slate-950/90 border ${isLocked ? 'border-slate-800/60 opacity-85' : 'border-slate-800/90'} rounded-lg p-2.5 space-y-2">
      <div class="text-xs font-bold text-slate-200 truncate">${escapeHtml(getPlayerName(playerId))}</div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        ${enabledStats.map(st => renderSingleStatControl(roundIdx, matchIdx, playerId, st.key, st.shortLabel, s[st.key] || 0, st.color || 'text-emerald-300', isLocked)).join('')}
      </div>
    </div>
  `;
}

function renderSingleStatControl(roundIdx, matchIdx, playerId, statKey, label, val, valColor, isLocked = false) {
  return `
    <div class="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-md px-2 py-1">
      <span class="text-[10px] font-semibold text-slate-400 uppercase">${escapeHtml(label)}</span>
      <div class="flex items-center gap-1">
        ${isLocked
          ? `<span class="text-xs font-extrabold ${valColor} min-w-[14px] text-center">${val}</span>`
          : `
            <button type="button" onclick="adjustMatchStat(${roundIdx}, ${matchIdx}, '${playerId}', '${statKey}', -1)" class="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center transition">-</button>
            <span class="text-xs font-extrabold ${valColor} min-w-[14px] text-center">${val}</span>
            <button type="button" onclick="adjustMatchStat(${roundIdx}, ${matchIdx}, '${playerId}', '${statKey}', 1)" class="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center transition">+</button>
          `
        }
      </div>
    </div>
  `;
}

function renderStandings() {
  const isFixed = state.scheduleFormat === 'fixed';
  const standings = isFixed ? computeTeamStandings() : computeStandings();
  const enabledStats = getEnabledStatDefinitions();
  const thead = document.getElementById('standings-thead');
  const tbody = document.getElementById('standings-tbody');
  document.getElementById('standings-desc-rotating').classList.toggle('hidden', isFixed);
  document.getElementById('standings-desc-fixed').classList.toggle('hidden', !isFixed);

  thead.innerHTML = `
    <tr class="bg-slate-950/90 border-b border-slate-800 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
      <th class="py-3.5 px-4">Rank</th>
      <th class="py-3.5 px-4">${isFixed ? 'Team' : 'Participant'}</th>
      <th class="py-3.5 px-3 text-center">W - L</th>
      <th class="py-3.5 px-3 text-center text-emerald-400">Win % (1st)</th>
      <th class="py-3.5 px-3 text-center text-amber-400">Net Stat Score (2nd)</th>
      ${enabledStats.map(st => `
        <th class="py-3.5 px-3 text-center ${st.color || 'text-slate-300'}">${escapeHtml(st.shortLabel)} (${st.weight > 0 ? '+1' : '-1'})</th>
      `).join('')}
    </tr>
  `;

  tbody.innerHTML = standings.map((row, idx) => {
    const rank = idx + 1;
    const pctDisplay = (row.winPct * 100).toFixed(1) + '%';
    const netSign = row.netStatScore > 0 ? `+${row.netStatScore}` : `${row.netStatScore}`;
    const rankBadge = rank === 1
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
      : rank <= 4
        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
        : 'bg-slate-800 text-slate-300 border-slate-700';

    return `
      <tr class="hover:bg-slate-800/40 transition">
        <td class="py-3 px-4">
          <span class="inline-flex items-center justify-center w-7 h-7 rounded-lg border text-xs font-extrabold ${rankBadge}">#${rank}</span>
        </td>
        <td class="py-3 px-4 font-bold text-white">${escapeHtml(row.name)}</td>
        <td class="py-3 px-3 text-center font-semibold text-slate-300">${row.wins} - ${row.losses}</td>
        <td class="py-3 px-3 text-center font-extrabold text-emerald-400">${pctDisplay}</td>
        <td class="py-3 px-3 text-center font-extrabold text-amber-300">${netSign}</td>
        ${enabledStats.map(st => `
          <td class="py-3 px-3 text-center ${st.color || 'text-slate-300'}">${row.statTotals[st.key] || 0}</td>
        `).join('')}
      </tr>
    `;
  }).join('');
}

function renderBracket() {
  const teamCountLabel = document.getElementById('playoff-team-count-label');
  const teamsStrip = document.getElementById('playoff-teams-strip');
  if (teamCountLabel && teamsStrip) {
    const isFixed = state.scheduleFormat === 'fixed';
    teamCountLabel.textContent = `${state.playoffTeams.length} Teams (${isFixed ? 'Seeded by Team Record' : 'High-Low Seeding'})`;
    document.getElementById('bracket-desc-rotating').classList.toggle('hidden', isFixed);
    document.getElementById('bracket-desc-fixed').classList.toggle('hidden', !isFixed);
    teamsStrip.innerHTML = state.playoffTeams.map(team => `
      <div class="bg-slate-950/90 border ${team.isSolo ? 'border-amber-500/45' : 'border-slate-800'} rounded-xl px-3 py-2 flex items-center justify-between gap-2">
        <div class="truncate">
          <div class="text-xs font-extrabold text-white truncate">#${team.seed} ${escapeHtml(team.name)}</div>
          <div class="text-[10px] text-slate-400">
            ${team.isFixed
              ? `Round-Robin Team Rank #${team.ranks[0]}${team.isSolo ? ' (Solo)' : ''}`
              : (team.isSolo ? 'Solo Entry (Last Seed)' : `Ranks #${team.ranks[0]} & #${team.ranks[1]}`)}
          </div>
        </div>
        ${team.isSolo ? '<span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold shrink-0">SOLO</span>' : ''}
      </div>
    `).join('');
  }

  if (!state.bracket) return;
  const container = document.getElementById('bracket-columns-container');
  const rounds = state.bracket.rounds;

  const finalsRound = rounds[rounds.length - 1];
  const finalsMatch = finalsRound.matches[0];
  const championTeam = getWinnerTeamObject(finalsMatch);
  const champBanner = document.getElementById('champion-banner');

  if (championTeam) {
    champBanner.classList.remove('hidden');
    document.getElementById('champion-team-name').textContent = `Seed #${championTeam.seed} — ${championTeam.name}`;
    document.getElementById('champion-players-sub').textContent = `Won Championship Finals (${finalsMatch.scoreA} - ${finalsMatch.scoreB})`;
  } else {
    champBanner.classList.add('hidden');
  }

  container.innerHTML = rounds.map((round, rIdx) => {
    const isFinals = rIdx === rounds.length - 1;
    const winsNeeded = Math.ceil(round.bestOf / 2);

    const matchesHtml = round.matches.map((match, mIdx) => {
      const teamAName = match.teamA ? `#${match.teamA.seed} ${match.teamA.name}` : match.placeholderA;
      const teamBName = match.teamB ? `#${match.teamB.seed} ${match.teamB.name}` : (match.isBye ? 'BYE' : match.placeholderB);
      const isReady = Boolean(match.teamA && match.teamB && !match.isBye);
      const aWon = match.winnerTeamId && match.teamA && match.winnerTeamId === match.teamA.id;
      const bWon = match.winnerTeamId && match.teamB && match.winnerTeamId === match.teamB.id;

      return `
        <div class="bg-slate-950/95 border ${isFinals ? 'border-amber-500/50' : (match.winnerTeamId ? 'border-emerald-500/40' : 'border-slate-800')} rounded-2xl p-4 w-72 sm:w-80 shadow-xl space-y-3">
          <div class="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
            <span class="${isFinals ? 'text-amber-400' : 'text-slate-400'}">
              ${match.isBye ? 'First-Round Bye' : `Best of ${match.bestOf} (First to ${winsNeeded})`}
            </span>
            ${match.winnerTeamId ? '<span class="text-emerald-400">✓ Decided</span>' : (isReady ? '<span class="text-sky-400">Live</span>' : '<span class="text-slate-600">Pending</span>')}
          </div>

          <!-- Team A -->
          <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl border ${aWon ? 'bg-emerald-950/40 border-emerald-500/60' : 'bg-slate-900/90 border-slate-800'}">
            <div class="truncate text-xs sm:text-sm font-bold ${match.teamA ? (aWon ? 'text-emerald-300' : 'text-white') : 'text-slate-500 italic'}">
              ${escapeHtml(teamAName)}
            </div>
            ${isReady ? `
              <div class="flex items-center gap-1.5 shrink-0">
                <button type="button" onclick="adjustSeriesScore(${rIdx}, ${mIdx}, 'A', -1)" class="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold">-</button>
                <span class="w-5 text-center text-sm font-black ${aWon ? 'text-emerald-400' : 'text-white'}">${match.scoreA}</span>
                <button type="button" onclick="adjustSeriesScore(${rIdx}, ${mIdx}, 'A', 1)" class="w-6 h-6 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">+</button>
              </div>
            ` : ''}
          </div>

          <!-- Team B -->
          <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl border ${bWon ? 'bg-emerald-950/40 border-emerald-500/60' : 'bg-slate-900/90 border-slate-800'}">
            <div class="truncate text-xs sm:text-sm font-bold ${match.teamB ? (bWon ? 'text-emerald-300' : 'text-white') : 'text-slate-500 italic'}">
              ${escapeHtml(teamBName)}
            </div>
            ${isReady ? `
              <div class="flex items-center gap-1.5 shrink-0">
                <button type="button" onclick="adjustSeriesScore(${rIdx}, ${mIdx}, 'B', -1)" class="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold">-</button>
                <span class="w-5 text-center text-sm font-black ${bWon ? 'text-emerald-400' : 'text-white'}">${match.scoreB}</span>
                <button type="button" onclick="adjustSeriesScore(${rIdx}, ${mIdx}, 'B', 1)" class="w-6 h-6 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">+</button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="flex flex-col justify-around gap-5">
        <div class="text-center pb-1 border-b border-slate-800">
          <div class="text-xs font-black uppercase tracking-wider ${isFinals ? 'text-amber-400' : 'text-emerald-400'}">${escapeHtml(round.title)}</div>
          <div class="text-[11px] text-slate-500">Best of ${round.bestOf}</div>
        </div>
        <div class="flex-1 flex flex-col justify-around gap-5">
          ${matchesHtml}
        </div>
      </div>
    `;
  }).join('');
}
