import {Command, Flags, Interfaces} from '@oclif/core'
import {readFile} from 'node:fs/promises'

import Generate from './index.js'

function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({length: Math.ceil(arr.length / size)}, (_, i) => arr.slice(i * size, i * size + size))
}

export default class GenerateMatrix extends Command {
  static examples = ['<%= config.bin %> <%= command.id %>']

  static flags = {
    'chunk-size': Flags.integer({
      char: 'c',
      min: 1,
      summary: 'Number of plugins to generate at a time.',
    }),
    matrix: Flags.file({
      char: 'm',
      default: 'matrix.json',
      exists: true,
      required: true,
      summary: 'JSON file containing a matrix of options.',
    }),
    'output-directory': Flags.directory({
      char: 'd',
      default: async () => process.cwd(),
      defaultHelp: async () => 'Current working directory.',
      summary: 'Directory to create the plugin in.',
    }),
  }

  static summary = 'Generate plugins based on a matrix of options.'

  public async run(): Promise<void> {
    const {flags} = await this.parse(GenerateMatrix)

    const matrix = JSON.parse(await readFile(flags.matrix, 'utf8')) as Array<
      Interfaces.InferredFlags<(typeof Generate)['flags']> & {skip?: boolean}
    >

    const pluginsToGenerate = matrix
      .filter((opts) => !opts.skip)
      .map((opts) =>
        Object.entries(opts)
          .flatMap(([name, value]) => {
            if (value === true) return [`--${name}`]
            if (Array.isArray(value)) return value.flatMap((v) => [`--${name}`, v])
            if (typeof value === 'string') return [`--${name}`, value]
            return []
          })
          .filter(Boolean),
      )

    if (flags['chunk-size']) {
      const chunks = chunk(pluginsToGenerate, flags['chunk-size'])
      for (const pluginChunk of chunks) {
        // eslint-disable-next-line no-await-in-loop
        await Promise.all(
          pluginChunk.map((plugin) =>
            Generate.run([...plugin, '--force', '--directory', flags['output-directory'], '--no-spinner'], this.config),
          ),
        )
      }
    } else {
      await Promise.all(
        pluginsToGenerate.map((plugin) =>
          Generate.run([...plugin, '--force', '--directory', flags['output-directory'], '--no-spinner'], this.config),
        ),
      )
    }
  }
}
