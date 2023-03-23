import esbuild from "esbuild"
import { examplePath } from "../../file.util.mjs"

await esbuild.build({
    entryPoints: [examplePath('no-plugins/cat.txt')]
})