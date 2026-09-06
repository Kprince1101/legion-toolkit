import { createRequire } from 'node:module';
import {
  defineLegionConfig,
  recommended as recommendedConfig,
  rules,
  strict as strictConfig,
} from 'legion-rules';
import type {
  EslintExtras,
  EslintFlatConfig,
  LegionConfig,
  LegionConfigInput,
} from 'legion-rules';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

export interface LegionPlugin {
  meta: { name: string; version: string };
  rules: typeof rules;
  configs: {
    recommended: EslintFlatConfig[];
    strict: EslintFlatConfig[];
  };
}

const plugin: LegionPlugin = {
  meta: { name: 'legion', version },
  rules,
  configs: { recommended: [], strict: [] },
};

plugin.configs.recommended = recommendedConfig.eslint(plugin);
plugin.configs.strict = strictConfig.eslint(plugin);

export const legionEslintConfig = (
  config: LegionConfig | LegionConfigInput,
  extras?: EslintExtras,
): EslintFlatConfig[] => {
  if ('eslint' in config && typeof config.eslint === 'function') {
    return config.eslint(plugin, extras);
  }
  return defineLegionConfig(config as LegionConfigInput).eslint(plugin, extras);
};

export const legionOxlintConfig = (config: LegionConfigInput) =>
  defineLegionConfig(config).oxlint;

export { recommendedConfig as recommended, strictConfig as strict, rules };

export default plugin;
