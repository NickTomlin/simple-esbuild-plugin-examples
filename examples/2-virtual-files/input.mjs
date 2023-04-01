import { MESSAGE, NAME } from 'config:templates'

export default function hello() {
    // this will be inserted by our build step
    return `${MESSAGE}, ${NAME}!`
}