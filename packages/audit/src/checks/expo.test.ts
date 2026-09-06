import {
  classifyDoctorOutput,
  isPatchOnlyDrift,
  parseMismatchRows,
  parseVersion,
} from './expo.js';

const DRIFT_OUTPUT = `
✖ Check that packages match versions required by installed Expo SDK
  The following packages should be updated for best compatibility with the installed expo version:
    package          expected      found
    expo-camera      ~57.0.5       57.0.4
    expo-constants   ~57.0.14      57.0.13
`;

const MAJOR_OUTPUT = `
✖ Check that packages match versions required by installed Expo SDK
    package          expected      found
    react-native     0.83.0        0.81.4
`;

const OTHER_FAILURE = `
✖ Check for app config fields that may not be synced in a non-CNG project
  This project has native project folders but also has native configuration properties in app.json.
`;

describe('parseVersion', () => {
  it('reads a semver out of a range', () => {
    expect(parseVersion('~57.0.15')).toEqual({
      major: 57,
      minor: 0,
      patch: 15,
    });
  });

  it('returns null when there is no version', () => {
    expect(parseVersion('latest')).toBeNull();
  });
});

describe('isPatchOnlyDrift', () => {
  it('is true when only the patch differs', () => {
    expect(isPatchOnlyDrift('~57.0.16', '57.0.15')).toBe(true);
  });

  it('is false for a minor or major difference', () => {
    expect(isPatchOnlyDrift('~57.1.0', '57.0.15')).toBe(false);
    expect(isPatchOnlyDrift('0.83.0', '0.81.4')).toBe(false);
  });

  it('is false when the versions are equal', () => {
    expect(isPatchOnlyDrift('57.0.15', '57.0.15')).toBe(false);
  });
});

describe('parseMismatchRows', () => {
  it('reads the package table and skips the header', () => {
    expect(parseMismatchRows(DRIFT_OUTPUT)).toEqual([
      { name: 'expo-camera', expected: '~57.0.5', found: '57.0.4' },
      { name: 'expo-constants', expected: '~57.0.14', found: '57.0.13' },
    ]);
  });
});

describe('classifyDoctorOutput', () => {
  it('passes a clean run', () => {
    const verdict = classifyDoctorOutput('17/17 checks passed', 0);
    expect(verdict.blocking).toBe(false);
    expect(verdict.patchDrift).toEqual([]);
  });

  it('does not block on patch-level drift alone', () => {
    const verdict = classifyDoctorOutput(DRIFT_OUTPUT, 1);
    expect(verdict.blocking).toBe(false);
    expect(verdict.reason).toBe('patch-level drift only');
    expect(verdict.patchDrift).toHaveLength(2);
  });

  it('blocks on a major or minor mismatch', () => {
    const verdict = classifyDoctorOutput(MAJOR_OUTPUT, 1);
    expect(verdict.blocking).toBe(true);
    expect(verdict.reason).toContain('react-native');
  });

  it('blocks on a failure that is not version drift', () => {
    const verdict = classifyDoctorOutput(OTHER_FAILURE, 1);
    expect(verdict.blocking).toBe(true);
    expect(verdict.reason).toBe(
      'a doctor check failed that is not version drift',
    );
  });

  it('blocks when more than one check failed, even if one is drift', () => {
    const verdict = classifyDoctorOutput(DRIFT_OUTPUT + OTHER_FAILURE, 1);
    expect(verdict.blocking).toBe(true);
    expect(verdict.reason).toBe('more than one doctor check failed');
  });
});
