const { test, expect } = require('@playwright/test');
const { SAMPLE_12, openFresh, loadSample, generateSchedule } = require('./helpers');

async function simulateAndOpenStandings(page) {
  await page.getByRole('button', { name: /Simulate Remaining Games/ }).click();
  const progress = (await page.locator('#rr-progress-badge').innerText()).trim();
  const completed = progress.match(/^(\d+) \/ \1 Completed$/);
  expect(completed, progress).not.toBeNull();
  expect(Number(completed[1])).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'View Standings & Seeding →' }).click();
  await expect(page.getByRole('heading', { name: 'Individual Standings & High-Low Seeding' })).toBeVisible();
}

test('12-player standings seed a play-in bracket and a series win advances', async ({ page }) => {
  await openFresh(page);
  await loadSample(page, 12);
  await generateSchedule(page);
  await simulateAndOpenStandings(page);

  const rows = page.locator('#standings-tbody tr');
  await expect(rows).toHaveCount(12);
  for (const name of SAMPLE_12) {
    await expect(page.locator('#standings-tbody')).toContainText(name);
  }

  await page.getByRole('button', { name: /Lock Standings & Launch Playoff Bracket/ }).click();
  await expect(page.getByRole('heading', { name: 'High-Low Seeded Playoff Bracket' })).toBeVisible();
  await expect(page.locator('#playoff-teams-strip')).toContainText('Ranks #1 & #2');
  await expect(page.locator('#bracket-columns-container')).toContainText('Play-In Round');
  await expect(page.locator('#bracket-columns-container')).toContainText('Championship Finals');
  await expect(page.locator('#bracket-columns-container')).toContainText('Best of 5');

  const playIn = page.locator('#bracket-columns-container > div').filter({ hasText: 'Play-In Round' });
  const match = playIn.locator('.w-72').first();
  const teamLabel = (await match.locator('.truncate').first().innerText()).trim();
  const plus = match.locator('.truncate').first().locator('xpath=..').getByRole('button', { name: '+', exact: true });
  await plus.click();
  await plus.click();

  await expect(match).toContainText('Decided');
  const semifinals = page.locator('#bracket-columns-container > div').filter({
    has: page.getByText('Semifinals', { exact: true })
  });
  await expect(semifinals).toContainText(teamLabel);
});

test('17 players produce one solo playoff team', async ({ page }) => {
  await openFresh(page);
  await loadSample(page, 17);
  await generateSchedule(page);
  await simulateAndOpenStandings(page);
  await expect(page.locator('#standings-tbody tr')).toHaveCount(17);

  await page.getByRole('button', { name: /Lock Standings & Launch Playoff Bracket/ }).click();
  await expect(page.locator('#playoff-teams-strip')).toContainText('SOLO');
  await expect(page.locator('#playoff-teams-strip')).toContainText('(Solo)');
});
