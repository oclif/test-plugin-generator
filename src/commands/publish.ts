/* eslint-disable unicorn/no-await-expression-member */
import {Command, Flags, ux} from '@oclif/core'
import {readFile, readdir, rm, writeFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {homedir} from 'node:os'
import {join, resolve} from 'node:path'

import {Executor, exists} from '../utils.js'

async function determinePackageManager(dir: string): Promise<'npm' | 'pnpm' | 'yarn'> {
  if (await exists(join(dir, 'package-lock.json'))) {
    return 'npm'
  }

  if (await exists(join(dir, 'npm-shrinkwrap.json'))) {
    return 'npm'
  }

  if (await exists(join(dir, 'pnpm-lock.yaml'))) {
    return 'pnpm'
  }

  return 'yarn'
}

function bumpPatchVersion(version: string): string {
  const [major, minor, patch] = version.split('.')
  return [major, minor, Number.parseInt(patch, 10) + 1].join('.')
}

export default class Publish extends Command {
  static description = 'Publish generated plugin to npm registry.'

  static examples = ['<%= config.bin %> <%= command.id %>']

  static flags = {
    'clear-registry': Flags.boolean({
      allowNo: true,
      default: true,
      summary: 'Clear registry before publishing.',
    }),
    directory: Flags.directory({
      char: 'd',
      exactlyOne: ['directory', 'plugin-directory'],
      summary: 'Directory of plugins to publish.',
    }),
    'dry-run': Flags.boolean({
      summary: 'Do not publish to registry.',
    }),
    'plugin-directory': Flags.directory({
      char: 'p',
      exactlyOne: ['directory', 'plugin-directory'],
      summary: 'Plugin directory to publish from.',
    }),
    registry: Flags.string({
      char: 'r',
      default: 'http://localhost:4873/',
      async parse(input: string) {
        if (!input.includes('localhost')) {
          throw new Error('Registry must be localhost.')
        }

        return input
      },
      summary: 'Verdaccio registry to publish to.',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(Publish)

    const plugins = flags.directory
      ? (await readdir(flags.directory)).map((p) => join(flags.directory ?? '', p))
      : [flags['plugin-directory'] ?? process.cwd()]
    const require = createRequire(import.meta.url)

    if (flags['clear-registry']) {
      await rm(resolve(`${homedir()}/.local/share/verdaccio/storage`), {force: true, recursive: true})
    }

    ux.action.start('Publishing')
    ux.styledHeader('Plugins to Publish')
    for (const plugin of plugins) {
      this.log(plugin)
    }

    const published: string[] = []
    const failed: string[] = []
    await Promise.all(
      plugins.map(async (plugin) => {
        const packageManager = await determinePackageManager(plugin)
        const packageJson = JSON.parse(await readFile(join(plugin, 'package.json'), 'utf8')) as {
          name: string
          packageManager?: string
          version: string
        }
        packageJson.version = bumpPatchVersion(packageJson.version)
        await writeFile(join(plugin, 'package.json'), JSON.stringify(packageJson, null, 2))
        const executor = new Executor(packageJson.name)
        switch (packageManager) {
          case 'npm': {
            const npm = require.resolve('.bin/npm')
            const result = await executor.exec(
              npm,
              ['publish', '--registry', flags.registry, flags['dry-run'] ? '--dry-run' : ''],
              {
                cwd: plugin,
              },
            )

            if (result === 0) published.push(packageJson.name)
            else {
              failed.push(packageJson.name)
              this.log(`Failed to publish ${packageJson.name}`)
            }

            break
          }

          case 'pnpm': {
            const pnpm = require.resolve('.bin/pnpm')
            const result = await executor.exec(
              pnpm,
              ['publish', '--registry', flags.registry, flags['dry-run'] ? '--dry-run' : ''],
              {
                cwd: plugin,
              },
            )
            if (result === 0) published.push(packageJson.name)
            else {
              failed.push(packageJson.name)
              this.log(`Failed to publish ${packageJson.name}`)
            }

            break
          }

          case 'yarn': {
            const isYarn4 = packageJson.packageManager?.split('@')[1].startsWith('4')
            if (isYarn4) {
              const yarnRc = [
                'nodeLinker: node-modules',
                `npmRegistryServer: "${flags.registry}"`,
                'unsafeHttpWhitelist:',
                '  - localhost',
                'npmAuthIdent: "username:password"',
              ]
              await writeFile(join(plugin, '.yarnrc.yml'), yarnRc.join('\n'))
            }

            const result = await executor.exec(
              'yarn',
              [
                isYarn4 ? 'npm publish' : 'publish',
                isYarn4 ? '' : '--registry',
                isYarn4 ? '' : flags.registry,
                flags['dry-run'] ? '--dry-run' : '',
              ],
              {
                cwd: plugin,
              },
            )
            if (result === 0) published.push(packageJson.name)
            else {
              failed.push(packageJson.name)
              this.log(`Failed to publish ${packageJson.name}`)
            }

            break
          }
        }
      }),
    )

    ux.action.stop()
    ux.styledHeader('Published')
    for (const plugin of published) {
      this.log(plugin)
    }

    if (failed.length > 0) {
      ux.styledHeader('Failed')
      for (const plugin of failed) {
        this.log(plugin)
      }
    }
  }
}
