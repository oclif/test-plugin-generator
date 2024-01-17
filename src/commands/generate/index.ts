/* eslint-disable complexity */
import {Command, Flags, Interfaces, ux} from '@oclif/core'
import chalk from 'chalk'
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {join} from 'node:path'

import {Executor, exists} from '../../utils.js'

export default class Generate extends Command {
  static description = 'Generate an oclif test plugin that uses a specific package manager.'

  static examples = [
    '<%= config.bin %> <%= command.id %> --package-manager npm',
    '<%= config.bin %> <%= command.id %> --package-manager npm --shrinkwrap',
    '<%= config.bin %> <%= command.id %> --package-manager npm --bundle-dependencies-all',
    '<%= config.bin %> <%= command.id %> --package-manager npm --bundle-dependency @oclif/core',
    '<%= config.bin %> <%= command.id %> --package-manager pnpm',
    '<%= config.bin %> <%= command.id %> --package-manager pnpm --bundle-dependencies-all',
    '<%= config.bin %> <%= command.id %> --package-manager pnpm --bundle-dependency @oclif/core',
    '<%= config.bin %> <%= command.id %> --package-manager yarn --yarn-version 1.x',
    '<%= config.bin %> <%= command.id %> --package-manager yarn --yarn-version 2.x',
    '<%= config.bin %> <%= command.id %> --package-manager yarn --yarn-version 3.x',
    '<%= config.bin %> <%= command.id %> --package-manager yarn --yarn-version 4.x',
    '<%= config.bin %> <%= command.id %> --package-manager yarn --yarn-version latest',
    '<%= config.bin %> <%= command.id %> --package-manager yarn --yarn-version stable',
  ]

  static flags = {
    'bundle-dependencies-all': Flags.boolean({
      exclusive: ['bundle-dependency'],
      relationships: [
        {flags: [{name: 'package-manager', when: async (flags) => flags['package-manager'] === 'yarn'}], type: 'none'},
      ],
      summary: 'Set bundleDependencies:true in package.json.',
    }),
    'bundle-dependency': Flags.string({
      exclusive: ['bundle-dependencies-all'],
      multiple: true,
      relationships: [
        {flags: [{name: 'package-manager', when: async (flags) => flags['package-manager'] === 'yarn'}], type: 'none'},
      ],
      summary: 'Add package to bundleDependencies in package.json.',
    }),
    directory: Flags.directory({
      char: 'd',
      default: async () => process.cwd(),
      defaultHelp: async () => 'Current working directory.',
      summary: 'Directory to create the plugin in.',
    }),
    force: Flags.boolean({
      char: 'f',
      summary: 'Overwrite existing plugin.',
    }),
    name: Flags.string({
      char: 'n',
      summary: 'Override the computed name of the plugin.',
    }),
    'no-spinner': Flags.boolean({
      hidden: true,
    }),
    'oclif-lock': Flags.boolean({
      relationships: [
        // Prevent --oclif-lock from being used when --package-manager does not equal yarn
        {flags: [{name: 'package-manager', when: async (flags) => flags['package-manager'] !== 'yarn'}], type: 'none'},
      ],
      summary: 'Generate oclif.lock for yarn plugins.',
    }),
    'package-manager': Flags.option({
      char: 'm',
      options: ['npm', 'pnpm', 'yarn'] as const,
      required: true,
      summary: 'Package manager to use for plugin.',
    })(),
    shrinkwrap: Flags.boolean({
      relationships: [
        // Prevent --shrinkwrap from being used when --package-manager does not equal npm
        {flags: [{name: 'package-manager', when: async (flags) => flags['package-manager'] !== 'npm'}], type: 'none'},
      ],
      summary: 'Generate shrinkwrap for npm plugin.',
    }),
    'yarn-version': Flags.option({
      options: ['latest', 'stable', 'classic', 'canary', '1.x', '2.x', '3.x', '4.x'] as const,
      relationships: [
        // Prevent --yarn-version from being used when --package-manager does not equal yarn
        {flags: [{name: 'package-manager', when: async (flags) => flags['package-manager'] !== 'yarn'}], type: 'none'},
      ],
      summary: 'Version of yarn to use for yarn plugins.',
    })(),
  }

  private flags!: Interfaces.InferredFlags<typeof Generate.flags>

  public async run(): Promise<void> {
    const {flags} = await this.parse(Generate)
    this.flags = flags

    if (!flags['no-spinner']) ux.action.start('Generating plugin')

    const require = createRequire(import.meta.url)
    const oclif = require.resolve('.bin/oclif')

    if (!(await exists(flags.directory))) {
      await mkdir(flags.directory, {recursive: true})
    }

    const name = this.computeName()
    const pluginPath = join(flags.directory, name)
    this.log(chalk.bold('Plugin Configuration'))
    this.log(chalk.dim('name'), name)
    this.log(
      chalk.dim('package manager'),
      flags['package-manager'],
      flags['package-manager'] === 'yarn' ? flags['yarn-version'] : '',
    )
    this.log(chalk.dim('location'), pluginPath)
    if (flags['bundle-dependencies-all']) this.log(chalk.dim('bundleDependencies'), flags['bundle-dependencies-all'])
    if (flags['bundle-dependency']) this.log(chalk.dim('bundleDependencies'), flags['bundle-dependency'])
    this.log(chalk.dim('shrinkwrap'), flags.shrinkwrap ?? false)
    this.log(chalk.dim('oclif-lock'), flags['oclif-lock'] ?? false)

    if (await exists(pluginPath)) {
      if (flags.force) {
        await rm(pluginPath, {recursive: true})
      } else {
        this.error(`Plugin ${name} already exists. Use --force to overwrite.`)
      }
    }

    ux.action.status = 'Building template'
    const executor = new Executor(`generate:${name}`)
    await executor.exec(oclif, ['generate', name, '--defaults'], {cwd: flags.directory})

    const packageJsonPath = join(pluginPath, 'package.json')
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
      bundleDependencies: boolean | string[]
      name: string
      scripts: Record<string, string>
    }

