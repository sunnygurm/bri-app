const { test, expect } = require('@playwright/test');
const { SAMPLE_12, openFresh, loadSample } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await openFresh(page);
});

test('sample roster of 12 shows those players', async ({ page }) => {
  await loadSample(page, 12);
  await expect(page.locator('#player-count-badge')).toHaveText('12 / 30 Players ✓ Ready');
  for (const name of SAMPLE_12) {
    await expect(page.locator('#roster-grid')).toContainText(name);
  }
});

test('generate with fewer than 4 players shows an error', async ({ page }) => {
  await page.locator('#bulk-player-input').fill('Ann, Ben, Cal');
  await page.getByRole('button', { name: '+ Import Roster' }).click();
  await page.getByRole('button', { name: 'Generate Round-Robin Schedule' }).click();
  await expect(page.locator('#toast-container')).toContainText('Please register between 4 and 30 participants first.');
  await expect(page.locator('#view-roundrobin')).toBeHidden();
});

test('add, bulk paste, and remove players update the roster', async ({ page }) => {
  await page.locator('#single-player-input').fill('Casey Solo');
  await page.locator('form').getByRole('button', { name: '+ Add' }).click();
  await expect(page.locator('#roster-grid')).toContainText('Casey Solo');
  await expect(page.locator('#player-count-badge')).toContainText('1 / 30');

  await page.locator('#bulk-player-input').fill('Mike, Sarah');
  await page.getByRole('button', { name: '+ Import Roster' }).click();
  await expect(page.locator('#roster-grid')).toContainText('Mike');
  await expect(page.locator('#roster-grid')).toContainText('Sarah');
  await expect(page.locator('#player-count-badge')).toContainText('3 / 30');

  await page.locator('#roster-grid').getByTitle('Remove player').first().click();
  await expect(page.locator('#roster-grid')).not.toContainText('Casey Solo');
  await expect(page.locator('#player-count-badge')).toContainText('2 / 30');
});

test('table count and game cap update the schedule preview', async ({ page }) => {
  await loadSample(page, 12);
  await page.locator('#config-num-tables').selectOption('4');
  await page.locator('#config-max-games').selectOption('8');
  const preview = page.locator('#schedule-preview-box');
  await expect(preview).toContainText('4 Tables');
  await expect(preview).toContainText('~8 games');
});
