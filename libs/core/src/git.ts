import { execSync } from 'node:child_process';

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
  return execSync(`git diff ${base} --unified=0`, {
    maxBuffer: TEN_MEGABYTES,
    cwd,
    stdio: 'pipe',
  })
    .toString()
    .trim();
}

interface GetChangedFiles {
  filePath: string;
  changedLines: number[];
}

export function getChangedFiles({
  base,
  cwd,
}: BaseGitActionArgs): GetChangedFiles[] {
  const mergeBase = getMergeBase({ base, cwd });
  const diff = getDiff({ base: mergeBase, cwd });

  return diff
    .split(/^diff --git/gm)
    .slice(1)
    .map((file) => {
      /* istanbul ignore next */
      const filePath = file.match(/(?<= a\/).*(?= b\/)/g)?.[0] ?? '';
      /* istanbul ignore next */
      const changedLines =
        file.match(/(?<=@@ -.* \+)\d*(?=.* @@)/g)?.map((line) => +line) ?? [];

      return {
        filePath,
        changedLines,
      };
    });
}
