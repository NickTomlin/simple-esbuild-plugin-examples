
import esbuild from "esbuild"
import { readFile } from "node:fs/promises"
import { examplePath } from "../../file.util.mjs"

/*
This mimics the behavior of default esbuild process in a simple plugin
*/
const vanillaPlugin = {
    name: "vanillaPlugin",
    setup: (build) => {
        build.onResolve({ filter: /\.js$/ }, (args) => {
            console.debug('onResolve', args)
            return {
                path: args.path,
                namespace: 'vanilla'
            }
        })

        build.onLoad({ filter: /.*/, namespace: "vanilla" }, async (args) => {
            console.debug('onLoad', args)
            const contents = await readFile(args.path, 'utf8')
            return {
                // a simple substitution just to prove that we've
                // loaded the file and are transforming it
                contents: contents.replace('!', '!!!')
            }
        })
    }
}

await esbuild.build({
    entryPoints: [examplePath('0-vanilla-plugin/cat.js')],
    plugins: [vanillaPlugin]
})