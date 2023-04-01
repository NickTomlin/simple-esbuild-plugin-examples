import esbuild from "esbuild"
import { examplePath } from "../../file.util.mjs"

/*
This showcases plugin's ability to add virtual files to the build
pipeline via the `onLoad` hook.
*/
function templatePlugin({ replacements = {} } = {}) {
    return {
        name: "templatePlugin",
        setup: (build) => {
            build.onResolve({ filter: /config:templates/ }, (args) => {
                return {
                    path: args.path,
                    namespace: 'templates'
                }
            })

            build.onLoad({ filter: /.*/, namespace: "templatePlugin" }, (args) => {
                return {
                    contents: JSON.stringify(replacements),
                    loader: 'json'
                }
            })
        }
    }
}

await esbuild.build({
    entryPoints: [examplePath('2-virtual-files/input.mjs')],
    bundle: true,
    plugins: [templatePlugin({ replacements: { MESSAGE: 'Hello', NAME: 'World' } })]
})