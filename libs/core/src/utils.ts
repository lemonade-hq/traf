import { ts, SyntaxKind, Node } from 'ts-morph';
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
  projects: TrueAffectedProject[],
  // Search files in the project root as well
  includesRoot = false,
): string | undefined => {
  return projects.map(({ name, sourceRoot }) => ({
     name,
     root: includesRoot ? sourceRoot.substring(0, sourceRoot.lastIndexOf("/")) : sourceRoot
   }))
   // In case of nested project paths (for example when there's a root project.json):
   // sort the paths from the longest to the shortest so the sub-directories come before their parent directories
   .sort((a, b) => b.root.length - a.root.length)
   .find(
    ({ root }) => path.includes(root)
  )?.name;
};
