module.exports = {
  cacheDirectory: "<rootDir>/node_modules/.cache/jest",
  testEnvironment: "jsdom",
  testMatch: ["**/test/frontend*.test.js"],
  transform: { "^.+\\.[jt]sx?$": "babel-jest" },
  moduleNameMapper: { "\\.css$": "<rootDir>/test/styleMock.cjs" },
  collectCoverage: true,
  collectCoverageFrom: ["client/api.js", "client/main.jsx"],
  coverageDirectory: "coverage/frontend",
  coverageReporters: ["text", "lcov"],
};
