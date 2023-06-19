# traf 🚀

Avoid unnecessary builds, tests, lint and more in your monorepo CI. Optimize your development process by intelligently finding affected dependencies and selectively triggering builds and tests only when needed.

## Monorepo support

This lib is designed to work with any monorepo, supported by the following packages:

- nx - [`@traf/nx`](https://github.com/lemonade-hq/traf#trafnx)

If you want to add support for another monorepo tool, please open an issue.

## `@traf/core`

A library that finds affected projects in a monorepo, based on the changed **lines** in the current branch.

### Installation

```bash
npm install @traf/core
```

### **Usage**

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

### **Options**

| Option         | Type        | Description                                           | Default       |
| -------------- | ----------- | ----------------------------------------------------- | ------------- |
| `rootTsConfig` | `string`    | The path to the root tsconfig file                    |               |
| `projects`     | `Project[]` | An array of projects to check                         |               |
| `cwd`          | `string`    | The current working directory                         |               |
| `base`         | `string`    | The base branch to compare against                    | `origin/main` |
| `includeFiles` | `string[]`  | File names to include that are not part of `tsconfig` |               |

> `rootTsConfig` - The path to the root tsconfig file, should include the `paths` prop with all projects mapping so `ts-morph` can find the references.

### **Project**

| Option                 | Type       | Description                                                       |
| ---------------------- | ---------- | ----------------------------------------------------------------- |
| `name`                 | `string`   | The project name                                                  |
| `sourceRoot`           | `string`   | The project source root                                           |
| `tsConfig`             | `string`   | The project tsconfig file (should only include the project files) |
| `implicitDependencies` | `string[]` | An array of implicit dependencies                                 |

### How it works?

The algorithm is based on the following steps:

1. Using git to find all changed lines in the current branch.
2. Using [ts-morph](https://ts-morph.com/) to find the changed element (function, class, const etc..) per line.
3. Using ts-morph [findReferences](https://ts-morph.com/navigation/finding-references#finding-referencing-nodes) to find all references to the changed element recursively.
4. For each reference, find the project that contains the reference and add it to the affected projects list.
