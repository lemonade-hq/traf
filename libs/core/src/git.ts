import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const TEN_MEGABYTES = 1024 * 10000;

interface BaseGitActionArgs {
  base: string;
  cwd?: string;
}

interface GitMergeBaseArgs extends BaseGitActionArgs {
  head?: string;
}

export function getMergeBase({
  cwd,
  base,
  head = 'HEAD',
}: GitMergeBaseArgs): string {
  try {
    return execSync(`git merge-base "${base}" "${head}"`, {
      maxBuffer: TEN_MEGABYTES,
      stdio: 'pipe',
      cwd,
    })
      .toString()
      .trim();
  } catch {
    try {
      return execSync(`git merge-base --fork-point "${base}" "${head}"`, {
        maxBuffer: TEN_MEGABYTES,
        stdio: 'pipe',
        cwd,
      })
        .toString()
        .trim();
    } catch {
      return base;
    }
  }
}

export function getDiff({ base, cwd }: BaseGitActionArgs): string {
  try {
    const diffCommand =
      cwd != null
        ? `git diff ${base} --unified=0 --relative -- ${resolve(cwd)}`
        : `git diff ${base} --unified=0 `;

    return execSync(diffCommand, {
      maxBuffer: TEN_MEGABYTES,
      cwd,
      stdio: 'pipe',
    })
      .toString()
      .trim();
  } catch (e) {
    throw new Error(
      `Unable to get diff for base: "${base}". are you using the correct base?`
    );
  }
}

interface FileFromRevisionArgs extends BaseGitActionArgs {
  filePath: string;
}

export function getFileFromRevision({
  base,
  filePath,
  cwd,
}: FileFromRevisionArgs): string {
  try {
    return execSync(`git show ${base}:${filePath}`, {
      maxBuffer: TEN_MEGABYTES,
      cwd,
      stdio: 'pipe',
    })
      .toString()
      .trim();
  } catch (e) {
    throw new Error(
      `Unable to get file "${filePath}" for base: "${base}". are you using the correct base?`
    );
  }
}

export interface ChangedFiles {
  filePath: string;
  changedLines: number[];
}

export function getChangedFiles({
  base,
  cwd,
}: BaseGitActionArgs): ChangedFiles[] {
  const mergeBase = getMergeBase({ base, cwd });
  const diff = getDiff({ base: mergeBase, cwd });

  return diff
    .split(/^diff --git/gm)
    .slice(1)
    .map((file) => {
      /* istanbul ignore next */
      const filePath = (file.match(/(?<=["\s]a\/).*(?=["\s]b\/)/g)?.[0] ?? '').replace('"', '').trim();
      /* istanbul ignore next */
      const changedLines =
        file.match(/(?<=@@ -.* \+)\d*(?=.* @@)/g)?.map((line) => +line) ?? [];

      return {
        filePath,
        changedLines,
      };
    });
}
