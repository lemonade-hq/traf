import { readFileSync } from 'fs';
import diff from 'microdiff';
import { FastFindInFiles, fastFindInFiles } from 'fast-find-in-files';
import { join, relative } from 'path';
import {
  getLockFileName,
  getLockFileNodes,
} from 'nx/src/plugins/js/lock-file/lock-file.js';
import { detectPackageManager } from 'nx/src/utils/package-manager.js';
import { readModulePackageJson } from 'nx/src/utils/package-json.js';
import { ChangedFiles, getFileFromRevision } from './git';

const packageManager = detectPackageManager();
export const lockFileName = getLockFileName(packageManager);

export function findAffectedModules(cwd: string, base: string): string[] {
  const lock = readFileSync(lockFileName, 'utf-8');
  let prevLock = '{}';

  try {
    prevLock = getFileFromRevision({
      base,
      filePath: lockFileName,
      cwd,
    });
  } catch (e) {
    // ignore
  }

  const nodes = getLockFileNodes(packageManager, lock, 'lock');
  const prevNodes = getLockFileNodes(packageManager, prevLock, 'prevLock');
  const changes = diff(prevNodes, nodes);

  const pkg = readModulePackageJson(cwd).packageJson;
  const deps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];

  const captureModuleName = new RegExp(/npm:(@?[\w-/]+)/);

  return Array.from(
    new Set<string>(
      changes
        .map(
          ({ path }) =>
            captureModuleName.exec(path[0].toString())?.[1] ??
            path[0].toString()
        )
        .filter((module) => deps.includes(module))
    )
  );
}

export function hasLockfileChanged(changedFiles: ChangedFiles[]): boolean {
  return changedFiles.some(({ filePath }) => filePath === lockFileName);
}

export function findAffectedFilesByLockfile(
  cwd: string,
  base: string,
  excludePaths: string[]
): ChangedFiles[] {
  const dependencies = findAffectedModules(cwd, base);
  const excludeFolderPaths = excludePaths.map((path) => join(cwd, path));

  // fastFindInFiles supports regex but fails with `@` in the regex
  const files = dependencies.flatMap((dep) =>
    fastFindInFiles({
      directory: cwd,
      needle: dep,
      excludeFolderPaths,
    })
  );

  const relevantFiles = filterRelevantFiles(cwd, files, dependencies.join('|'));

  return relevantFiles;
}

function filterRelevantFiles(
  cwd: string,
  files: FastFindInFiles[],
  libName: string
): ChangedFiles[] {
  const regExp = new RegExp(`['"\`](?<lib>${libName})(?:/.*)?['"\`]`);

  return files
    .map(({ filePath: foundFilePath, queryHits }) => ({
      filePath: relative(cwd, foundFilePath),
      changedLines: queryHits
        .filter(({ line }) => isRelevantLine(line, regExp))
        .map(({ lineNumber }) => lineNumber),
    }))
    .filter(({ changedLines }) => changedLines.length > 0);
}

function isRelevantLine(line: string, regExp: RegExp): boolean {
  const match = regExp.exec(line);
  const { lib } = match?.groups ?? {};

  return lib != null;
}
