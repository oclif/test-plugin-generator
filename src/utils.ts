import chalk from 'chalk'
import {spawn} from 'cross-spawn'
import makeDebug from 'debug'
import {SpawnOptions} from 'node:child_process'
import {access} from 'node:fs/promises'

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export class Executor {
  private debug: makeDebug.Debugger

  public constructor(debugHeader: string) {
    this.debug = makeDebug(debugHeader)
  }

  public async exec(command: string, args?: string[], opts?: SpawnOptions): Promise<number> {
    // eslint-disable-next-line unicorn/consistent-function-scoping
    const debug = (source: 'stderr' | 'stdout', data: Buffer) => {
      this.debug(chalk.dim(`(${source})`), data.toString().trimEnd())
    }

    return new Promise((resolve, reject) => {
      this.debug(`${command} ${args?.join(' ')} (cwd: ${opts?.cwd})`)
      const child = spawn(command, args, {...opts, shell: true, stdio: 'pipe'})
      child.on('error', reject)
      child.on('exit', resolve)

      child.stderr?.on('data', (data: Buffer) => debug('stderr', data))
      child.stdout?.on('data', (data: Buffer) => debug('stdout', data))
    })
  }
}

export async function exec(command: string, args?: string[], opts?: SpawnOptions): Promise<number> {
  return new Executor('exec').exec(command, args, opts)
}
