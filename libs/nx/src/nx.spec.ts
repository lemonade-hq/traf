import { getNxProjects } from './nx';
import * as globby from 'globby';

jest.mock('globby', () => ({
  globby: jest.fn(),
}));

describe('nx', () => {
  describe('getNxProjects', () => {
    describe('nx workspace with workspace.json', () => {
      const cwd = 'libs/nx/src/__fixtures__/nx-workspace';
      it('should return all found nx projects', async () => {
        const projects = await getNxProjects(cwd);

        expect(projects).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              name: 'proj1',
              project: {},
            }),
            expect.objectContaining({
              name: 'proj2',
              project: {},
            }),
          ])
        );
      });
    });

    describe('nx workspace with nested project.json', () => {
      const cwd = 'libs/nx/src/__fixtures__/nx-project';

      beforeEach(() => {
        jest
          .spyOn(globby, 'globby')
          .mockResolvedValue(['./proj1/project.json', './proj2/project.json']);
      });

      it('should return all found nx projects', async () => {
        const projects = await getNxProjects(cwd);

        expect(projects).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              name: 'proj1',
              project: {
                name: 'proj1',
              },
            }),
            expect.objectContaining({
              name: 'proj2',
              project: {
                name: 'proj2',
              },
            }),
          ])
        );
      });
    });

    describe('no nx workspace and no nested project.json', () => {
      it('should return an empty array', async () => {
        const logSpy = jest
          .spyOn(console, 'log')
          .mockImplementationOnce(() => '');

        const projects = await getNxProjects('.');

        expect(logSpy).toHaveBeenCalled();
        expect(projects).toEqual([]);
      });
    });
  });
});
