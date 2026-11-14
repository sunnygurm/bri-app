const { expect } = require('@playwright/test');

const SAMPLE_12 = [
  'Alex', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Morgan',
  'Sam', 'Quinn', 'Avery', 'Cameron', 'Drew', 'Logan'
];

async function openFresh(page) {
  await page.goto('/PongMasterPro.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tournament Setup & Player Roster' })).toBeVisible();
}

async function loadSample(page, count) {
  const labels = {
    12: '12 Players',
    17: '17 Players (Odd)',
    24: '24 Players'
  };
  await page.getByRole('button', { name: labels[count], exact: true }).click();
}

async function generateSchedule(page) {
  await page.getByRole('button', { name: 'Generate Round-Robin Schedule' }).click();
  await expect(page.getByRole('heading', { name: 'Round-Robin Court & Queue Manager' })).toBeVisible();
}

async function clickCupsPlus(page, playerName) {
  const card = page.locator('#active-tables-section div.rounded-lg').filter({ hasText: playerName }).first();
  const cupsRow = card.locator('div').filter({ has: page.getByText('Cups', { exact: true }) }).last();
  await cupsRow.getByRole('button', { name: '+', exact: true }).click();
}

module.exports = {
  SAMPLE_12,
  openFresh,
  loadSample,
  generateSchedule,
  clickCupsPlus
};
