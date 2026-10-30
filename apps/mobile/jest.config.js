module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  // Cold Babel transforms of RN components can exceed the 5s default on the first run.
  testTimeout: 15000,
};
