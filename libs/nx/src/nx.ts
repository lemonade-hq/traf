import { basename, dirname, join, resolve } from 'path';
import { readFile } from 'fs/promises';
import { globby } from 'globby';
import { TrueAffectedLogging, TrueAffectedProject } from '@traf/core';
import { existsSync } from 'fs';
import chalk from 'chalk';

interface NxProject {
  name?: string;
  sourceRoot?: string;
  projectType: 'application' | 'library';
  implicitDependencies?: string[];
  targets?: {
    build?: {
      options: {
        tsConfig: string;
      };
    };
  };
}

interface WorkspaceJsonConfiguration {
  projects: Record<string, NxProject | string>;
}

interface WorkspaceProject {
  name?: string;
  path: string;
  project: NxProject;
}

export async function getNxProjects(cwd: string): Promise<WorkspaceProject[]> {
  const nxProjects = await getNxProjectJsonProjects(cwd);
  const workspaceProjects = await getNxWorkspaceProjects(cwd);

  const relevantWorkspaceProjects = workspaceProjects.filter(
    (proj) =>
      nxProjects.find((nested) => nested.name === proj.name) === undefined
  );

  return [...nxProjects, ...relevantWorkspaceProjects];
}

async function getNxWorkspaceProjects(
  cwd: string
): Promise<WorkspaceProject[]> {
  try {
    const path = resolve(cwd, 'workspace.json');
    const file = await readFile(path, 'utf-8');
    const workspace = JSON.parse(file) as WorkspaceJsonConfiguration;

    return Object.entries(workspace.projects)
      .filter(([, project]) => typeof project === 'object')
      .map(([name, project]) => ({
        name,
        path,
        project: project as NxProject,
      }));
  } catch (e) {
    return [];
  }
}

async function getNxProjectJsonProjects(
  cwd: string
): Promise<WorkspaceProject[]> {
  try {
    const staticIgnores = ['node_modules', '**/node_modules', 'dist', '.git'];

    const projectGlobPatterns: string[] = [`project.json`, `**/project.json`];

    const combinedProjectGlobPattern =
      '{' + projectGlobPatterns.join(',') + '}';

    const files = await globby(combinedProjectGlobPattern, {
      ignore: staticIgnores,
      ignoreFiles: ['.nxignore'],
      absolute: true,
      cwd,
      dot: true,
      suppressErrors: true,
      gitignore: true,
    });

    const projectFiles = [];

    for (const file of files) {
      const path = resolve(cwd, file);
      const project = JSON.parse(await readFile(path, 'utf-8')) as NxProject;
      projectFiles.push({
        name: project.name,
        path,
        project,
      });
    }

    return projectFiles;
  } catch (e) {
    return [];
  }
}

type GetNxTrueAffectedProjectsOptions = TrueAffectedLogging;

export async function getNxTrueAffectedProjects(
  cwd: string,
  { verbose = false, logger = console }: GetNxTrueAffectedProjectsOptions = {}
): Promise<TrueAffectedProject[]> {
  const projects = await getNxProjects(cwd);

  if (verbose) {
    logger.log(`Found ${chalk.bold(projects.length)} nx projects`);
  }

  return projects.map(({ name, path, project }) => {
    let tsConfig = project.targets?.build?.options?.tsConfig;
    const projectPathDir = dirname(path);
    const projectName = name ?? basename(projectPathDir);

    if (!name) {
      logger.warn(
        `Project at ${chalk.bold(
          path
        )} does not have a name property. Using project.json directory name ${chalk.bold(
          projectName
        )}.`
      );
    }

    if (!project.sourceRoot) {
      logger.warn(
        `Project at ${chalk.bold(
          path
        )} does not have a sourceRoot property. Using project.json directory.`
      );
    }

    if (!tsConfig) {
      if (verbose) {
        if (project.sourceRoot) {
          logger.log(
            `Project at ${chalk.bold(
              path
            )} does not have a tsConfig property under '${chalk.bold(
              'targets.build.options.tsConfig'
            )}'. Trying to use '${chalk.bold('sourceRoot')}' `
          );
        } else {
          logger.log(
            `Project at ${chalk.bold(
              path
            )} does not have a tsConfig property under '${chalk.bold(
              'targets.build.options.tsConfig'
            )}'. Using project.json directory.`
          );
        }
      }
      const projectRoot = project.sourceRoot
        ? join(project.sourceRoot, '..')
        : projectPathDir;

      if (project.projectType === 'library') {
        tsConfig = join(projectRoot, 'tsconfig.lib.json');
      } else {
        tsConfig = join(projectRoot, 'tsconfig.app.json');
      }

      if (!existsSync(resolve(cwd, tsConfig))) {
        tsConfig = join(projectRoot, 'tsconfig.json');
      }
    }

    if (verbose) {
      logger.log(
        `Using tsconfig at ${chalk.bold(tsConfig)} for project ${chalk.bold(
          projectName
        )}`
      );
    }

    return {
      name: projectName,
      sourceRoot: project.sourceRoot ?? projectPathDir,
      implicitDependencies: project.implicitDependencies ?? [],
      tsConfig,
      targets: Object.keys(project.targets ?? {}),
    };
  });
}
