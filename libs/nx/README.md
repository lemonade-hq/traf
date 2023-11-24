# traf 🚀

Avoid unnecessary builds, tests, lint and more in your monorepo CI. Optimize your development process by intelligently finding affected dependencies and selectively triggering builds and tests only when needed.

## `@traf/nx`

A cli tool that wraps [`@traf/core`](https://github.com/lemonade-hq/traf#trafcore) to be used with Nx.

> Will automatically find all projects in the nx workspace.

### **Usage**

```bash
npx @traf/nx@latest affected <action> [options]
```

### **Options**

| Option               | Description                                                                          | Default              |
|----------------------|--------------------------------------------------------------------------------------| -------------------- |
| `--cwd`              | The current working directory                                                        | `process.cwd()`      |
| `--all`              | Outputs all available projects regardless of changes                                 | `false`              |
| `--base`             | The base branch to compare against                                                   | `origin/main`        |
| `--tsConfigFilePath` | The path to the root tsconfig file                                                   | `tsconfig.base.json` |
| `--action`           | The action to perform. Can be any command                                            | `log`                |
| `--json`             | Output the result as JSON                                                            | `false`              |
| `--includeFiles`     | Comma separated list of glob patterns to include (relative to projects' source root) |                      |
| `--target`           | Comma separated list of targets to filter affected projects by                       |                      |
