import { resolve } from 'path';
import chalk from 'chalk';
import { spawn } from 'node:child_process';
import { CommandModule } from 'yargs';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';
import { trueAffected } from '@traf/core';
import { getTurboTrueAffectedProjects } from './turbo';

const color = '#ff0083';

const log = (message: string) =>
  console.log(
    ` ${chalk.hex(color)('>')} ${chalk.bgHex(color).bold(' TRAF ')}  ${message}`
  );

const affectedAction = async ({
  cwd,
  action = 'log',
  base = 'origin/main',
  json,
  restArgs,
}: AffectedOptions) => {
  const projects = await getTurboTrueAffectedProjects(cwd);
  const affected = await trueAffected({
    cwd,
    base,
    projects,
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
      const command = `npx turbo run ${action} ${affected
        .map((p) => `--filter=${p}`)
        .join(' ')} ${restArgs.join(' ')}`;

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
  action: string;
  base: string;
  json: boolean;
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
  },
  handler: async ({
    cwd,
    action,
    base,
    json,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    $0,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _,
    ...rest
  }) => {
    await affectedAction({
      cwd,
      action,
      base,
      json,
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

run();
