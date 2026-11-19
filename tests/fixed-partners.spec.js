const { test, expect } = require('@playwright/test');
const { openFresh, loadSample, generateSchedule } = require('./helpers');

async function addPlayers(page, names) {
  await page.locator('#bulk-player-input').fill(names.join(', '));
  await page.getByRole('button', { name: '+ Import Roster' }).click();
}

async function pairNextTwo(page) {
  await page.getByRole('button', { name: '+ Pair Team' }).click();
}

test.beforeEach(async ({ page }) => {
  await openFresh(page);
});

test('rotating partners works with the 4 player minimum', async ({ page }) => {
  await addPlayers(page, ['Ann', 'Ben', 'Cal', 'Dee']);
  await expect(page.locator('#player-count-badge')).toContainText('4 / 30');
  await generateSchedule(page);
  await expect(page.locator('#smart-queue-section')).toContainText('Ann');
});

test('fixed partners with 8 players plays a full team round robin into playoffs', async ({ page }) => {
  await loadSample(page, 8);
  await page.locator('#config-format').selectOption('fixed');
  await expect(page.locator('#config-max-games-wrap')).toBeHidden();
  await expect(page.locator('#fixed-teams-panel')).toBeVisible();

  for (let i = 0; i < 4; i++) await pairNextTwo(page);
  await expect(page.locator('#fixed-teams-panel')).toContainText('Team 4:');
  await expect(page.getByRole('button', { name: '+ Pair Team' })).toHaveCount(0);

  await generateSchedule(page);
  await expect(page.locator('#rr-progress-badge')).toContainText('0 / 6 Completed');
  await expect(page.locator('#smart-queue-section')).toContainText(' & ');

  await page.getByRole('button', { name: '⚡ Simulate Remaining Games' }).click();
  await expect(page.locator('#rr-progress-badge')).toContainText('6 / 6 Completed');

  await page.getByRole('button', { name: 'View Standings & Seeding →' }).click();
  await expect(page.locator('#standings-thead')).toContainText('Team');
  await expect(page.locator('#standings-tbody tr')).toHaveCount(4);
  await expect(page.locator('#standings-desc-fixed')).toBeVisible();

  await page.getByRole('button', { name: /Lock Standings & Launch Playoff Bracket/ }).click();
  await expect(page.locator('#playoff-team-count-label')).toContainText('4 Teams (Seeded by Team Record)');
  await expect(page.locator('#playoff-teams-strip')).toContainText('Round-Robin Team Rank #1');
  await expect(page.getByText('Semifinals', { exact: true })).toBeVisible();
});

test('fixed partners with an odd player gives them a solo team', async ({ page }) => {
  await addPlayers(page, ['Ann', 'Ben', 'Cal', 'Dee', 'Eve']);
  await page.locator('#config-format').selectOption('fixed');
  await pairNextTwo(page);
  await pairNextTwo(page);
  await expect(page.locator('#fixed-teams-panel')).toContainText('Eve will play as a solo team.');

  await generateSchedule(page);
  await expect(page.locator('#rr-progress-badge')).toContainText('0 / 3 Completed');

  await page.getByRole('button', { name: '⚡ Simulate Remaining Games' }).click();
  await page.getByRole('button', { name: 'View Standings & Seeding →' }).click();
  await expect(page.locator('#standings-tbody tr')).toHaveCount(3);
  await expect(page.locator('#standings-tbody')).toContainText('Eve (Solo)');
});

test('fixed partners refuses to start with unpaired players', async ({ page }) => {
  await loadSample(page, 8);
  await page.locator('#config-format').selectOption('fixed');
  await pairNextTwo(page);
  await page.getByRole('button', { name: 'Generate Round-Robin Schedule' }).click();
  await expect(page.locator('#toast-container')).toContainText('Pair every player into a team first');
  await expect(page.locator('#view-roundrobin')).toBeHidden();
});

test('splitting a team returns both players to the pool', async ({ page }) => {
  await loadSample(page, 8);
  await page.locator('#config-format').selectOption('fixed');
  await pairNextTwo(page);
  await expect(page.locator('#fixed-teams-panel')).toContainText('Team 1:');
  await page.getByTitle('Split team').click();
  await expect(page.locator('#fixed-teams-panel')).not.toContainText('Team 1:');
});
