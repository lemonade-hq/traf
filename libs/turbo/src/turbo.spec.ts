import { getWorkspaces, getTurboTrueAffectedProjects } from './turbo';
import * as globby from 'globby';
import * as fs from 'fs';
import { join } from 'path';

jest.mock('globby', () => ({
  globby: jest.fn(),
}));

// jest.mock('fs', () => ({
//   ...jest.requireActual('fs'),
//   existsSync: jest.fn(),
// }));

describe('workspace', () => {
  describe('getWorkspaces', () => {
    describe('turbo with package.json workspaces', () => {
      const cwd = 'libs/turbo/src/__fixtures__/package-workspaces';
      it('should return all found monorepo projects', async () => {
        const projects = await getWorkspaces(cwd);

        expect(projects).toEqual(expect.arrayContaining(['proj1', 'proj2']));
      });
    });

    describe('turbo with pnpm workspaces', () => {
      const cwd = 'libs/turbo/src/__fixtures__/turbo-pnpm';

      beforeEach(() => {
        jest
          .spyOn(globby, 'globby')
          .mockResolvedValue(['./proj1/package.json', './proj2/package.json']);
      });

      it('should return all found turbo projects', async () => {
        const projects = await getWorkspaces(cwd);

        expect(projects).toEqual(expect.arrayContaining(['proj1', 'proj2']));
      });
    });

    describe('no package.json workspaces and no pnpm workspaces', () => {
      it('should return an empty array', async () => {
        const projects = await getWorkspaces('.');

        expect(projects).toEqual([]);
      });
    });
  });

  describe('getTurboTrueAffectedProjects', () => {
    const cwd = 'libs/turbo/src/__fixtures__/package-workspaces';
    beforeAll(() => {
      jest
        .spyOn(globby, 'globby')
        .mockResolvedValue([join(cwd, './proj1/package.json')]);
    });

    describe('tsConfig is set in build options', () => {
      it('should return build script tsConfig if exists', async () => {
        jest.spyOn(fs.promises, 'readFile').mockImplementation((pathLike) => {
          const path = pathLike.toString();

          if (path.endsWith(join(cwd, 'proj1/package.json'))) {
            return Promise.resolve(
              JSON.stringify({
                name: 'proj1',
              })
            );
          } else if (path.endsWith(join(cwd, 'package.json'))) {
            return Promise.resolve(
              JSON.stringify({
                workspaces: ['proj1', 'proj2'],
              })
            );
          }

          return Promise.reject('File not found');
        });

        const projects = await getTurboTrueAffectedProjects(cwd);

        expect(projects).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              name: 'proj1',
              sourceRoot: 'proj1',
            }),
          ])
        );
      });
    });
  });
});
