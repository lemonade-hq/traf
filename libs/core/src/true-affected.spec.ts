import {
  trueAffected,
  findRootNode,
  getPackageNameByPath,
} from './true-affected';
import { Project, SyntaxKind } from 'ts-morph';
import * as git from './git';

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

  it('should ignore files that are not in projects files', async () => {
    jest.spyOn(git, 'getChangedFiles').mockReturnValue([
      {
        filePath: 'proj1/index.spec.ts',
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
    ['glob path', ['**/package.json'], ['proj3']],
    [
      'multiple paths',
      ['package.json', '**/jest.config.js'],
      ['proj2', 'proj3'],
    ],
  ])('should include files with %s', async (title, filePatterns, expected) => {
    jest.spyOn(git, 'getChangedFiles').mockReturnValue([
      {
        filePath: 'proj2/jest.config.js',
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
      includeFiles: filePatterns,
    });

    expect(affected).toEqual(expected);
  });
});

describe('findRootNode', () => {
  it('should find the root node', () => {
    const project = new Project({ useInMemoryFileSystem: true });

    const file = project.createSourceFile('file.ts', 'export const foo = 1;');

    const node = file.getFirstDescendantByKind(SyntaxKind.Identifier);

    const root = findRootNode(node);

    expect(root?.getKind()).toEqual(SyntaxKind.VariableStatement);
  });

  it('should return undefined if could not find root node', () => {
    const project = new Project({ useInMemoryFileSystem: true });

    const file = project.createSourceFile('file.ts', 'export const foo = 1;');

    const node = file.getFirstDescendantByKind(SyntaxKind.FunctionDeclaration);

    const root = findRootNode(node);

    expect(root?.getKindName()).toBeUndefined();
  });
});

describe('getPackageNameByPath', () => {
  it('should return the package name by path', () => {
    const packageName = getPackageNameByPath('pkg1/index.ts', [
      {
        name: 'pkg1',
        sourceRoot: 'pkg1/',
        tsConfig: '',
      },
    ]);

    expect(packageName).toEqual('pkg1');
  });

  it('should return undefined if could not find package name', () => {
    const packageName = getPackageNameByPath('pkg1/index.ts', [
      {
        name: 'pkg2',
        sourceRoot: 'pkg2/',
        tsConfig: '',
      },
    ]);

    expect(packageName).toBeUndefined();
  });
});
