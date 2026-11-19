const { test, expect } = require('@playwright/test');
const { openFresh, loadSample } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await openFresh(page);
});

test('reload keeps the roster', async ({ page }) => {
  await loadSample(page, 12);
  await page.reload();
  await expect(page.locator('#player-count-badge')).toHaveText('12 / 30 Players ✓ Ready');
  await expect(page.locator('#roster-grid')).toContainText('Alex');
});

test('export downloads schema version 2 and import restores a roster', async ({ page }) => {
  await loadSample(page, 12);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export JSON/ }).click();
  const download = await downloadPromise;
  const fs = require('fs');
  const payload = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(payload.schemaVersion).toBe(2);
  expect(payload.tournament.players).toHaveLength(12);

  await page.getByRole('button', { name: 'Reset All' }).click();
  await page.locator('#confirm-ok-btn').click();
  await expect(page.locator('#roster-grid')).toContainText('No participants added yet');

  await page.locator('#import-json-input').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      schemaVersion: 2,
      tournament: {
        players: [{ id: 'p-import', name: 'Imported Pat' }],
        activeTab: 'setup'
      }
    }))
  });

  await expect(page.locator('#roster-grid')).toContainText('Imported Pat');
  await expect(page.locator('#toast-container')).toContainText('Imported tournament (1 players).');
});

test('reset all returns to an empty setup screen', async ({ page }) => {
  await loadSample(page, 12);
  await page.getByRole('button', { name: 'Reset All' }).click();
  await expect(page.locator('#confirm-title')).toHaveText('Reset Entire Tournament?');
  await page.locator('#confirm-ok-btn').click();
  await expect(page.locator('#view-setup')).toBeVisible();
  await expect(page.locator('#roster-grid')).toContainText('No participants added yet');
  await expect(page.locator('#player-count-badge')).toHaveText('0 / 30 Players (Min 4)');
});
