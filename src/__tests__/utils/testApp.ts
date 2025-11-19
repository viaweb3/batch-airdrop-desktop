import { createTempTestDir, cleanupTempDir } from './testUtils';

let testDir: string;
let mockApp: any;
let mockDatabaseService: any;

export async function setupTestApp() {
  testDir = createTempTestDir();

  // Mock Express app for API testing
  mockApp = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    use: jest.fn(),
    listen: jest.fn()
  };

  // Mock database service for testing
  mockDatabaseService = {
    initialize: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    getCampaigns: jest.fn().mockResolvedValue([]),
    getCampaign: jest.fn().mockResolvedValue(null),
    createCampaign: jest.fn().mockResolvedValue({ id: 'test-campaign-id' }),
    updateCampaign: jest.fn().mockResolvedValue(true),
    deleteCampaign: jest.fn().mockResolvedValue(true)
  };

  return {
    app: mockApp,
    databaseService: mockDatabaseService
  };
}

export async function teardownTestApp() {
  if (mockDatabaseService && typeof mockDatabaseService.close === 'function') {
    await mockDatabaseService.close();
  }

  if (testDir) {
    cleanupTempDir(testDir);
  }
}
