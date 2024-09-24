import { basename, dirname, join, relative, resolve } from 'path';
import { ChangedFiles } from './git';
import { FastFindInFiles, fastFindInFiles } from 'fast-find-in-files';
import { existsSync } from 'fs';

export function findNonSourceAffectedFiles(
  cwd: string,
  changedFilePath: string,
  excludeFolderPaths: (string | RegExp)[]
): ChangedFiles[] {
  const fileName = basename(changedFilePath);

  const files = fastFindInFiles({
    directory: cwd,
    needle: fileName,
    excludeFolderPaths: excludeFolderPaths.map((path) =>
      typeof path === 'string' ? join(cwd, path) : path
    ),
  });

  const relevantFiles = filterRelevantFiles(cwd, files, changedFilePath);

  return relevantFiles;
}

function filterRelevantFiles(
  cwd: string,
  files: FastFindInFiles[],
  changedFilePath: string
): ChangedFiles[] {
  const fileName = basename(changedFilePath);
  const regExp = new RegExp(`['"\`](?<relFilePath>.*${fileName})['"\`]`);

  return files
    .map(({ filePath: foundFilePath, queryHits }) => ({
      filePath: relative(cwd, foundFilePath),
      changedLines: queryHits
        .filter(({ line }) =>
          isRelevantLine(line, regExp, cwd, foundFilePath, changedFilePath)
        )
        .map(({ lineNumber }) => lineNumber),
    }))
    .filter(({ changedLines }) => changedLines.length > 0);
}

function isRelevantLine(
  line: string,
  regExp: RegExp,
  cwd: string,
  foundFilePath: string,
  changedFilePath: string
): boolean {
  const match = regExp.exec(line);
  const { relFilePath } = match?.groups ?? {};

  if (relFilePath == null) return false;

  const changedFile = resolve(cwd, changedFilePath);
  const relatedFilePath = resolve(
    cwd,
    relative(cwd, join(dirname(foundFilePath), relFilePath))
  );

  return relatedFilePath === changedFile && existsSync(relatedFilePath);
}
