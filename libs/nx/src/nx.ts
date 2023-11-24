import { join, resolve } from 'path';
import { readFile } from 'fs/promises';
import { globby } from 'globby';
import { TrueAffectedProject } from '@traf/core';
import { existsSync } from 'fs';

interface NxProject {
  name: string;
  sourceRoot: string;
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
  name: string;
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
      .filter(([_, project]) => typeof project === 'object')
      .map(([name, project]) => ({
        name,
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
      const project = JSON.parse(
        await readFile(resolve(cwd, file), 'utf-8')
      ) as NxProject;
      projectFiles.push({
        name: project.name,
        project,
      });
    }

    return projectFiles;
  } catch (e) {
    return [];
  }
}

export async function getNxTrueAffectedProjects(
  cwd: string
): Promise<TrueAffectedProject[]> {
  const projects = await getNxProjects(cwd);

  return projects.map(({ name, project }) => {
    let tsConfig = project.targets?.build?.options.tsConfig;

    if (tsConfig == null) {
      const projectRoot = join(project.sourceRoot, '..');

      if (project.projectType === 'library') {
        tsConfig = join(projectRoot, 'tsconfig.lib.json');
      } else {
        tsConfig = join(projectRoot, 'tsconfig.app.json');
      }

      if (!existsSync(resolve(cwd, tsConfig))) {
        tsConfig = join(projectRoot, 'tsconfig.json');
      }
    }

    return {
      name,
      sourceRoot: project.sourceRoot,
      implicitDependencies: project.implicitDependencies ?? [],
      tsConfig,
      targets: Object.keys(project.targets ?? {}),
    };
  });
}
