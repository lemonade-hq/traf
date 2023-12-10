import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { Project, Node, ts, SyntaxKind } from 'ts-morph';
import { GetChangedFiles, getChangedFiles } from './git';
import {
  findNonSourceAffectedFiles,
  findRootNode,
  getPackageNameByPath,
} from './utils';
import { TrueAffected, TrueAffectedProject } from './types';

const ignoredRootNodeTypes = [
  SyntaxKind.ImportDeclaration,
  SyntaxKind.ExportDeclaration,
  SyntaxKind.ModuleDeclaration,
  SyntaxKind.ExpressionStatement, // iife,
  SyntaxKind.IfStatement,
];

export const trueAffected = async ({
  cwd,
  rootTsConfig,
  base = 'origin/main',
  projects,
  includeFiles = [],
  testSuffixes = ['spec', 'test'],
}: TrueAffected) => {
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

  const implicitDeps = (
    projects.filter(
      ({ implicitDependencies = [] }) => implicitDependencies.length > 0
    ) as Required<TrueAffectedProject>[]
  ).reduce(
    (acc, { name, implicitDependencies }) =>
      acc.set(name, implicitDependencies),
    new Map<string, string[]>()
  );

  projects.forEach(
    ({ sourceRoot, tsConfig = join(sourceRoot, 'tsconfig.json') }) => {
      const tsConfigPath = resolve(cwd, tsConfig);

      if (existsSync(tsConfigPath)) {
        project.addSourceFilesFromTsConfig(tsConfigPath);
      } else {
        project.addSourceFilesAtPaths(
          join(resolve(cwd, sourceRoot), '**/*.{ts,js}')
        );
      }

      project.addSourceFilesAtPaths(
        includeFiles.map((path) => `${resolve(cwd, sourceRoot)}/${path}`)
      );
    }
  );

  const sourceChangedFiles: GetChangedFiles[] = getChangedFiles({
    base,
    cwd,
  }).filter(
    ({ filePath }) => project.getSourceFile(resolve(cwd, filePath)) != null
  );

  const ignoredPaths = ['./node_modules', './dist', './.git'];

  const nonSourceChangedFiles: GetChangedFiles[] = getChangedFiles({
    base,
    cwd,
  })
    .filter(
      ({ filePath }) =>
        !filePath.match(/.*\.(ts|js)x?$/g) &&
        project.getSourceFile(resolve(cwd, filePath)) == null
    )
    .flatMap(({ filePath: changedFilePath }) =>
      findNonSourceAffectedFiles(cwd, changedFilePath, ignoredPaths)
    );

  const changedFiles = [...sourceChangedFiles, ...nonSourceChangedFiles];

  const changedTestFilesPackages = changedFiles
    .filter(({ filePath }) =>
      new RegExp(`.*\\.(${testSuffixes.join('|')})\\.(ts|js)x?$`).test(filePath)
    )
    .map(({ filePath }) => getPackageNameByPath(filePath, projects))
    .filter((v): v is string => v != null);

  const affectedPackages = new Set<string>(changedTestFilesPackages);
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

    if (identifierName && path) {
      const visited = visitedIdentifiers.get(identifierName) ?? [];
      if (visited.includes(path)) return;
      visitedIdentifiers.set(identifierName, [...visited, path]);
    }

    refs.forEach((node) => {
      const sourceFile = node.getSourceFile();
      const pkg = getPackageNameByPath(sourceFile.getFilePath(), projects);

      if (pkg) affectedPackages.add(pkg);

      findReferencesLibs(node);
    });
  };

  changedFiles.forEach(({ filePath, changedLines }) => {
    const sourceFile = project.getSourceFile(resolve(cwd, filePath));

    if (sourceFile == null) return;

    changedLines.forEach((line) => {
      try {
        const lineStartPos =
          sourceFile.compilerNode.getPositionOfLineAndCharacter(line - 1, 0);
        const changedNode = sourceFile.getDescendantAtPos(lineStartPos);

        /* istanbul ignore next */
        if (!changedNode) return;

        const pkg = getPackageNameByPath(sourceFile.getFilePath(), projects);

        if (pkg) affectedPackages.add(pkg);

        findReferencesLibs(changedNode);
      } catch {
        return;
      }
    });
  });

  // add implicit deps
  affectedPackages.forEach((pkg) => {
    const deps = Array.from(implicitDeps.entries())
      .filter(([, deps]) => deps.includes(pkg))
      .map(([name]) => name);

    deps.forEach((dep) => affectedPackages.add(dep));
  });

  return Array.from(affectedPackages);
};
