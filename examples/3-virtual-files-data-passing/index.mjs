
import esbuild from "esbuild"
import { examplePath } from "../../file.util.mjs"

/*
This showcases plugin's ability to add virtual files to the build
pipeline via the `onLoad` hook.
*/
function VirtualFilesDataPassingPlugin(numberOfFiles = 3) {
    return {
        name: "templatePlugin",
        setup: (build) => {
            build.onResolve({ filter: /\.mjs$/ }, (args) => {
                if (args.kind !== 'entry-point') { return }
                return {
                    path: args.path,
                    namespace: 'templatePlugin.entry',
                    pluginData: {
                        numberOfFiles,
                    }
                }
            })

            build.onLoad({ filter: /\.mjs$/, namespace: 'templatePlugin.entry' }, async (args) => {
                const { numberOfFiles } = args.pluginData
                const virtualImports = Array
                    .from({ length: numberOfFiles }, (_, i) => `import message${i} from './message-${i}.VIRTUAL.mjs'`)
                    .join('\n')
                const useImports = Array
                    .from({ length: numberOfFiles }, (_, i) => `message${i}`)
                    .join(' + ')

                const updatedContents = `
                    ${virtualImports}

                    export default function greet () {
                        ${useImports}
                    }
                `
                return {
                    contents: updatedContents,
                    pluginData: args.pluginData
                }
            })

            build.onResolve({ filter: /\.VIRTUAL.mjs$/ }, (args) => {
                return {
                    path: args.path,
                    namespace: 'templatePlugin.virtual',
                    pluginData: {
                        number: args.path.match(/message-(\d+)\.VIRTUAL\.mjs/)[1],
                    }
                }
            })

            build.onLoad({ filter: /.*/, namespace: "templatePlugin.virtual" }, (args) => {
                const { number } = args.pluginData
                console.debug(args)
                return {
                    contents: `
                export default 'Hello ${number}!'
                    `
                }
            })
        }
    }
}

await esbuild.build({
    entryPoints: [examplePath('3-virtual-files-data-passing/input.mjs')],
    bundle: true,
    plugins: [VirtualFilesDataPassingPlugin()]
})