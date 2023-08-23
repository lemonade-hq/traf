export interface TrueAffectedProject {
  name: string;
  sourceRoot: string;
  tsConfig?: string;
  implicitDependencies?: string[];
}

export interface TrueAffected {
  cwd: string;
  rootTsConfig?: string;
  base?: string;
  projects: TrueAffectedProject[];
  includeFiles?: string[];
}
