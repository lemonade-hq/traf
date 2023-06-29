import { getChangedFiles, getMergeBase, getDiff } from './git';
import { resolve } from 'path';
import { readFile, writeFile } from 'fs/promises';
import * as childProcess from 'node:child_process';

const cwd = 'libs/core/src/__fixtures__/git';
const absoluteCwd = resolve(cwd);
const branch = 'main';

describe('git', () => {
  let oldFile: string;

  const restoreFile = async () => {
    await writeFile(resolve(cwd, 'index.ts'), oldFile);
  };

  beforeAll(async () => {
    // setup git repo in order to test getMergeBase & getChangedFiles functions
    try {
      childProcess.execSync(`git init -b ${branch}`, { cwd });
      childProcess.execSync(
        `git add . && git -c user.name="test" -c user.email="user@test.com" commit -m "initial"`,
        { cwd }
      );
    } catch {
      // ignore
    }
  });

  afterAll(async () => {
    childProcess.execSync('rm -rf .git', { cwd });
  });

  beforeEach(async () => {
    oldFile = await readFile(resolve(cwd, 'index.ts'), 'utf-8');
    const newFile = oldFile.replace('return;', 'return 1;');

    await writeFile(resolve(cwd, 'index.ts'), newFile);
  });

  afterEach(async () => {
    await restoreFile();
  });

  describe('getMergeBase', () => {
    it('should return merge-base commit sha', () => {
      const mergeBase = getMergeBase({
        base: branch,
        cwd,
      });

      expect(mergeBase).toEqual(expect.any(String));
    });

    it('should fallback to fork-point if merge-base fails', () => {
      jest.spyOn(childProcess, 'execSync').mockImplementationOnce(() => {
        throw new Error();
      });

      const mergeBase = getMergeBase({
        base: branch,
        cwd,
      });

      expect(mergeBase).toEqual(expect.any(String));
    });

    it('should fallback to "base" if fork-point fails', () => {
      const spy = jest
        .spyOn(childProcess, 'execSync')
        .mockImplementation(() => {
          throw new Error();
        });

      const mergeBase = getMergeBase({
        base: branch,
        cwd,
      });

      expect(mergeBase).toEqual(branch);

      spy.mockRestore();
    });
  });

  describe('getDiff', () => {
    it('should return diff', () => {
      const diff = getDiff({
        base: branch,
        cwd,
      });

      expect(diff).toEqual(expect.any(String));
    });

    it('should throw error if provided base does not exist', () => {
      const spy = jest
        .spyOn(childProcess, 'execSync')
        .mockImplementation(() => {
          throw new Error();
        });

      const nonExistingBranch = 'branch-that-does-not-exist';

      expect(() =>
        getDiff({
          base: nonExistingBranch,
          cwd,
        })
      ).toThrow(
        `Unable to get diff for base: "${nonExistingBranch}". are you using the correct base?`
      );

      spy.mockRestore();
    });
  });

  describe('getChangedFiles', () => {
    it('should return changed files with line numbers from relative cwd path', () => {
      const changedFiles = getChangedFiles({
        base: branch,
        cwd,
      });

      expect(changedFiles).toEqual([
        {
          filePath: 'index.ts',
          changedLines: [3],
        },
      ]);
    });

    it('should return changed files with line numbers from absolute cwd path', () => {
      const changedFiles = getChangedFiles({
        base: branch,
        cwd: absoluteCwd,
      });

      expect(changedFiles).toEqual([
        {
          filePath: 'index.ts',
          changedLines: [3],
        },
      ]);
    });

    it('should return empty array if no files changed', async () => {
      await restoreFile();

      const changedFiles = getChangedFiles({
        base: branch,
        cwd,
      });

      expect(changedFiles).toEqual([]);
    });
  });
});
