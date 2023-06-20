import { resolve } from 'path';
import * as cli from './cli';
import * as nx from './nx';
import { workspaceCwd } from './mocks';
import { TrueAffectedProject } from '@traf/core';

jest.mock('chalk', () => ({
  chalk: jest.fn(),
}));

jest.mock('globby', () => ({
  globby: jest.fn(),
}));

const trafSpy = jest.fn();

jest.mock('@traf/core', () => ({
  trueAffected: (args: unknown) => trafSpy(args),
}));

const mockSpawn = jest.fn();

jest.mock('node:child_process', () => ({
  spawn: (command: string, options: Record<string, unknown>) =>
    mockSpawn(command, options),
}));

async function runCommand(args: string[]) {
  process.argv = ['node', 'cli.js', ...args];

  // const { run } = await import('./cli');

  // Require the yargs CLI script
  return cli.run();
}

describe('cli', () => {
  describe('run', () => {
    let originalArgv: typeof process.argv;
    let affectedActionSpy: jest.SpyInstance<Promise<void>>;

    beforeEach(() => {
      originalArgv = process.argv;
      affectedActionSpy = jest
        .spyOn(cli, 'affectedAction')
        .mockImplementation();
    });

    afterEach(() => {
      process.argv = originalArgv;
      jest.restoreAllMocks();
    });

    it('should run command with default options', () => {
      runCommand(['affected']);
      expect(affectedActionSpy).toBeCalledWith({
        action: 'log',
        base: 'origin/main',
        cwd: process.cwd(),
        includeFiles: [],
        json: false,
        restArgs: [],
        tsConfigFilePath: 'tsconfig.base.json',
      });
    });

    it('should override options', () => {
      runCommand([
        'affected',
        'build',
        '--base=master',
        '--tsConfigFilePath=tsconfig.json',
        `--cwd=${workspaceCwd}`,
        '--includeFiles=package.json,jest.setup.js',
      ]);
      expect(affectedActionSpy).toBeCalledWith({
        action: 'build',
        base: 'master',
        cwd: resolve(process.cwd(), workspaceCwd),
        includeFiles: ['package.json', 'jest.setup.js'],
        json: false,
        restArgs: [],
        tsConfigFilePath: 'tsconfig.json',
      });
    });
  });

  describe('affectedAction', () => {
    let getNxTrueAffectedProjectsSpy: jest.SpyInstance<
      Promise<TrueAffectedProject[]>
    >;

    let logSpy: jest.SpyInstance<void>;
    beforeEach(() => {
      getNxTrueAffectedProjectsSpy = jest
        .spyOn(nx, 'getNxTrueAffectedProjects')
        .mockImplementation();

      logSpy = jest.spyOn(cli, 'log').mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should pass parameters correctly', async () => {
      trafSpy.mockResolvedValueOnce([]);
      getNxTrueAffectedProjectsSpy.mockResolvedValueOnce([]);

      await cli.affectedAction({
        action: 'log',
        base: 'origin/main',
        cwd: process.cwd(),
        includeFiles: [],
        json: false,
        restArgs: [],
        tsConfigFilePath: 'tsconfig.base.json',
      });

      expect(getNxTrueAffectedProjectsSpy).toBeCalledWith(process.cwd());
      expect(trafSpy).toHaveBeenCalledWith({
        cwd: process.cwd(),
        rootTsConfig: 'tsconfig.base.json',
        base: 'origin/main',
        projects: [],
        includeFiles: [],
      });
    });

    it('should log no affected projects', async () => {
      trafSpy.mockResolvedValueOnce([]);
      getNxTrueAffectedProjectsSpy.mockResolvedValueOnce([]);

      await cli.affectedAction({
        action: 'log',
        base: 'origin/main',
        cwd: process.cwd(),
        includeFiles: [],
        json: false,
        restArgs: [],
        tsConfigFilePath: 'tsconfig.base.json',
      });

      expect(logSpy).toHaveBeenCalledWith('No affected projects');
    });

    it('should run log command', async () => {
      trafSpy.mockResolvedValueOnce(['proj1']);

      await cli.affectedAction({
        action: 'log',
        base: 'origin/main',
        cwd: process.cwd(),
        includeFiles: [],
        json: false,
        restArgs: [],
        tsConfigFilePath: 'tsconfig.base.json',
      });

      expect(logSpy).toHaveBeenCalledWith('Affected projects:\n - proj1');
    });

    it('should run other commands', async () => {
      trafSpy.mockResolvedValueOnce(['proj1']);
      mockSpawn.mockReturnValue({
        on: jest.fn(),
      });

      await cli.affectedAction({
        action: 'build',
        base: 'origin/main',
        cwd: process.cwd(),
        includeFiles: [],
        json: false,
        restArgs: [],
        tsConfigFilePath: 'tsconfig.base.json',
      });

      const expectedCommand = `npx nx run-many --target=build --projects=proj1 `;

      expect(logSpy).toHaveBeenCalledWith(
        `Running command: ${expectedCommand}`
      );
      expect(mockSpawn).toHaveBeenCalledWith(
        expectedCommand,
        expect.anything()
      );
    });
  });
});
