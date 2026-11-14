/**
 * Bootstrap Application
 */
window.addEventListener('DOMContentLoaded', () => {
  loadState();
  switchTab(state.activeTab || 'setup');
});
