const agent = process.env.npm_config_user_agent ?? '';

if (!agent.startsWith('pnpm/')) {
  console.error(
    'This repository is developed with pnpm 10. Run `corepack enable` and then `pnpm install`.',
  );
  process.exit(1);
}
