import path from 'node:path'
import * as url from 'node:url';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

/*
Provide an absolute path from the root, to make dealing with (and thinking about)
paths from example a little easier
*/
export function examplePath(...filePaths) {
    return path.join(__dirname, 'examples', ...filePaths)
}