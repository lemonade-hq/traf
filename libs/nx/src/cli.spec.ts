import { resolve } from 'path';
import * as cli from './cli';
import * as nx from './nx';
import { workspaceCwd } from './mocks';
import { TrueAffectedProject } from '@traf/core';

jest.mock('chalk', () => ({
  hex: jest.fn().mockReturnValue(jest.fn()),
  bgHex: jest.fn().mockReturnValue({
    bold: jest.fn(),
  }),
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
  return cli.run();
}

describe('log', () => {
  it('should log', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation();
    cli.log('test');

    expect(logSpy).toHaveBeenCalled();
  });
});

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
        all: false,
        base: 'origin/main',
        cwd: process.cwd(),
        includeFiles: [],
        json: false,
        restArgs: [],
        tsConfigFilePath: 'tsconfig.base.json',
        target: [],
        experimentalLockfileCheck: false,
      });
    });

    it('should override options', () => {
      runCommand([
        'affected',
        'build',
        '--all=true',
        '--base=master',
        '--tsConfigFilePath=tsconfig.json',
        `--cwd=${workspaceCwd}`,
        '--includeFiles=package.json,jest.setup.js',
      ]);
      expect(affectedActionSpy).toBeCalledWith({
        action: 'build',
        all: 'true',
        base: 'master',
        cwd: resolve(process.cwd(), workspaceCwd),
        includeFiles: ['package.json', 'jest.setup.js'],
        json: false,
        restArgs: [],
        tsConfigFilePath: 'tsconfig.json',
        target: [],
        experimentalLockfileCheck: false,
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
        cwd: process.cwd(),
        includeFiles: [],
        json: false,
        restArgs: [],
        tsConfigFilePath: 'tsconfig.base.json',
        target: [],
      });

      expect(getNxTrueAffectedProjectsSpy).toBeCalledWith(process.cwd());
      expect(trafSpy).toHaveBeenCalledWith({
        cwd: process.cwd(),
        rootTsConfig: 'tsconfig.base.json',
        base: 'origin/main',
        projects: [],
        include: [],
      });
    });

    it('should log no affected projects', async () => {
      trafSpy.mockResolvedValueOnce([]);
      getNxTrueAffectedProjectsSpy.mockResolvedValueOnce([]);

      await cli.affectedAction({
        action: 'log',
        all: false,
        base: 'origin/main',
        cwd: process.cwd(),
        includeFiles: [],
        json: false,
        restArgs: [],
        tsConfigFilePath: 'tsconfig.base.json',
        target: [],
      });

      expect(logSpy).toHaveBeenCalledWith('No affected projects');
    });

    it('should run log command', async () => {
      trafSpy.mockResolvedValueOnce(['proj1']);

      await cli.affectedAction({
        action: 'log',
        all: false,
        base: 'origin/main',
        cwd: process.cwd(),
        includeFiles: [],
        json: false,
        restArgs: [],
        tsConfigFilePath: 'tsconfig.base.json',
        target: [],
      });

      expect(logSpy).toHaveBeenCalledWith('Affected projects:\n - proj1');
    });

    it('should run log command with json', async () => {
      trafSpy.mockResolvedValueOnce(['proj1']);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await cli.affectedAction({
        action: 'log',
        all: false,
        base: 'origin/main',
        cwd: process.cwd(),
        includeFiles: [],
        json: true,
        restArgs: [],
        tsConfigFilePath: 'tsconfig.base.json',
        target: [],
      });

      expect(consoleSpy).toHaveBeenCalledWith('["proj1"]');
    });

    it('should run other commands', async () => {
      trafSpy.mockResolvedValueOnce(['proj1']);
      mockSpawn.mockReturnValue({
        on: jest.fn(),
      });

      await cli.affectedAction({
        action: 'build',
        all: false,
        base: 'origin/main',
        cwd: process.cwd(),
        includeFiles: [],
        json: false,
        restArgs: [],
        tsConfigFilePath: 'tsconfig.base.json',
        target: [],
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

    describe('`target` option', () => {
      beforeEach(() => {
        trafSpy.mockResolvedValueOnce(['proj1']);

        getNxTrueAffectedProjectsSpy.mockResolvedValueOnce([
          {
            name: 'proj1',
            sourceRoot: 'mock',
            tsConfig: 'mock',
            targets: ['build'],
          },
          {
            name: 'proj2',
            sourceRoot: 'mock',
            tsConfig: 'mock',
            targets: ['test'],
          },
        ]);
      });

      it('should only return projects with a build target', async () => {
        await cli.affectedAction({
          action: 'log',
          all: false,
          base: 'origin/main',
          cwd: process.cwd(),
          includeFiles: [],
          json: false,
          restArgs: [],
          tsConfigFilePath: 'tsconfig.base.json',
          target: ['build'],
        });

        expect(logSpy).toHaveBeenCalledWith('Affected projects:\n - proj1');
      });
    });

    describe('`all` option', () => {
      beforeEach(() => {
        trafSpy.mockResolvedValueOnce(['proj1']);

        getNxTrueAffectedProjectsSpy.mockResolvedValueOnce([
          { name: 'proj1', sourceRoot: 'mock', tsConfig: 'mock', targets: [] },
          { name: 'proj2', sourceRoot: 'mock', tsConfig: 'mock', targets: [] },
        ]);
      });

      it('should return only affected projects when `all` is false', async () => {
        await cli.affectedAction({
          action: 'log',
          all: false,
          base: 'origin/main',
          cwd: process.cwd(),
          includeFiles: [],
          json: false,
          restArgs: [],
          tsConfigFilePath: 'tsconfig.base.json',
          target: [],
        });

        expect(logSpy).toHaveBeenCalledWith('Affected projects:\n - proj1');
      });

      it('should return all projects regardless of changes when `all` is true', async () => {
        await cli.affectedAction({
          action: 'log',
          all: true,
          base: 'origin/main',
          cwd: process.cwd(),
          includeFiles: [],
          json: false,
          restArgs: [],
          tsConfigFilePath: 'tsconfig.base.json',
          target: [],
        });

        expect(logSpy).toHaveBeenCalledWith(
          'Affected projects:\n - proj1\n - proj2'
        );
      });
    });
  });
});
