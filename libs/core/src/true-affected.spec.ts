import { trueAffected } from './true-affected';
import * as git from './git';
import * as lockFiles from './lock-files';

jest.mock('chalk', () => ({
  default: {
    bold: (str: string) => str,
  },
}));

describe('trueAffected', () => {
  const cwd = 'libs/core/src/__fixtures__/monorepo';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return only the true affected packages', async () => {
    jest.spyOn(git, 'getChangedFiles').mockReturnValue([
      {
        filePath: 'proj1/index.ts',
        changedLines: [2],
      },
    ]);

    const affected = await trueAffected({
      cwd,
      rootTsConfig: 'tsconfig.json',
      projects: [
        {
          name: 'proj1',
          sourceRoot: 'proj1/',
          tsConfig: 'proj1/tsconfig.json',
        },
        {
          name: 'proj2',
          sourceRoot: 'proj2/',
          tsConfig: 'proj2/tsconfig.json',
        },
        {
          name: 'proj3',
          sourceRoot: 'proj3/',
          tsConfig: 'proj3/tsconfig.json',
        },
      ],
    });

    expect(affected).toEqual(['proj1', 'proj2']);
  });

  it('should support base branch option', async () => {
    jest.spyOn(git, 'getChangedFiles').mockReturnValue([
      {
        filePath: 'proj1/index.ts',
        changedLines: [2],
      },
    ]);

    const affected = await trueAffected({
      cwd,
      base: 'main',
      rootTsConfig: 'tsconfig.json',
      projects: [
        {
          name: 'proj1',
          sourceRoot: 'proj1/',
          tsConfig: 'proj1/tsconfig.json',
        },
        {
          name: 'proj2',
          sourceRoot: 'proj2/',
          tsConfig: 'proj2/tsconfig.json',
        },
        {
          name: 'proj3',
          sourceRoot: 'proj3/',
          tsConfig: 'proj3/tsconfig.json',
        },
      ],
    });

    expect(affected).toEqual(['proj1', 'proj2']);
  });

  it('should support implicit dependencies for projects', async () => {
    jest.spyOn(git, 'getChangedFiles').mockReturnValue([
      {
        filePath: 'proj1/index.ts',
        changedLines: [6],
      },
    ]);

    const affected = await trueAffected({
      cwd,
      base: 'main',
      rootTsConfig: 'tsconfig.json',
      projects: [
        {
          name: 'proj1',
          sourceRoot: 'proj1/',
          tsConfig: 'proj1/tsconfig.json',
        },
        {
          name: 'proj2',
          sourceRoot: 'proj2/',
          tsConfig: 'proj2/tsconfig.json',
        },
        {
          name: 'proj3',
          sourceRoot: 'proj3/',
          tsConfig: 'proj3/tsconfig.json',
          implicitDependencies: ['proj1'],
        },
      ],
    });

    expect(affected).toEqual(['proj1', 'proj3']);
  });

  it('should add all source files if missing tsconfig', async () => {
    jest.spyOn(git, 'getChangedFiles').mockReturnValue([
      {
        filePath: 'proj1/index.ts',
        changedLines: [6],
      },
    ]);

    const affected = await trueAffected({
      cwd,
      base: 'main',
      rootTsConfig: 'tsconfig.json',
      projects: [
        {
          name: 'proj1',
          sourceRoot: 'proj1/',
        },
        {
          name: 'proj3',
          sourceRoot: 'proj3/',
          implicitDependencies: ['proj1'],
        },
      ],
    });

    expect(affected).toEqual(['proj1', 'proj3']);
  });

  it('should support no root tsconfig', async () => {
    jest.spyOn(git, 'getChangedFiles').mockReturnValue([
      {
        filePath: 'proj1/index.ts',
        changedLines: [6],
      },
    ]);

    const affected = await trueAffected({
      cwd,
      base: 'main',
      projects: [
        {
          name: 'proj1',
          sourceRoot: 'proj1/',
        },
        {
          name: 'proj3',
          sourceRoot: 'proj3/',
          implicitDependencies: ['proj1'],
        },
      ],
    });

    expect(affected).toEqual(['proj1', 'proj3']);
  });

  it('should ignore files that are not in projects files', async () => {
    jest.spyOn(git, 'getChangedFiles').mockReturnValue([
      {
        filePath: 'proj1/README.md',
        changedLines: [6],
      },
    ]);

    const affected = await trueAffected({
      cwd,
      base: 'main',
      rootTsConfig: 'tsconfig.json',
      projects: [
        {
          name: 'proj1',
          sourceRoot: 'proj1/',
          tsConfig: 'proj1/tsconfig.json',
        },
        {
          name: 'proj2',
          sourceRoot: 'proj2/',
          tsConfig: 'proj2/tsconfig.json',
        },
        {
          name: 'proj3',
          sourceRoot: 'proj3/',
          tsConfig: 'proj3/tsconfig.json',
          implicitDependencies: ['proj1'],
        },
      ],
    });

    expect(affected).toEqual([]);
  });

  it('should find files that are related to changed files which are not in projects files', async () => {
    jest.spyOn(git, 'getChangedFiles').mockReturnValue([
      {
        filePath: 'angular-component/component.html',
        changedLines: [6],
      },
    ]);

    const affected = await trueAffected({
      cwd,
      base: 'main',
      rootTsConfig: 'tsconfig.json',
      projects: [
        {
          name: 'angular-component',
          sourceRoot: 'angular-component/',
          tsConfig: 'angular-component/tsconfig.json',
        },
        {
          name: 'proj1',
          sourceRoot: 'proj1/',
          tsConfig: 'proj1/tsconfig.json',
        },
        {
          name: 'proj2',
          sourceRoot: 'proj2/',
          tsConfig: 'proj2/tsconfig.json',
        },
        {
          name: 'proj3',
          sourceRoot: 'proj3/',
          tsConfig: 'proj3/tsconfig.json',
          implicitDependencies: ['proj1'],
        },
      ],
    });

    expect(affected).toEqual(['angular-component']);
  });

  describe('__experimentalLockfileCheck', () => {
    it('should find files that are related to changed modules from lockfile if flag is on', async () => {
      jest.spyOn(git, 'getChangedFiles').mockReturnValue([
        {
          filePath: 'package-lock.json',
          changedLines: [2],
        },
      ]);
      jest.spyOn(lockFiles, 'hasLockfileChanged').mockReturnValue(true);
      jest.spyOn(lockFiles, 'findAffectedFilesByLockfile').mockReturnValue([
        {
          filePath: 'proj1/index.ts',
          changedLines: [2],
        },
      ]);

      const affected = await trueAffected({
        cwd,
        base: 'main',
        __experimentalLockfileCheck: true,
        projects: [
          {
            name: 'proj1',
            sourceRoot: 'proj1/',
          },
        ],
      });

      expect(affected).toEqual(['proj1']);
    });

    it('should not find files that are related to changed modules from lockfile if flag is off', async () => {
      jest.spyOn(git, 'getChangedFiles').mockReturnValue([
        {
          filePath: 'package-lock.json',
          changedLines: [2],
        },
      ]);

      const affected = await trueAffected({
        cwd,
        base: 'main',
        __experimentalLockfileCheck: false,
        projects: [
          {
            name: 'proj1',
            sourceRoot: 'proj1/',
          },
        ],
      });

      expect(affected).toEqual([]);
    });
  });

  it("should ignore files when can't find the changed line", async () => {
    jest.spyOn(git, 'getChangedFiles').mockReturnValue([
      {
        filePath: 'proj1/index.ts',
        changedLines: [1000],
      },
    ]);

    const affected = await trueAffected({
      cwd,
      base: 'main',
      rootTsConfig: 'tsconfig.json',
      projects: [
        {
          name: 'proj1',
          sourceRoot: 'proj1/',
          tsConfig: 'proj1/tsconfig.json',
        },
        {
          name: 'proj2',
          sourceRoot: 'proj2/',
          tsConfig: 'proj2/tsconfig.json',
        },
        {
          name: 'proj3',
          sourceRoot: 'proj3/',
          tsConfig: 'proj3/tsconfig.json',
        },
      ],
    });

    expect(affected).toEqual([]);
  });

  it('should ignore files when it can find the line but not the parent node', async () => {
    jest.spyOn(git, 'getChangedFiles').mockReturnValue([
      {
        filePath: 'proj1/index.ts',
        changedLines: [4],
      },
    ]);

    const affected = await trueAffected({
      cwd,
      base: 'main',
      rootTsConfig: 'tsconfig.json',
      projects: [
        {
          name: 'proj1',
          sourceRoot: 'proj1/',
          tsConfig: 'proj1/tsconfig.json',
        },
        {
          name: 'proj2',
          sourceRoot: 'proj2/',
          tsConfig: 'proj2/tsconfig.json',
        },
        {
          name: 'proj3',
          sourceRoot: 'proj3/',
          tsConfig: 'proj3/tsconfig.json',
        },
      ],
    });

    expect(affected).toEqual(['proj1']);
  });

  it.each([
    ['regular path', ['package.json'], ['proj3']],
    ['regexp path', [/\.spec\.ts$/], ['proj1']],
    ['multiple paths', ['package.json', /\.spec\.ts$/], ['proj1', 'proj3']],
  ])('should include files with %s', async (title, filePatterns, expected) => {
    jest.spyOn(git, 'getChangedFiles').mockReturnValue([
      {
        filePath: 'proj1/test.spec.ts',
        changedLines: [1],
      },
      {
        filePath: 'proj3/package.json',
        changedLines: [2],
      },
    ]);

    const affected = await trueAffected({
      cwd,
      base: 'main',
      rootTsConfig: 'tsconfig.json',
      projects: [
        {
          name: 'proj1',
          sourceRoot: 'proj1/',
          tsConfig: 'proj1/tsconfig.json',
        },
        {
          name: 'proj2',
          sourceRoot: 'proj2/',
          tsConfig: 'proj2/tsconfig.json',
        },
        {
          name: 'proj3',
          sourceRoot: 'proj3/',
          tsConfig: 'proj3/tsconfig.json',
        },
      ],
      include: filePatterns,
    });

    expect(affected).toEqual(expected);
  });

  it('should log the progress', async () => {
    const changedFiles = [
      {
        filePath: 'proj1/index.ts',
        changedLines: [2],
      },
    ];
    jest.spyOn(git, 'getChangedFiles').mockReturnValue(changedFiles);

    const debug = jest.fn();
    await trueAffected({
      cwd,
      base: 'main',
      rootTsConfig: 'tsconfig.json',
      projects: [
        {
          name: 'proj1',
          sourceRoot: 'proj1/',
          tsConfig: 'proj1/tsconfig.json',
        },
        {
          name: 'proj2',
          sourceRoot: 'proj2/',
          tsConfig: 'proj2/tsconfig.json',
        },
        {
          name: 'proj3',
          sourceRoot: 'proj3/',
          tsConfig: 'proj3/tsconfig.json',
          implicitDependencies: ['proj1'],
        },
      ],
      logger: {
        debug,
      } as unknown as Console,
    });

    expect(debug).toHaveBeenCalledWith('Getting affected projects');
    expect(debug).toHaveBeenCalledWith(
      expect.stringContaining('Creating project with root tsconfig from')
    );
    expect(debug).toHaveBeenCalledWith(
      expect.stringContaining('Adding source files for project proj1')
    );
    expect(debug).toHaveBeenCalledWith(
      expect.stringContaining('Adding source files for project proj2')
    );
    expect(debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Could not find a tsconfig for project proj3, adding source files paths'
      )
    );
    expect(debug).toHaveBeenCalledWith(
      `Found ${changedFiles.length} changed files`
    );
    expect(debug).toHaveBeenCalledWith(
      `Added package proj1 to affected packages for changed line ${changedFiles[0].changedLines[0]} in ${changedFiles[0].filePath}`
    );
    expect(debug).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(`^Found identifier .* in .*${changedFiles[0].filePath}$`)
      )
    );
    expect(debug).toHaveBeenCalledWith(
      'Added package proj2 to affected packages'
    );
  });

  it('should support compilerOptions', async () => {
    jest.spyOn(git, 'getChangedFiles').mockReturnValue([
      {
        filePath: 'proj1/index.ts',
        changedLines: [4],
      },
    ]);

    const compilerOptions = {
      paths: {
        "@monorepo/proj1": [
          "./proj1/index.ts"
        ],
        "@monorepo/proj2": [
          "./proj2/index.ts"
        ],
        "@monorepo/proj3": [
          "./proj3/index.ts"
        ],
      }
    }

    const affected = await trueAffected({
      cwd,
      base: 'main',
      projects: [
        {
          name: 'proj1',
          sourceRoot: 'proj1/',
          tsConfig: 'proj1/tsconfig.json',
        },
        {
          name: 'proj2',
          sourceRoot: 'proj2/',
          tsConfig: 'proj2/tsconfig.json',
        },
        {
          name: 'proj3',
          sourceRoot: 'proj3/',
          tsConfig: 'proj3/tsconfig.json',
        },
      ],
      include: filePatterns,
      compilerOptions
    });

    expect(affected).toEqual(['proj1']);
  })
});
