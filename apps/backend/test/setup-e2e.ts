// jest `setupFilesAfterEnv` for the e2e project. Nothing global lives
// here on purpose: each spec boots its own app in beforeAll and calls
// resetDatabase() so files are isolated (jest runs them --runInBand).
jest.setTimeout(30000);
