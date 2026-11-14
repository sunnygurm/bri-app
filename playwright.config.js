const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
  },
  webServer: {
    command: 'python3 -m http.server 4173',
    url: 'http://127.0.0.1:4173/PongMasterPro.html',
    reuseExistingServer: !process.env.CI,
  },
});
