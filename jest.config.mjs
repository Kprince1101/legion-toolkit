export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'],
  testMatch: ['**/src/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  moduleFileExtensions: ['ts', 'js', 'mjs', 'cjs', 'json'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^legion-rules$': '<rootDir>/packages/rules/src/index.ts',
    '^eslint-plugin-legion$': '<rootDir>/packages/eslint-plugin/src/index.ts',
    '^legion-audit$': '<rootDir>/packages/audit/src/index.ts',
    '^legion-init$': '<rootDir>/packages/init/src/index.ts',
  },
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript' },
          target: 'es2022',
        },
        module: { type: 'commonjs' },
      },
    ],
  },
};
