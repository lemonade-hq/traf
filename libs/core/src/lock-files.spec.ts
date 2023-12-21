import { readFileSync } from 'fs';
import { getLockFileNodes } from 'nx/src/plugins/js/lock-file/lock-file.js';
import { readModulePackageJson } from 'nx/src/utils/package-json.js';
import { fastFindInFiles } from 'fast-find-in-files';
import {
  hasLockfileChanged,
  findAffectedModules,
  findAffectedFilesByLockfile,
} from './lock-files';
import { getFileFromRevision } from './git';
import { findDirectDeps } from './find-direct-deps';

jest.mock('nx/src/plugins/js/lock-file/lock-file.js', () => ({
  getLockFileName: jest.fn().mockReturnValue('yarn.lock'),
  getLockFileNodes: jest.fn(),
}));
jest.mock('fs');
jest.mock('nx/src/utils/package-json.js');
jest.mock('fast-find-in-files');
jest.mock('./git');
jest.mock('./find-direct-deps');

describe('hasLockfileChanged', () => {
  it('should return true if lockfile has changed', () => {
    const hasChanged = hasLockfileChanged([
      { filePath: 'yarn.lock', changedLines: [] },
    ]);

    expect(hasChanged).toBe(true);
  });

  it('should return false if lockfile has not changed', () => {
    const hasChanged = hasLockfileChanged([
      { filePath: 'index.ts', changedLines: [] },
    ]);

    expect(hasChanged).toBe(false);
  });
});

describe('findAffectedModules', () => {
  beforeEach(() => {
    (readFileSync as jest.Mock).mockReturnValueOnce('{}');
    (readModulePackageJson as jest.Mock).mockReturnValueOnce({
      packageJson: {
        dependencies: {
          dep: '1.0.0',
          '@scope/dep': '1.0.0',
        },
      },
    });
  });

  it('should return empty array if lockfile has not changed', () => {
    (getFileFromRevision as jest.Mock).mockReturnValueOnce('{}');
    (getLockFileNodes as jest.Mock).mockReturnValueOnce({});

    findAffectedModules('./', 'main');

    expect(findDirectDeps).toHaveBeenCalledWith(
      'npm',
      './',
      expect.arrayContaining([])
    );
  });

  it('should return empty array if package.json has no dependencies', () => {
    (readModulePackageJson as jest.Mock).mockReturnValueOnce({
      packageJson: {},
    });
    (getFileFromRevision as jest.Mock).mockReturnValueOnce('{}');
    (getLockFileNodes as jest.Mock).mockReturnValueOnce({});

    findAffectedModules('./', 'main');

    expect(findDirectDeps).toHaveBeenCalledWith(
      'npm',
      './',
      expect.arrayContaining([])
    );
  });

  it('should still work when getFileFromRevision throws (no previous version of lock file)', () => {
    (getFileFromRevision as jest.Mock).mockImplementation(() => {
      throw new Error();
    });
    (getLockFileNodes as jest.Mock).mockReturnValueOnce({});

    findAffectedModules('./', 'main');

    expect(findDirectDeps).toHaveBeenCalledWith(
      'npm',
      './',
      expect.arrayContaining([])
    );
  });

  it('should return changed modules if lockfile has not changed', () => {
    (getFileFromRevision as jest.Mock).mockReturnValueOnce('{}');
    (getLockFileNodes as jest.Mock).mockImplementation((manager, file, key) => {
      if (key === 'lock') {
        return {
          [`npm:dep`]: '1.0.0',
        };
      } else {
        return {
          [`npm:dep`]: '2.0.0',
        };
      }
    });

    findAffectedModules('./', 'main');

    expect(findDirectDeps).toHaveBeenCalledWith(
      'npm',
      './',
      expect.arrayContaining(['dep'])
    );
  });

  it('should support scoped packages', () => {
    (getFileFromRevision as jest.Mock).mockReturnValueOnce('{}');
    (getLockFileNodes as jest.Mock).mockImplementation((manager, file, key) => {
      if (key === 'lock') {
        return {
          [`npm:@scope/dep`]: '1.0.0',
        };
      } else {
        return {
          [`npm:@scope/dep`]: '2.0.0',
        };
      }
    });

    findAffectedModules('./', 'main');

    expect(findDirectDeps).toHaveBeenCalledWith(
      'npm',
      './',
      expect.arrayContaining(['@scope/dep'])
    );
  });

  it('should support scoped packages with different versions', () => {
    (getFileFromRevision as jest.Mock).mockReturnValueOnce('{}');
    (getLockFileNodes as jest.Mock).mockImplementation((manager, file, key) => {
      if (key === 'lock') {
        return {
          [`npm:@scope/dep@1.0.0`]: '1.0.0',
        };
      } else {
        return {
          [`npm:@scope/dep@1.0.0`]: '2.0.0',
        };
      }
    });

    findAffectedModules('./', 'main');

    expect(findDirectDeps).toHaveBeenCalledWith(
      'npm',
      './',
      expect.arrayContaining(['@scope/dep'])
    );
  });

  it('should return module name even if it does not start with npm:', () => {
    (getFileFromRevision as jest.Mock).mockReturnValueOnce('{}');
    (getLockFileNodes as jest.Mock).mockImplementation((manager, file, key) => {
      if (key === 'lock') {
        return {
          [`dep`]: '1.0.0',
        };
      } else {
        return {
          [`dep`]: '2.0.0',
        };
      }
    });

    findAffectedModules('./', 'main');

    expect(findDirectDeps).toHaveBeenCalledWith(
      'npm',
      './',
      expect.arrayContaining(['dep'])
    );
  });
});

