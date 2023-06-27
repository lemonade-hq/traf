# traf 🚀

Avoid unnecessary builds, tests, lint and more in your monorepo CI. Optimize your development process by intelligently finding affected dependencies and selectively triggering builds and tests only when needed.

## `@traf/turbo`

A cli tool that wraps [`@traf/core`](https://github.com/lemonade-hq/traf#trafcore) to be used with turborepo.
> Will automatically find all projects in the turborepo workspace.

### **Usage**

```bash
npx @traf/turbo@latest affected <action> [options]
```

### **Options**

| Option | Description | Default |
| --- | --- | --- |
| `--cwd` | The current working directory | `process.cwd()` |
| `--base` | The base branch to compare against | `origin/main` |
| `--tsConfigFilePath` | The path to the root tsconfig file | `tsconfig.base.json` |
| `--action` | The action to perform. Can be any command | `log` |
| `--json` | Output the result as JSON | `false` |
