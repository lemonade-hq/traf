import { findRootNode, getPackageNameByPath } from './utils';
import { Project, SyntaxKind } from 'ts-morph';

describe('findRootNode', () => {
  it('should find the root node', () => {
    const project = new Project({ useInMemoryFileSystem: true });

    const file = project.createSourceFile('file.ts', 'export const foo = 1;');

    const node = file.getFirstDescendantByKind(SyntaxKind.Identifier);

    const root = findRootNode(node);

    expect(root?.getKind()).toEqual(SyntaxKind.VariableStatement);
  });

  it('should return undefined if could not find root node', () => {
    const project = new Project({ useInMemoryFileSystem: true });

    const file = project.createSourceFile('file.ts', 'export const foo = 1;');

    const node = file.getFirstDescendantByKind(SyntaxKind.FunctionDeclaration);

    const root = findRootNode(node);

    expect(root?.getKindName()).toBeUndefined();
  });
});

describe('getPackageNameByPath', () => {
  it('should return the package name by path', () => {
    const packageName = getPackageNameByPath('pkg1/index.ts', [
      {
        name: 'pkg1',
        sourceRoot: 'pkg1/',
        tsConfig: '',
      },
    ]);

    expect(packageName).toEqual('pkg1');
  });

  it('should return undefined if could not find package name', () => {
    const packageName = getPackageNameByPath('pkg1/index.ts', [
      {
        name: 'pkg2',
        sourceRoot: 'pkg2/',
        tsConfig: '',
      },
    ]);

    expect(packageName).toBeUndefined();
  });
});