describe('findAffectedFilesByLockfile', () => {
  const cwd = '/project';
  const excludeFolderPaths = ['node_modules', 'dist', '.git'];

  beforeEach(() => {
    (readFileSync as jest.Mock).mockReturnValueOnce('{}');
    (readModulePackageJson as jest.Mock).mockReturnValueOnce({
      packageJson: {
        dependencies: {
          '@scope/dep': '1.0.0',
        },
      },
    });
    (getFileFromRevision as jest.Mock).mockReturnValueOnce('{}');
    (getLockFileNodes as jest.Mock).mockImplementation((manager, file, key) => {
      if (key === 'lock') {
        return {
          [`npm:@scope/dep`]: '1.0.0',
        };
      } else {
        return {
          [`npm:@scope/dep`]: '2.0.0',
        };
      }
    });
    (findDirectDeps as jest.Mock).mockReturnValue(['@scope/dep']);
  });

  it('should return relevant files', () => {
    (fastFindInFiles as jest.Mock).mockReturnValue([
      {
        filePath: '/project/src/file.ts',
        queryHits: [{ lineNumber: 1, line: `import dep from '@scope/dep';` }],
      },
      {
        filePath: '/project/src/file.ts',
        queryHits: [
          { lineNumber: 2, line: `const a = import(() => '@scope/dep');` },
        ],
      },
      {
        filePath: '/project/src/file.ts',
        queryHits: [
          { lineNumber: 3, line: `const a = require('@scope/dep');` },
        ],
      },
    ]);

    const result = findAffectedFilesByLockfile(cwd, 'main', excludeFolderPaths);

    expect(result).toEqual([
      { filePath: 'src/file.ts', changedLines: [1] },
      { filePath: 'src/file.ts', changedLines: [2] },
      { filePath: 'src/file.ts', changedLines: [3] },
    ]);
  });

  it('should return relevant files with multiple hits', () => {
    (fastFindInFiles as jest.Mock).mockReturnValue([
      {
        filePath: '/project/src/file.ts',
        queryHits: [
          { lineNumber: 1, line: `import dep from '@scope/dep';` },
          { lineNumber: 2, line: `const a = import(() => '@scope/dep');` },
          { lineNumber: 3, line: `const a = require('@scope/dep');` },
        ],
      },
    ]);

    const result = findAffectedFilesByLockfile(cwd, 'main', excludeFolderPaths);

    expect(result).toEqual([
      { filePath: 'src/file.ts', changedLines: [1, 2, 3] },
    ]);
  });

  it('should return empty array if no relevant files found', () => {
    (fastFindInFiles as jest.Mock).mockReturnValue([]);

    const result = findAffectedFilesByLockfile(cwd, 'main', excludeFolderPaths);

    expect(result).toEqual([]);
  });

  it("should still work even if found file didn't have a match", () => {
    (fastFindInFiles as jest.Mock).mockReturnValue([
      {
        filePath: '/project/src/file.ts',
        queryHits: [{ lineNumber: 1, line: `console.log('hi')` }],
      },
    ]);

    const result = findAffectedFilesByLockfile(cwd, 'main', excludeFolderPaths);

    expect(result).toEqual([]);
  });
});
