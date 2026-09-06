import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findWorkspaceRoot, workspaceContext } from './workspace.js';

const makeRepo = (): string => mkdtempSync(join(tmpdir(), 'legion-ws-'));

describe('findWorkspaceRoot', () => {
  it('returns the directory itself when it holds the lockfile', () => {
    const root = makeRepo();
    writeFileSync(join(root, 'yarn.lock'), '');
    expect(findWorkspaceRoot(root)).toBe(root);
  });

  it('walks up to the workspace root from a package inside a monorepo', () => {
    const root = makeRepo();
    writeFileSync(join(root, 'yarn.lock'), '');
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ workspaces: ['apps/*'] }),
    );
    const app = join(root, 'apps', 'mobile');
    mkdirSync(app, { recursive: true });
    writeFileSync(
      join(app, 'package.json'),
      JSON.stringify({ name: 'mobile' }),
    );
    expect(findWorkspaceRoot(app)).toBe(root);
    expect(workspaceContext(app).isPackage).toBe(true);
  });

  it('reports a standalone repo as its own workspace root', () => {
    const root = makeRepo();
    writeFileSync(join(root, 'yarn.lock'), '');
    expect(workspaceContext(root).isPackage).toBe(false);
  });
});
