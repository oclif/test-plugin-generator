import {Command, Flags, Interfaces} from '@oclif/core'
import {readFile} from 'node:fs/promises'

import Generate from './index.js'

export default class GenerateMatrix extends Command {
  static description = 'Generate plugins based on a matrix of options.'

  static examples = ['<%= config.bin %> <%= command.id %>']

  static flags = {
    matrix: Flags.file({
      char: 'm',
      default: 'matrix.json',
      description: 'JSON file containing a matrix of options.',
      exists: true,
      required: true,
    }),
    'output-directory': Flags.directory({
      char: 'd',
      default: async () => process.cwd(),
      defaultHelp: async () => 'Current working directory.',
      summary: 'Directory to create the plugin in.',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(GenerateMatrix)

    const matrix = JSON.parse(await readFile(flags.matrix, 'utf8')) as Array<
      Interfaces.InferredFlags<(typeof Generate)['flags']> & {skip?: boolean}
    >

    await Promise.all(
      matrix
        .filter((opts) => !opts.skip)
        .map(async (opts) => {
          const compiledFlags = Object.entries(opts)
            .flatMap(([name, value]) => {
              if (value === true) return [`--${name}`]
              if (Array.isArray(value)) return value.flatMap((v) => [`--${name}`, v])
              if (typeof value === 'string') return [`--${name}`, value]
              return []
            })
            .filter(Boolean)
          await Generate.run(
            [...compiledFlags, '--force', '--directory', flags['output-directory'], '--no-spinner'],
            this.config,
          )
        }),
    )
  }
}
