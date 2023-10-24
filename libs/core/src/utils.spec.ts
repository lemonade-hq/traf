import {
  findNonSourceAffectedFiles,
  findRootNode,
  getPackageNameByPath,
} from './utils';
import * as path from 'path';
import { fastFindInFiles } from 'fast-find-in-files';
import { existsSync } from 'fs';
import { Project, SyntaxKind } from 'ts-morph';

jest.mock('fast-find-in-files');
jest.mock('fs');

describe('findNonSourceAffectedFiles', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return relevant files', () => {
    const cwd = '/project';
    const changedFilePath = '/project/src/file.ts';
    const excludeFolderPaths = ['node_modules', 'dist', '.git'];

    (fastFindInFiles as jest.Mock).mockReturnValue([
      {
        filePath: '/project/src/file.ts',
        queryHits: [{ lineNumber: 1, line: `"file.ts"` }],
      },
    ]);
    (existsSync as jest.Mock).mockReturnValue(true);

    const result = findNonSourceAffectedFiles(
      cwd,
      changedFilePath,
      excludeFolderPaths
    );

    expect(result).toEqual([{ filePath: 'src/file.ts', changedLines: [1] }]);
    expect(fastFindInFiles).toHaveBeenCalledWith({
      directory: cwd,
      needle: path.basename(changedFilePath),
      excludeFolderPaths: excludeFolderPaths.map((folder) =>
        path.join(cwd, folder)
      ),
    });
  });

  it('should return empty array if no relevant files found', () => {
    const cwd = '/project';
    const changedFilePath = '/project/src/file.ts';
    const excludeFolderPaths = ['node_modules', 'dist', '.git'];

    (fastFindInFiles as jest.Mock).mockReturnValue([]);
    (existsSync as jest.Mock).mockReturnValue(true);

    const result = findNonSourceAffectedFiles(
      cwd,
      changedFilePath,
      excludeFolderPaths
    );

    expect(result).toEqual([]);
    expect(fastFindInFiles).toHaveBeenCalledWith({
      directory: cwd,
      needle: path.basename(changedFilePath),
      excludeFolderPaths: excludeFolderPaths.map((folder) =>
        path.join(cwd, folder)
      ),
    });
  });

  it("should still work even if found file didn't have a match", () => {
    const cwd = '/project';
    const changedFilePath = '/project/src/file.ts';
    const excludeFolderPaths = ['node_modules', 'dist', '.git'];

    (fastFindInFiles as jest.Mock).mockReturnValue([
      {
        filePath: '/project/src/file.ts',
        queryHits: [{ lineNumber: 1, line: `console.log('hi')` }],
      },
    ]);
    (existsSync as jest.Mock).mockReturnValue(true);

    const result = findNonSourceAffectedFiles(
      cwd,
      changedFilePath,
      excludeFolderPaths
    );

    expect(result).toEqual([]);
    expect(fastFindInFiles).toHaveBeenCalledWith({
      directory: cwd,
      needle: path.basename(changedFilePath),
      excludeFolderPaths: excludeFolderPaths.map((folder) =>
        path.join(cwd, folder)
      ),
    });
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
