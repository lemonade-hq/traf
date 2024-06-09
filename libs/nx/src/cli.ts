import { resolve } from 'path';
import chalk from 'chalk';
import { spawn } from 'node:child_process';
import { CommandModule } from 'yargs';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';
import { DEFAULT_INCLUDE_TEST_FILES, trueAffected } from '@traf/core';
import { getNxTrueAffectedProjects } from './nx';

const color = '#ff0083';

export const log = (message: string) =>
  console.log(
    ` ${chalk.hex(color)('>')} ${chalk.bgHex(color).bold(' TRAF ')}  ${message}`
  );

const getLogger = (namespace: string) => ({
  ...console,
  debug: (message: string) =>
    process.env['DEBUG'] === 'true' &&
    console.debug(
      ` ${chalk.hex(color)('>')} ${chalk.bgGray.bold(
        ` ${namespace} `
      )} ${message}`
    ),
  warn: (message: string) =>
    console.warn(
      ` ${chalk.yellowBright('⚠️')} ${chalk.bgGray.bold(
        ` ${namespace} `
      )} ${chalk.yellow(message)}`
    ),
});

export const affectedAction = async ({
  cwd,
  action = 'log',
  all = false,
  base = 'origin/main',
  json,
  restArgs,
  tsConfigFilePath,
  includeFiles,
  target,
  experimentalLockfileCheck,
}: AffectedOptions) => {
  const nxLogger = getLogger('NX');

  nxLogger.debug('Getting nx projects');

  let projects = await getNxTrueAffectedProjects(cwd, {
    logger: nxLogger,
  });

  nxLogger.debug(`Found ${projects.length} projects`);

  if (target.length) {
    projects = projects.filter(
      (project) =>
        !!project.targets?.some((projectTarget) =>
          target.includes(projectTarget)
        )
    );
  }

  const affected = all
    ? projects.map((p) => p.name)
    : await trueAffected({
        cwd,
        rootTsConfig: tsConfigFilePath,
        base,
        projects,
        include: [...includeFiles, DEFAULT_INCLUDE_TEST_FILES],
        logger: getLogger('CORE'),
        __experimentalLockfileCheck: experimentalLockfileCheck,
      });

  if (json) {
    console.log(JSON.stringify(affected));
    return;
  }

  if (affected.length === 0) {
    log('No affected projects');
    return;
  }

  switch (action) {
    case 'log': {
      log(`Affected projects:\n${affected.map((l) => ` - ${l}`).join('\n')}`);
      break;
    }
    default: {
      const command = `npx nx run-many --target=${action} --projects=${affected.join(
        ','
      )} ${restArgs.join(' ')}`;

      log(`Running command: ${command}`);
      const child = spawn(command, {
        stdio: 'inherit',
        shell: true,
      });
      child.on('exit', (code) => {
        /* istanbul ignore next */
        process.exit(code ?? 0);
      });

      break;
    }
  }
};

interface AffectedOptions {
  cwd: string;
  tsConfigFilePath: string;
  action?: string;
  all?: boolean;
  base?: string;
  json: boolean;
  includeFiles: string[];
  restArgs: string[];
  target: string[];
  experimentalLockfileCheck?: boolean;
}

const affectedCommand: CommandModule<unknown, AffectedOptions> = {
  command: 'affected [action]',
  describe: 'Run a command on affected projects using true-affected',
  builder: {
    cwd: {
      desc: 'Current working directory',
      default: process.cwd(),
      coerce: (value: string): string => resolve(process.cwd(), value),
    },
    tsConfigFilePath: {
      desc: 'Path to the root tsconfig.json file',
      default: 'tsconfig.base.json',
    },
    action: {
      desc: 'Action to run on affected projects',
      default: 'log',
    },
    all: {
      desc: 'Outputs all available projects regardless of changes',
      default: false,
      coerce: Boolean,
    },
    base: {
      desc: 'Base branch to compare against',
      default: 'origin/main',
    },
    json: {
      desc: 'Output affected projects as JSON',
      default: false,
      coerce: Boolean,
    },
    includeFiles: {
      desc: 'Comma separated list of files to include',
      type: 'array',
      default: [],
      coerce: (array: string[]) => {
        return array.flatMap((v) => v.split(','));
      },
    },
    target: {
      desc: 'Comma separate list of targets to filter affected projects by',
      type: 'array',
      default: [],
      coerce: (array: string[]) => {
        return array.flatMap((v) => v.split(',')).map((v) => v.trim());
      },
    },
    experimentalLockfileCheck: {
      desc: 'Experimental lockfile check',
      type: 'boolean',
      default: false,
      coerce: Boolean,
    },
  },
  handler: async ({
    cwd,
    tsConfigFilePath,
    all,
    action,
    base,
    json,
    includeFiles,
    target,
    experimentalLockfileCheck,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    $0,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _,
    ...rest
  }) => {
    await affectedAction({
      cwd,
      tsConfigFilePath,
      all,
      action,
      base,
      json,
      includeFiles,
      target,
      experimentalLockfileCheck,
      restArgs: Object.entries(rest).map(
        /* istanbul ignore next */
        ([key, value]) => `--${key}=${value}`
      ),
    });
  },
};

export async function run(): Promise<void> {
  await yargs(hideBin(process.argv))
    .usage('Usage: $0 <command> [options]')
    .parserConfiguration({ 'strip-dashed': true, 'strip-aliased': true })
    .command(affectedCommand)
    .demandCommand()
    .strictCommands().argv;
}

/* istanbul ignore next */
if (process.env['JEST_WORKER_ID'] == null) {
  run();
}