    const npmName = `@oclif/${name.replaceAll('_', '-')}`
    packageJson.name = npmName

    if (flags['bundle-dependencies-all']) {
      packageJson.bundleDependencies = true
    }

    if (flags['bundle-dependency']) {
      packageJson.bundleDependencies = flags['bundle-dependency']
    }

    if (flags['package-manager'] === 'npm') {
      const npm = require.resolve('.bin/npm')
      ux.action.status = 'Cleaning up'
      await this.rm(join(pluginPath, 'yarn.lock'))
      await this.rm(join(pluginPath, 'node_modules'))
      ux.action.status = 'Installing dependencies'
      await executor.exec(npm, ['install'], {cwd: pluginPath})

      if (flags.shrinkwrap) {
        ux.action.status = 'Generating shrinkwrap'
        await executor.exec(npm, ['shrinkwrap'], {cwd: pluginPath})
      }

      const scripts = packageJson.scripts ?? {}
      for (const [name, script] of Object.entries(scripts)) {
        scripts[name] = script.replace('yarn', 'npm run')
      }

      await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8')
    }

    if (flags['package-manager'] === 'pnpm') {
      const pnpm = require.resolve('.bin/pnpm')
      ux.action.status = 'Cleaning up'
      await this.rm(join(pluginPath, 'yarn.lock'))
      await this.rm(join(pluginPath, 'node_modules'))
      ux.action.status = 'Installing dependencies'
      await executor.exec(pnpm, ['install'], {cwd: pluginPath})

      const scripts = packageJson.scripts ?? {}
      for (const [name, script] of Object.entries(scripts)) {
        scripts[name] = script.replace('yarn', 'pnpm run')
      }

      await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8')
    }

    const isYarn1 =
      flags['package-manager'] === 'yarn' && (flags['yarn-version'] === '1.x' || flags['yarn-version'] === 'classic')
    if (flags['package-manager'] === 'yarn' && !isYarn1) {
      await executor.exec('corepack', ['enable'], {cwd: pluginPath})
      ux.action.status = 'Cleaning up'
      await this.rm(join(pluginPath, 'yarn.lock'))
      await this.rm(join(pluginPath, 'node_modules'))

      try {
        ux.action.status = `Setting yarn version (${flags['yarn-version']})`
        // use global yarn because yarn gets confused if you try to use a different version
        // set to stable first so that we can set version to semver range
        await executor.exec('yarn', ['set', 'version', 'stable', '--yarn-path'], {cwd: pluginPath})
        await executor.exec('yarn', ['set', 'version', flags['yarn-version'] ?? 'classic', '--yarn-path'], {
          cwd: pluginPath,
        })

        await writeFile(join(pluginPath, '.yarnrc.yml'), 'nodeLinker: node-modules', 'utf8')
        ux.action.status = 'Installing dependencies'
        await executor.exec('yarn', ['install'], {cwd: pluginPath})

        if (flags['oclif-lock']) {
          await executor.exec(oclif, ['lock'], {cwd: pluginPath})
        }

        const latestPjson = JSON.parse(await readFile(join(pluginPath, 'package.json'), 'utf8'))
        await writeFile(
          join(pluginPath, 'package.json'),
          JSON.stringify(
            {
              ...latestPjson,
              files: [...latestPjson.files, 'oclif.lock'],
              name: npmName,
              scripts: {...latestPjson.scripts, prepack: `${latestPjson.scripts.prepack} && oclif.lock`},
            },
            null,
            2,
          ),
          'utf8',
        )
      } catch (error) {
        this.error(error as Error, {suggestions: ['is yarn installed globally?']})
      }
    }

    if (flags['package-manager'] === 'yarn' && isYarn1) {
      if (flags['oclif-lock']) {
        await executor.exec(oclif, ['lock'], {cwd: pluginPath})
      }

      const latestPjson = JSON.parse(await readFile(join(pluginPath, 'package.json'), 'utf8'))
      await writeFile(
        join(pluginPath, 'package.json'),
        JSON.stringify(
          {
            ...latestPjson,
            files: [...latestPjson.files, 'oclif.lock'],
            name: npmName,
            scripts: {...latestPjson.scripts, prepack: `${latestPjson.scripts.prepack} && oclif.lock`},
          },
          null,
          2,
        ),
        'utf8',
      )
    }

    ux.action.stop('Success!')
  }

  private computeName(): string {
    if (this.flags.name) return this.flags.name

    const opts = [
      this.flags['yarn-version'] ? `${this.flags['yarn-version']}` : null,
      this.flags['bundle-dependencies-all'] ? 'bundle-deps-all' : null,
      this.flags['bundle-dependency'] ? 'bundle-deps' : null,
      this.flags.shrinkwrap ? 'shrinkwrap' : null,
      this.flags['oclif-lock'] ? 'oclif-lock' : null,
    ]
      .filter(Boolean)
      .join('_')
    return `test-plugin-${this.flags['package-manager']}${opts ? '_' + opts : ''}`.replace(/_$/, '').replaceAll('.', '')
  }

  private rm(path: string): Promise<void> {
    this.debug(`rm -rf ${path}`)
    return rm(path, {recursive: true})
  }
}
