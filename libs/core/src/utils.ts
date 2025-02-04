import { ts, SyntaxKind, Node, SourceFile } from 'ts-morph';
import { TrueAffectedProject } from './types';

export const findRootNode = (
  node?: Node<ts.Node>
): Node<ts.Node> | undefined => {
  if (node == null) return;
  /* istanbul ignore next */
  if (node.getParent()?.getKind() === SyntaxKind.SourceFile) return node;
  return findRootNode(node.getParent());
};

export const getPackageNameByPath = (
  path: string,
  projects: TrueAffectedProject[]
): string | undefined => {
  return projects.find(({ sourceRoot }) => path.includes(sourceRoot))?.name;
};

export const findNodeAtLine = (
  sourceFile: SourceFile,
  line: number
): Node<ts.Node> | undefined => {
  const lineStartPos = sourceFile.compilerNode.getPositionOfLineAndCharacter(
    line - 1,
    0
  );
  return sourceFile.getDescendantAtPos(lineStartPos);
};
