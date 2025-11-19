/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '!**/__tests__/e2e/**/*.spec.ts'
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
        moduleResolution: 'node',
        resolveJsonModule: true
      }
    }]
  },
  collectCoverageFrom: [
    'src/main/**/*.ts',
    'src/main/**/*.js',
    '!src/main/**/*.d.ts',
    '!src/main/**/index.ts',
    '!src/main/database/schema.ts' // Exclude complex database schema from coverage
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 30000,
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/src/__tests__/utils/', // Exclude utility files from being run as tests
    '<rootDir>/src/__tests__/setup.ts', // Exclude setup file from being run as tests
    '<rootDir>/src/__tests__/e2e/' // Exclude Playwright e2e tests
  ],
  resetMocks: true,
  restoreMocks: true,
  clearMocks: true,
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(uuid)/)'
  ],
};