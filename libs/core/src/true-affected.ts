import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { Project, Node, ts, SyntaxKind } from 'ts-morph';
import chalk from 'chalk';
import { ChangedFiles, getChangedFiles } from './git';
import { findRootNode, getPackageNameByPath } from './utils';
import { TrueAffected, TrueAffectedProject } from './types';
import { findNonSourceAffectedFiles } from './assets';
import {
  findAffectedFilesByLockfile,
  hasLockfileChanged,
  lockFileName,
} from './lock-files';

const ignoredRootNodeTypes = [
  SyntaxKind.ImportDeclaration,
  SyntaxKind.ExportDeclaration,
  SyntaxKind.ModuleDeclaration,
  SyntaxKind.ExpressionStatement, // iife,
  SyntaxKind.IfStatement,
];

export const DEFAULT_INCLUDE_TEST_FILES = /\.(spec|test)\.(ts|js)x?/;

export const trueAffected = async ({
  cwd,
  rootTsConfig,
  base = 'origin/main',
  projects,
  include = [DEFAULT_INCLUDE_TEST_FILES],
  verbose = false,
  logger = console,
  __experimentalLockfileCheck = false,
}: TrueAffected) => {
  if (verbose) {
    logger.log('Getting affected projects');
    if (rootTsConfig != null) {
      logger.log(
        `Creating project with root tsconfig from ${chalk.bold(
          resolve(cwd, rootTsConfig)
        )}`
      );
    }
  }

  const project = new Project({
    compilerOptions: {
      allowJs: true,
    },
    ...(rootTsConfig == null
      ? {}
      : {
          tsConfigFilePath: resolve(cwd, rootTsConfig),
          skipAddingFilesFromTsConfig: true,
        }),
  });

  projects.forEach(
    ({ name, sourceRoot, tsConfig = join(sourceRoot, 'tsconfig.json') }) => {
      const tsConfigPath = resolve(cwd, tsConfig);

      if (existsSync(tsConfigPath)) {
        if (verbose) {
          logger.log(
            `Adding source files for project ${chalk.bold(
              name
            )} from tsconfig at ${chalk.bold(tsConfigPath)}`
          );
        }
        project.addSourceFilesFromTsConfig(tsConfigPath);
      } else {
        if (verbose) {
          logger.log(
            `Could not find a tsconfig for project ${chalk.bold(
              name
            )}, adding source files paths in ${chalk.bold(
              resolve(cwd, sourceRoot)
            )}`
          );
        }
        project.addSourceFilesAtPaths(
          join(resolve(cwd, sourceRoot), '**/*.{ts,js}')
        );
      }
    }
  );

  const changedFiles = getChangedFiles({
    base,
    cwd,
  });

  if (verbose) {
    logger.log(`Found ${chalk.bold(changedFiles.length)} changed files`);
  }

  const sourceChangedFiles = changedFiles.filter(
    ({ filePath }) => project.getSourceFile(resolve(cwd, filePath)) != null
  );

  const ignoredPaths = ['./node_modules', './build', './dist', './.git'];

  const nonSourceChangedFiles = changedFiles
    .filter(
      ({ filePath }) =>
        !filePath.match(/.*\.(ts|js)x?$/g) &&
        !filePath.endsWith(lockFileName) &&
        project.getSourceFile(resolve(cwd, filePath)) == null
    )
    .flatMap(({ filePath: changedFilePath }) => {
      if (verbose) {
        logger.log(
          `Finding non-source affected files for ${chalk.bold(changedFilePath)}`
        );
      }

      return findNonSourceAffectedFiles(cwd, changedFilePath, ignoredPaths);
    });

  if (verbose && nonSourceChangedFiles.length > 0) {
    logger.log(
      `Found ${chalk.bold(
        nonSourceChangedFiles.length
      )} non-source affected files`
    );
  }

  let changedFilesByLockfile: ChangedFiles[] = [];
  if (__experimentalLockfileCheck && hasLockfileChanged(changedFiles)) {
    if (verbose) {
      logger.log('Lockfile has changed, finding affected files');
    }

    changedFilesByLockfile = findAffectedFilesByLockfile(
      cwd,
      base,
      ignoredPaths
    ).filter(
      ({ filePath }) => project.getSourceFile(resolve(cwd, filePath)) != null
    );
  }

  const filteredChangedFiles = [
    ...sourceChangedFiles,
    ...nonSourceChangedFiles,
    ...changedFilesByLockfile,
  ];

  const changedIncludedFilesPackages = changedFiles
    .filter(({ filePath }) =>
      include.some((file) =>
        typeof file === 'string'
          ? filePath.endsWith(file)
          : filePath.match(file)
      )
    )
    .map(({ filePath }) => getPackageNameByPath(filePath, projects))
    .filter((v): v is string => v != null);

  if (verbose && changedIncludedFilesPackages.length > 0) {
    logger.log(
      `Found ${chalk.bold(
        changedIncludedFilesPackages.length
      )} affected packages from included files`
    );
  }

  const affectedPackages = new Set<string>(changedIncludedFilesPackages);
  const visitedIdentifiers = new Map<string, string[]>();

  const findReferencesLibs = (node: Node<ts.Node>) => {
    const rootNode = findRootNode(node);

    /* istanbul ignore next */
    if (rootNode == null) return;

    if (ignoredRootNodeTypes.find((type) => rootNode.isKind(type))) return;

    const identifier =
      rootNode.getFirstChildByKind(SyntaxKind.Identifier) ??
      rootNode.getFirstDescendantByKind(SyntaxKind.Identifier);

    /* istanbul ignore next */
    if (identifier == null) return;

    const refs = identifier.findReferencesAsNodes();
    const identifierName = identifier.getText();
    const path = rootNode.getSourceFile().getFilePath();

    if (verbose) {
      logger.log(
        `Found identifier ${chalk.bold(identifierName)} in ${chalk.bold(path)}`
      );
    }

    if (identifierName && path) {
      const visited = visitedIdentifiers.get(path) ?? [];
      if (visited.includes(identifierName)) {
        if (verbose) {
          logger.log(
            `Already visited ${chalk.bold(identifierName)} in ${chalk.bold(
              path
            )}`
          );
        }

        return;
      }

      visitedIdentifiers.set(path, [...visited, identifierName]);

      if (verbose) {
        logger.log(
          `Visiting ${chalk.bold(identifierName)} in ${chalk.bold(path)}`
        );
      }
    }

    refs.forEach((node) => {
      const sourceFile = node.getSourceFile();
      const pkg = getPackageNameByPath(sourceFile.getFilePath(), projects);

      if (pkg) {
        affectedPackages.add(pkg);
        if (verbose) {
          logger.log(`Added package ${chalk.bold(pkg)} to affected packages`);
        }
      }

      findReferencesLibs(node);
    });
  };

  filteredChangedFiles.forEach(({ filePath, changedLines }) => {
    const sourceFile = project.getSourceFile(resolve(cwd, filePath));

    /* istanbul ignore next */
    if (sourceFile == null) return;

    changedLines.forEach((line) => {
      try {
        const lineStartPos =
          sourceFile.compilerNode.getPositionOfLineAndCharacter(line - 1, 0);
        const changedNode = sourceFile.getDescendantAtPos(lineStartPos);

        /* istanbul ignore next */
        if (!changedNode) return;

        const pkg = getPackageNameByPath(sourceFile.getFilePath(), projects);

        if (pkg) {
          affectedPackages.add(pkg);
          if (verbose) {
            logger.log(
              `Added package ${chalk.bold(
                pkg
              )} to affected packages for changed line ${chalk.bold(
                line
              )} in ${chalk.bold(filePath)}`
            );
          }
        }

        findReferencesLibs(changedNode);
      } catch {
        return;
      }
    });
  });

  const implicitDeps = (
    projects.filter(
      ({ implicitDependencies = [] }) => implicitDependencies.length > 0
    ) as Required<TrueAffectedProject>[]
  ).reduce(
    (acc, { name, implicitDependencies }) =>
      acc.set(name, implicitDependencies),
    new Map<string, string[]>()
  );

  // add implicit deps
  affectedPackages.forEach((pkg) => {
    const deps = Array.from(implicitDeps.entries())
      .filter(([, deps]) => deps.includes(pkg))
      .map(([name]) => name);

    if (verbose && deps.length > 0) {
      logger.log(
        `Adding implicit dependencies ${chalk.bold(
          deps.join(', ')
        )} to ${chalk.bold(pkg)}`
      );
    }

    deps.forEach((dep) => affectedPackages.add(dep));
  });

  return Array.from(affectedPackages);
};
