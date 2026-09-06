if (process.env.GITHUB_ACTIONS !== 'true') {
  console.error(
    'Publishing happens only from the release workflow on GitHub Actions, with npm provenance. Local publishes are blocked.',
  );
  process.exit(1);
}
