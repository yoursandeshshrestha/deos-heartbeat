import * as esbuild from 'esbuild'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const resolveTs = {
  name: 'resolve-ts',
  setup(build) {
    build.onResolve({ filter: /^\./ }, (args) => {
      if (!args.path.endsWith('.js')) return null
      const tsPath = args.path.slice(0, -3) + '.ts'
      const candidate = join(args.resolveDir, tsPath)
      if (!existsSync(candidate)) return null
      return { path: candidate }
    })
  },
}

await esbuild.build({
  absWorkingDir: root,
  entryPoints: ['supabase/functions/api/main.ts'],
  outfile: 'supabase/functions/api/index.ts',
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  plugins: [resolveTs],
  external: [
    'node:*',
    'pdf-lib',
    '@pdf-lib/fontkit',
    'resend',
    '@supabase/supabase-js',
  ],
  banner: {
    js: `import { Buffer as __NodeBuffer } from "node:buffer";\nglobalThis.Buffer = globalThis.Buffer ?? __NodeBuffer;\n`,
  },
})

console.log('bundled', pathToFileURL(join(root, 'supabase/functions/api/index.ts')).pathname)
