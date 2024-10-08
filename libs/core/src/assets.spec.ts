import { fastFindInFiles } from 'fast-find-in-files';
import { existsSync } from 'fs';
import * as path from 'path';
import { findNonSourceAffectedFiles } from './assets';

jest.mock('fast-find-in-files');
jest.mock('fs');

describe('findNonSourceAffectedFiles', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return relevant files', () => {
    const cwd = '/project';
    const changedFilePaths = ['/project/src/file.ts'];
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
      changedFilePaths,
      excludeFolderPaths
    );

    expect(result).toEqual([{ filePath: 'src/file.ts', changedLines: [1] }]);
    expect(fastFindInFiles).toHaveBeenCalledWith({
      directory: cwd,
      needle: new RegExp(
        changedFilePaths
          .map((changedFilePath) => path.basename(changedFilePath))
          .join('|')
          .replaceAll('.', '\\.')
      ),
      excludeFolderPaths: excludeFolderPaths.map((folder) =>
        path.join(cwd, folder)
      ),
    });
  });

  it('should aggregate changedFilePaths to regExp needle', () => {
    const cwd = '/project';
    const changedFilePaths = ['/project/src/file.ts', '/project/src/file2.ts'];
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
      changedFilePaths,
      excludeFolderPaths
    );
    expect(result).toEqual([{ filePath: 'src/file.ts', changedLines: [1] }]);
    expect(fastFindInFiles).toHaveBeenCalledWith({
      directory: cwd,
      needle: new RegExp(
        changedFilePaths
          .map((changedFilePath) => path.basename(changedFilePath))
          .join('|')
          .replaceAll('.', '\\.')
      ),
      excludeFolderPaths: excludeFolderPaths.map((folder) =>
        path.join(cwd, folder)
      ),
    });
  });

  it('should return empty array if no relevant files found', () => {
    const cwd = '/project';
    const changedFilePaths = ['/project/src/file.ts'];
    const excludeFolderPaths = ['node_modules', 'dist', '.git'];

    (fastFindInFiles as jest.Mock).mockReturnValue([]);
    (existsSync as jest.Mock).mockReturnValue(true);

    const result = findNonSourceAffectedFiles(
      cwd,
      changedFilePaths,
      excludeFolderPaths
    );

    expect(result).toEqual([]);
    expect(fastFindInFiles).toHaveBeenCalledWith({
      directory: cwd,
      needle: new RegExp(
        changedFilePaths
          .map((changedFilePath) => path.basename(changedFilePath))
          .join('|')
          .replaceAll('.', '\\.')
      ),
      excludeFolderPaths: excludeFolderPaths.map((folder) =>
        path.join(cwd, folder)
      ),
    });
  });

  it("should still work even if found file didn't have a match", () => {
    const cwd = '/project';
    const changedFilePaths = ['/project/src/file.ts'];
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
      changedFilePaths,
      excludeFolderPaths
    );

    expect(result).toEqual([]);
    expect(fastFindInFiles).toHaveBeenCalledWith({
      directory: cwd,
      needle: new RegExp(
        changedFilePaths
          .map((changedFilePath) => path.basename(changedFilePath))
          .join('|')
          .replaceAll('.', '\\.')
      ),
      excludeFolderPaths: excludeFolderPaths.map((folder) =>
        path.join(cwd, folder)
      ),
    });
  });
});
