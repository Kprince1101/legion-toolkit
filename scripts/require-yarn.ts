const agent = process.env.npm_config_user_agent ?? '';

if (!agent.startsWith('yarn/')) {
  console.error(
    'This repository is developed with Yarn 4. Run `corepack enable` and then `yarn install`.',
  );
  process.exit(1);
}
