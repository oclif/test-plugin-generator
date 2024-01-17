Test Plugin Generator
=================

Generates plugins for @oclif/plugin-plugins integration tests

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![CircleCI](https://circleci.com/gh/oclif/test-plugin-generator/tree/main.svg?style=shield)](https://circleci.com/gh/oclif/test-plugin-generator/tree/main)
[![GitHub license](https://img.shields.io/github/license/oclif/test-plugin-generator)](https://github.com/oclif/test-plugin-generator/blob/main/LICENSE)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @oclif/test-plugin-generator
$ pg COMMAND
running command...
$ pg (--version)
@oclif/test-plugin-generator/0.0.0 darwin-arm64 node-v20.9.0
$ pg --help [COMMAND]
USAGE
  $ pg COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
- [Test Plugin Generator](#test-plugin-generator)
- [Usage](#usage)
- [Commands](#commands)
  - [`pg generate`](#pg-generate)
  - [`pg help [COMMANDS]`](#pg-help-commands)
  - [`pg publish`](#pg-publish)

## `pg generate`

Generate an oclif test plugin that uses a specific package manager.

```
USAGE
  $ pg generate -m npm|pnpm|yarn [--bundled-dependencies-all | --bundled-dependency <value>] [-d <value>] [-f]
    [-n <value>] [--shrinkwrap] [--yarn-version latest|stable|classic|canary|1.x|2.x|3.x|4.x]

FLAGS
  -d, --directory=<value>              [default: Current working directory.] Directory to create the plugin in.
  -f, --force                          Overwrite existing plugin.
  -m, --package-manager=<option>       (required) Package manager to use for plugin.
                                       <options: npm|pnpm|yarn>
  -n, --name=<value>                   Override the computed name of the plugin.
      --bundled-dependencies-all       Set bundledDependencies:true in package.json.
      --bundled-dependency=<value>...  Add package to bundledDependencies in package.json.
      --shrinkwrap                     Generate shrinkwrap for npm plugin.
      --yarn-version=<option>          [default: classic] Version of yarn to use for yarn plugins.
                                       <options: latest|stable|classic|canary|1.x|2.x|3.x|4.x>

DESCRIPTION
  Generate an oclif test plugin that uses a specific package manager.

EXAMPLES
  $ pg generate
```

_See code: [src/commands/generate.ts](https://github.com/oclif/test-plugin-generator/blob/v0.0.0/src/commands/generate.ts)_

## `pg help [COMMANDS]`

Display help for pg.

```
USAGE
  $ pg help [COMMANDS] [-n]

ARGUMENTS
  COMMANDS  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for pg.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.0.11/src/commands/help.ts)_

## `pg publish`

Publish generated plugin to npm registry.

```
USAGE
  $ pg publish [-d <value>] [--dry-run] [-r <value>]

FLAGS
  -d, --directory=<value>  [default: Current working directory.] Plugin directory to publish from.
  -r, --registry=<value>   [default: http://localhost:4873/] Registry to publish to.
      --dry-run            Do not publish to registry.

DESCRIPTION
  Publish generated plugin to npm registry.

EXAMPLES
  $ pg publish
```

_See code: [src/commands/publish.ts](https://github.com/oclif/test-plugin-generator/blob/v0.0.0/src/commands/publish.ts)_
<!-- commandsstop -->
