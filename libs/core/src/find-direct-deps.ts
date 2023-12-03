import { execSync } from 'node:child_process';
import { readModulePackageJson } from 'nx/src/utils/package-json.js';
import type { PackageManager } from 'nx/src/utils/package-manager.js';

interface NpmListJson {
  dependencies: Record<string, unknown>;
}

export function npmFindDirectDeps(cwd: string, packages: string[]): string[] {
  const pattern = packages.length > 1 ? `{${packages.join(',')}}` : packages;
  const result = execSync(`npm list -a --json --package-lock-only ${pattern}`, {
    cwd,
    encoding: 'utf-8',
  });
  const { dependencies = {} } = JSON.parse(result) as NpmListJson;

  return Object.keys(dependencies);
}

export function yarnFindDirectDeps(cwd: string, packages: string[]): string[] {
  const pkg = readModulePackageJson(cwd).packageJson;
  const deps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];

  const direct = deps.filter((dep) => packages.includes(dep));
  const transitive = deps.filter((dep) => !packages.includes(dep));

  if (transitive.length > 0) {
    console.warn(
      'INFO: detected yarn & affected transitive deps. unfortunately yarn list does not return direct dependencies from transitive dependencies. only top level dependencies are returned atm. PRs are welcome!'
    );
  }

  return direct;
}

interface PnpmListJson {
  dependencies: Record<string, unknown>;
  devDependencies: Record<string, unknown>;
}

export function pnpmFindDirectDeps(cwd: string, packages: string[]): string[] {
  // pnpm ls {fast-glob,loader-utils} --depth Infinity --json
  const pattern = packages.length > 1 ? `{${packages.join(',')}}` : packages;
  const result = execSync(`pnpm ls ${pattern} --depth Infinity --json`, {
    cwd,
    encoding: 'utf-8',
  });
  const [{ dependencies = {}, devDependencies = {} }] = JSON.parse(
    result
  ) as PnpmListJson[];

  return [...Object.keys(dependencies), ...Object.keys(devDependencies)];
}

export function findDirectDeps(
  packageManager: PackageManager,
  cwd: string,
  packages: string[]
): string[] {
  switch (packageManager) {
    case 'npm':
      return npmFindDirectDeps(cwd, packages);
    case 'yarn':
      return yarnFindDirectDeps(cwd, packages);
    case 'pnpm':
      return pnpmFindDirectDeps(cwd, packages);
  }
}
