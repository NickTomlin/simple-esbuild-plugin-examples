Esbuild plugins
---

This post provides a brief introduction to `esbuild`'s build pipeline and how to create basic `esbuild` plugins.

# What is esbuild? Why a guide?

[esbuild](https://esbuild.github.io/) is JavaScript bundler that processes files and turns them into a JavaScript bundle that Runtime (like ,node.js, `deno`, or your browser) can execute. There are many tools that also do this, but `esbuild` manages to do so in a fast, focused, and portable way. This is why it is used in projects like [`vite`](https://vitejs.dev/), [`remix`](https://remix.run/) and [`esm.sh`](https://esm.sh/) and _many more_.

The reason why `esbuild` is such a great platform for things like `vite` is that it is pretty limited in what it offers. While there is a growing list of [community plugins](https://github.com/esbuild/community-plugins) you may find yourself needing to do something that esbuild does not do, and that is why I wrote this quick guide.

# An overview

At it's core `esbuild` involves a simple process `[input] -> (resolve -> load) -> [output]`.

### Input

`input` file(s) passed to `esbuild`, for example:

```javascript
esbuild.build({
    entryPoints: ["index.js"]
})
```

### Resolve

The `resolve` step involves taking a path (an `fs` path or an `import`/`require` path) and directing it to something that can `load` it. There are different `kind`s of paths that can be resolved. A few important ones:

- `entryPoint` a file, like `index.js`
- `import`: an import like `import("./util.js")` or `require("./foo.js")` or `@import("my.css")`


### Load

The `load` step takes a resolved path from the previous stage, and loads the content for that path. This can take the form of reading it from the file system, or a url, or creating it on the fly.

Typically this takes the form of `javaScript`, since the output target of `esbuild` is a JavaScript application, but there is built in support for several different [content types](https://esbuild.github.io/content-types/)

![diagram of build steps][]

### `imports` and the build "stack"

While the build process can be envisioned as a one way pipeline, one of the unique features of `esbuild` is that `load`ed content can reference _other_ files via `import`s. This allows the build to become aware of other files in a way that maps the natural grain of a module dependency graph. This means that files can add other files, and the split between `resolve` and `load` allows for scenarios where an `import` can be dynamically resolved from _anywhere_ not just a file system path.

You can think of an `import` as a way of pushing an `input` back onto the build stack, which then gets sent through the same `resolve -> load` pipeline. This modeling is the core of input processing plugins in `esbuild`.

# Plugins

Now that we've explored how `esbuild`'s build time modeling works, we can launch into the plugin architecture.

By default, `esbuild` comes with `resolve` and `load` plugins: It will natively handle `js`/`ts`, `css`, `json` (and more!) files. It resolve, load, and spit out a valid JavaScript bundle for the runtime of your choosing.

### Why write a plugin?

While `esbuild` does many things out of the box, there are many situations it does not handle and does not want to handle. Plugins are there to close these gaps.

A few important things to note:

0. `esbuild`'s plugin architecture is just about `resolv`ing and `load`ing. Anything beyond simple text processing will be up to you. This means if you want to [compile your favorite esoteric language to js](https://esolangs.org/wiki/Language_list) you will have to run a compiler in you `load`er.
    - Running a compiler in `load` will (naturally) make your build slower.
1. The plugin architecture is simple and fast because it is limited. It may not be possible to do what you want with an `esbuild` plugin.
2. Plugins only work in `go` and `javascript`. There is a [`wasm`](https://esbuild.github.io/getting-started/#wasm) version but it does not have plugin support and is much slower.

# Defining a plugin

The [docs](https://esbuild.github.io/plugins/#using-plugins) do a good job of defining the APIs of plugins, but essentially `esbuild` allows plugins to hook into its build process to contribute to (and/or modify) the build. While, there are many different hooks an `esbuild` plugin can define,  This post will focus purely on the `onResolve` and `onLoad` hooks. These hooks are what I am most familiar with and are probably what most plugins will want to use anyway.

## The shape of a plugin

A common idio is to define your plugin as a function that accepts options that your plugin may want to expose. This function then returns an `esbuild` plugin implementation with whatever hooks you want to use defined:

```
function myPlugin ({greeting = "world"} = {}) {
    return {
        name: "MyPlugin"
        setup(build) {
            // use build hooks here
            build.onResolve(/* */)
        }
    }
}

await esbuild.build({
    entryPoints: ["index.js],
    plugins(myPlugin({ greeting: "Nick" }))
})
```

## Example: A "vanilla" plugin

To make this more concrete, let's create a simple plugin that replicates what `esbuild` does internally. We will `resolve` `js` files and simply replace every instance of `!` with `!!` to prove that our resolution is working.

First we define our "shell"

```javascript
function vanillaPlugin () {
    return {
      name: "vanillaPlugin",
      setup: (build) => {
        // todo
      }
  }
}
```

now we can concentrate on actually defining how our plugin will interact with the build process:

```javascript
// in the `setup` block above
build.onResolve({ filter: /\.js$/ }, (args) => {
    return {
        path: args.path,
        namespace: 'vanilla'
    }
})
```

All this does is tell `esbuild` if a file ends with `.js` let _us_ resolve it, rather than the built-in resolver.

We use the return to pass the original path (e.g. `./src/index.js`) on to the `loader` and a special `namespace` to indicate that this should be loaded by something within that namespace, rather than a default loader.

Now that we've claimed dibs on loading `.js` files, we need to actual provide a loader to do that.

```javascript
build.onLoad({ filter: /.*/, namespace: "vanilla" }, async (args) => {
    const contents = await readFile(args.path, 'utf8')
    return {
        // a simple substitution just to prove that we've
        // loaded the file and are transforming it
        contents: contents.replace('!', '!!!')
    }
})
```

Like `onResolve` we are passing an object to help us filter down what we should load, but we are now using the `namespace` property to scope us to the `namespace` we specified in our `onResolve` hook:

```
{ filter: /.*/, namespace: "vanilla" }
```

After that, we simply read the contents from the file system and do a simple `replace` on them. For our simple use case, this works great, this would break a program that relies on `!` for logic, and we need to use an `ast` parser or complicated regex if we wanted to do more fine-grained manipulations.

## Virtual files

Our first example dealt with files that were already on the file system.

```javascript
// input.mjs
import { MESSAGE, NAME } from 'config:templates'

export default function hello() {
    // this will be inserted by our build step
    return `${MESSAGE}, ${NAME}!`
}
```

There is no `config:templates` module on the file system, and so our plugin will `resolve` and `load` it with a "virtual" module.

Again, we start with a plugin scaffold:

```javascript
function templatePlugin({ replacements = {} } = {}) {
    return {
        name: "templatePlugin",
        setup: (build) => {
        // todo
    }
  }
}
```

And we resolve imports that contain `config:templates` to a plugin `namespace`

```javascript
build.onResolve({ filter: /config:templates/ }, (args) => {
    return {
        path: args.path,
        namespace: 'templates'
    }
})
```

Now we handle the actual content in an `onLoad`, by generating the source of `config:templates`, which is a simple `JSON` object:

```javascript
  build.onLoad({ filter: /.*/, namespace: "templatePlugin" }, (args) => {
      return {
          // we are using plugin options here, but this could easily come from a REST call or a database
          contents: JSON.stringify(replacements),
          // let esbuild know that it should treat this as a `json` file, as opposed to a 
          // a js file
          loader: 'json'
      }
  })
```

The build output shows `esbuild` has bundled those hardcoded variables into our program:

```
(() => {
  // virtualFilePlugin:config:templates
  var MESSAGE = "Hello";
  var NAME = "World";

  // examples/2-virtual-files/input.mjs
  function hello() {
    return `${MESSAGE}, ${NAME}!`;
  }
})();
```

This is a simplistic example, but this pattern can be repeated and extended to have multiple recusive `import`s to build out complicated module trees. All of that is built on the `resolve` and `load` primitives that `esbuild` provides.

# :wave:

That was a brief introduction into simple `esbuild` plugins; hopefully it can be of some help as you write (or debug) esbuild plugins yourself.

You can see more small examples in [the repo]() and I would also recommend browsing the [community plugins](https://github.com/esbuild/community-plugins) for inspiration!

Happy bundling!
Nick