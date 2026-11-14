const { test, expect } = require('@playwright/test');
const { openFresh, loadSample, generateSchedule, clickCupsPlus } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await openFresh(page);
  await loadSample(page, 12);
  await generateSchedule(page);
});

test('two tables start open and a suggested game can be started', async ({ page }) => {
  await expect(page.locator('#active-tables-section')).toContainText('Table 1 (Open)');
  await expect(page.locator('#active-tables-section')).toContainText('Table 2 (Open)');
  await expect(page.locator('#rr-table-usage-badge')).toHaveText('0 / 2 Tables Active');

  await page.getByRole('button', { name: /Game Started/ }).first().click();
  await expect(page.locator('#active-tables-section')).toContainText('Table 1 (LIVE)');
  await expect(page.locator('#rr-table-usage-badge')).toHaveText('1 / 2 Tables Active');
});

test('a winner needs 10 effective cups, a tie goes to overtime, and pause returns the game', async ({ page }) => {
  await page.getByRole('button', { name: /Game Started/ }).first().click();
  const live = page.locator('#active-tables-section');
  const finishButtons = live.getByRole('button', { name: /Need 10/ });
  await expect(finishButtons).toHaveCount(2);
  await expect(finishButtons.nth(0)).toBeDisabled();
  await expect(finishButtons.nth(1)).toBeDisabled();

  const pairAName = (await live.locator('div.rounded-lg').first().locator('div').first().innerText()).trim();
  for (let i = 0; i < 10; i++) await clickCupsPlus(page, pairAName);
  await expect(live.getByRole('button', { name: '🏆 Pair A Wins & Finish' })).toBeEnabled();

  const pairBName = (await live.locator('div.rounded-lg').nth(2).locator('div').first().innerText()).trim();
  for (let i = 0; i < 10; i++) await clickCupsPlus(page, pairBName);
  await expect(live.getByRole('button', { name: /Wins & Finish/ })).toHaveCount(0);
  await expect(live.getByRole('button', { name: /Need 10 \(10\/10\)/ })).toHaveCount(2);

  const startOt = live.getByRole('button', { name: /Start OT \(11\)/ });
  await expect(startOt).toBeEnabled();
  await startOt.click();
  await expect(live).toContainText('Target 11');

  await live.getByRole('button', { name: /Pause/ }).click();
  await expect(live).toContainText('Table 1 (Open)');
  await expect(live).not.toContainText('Table 1 (LIVE)');
});
