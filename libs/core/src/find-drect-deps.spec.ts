import * as cp from 'node:child_process';
import * as packageJsonUtils from 'nx/src/utils/package-json.js';
import {
  pnpmFindDirectDeps,
  npmFindDirectDeps,
  yarnFindDirectDeps,
  findDirectDeps,
} from './find-direct-deps';

describe('pnpmFindDirectDeps', () => {
  const cwd = '/project';
  const packages = ['nested-dep1', 'nested-dep2'];

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should execute pnpm ls command with correct pattern and options', () => {
    const spy = jest.spyOn(cp, 'execSync').mockReturnValueOnce(
      JSON.stringify([
        {
          dependencies: { dep1: '1.0.0' },
          devDependencies: { dep2: '2.0.0' },
        },
      ])
    );

    pnpmFindDirectDeps(cwd, packages);

    expect(spy).toHaveBeenCalledWith(
      `pnpm ls {nested-dep1,nested-dep2} --depth Infinity --json`,
      {
        cwd,
        encoding: 'utf-8',
      }
    );
  });

  it('should execute pnpm ls command with correct pattern when there is only one package', () => {
    const spy = jest.spyOn(cp, 'execSync').mockReturnValueOnce(
      JSON.stringify([
        {
          dependencies: { dep1: '1.0.0' },
          devDependencies: { dep2: '2.0.0' },
        },
      ])
    );

    pnpmFindDirectDeps(cwd, ['nested-dep1']);

    expect(spy).toHaveBeenCalledWith(
      `pnpm ls nested-dep1 --depth Infinity --json`,
      {
        cwd,
        encoding: 'utf-8',
      }
    );
  });

  it('should return direct dependencies from the pnpm ls result', () => {
    jest.spyOn(cp, 'execSync').mockReturnValueOnce(
      JSON.stringify([
        {
          dependencies: { dep1: '1.0.0' },
          devDependencies: { dep2: '2.0.0' },
        },
      ])
    );

    const result = pnpmFindDirectDeps(cwd, packages);

    expect(result).toEqual(['dep1', 'dep2']);
  });

  it('should return an empty array if pnpm ls result is empty', () => {
    jest.spyOn(cp, 'execSync').mockReturnValueOnce(JSON.stringify([{}]));

    const result = pnpmFindDirectDeps(cwd, packages);

    expect(result).toEqual([]);
  });
});

describe('npmFindDirectDeps', () => {
  const cwd = '/project';
  const packages = ['nested-dep1', 'nested-dep2'];

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should execute npm list command with correct pattern and options', () => {
    const spy = jest.spyOn(cp, 'execSync').mockReturnValueOnce(
      JSON.stringify({
        dependencies: { dep1: '1.0.0', dep2: '2.0.0' },
      })
    );

    npmFindDirectDeps(cwd, packages);

    expect(spy).toHaveBeenCalledWith(
      `npm list -a --json --package-lock-only {nested-dep1,nested-dep2}`,
      {
        cwd,
        encoding: 'utf-8',
      }
    );
  });

  it('should execute npm list command with correct pattern when there is only one package', () => {
    const spy = jest.spyOn(cp, 'execSync').mockReturnValueOnce(
      JSON.stringify({
        dependencies: { dep1: '1.0.0', dep2: '2.0.0' },
      })
    );

    npmFindDirectDeps(cwd, ['nested-dep1']);

    expect(spy).toHaveBeenCalledWith(
      `npm list -a --json --package-lock-only nested-dep1`,
      {
        cwd,
        encoding: 'utf-8',
      }
    );
  });

  it('should return direct dependencies from the npm list result', () => {
    jest.spyOn(cp, 'execSync').mockReturnValueOnce(
      JSON.stringify({
        dependencies: { dep1: '1.0.0', dep2: '2.0.0' },
      })
    );

    const result = npmFindDirectDeps(cwd, packages);

    expect(result).toEqual(['dep1', 'dep2']);
  });

  it('should return an empty array if npm list result is empty', () => {
    jest.spyOn(cp, 'execSync').mockReturnValueOnce(JSON.stringify({}));

    const result = npmFindDirectDeps(cwd, packages);

    expect(result).toEqual([]);
  });
});

describe('yarnFindDirectDeps', () => {
  const cwd = '/project';

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return direct dependencies from package.json if they were affected', () => {
    jest.spyOn(packageJsonUtils, 'readModulePackageJson').mockReturnValueOnce({
      path: '/project/package.json',
      packageJson: {
        name: 'project',
        version: '1.0.0',
        dependencies: {
          dep1: '1.0.0',
        },
        devDependencies: {
          dep2: '2.0.0',
        },
      },
    });
    const result = yarnFindDirectDeps(cwd, ['dep1', 'dep2']);

    expect(result).toEqual(['dep1', 'dep2']);
  });

  it('should return an empty array if affected packages are transitive', () => {
    jest.spyOn(packageJsonUtils, 'readModulePackageJson').mockReturnValueOnce({
      path: '/project/package.json',
      packageJson: {
        name: 'project',
        version: '1.0.0',
        dependencies: {
          dep1: '1.0.0',
        },
      },
    });

    const result = yarnFindDirectDeps(cwd, ['nested-dep1', 'nested-dep2']);

    expect(result).toEqual([]);
  });

  it('should warn if found transitive dependencies', () => {
    jest.spyOn(packageJsonUtils, 'readModulePackageJson').mockReturnValueOnce({
      path: '/project/package.json',
      packageJson: {
        name: 'project',
        version: '1.0.0',
        devDependencies: {
          dep2: '2.0.0',
        },
      },
    });

    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementationOnce(() => {});
    yarnFindDirectDeps(cwd, ['nested-dep1', 'nested-dep2']);

    expect(warnSpy).toHaveBeenCalledWith(
      'INFO: detected yarn & affected transitive deps. unfortunately yarn list does not return direct dependencies from transitive dependencies. only top level dependencies are returned atm. PRs are welcome!'
    );
  });
});

describe('findDirectDeps', () => {
  const cwd = '/project';

  it('should call pnpmFindDirectDeps if packageManager is pnpm', () => {
    const execSpy = jest
      .spyOn(cp, 'execSync')
      .mockImplementationOnce(() => '[{}]');

    findDirectDeps('pnpm', cwd, ['dep1', 'dep2']);

    expect(execSpy).toHaveBeenLastCalledWith(
      expect.stringContaining('pnpm ls'),
      expect.objectContaining({
        cwd,
        encoding: 'utf-8',
      })
    );
  });

  it('should call npmFindDirectDeps if packageManager is npm', () => {
    const execSpy = jest
      .spyOn(cp, 'execSync')
      .mockImplementationOnce(() => '{}');

    findDirectDeps('npm', cwd, ['dep1', 'dep2']);

    expect(execSpy).toHaveBeenLastCalledWith(
      expect.stringContaining('npm list'),
      expect.objectContaining({
        cwd,
        encoding: 'utf-8',
      })
    );
  });

  it('should call yarnFindDirectDeps if packageManager is yarn', () => {
    const readModulePackageJsonSpy = jest
      .spyOn(packageJsonUtils, 'readModulePackageJson')
      .mockReturnValueOnce({
        path: '/project/package.json',
        packageJson: {
          name: 'project',
          version: '1.0.0',
          dependencies: {
            dep1: '1.0.0',
          },
        },
      });

    findDirectDeps('yarn', cwd, ['dep1', 'dep2']);

    expect(readModulePackageJsonSpy).toHaveBeenCalledWith(cwd);
  });
});
