module.exports = {
  // Automatically clear mock calls and instances between every test
  clearMocks: true,

  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,

  // The directory where Jest should output its coverage files
  coverageDirectory: "coverage",

  // Indicates which provider should be used to instrument code for coverage
  coverageProvider: "v8",

  // A list of paths to directories that Jest should use to search for files in
  roots: [
    "<rootDir>/src"
  ],

  // The test environment that will be used for testing
  testEnvironment: "node",

  // A map from regular expressions to paths to transformers
  transform: {
    "^.+\\.(js|jsx)$": "babel-jest"
  },

  // An array of regexp pattern strings that are matched against all test paths
  testPathIgnorePatterns: [
    "/node_modules/"
  ],

  // An array of regexp pattern strings that are matched against all source file paths
  transformIgnorePatterns: [
    "/node_modules/",
    "\\.pnp\\.[^\\/]+$"
  ],

  // Automatically reset mock state between every test
  resetMocks: true,

  // The glob patterns Jest uses to detect test files
  testMatch: [
    "**/__tests__/**/*.[jt]s?(x)",
    "**/?(*.)+(spec|test).[tj]s?(x)"
  ],

  // An array of regexp pattern strings that are matched against all test files
  testPathIgnorePatterns: [
    "/node_modules/"
  ],

  // A map from regular expressions to module names or to arrays of module names
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1"
  },

  // Setup files to run before each test
  setupFiles: ["<rootDir>/src/tests/setup.js"],

  // Environment variables for tests
  testEnvironmentVariables: {
    NODE_ENV: "test"
  }
};
