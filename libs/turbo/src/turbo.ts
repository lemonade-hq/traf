import { dirname, join, relative, resolve } from 'path';
import { parse } from 'yaml';
import { readFile } from 'fs/promises';
import { globby } from 'globby';
import { TrueAffectedProject } from '@traf/core';
import { existsSync } from 'fs';

interface PnpmWorkspace {
  packages: string[];
}

interface PackageJson {
  workspaces?: string[];
}

export async function getWorkspaces(cwd: string): Promise<string[]> {
  const pnpmFile = resolve(cwd, 'pnpm-workspace.yaml');
  if (existsSync(pnpmFile)) {
    const workspace: PnpmWorkspace = parse(await readFile(pnpmFile, 'utf-8'));

    return workspace.packages;
  }

  const pkgJson: PackageJson = JSON.parse(
    await readFile(resolve(cwd, 'package.json'), 'utf-8')
  );

  return pkgJson.workspaces ?? [];
}

export async function getTurboTrueAffectedProjects(
  cwd: string
): Promise<TrueAffectedProject[]> {
  const workspaces = await getWorkspaces(cwd);

  const ignoredWorkspaces = workspaces.filter((workspace) =>
    workspace.startsWith('!')
  );

  const staticIgnores = [
    'node_modules',
    '**/node_modules',
    'dist',
    '.git',
    ...ignoredWorkspaces,
  ];

  const packageGlobPatterns: string[] = workspaces
    .filter((workspace) => !workspace.startsWith('!'))
    .map((workspace) => {
      return join(workspace, 'package.json');
    });

  const combinedPackageGlobPattern = `{${packageGlobPatterns.join(',')},}`;

  const files = await globby(combinedPackageGlobPattern, {
    ignore: staticIgnores,
    absolute: true,
    cwd,
    dot: true,
    suppressErrors: true,
    gitignore: true,
  });

  const projectFiles: TrueAffectedProject[] = [];

  for (const file of files) {
    const project = JSON.parse(await readFile(resolve(cwd, file), 'utf-8')) as {
      name: string;
    };

    projectFiles.push({
      name: project.name,
      sourceRoot: relative(cwd, dirname(file)),
    });
  }

  return projectFiles;
}
