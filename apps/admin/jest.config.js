/**
 * Unit tests for apps/admin's lib layer only — pure logic and Graph-API
 * wrappers with fetch mocked. Component/route testing happens in the
 * Playwright E2E suite (e2e/ at the repo root), not here: Next 14 App Router
 * pages and Base UI components don't unit-test meaningfully without a browser.
 * Same jest+ts-jest stack as packages/notify, so one person maintains one
 * testing toolchain.
 */
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
  },
  collectCoverageFrom: ['src/lib/**/*.ts'],
  coverageDirectory: 'coverage',
  verbose: true,
};
