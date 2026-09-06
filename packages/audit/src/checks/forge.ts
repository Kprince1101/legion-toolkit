import { run } from '../exec.js';
import type { Forge } from '../types.js';

interface ForgeProfile {
  label: string;
  pattern: RegExp;
  fix: string[];
}

const PROFILES: Record<Exclude<Forge, 'unknown'>, ForgeProfile> = {
  github: {
    label: 'GitHub',
    pattern: /\(#\d+\)|Merge pull request #\d+/,
    fix: ['git switch -c <branch>', 'gh pr create --fill --assignee @me'],
  },
  gitlab: {
    label: 'GitLab',
    pattern: /See merge request [^\s]*!\d+|![0-9]+\b/,
    fix: ['git switch -c <branch>', 'glab mr create --fill'],
  },
  bitbucket: {
    label: 'Bitbucket',
    pattern: /\(pull request #\d+\)|Merged in .+ \(pull request/,
    fix: [
      'git switch -c <branch>',
      'push, then open the pull request in Bitbucket',
    ],
  },
  azure: {
    label: 'Azure DevOps',
    pattern: /Merged PR \d+:/,
    fix: ['git switch -c <branch>', 'az repos pr create'],
  },
};

export const forgeFromRemote = (url: string): Forge => {
  const normalized = url.toLowerCase();
  if (normalized.includes('github.com')) return 'github';
  if (normalized.includes('gitlab')) return 'gitlab';
  if (normalized.includes('bitbucket')) return 'bitbucket';
  if (normalized.includes('dev.azure.com')) return 'azure';
  if (normalized.includes('visualstudio.com')) return 'azure';
  return 'unknown';
};

export const detectForge = (root: string): Forge => {
  const result = run('git', ['remote', 'get-url', 'origin'], root);
  if (result.code !== 0) return 'unknown';
  return forgeFromRemote(result.stdout.trim());
};

export const forgeLabel = (forge: Forge): string => {
  if (forge === 'unknown') return 'an unrecognized host';
  return PROFILES[forge].label;
};

export const forgePattern = (forge: Forge): RegExp | null => {
  if (forge === 'unknown') return null;
  return PROFILES[forge].pattern;
};

export const forgeFix = (forge: Forge): string[] => {
  if (forge === 'unknown') return [];
  return PROFILES[forge].fix;
};
