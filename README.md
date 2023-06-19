# traf 🚀

Avoid unnecessary builds, tests, lint and more in your monorepo CI. Optimize your development process by intelligently finding affected dependencies and selectively triggering builds and tests only when needed.

## Motivation

CI pipeline runtime is a precious resource, and in order to keep it as short as possible, we need to run only the necessary builds, tests, etc..

The way Nx `affected` algorithm works is by finding all changed projects in the current branch by file path and return the "affected" projects by the dependency graph.

This is not always accurate, as a change in a file can be a simple change in a comment, or a change in a function that is not used by a dependant project.

In Lemonade we have several big monorepos with complex dep graph, and we found that the `affected` algorithm causes us to run unnecessary tasks, which increases the CI runtime and slows down the development process.

This is where true affected comes in. It will find the affected projects by **lines** changes in the current branch.
![image](https://github.com/lemonade-hq/traf/assets/6004537/2e2d9b6e-3a40-4673-8783-6e444ac59c8f)

## Packages

- [@traf/core](#trafcore)
- [@traf/nx](#trafnx)

### `@traf/core`

A library that finds affected projects in a monorepo, based on the changed **lines** in the current branch.

#### **Installation**

```bash
npm install @traf/core
```

#### **Usage**

```ts
import { trueAffected } = from '@traf/core';

const affected = await trueAffected({
  rootTsConfig: 'tsconfig.base.json',
  projects: [
    {
      name: 'proj1',
      sourceRoot: '<project source>',
      tsConfig: '<project source>/tsconfig.json',
    },
    // ...
  ],
})
```

#### **Options**

| Option         | Type        | Description                                           | Default       |
| -------------- | ----------- | ----------------------------------------------------- | ------------- |
| `rootTsConfig` | `string`    | The path to the root tsconfig file                    |               |
| `projects`     | `Project[]` | An array of projects to check                         |               |
| `cwd`          | `string`    | The current working directory                         |               |
| `base`         | `string`    | The base branch to compare against                    | `origin/main` |
| `includeFiles` | `string[]`  | File names to include that are not part of `tsconfig` |               |

> `rootTsConfig` - The path to the root tsconfig file, should include the `paths` prop with all projects mapping so `ts-morph` can find the references.

#### **Project**

| Option                 | Type       | Description                                                       |
| ---------------------- | ---------- | ----------------------------------------------------------------- |
| `name`                 | `string`   | The project name                                                  |
| `sourceRoot`           | `string`   | The project source root                                           |
| `tsConfig`             | `string`   | The project tsconfig file (should only include the project files) |
| `implicitDependencies` | `string[]` | An array of implicit dependencies                                 |

#### How it works?

The algorithm is based on the following steps:

1. Using git to find all changed lines in the current branch.
2. Using [ts-morph](https://ts-morph.com/) to find the changed element (function, class, const etc..) per line.
3. Using ts-morph [findReferences](https://ts-morph.com/navigation/finding-references#finding-referencing-nodes) to find all references to the changed element recursively.
4. For each reference, find the project that contains the reference and add it to the affected projects list.

### `@traf/nx`

A cli tool that wraps `@traf/core` to be used with Nx.

> Will automatically find all projects in the nx workspace.

#### **Usage**

```bash
npx @traf/nx@latest affected <action> [options]
```

#### **Options**

| Option               | Description                               | Default              |
| -------------------- | ----------------------------------------- | -------------------- |
| `--cwd`              | The current working directory             | `process.cwd()`      |
| `--base`             | The base branch to compare against        | `origin/main`        |
| `--tsConfigFilePath` | The path to the root tsconfig file        | `tsconfig.base.json` |
| `--action`           | The action to perform. Can be any command | `log`                |
| `--json`             | Output the result as JSON                 | `false`              |
| `--includeFiles`     | Comma separated list of files to include  |                      |
