import * as globby from 'globby';

export const workspaceCwd = 'libs/nx/src/__fixtures__/nx-workspace';
export const projectCwd = 'libs/nx/src/__fixtures__/nx-project';

export const mockGlobby = () => {
  jest
    .spyOn(globby, 'globby')
    .mockResolvedValue(['./proj1/project.json', './proj2/project.json']);
};
