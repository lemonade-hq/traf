import { resolve } from 'path';
import chalk from 'chalk';
import { spawn } from 'node:child_process';
import { CommandModule } from 'yargs';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';
import { trueAffected } from '@traf/core';
import { getNxTrueAffectedProjects } from './nx';

const color = '#ff0083';

export const log = (message: string) =>
  console.log(
    ` ${chalk.hex(color)('>')} ${chalk.bgHex(color).bold(' TRAF ')}  ${message}`
  );

export const affectedAction = async ({
  cwd,
  action = 'log',
  base = 'origin/main',
  json,
  restArgs,
  tsConfigFilePath,
  includeFiles,
}: AffectedOptions) => {
  const projects = await getNxTrueAffectedProjects(cwd);
  const affected = await trueAffected({
    cwd,
    rootTsConfig: tsConfigFilePath,
    base,
    projects,
    includeFiles,
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
        process.exit(code ?? 0);
      });

      break;
    }
  }
};

interface AffectedOptions {
  cwd: string;
  tsConfigFilePath: string;
  action: string;
  base: string;
  json: boolean;
  includeFiles: string[];
  restArgs: string[];
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
    base: {
      desc: 'Base branch to compare against',
      default: 'origin/main',
    },
    json: {
      desc: 'Output affected projects as JSON',
      default: false,
    },
    includeFiles: {
      desc: 'Comma separated list of files to include',
      type: 'array',
      default: [],
      coerce: (array: string[]) => {
        return array.flatMap((v) => v.split(','));
      },
    },
  },
  handler: async ({
    cwd,
    tsConfigFilePath,
    action,
    base,
    json,
    includeFiles,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    $0,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _,
    ...rest
  }) => {
    await affectedAction({
      cwd,
      tsConfigFilePath,
      action,
      base,
      json,
      includeFiles,
      restArgs: Object.entries(rest).map(([key, value]) => `--${key}=${value}`),
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

if (process.env['JEST_WORKER_ID'] == null) {
  run();
}
