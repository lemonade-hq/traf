export interface TrueAffectedProject {
  name: string;
  sourceRoot: string;
  tsConfig?: string;
  implicitDependencies?: string[];
  targets?: string[];
}

export interface TrueAffectedLogging {
  verbose?: boolean;
  logger?: Console;
}

export interface TrueAffected extends TrueAffectedLogging {
  cwd: string;
  rootTsConfig?: string;
  base?: string;
  projects: TrueAffectedProject[];
  include?: (string | RegExp)[];

  // **experimental** - this is an experimental feature and may be removed or changed at any time
  __experimentalLockfileCheck?: boolean;
}
