import esbuild from "esbuild"
import { readFile } from "node:fs/promises"
import { examplePath } from "../../file.util.mjs"

/*
Change instances of `meow` to `woof`
*/
const dogifyPlugin = {
  name: "dogifyPlugin",
  setup: (build) => {
    build.onResolve({ filter: /\.txt$/ }, (args) => {
      console.debug('onResolve', args)
      return {
        path: args.path,
        namespace: 'dogify'
      }
    })

    build.onLoad({ filter: /.*/, namespace: "dogify" }, async (args) => {
      const originalContents = await readFile(args.path, 'utf8')
      const updatedContents = originalContents.replaceAll('meow', 'woof')

      return {
        contents: updatedContents,
        loader: "copy" // https://esbuild.github.io/content-types/#external-file
      }
    })
  }
}

await esbuild.build({
  entryPoints: [examplePath('1-simple-text-transform/cat.txt')],
  plugins: [dogifyPlugin]
})