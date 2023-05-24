import { getChangedFiles, getMergeBase } from './git';
import { resolve } from 'path';
import { readFile, writeFile } from 'fs/promises';
import * as childProcess from 'node:child_process';

const cwd = 'libs/core/src/__fixtures__/git';
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

  describe('getChangedFiles', () => {
    it('should return changed files with line numbers', () => {
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
