# Backdraft

## a JavaScript library for building browser-hosted user interfaces

  * employs a familiar, frugal, and powerful  API that includes declarative composition *as well as* traditional type specialization.
  * small--about 1000 lines of pure, modern JavaScript
  * faster than almost all and *as fast as any* component-construction library
  * *no* compilation step required
  * *zero* external dependencies in the library code
  * FreeBSD licensed

##Website

Backdraft is extensively documented at [backdraftjs.org](http://backdraftjs.org)

##Install

With `npm`:

```
npm install -D backdraftjs
```

With `yarn`:

```
yarn add backdraftjs
```

With `bower`:

```
bower install --save backdraftjs
```

#####Notice that all installers install in the directory backdraftjs (i.e., with a "js" at the end).


Backdraft is distributed with three versions of the code:

* The raw source; each source file is an ES6 module.
* A rollup of the library into a single ES6 module.
* A rollup of the library into a single  [UMD](https://github.com/umdjs/umd) module.


npm and yarn install Backdraft at ```npm_modules/backdraftjs```. The three versions of the code are located as follows:

* raw source: ```node_modules/backdraftjs/src/backdraft.js```
* ES6 module rollup: ```node_modules/backdraftjs/dist/backdraft.js```
* UMD module rollup: ```node_modules/backdraftjs/dist/backdraft-umd.js```

bower is similarly located except it uses ```bower_components``` in place of ```node_modules```.

If you are using AMD, then you should map the UMD rollup. We recommend you try out [bd-load](xxx) for AMD loading.

ES6 modules can be painful. Since ES6 modules loaders don't exist, module mapping (which, by the way, we invented) is not available with ES6 modules. We find it inconvenient to reference the install locations in every resource that imports symbols from Backdraft. To make things easier, we always create a resource in the root source directory of our projects that re-exports Backdraft symbols. For example, if a particular project organizes all of its source code in the ```<project-root>/src``` directory, then we would create a file in that directory named ```backdraft.js``` with the following contents:

```
export * from "../node_modules/backdraftjs/src/backdraft.js"
```

This allows us to write a module that imports from Backdraft easily. Consider what ```<project-root>/src/hello-world.js```  might look like:

```
import {render, e} from "./backdraft.js"

render(e("div", "hello, world"), document.getElementById("root"));
```

##Production Code

The Backdraft library makes no judgement about how you condition your code for production. Further, the library was designed from the ground up to avoid the need for extra code (and, therefore, complexity) in a "development" version. Therefore, simply include Backdraft in your build as if it was your own code; there is nothing more to it than that.

##Documentation

[Tutorial](http://backdraftjs.org/tutorial/1-getting-started.html)

[Reference Manual](http://backdraftjs.org/docs.html)

[Videos](http://backdraftjs.org/videos.html)

[Blog](http://backdraftjs.org/blog/top.html)

##Examples

The GitHub repo [altoviso/backdraft-tutorial](https://github.com/altoviso/backdraft-tutorial) includes several examples including all [tutorial](http://backdraftjs.org/tutorial/1-getting-started.html) code, the [todomvc example](https://github.com/tastejs/todomvc), and the [js-framework-benchmark example](https://github.com/krausest/js-framework-benchmark).

##Support

If you have a usage question, please open an issue on [stackoverflow](https://stackoverflow.com/questions/ask/advice?); please tag the question with "backdraft".

If you've found a bug, please open an issue in this repository. Your chances of getting attention are *much* higher if you provide a reproducible test case.

You may also request an enhancement by opening an issue. Again, your chances of getting that enhancement incorporated into future releases are *much* higher if you provide a pull request with a test.

##Commercial Support

Commercial support and program design and construction services are available from [ALTOVISO LLC](http://www.altoviso.com). You may email requests to [consult@altoviso.com](mailto:consult@altoviso.com) or contact us directly at 925.229.0667 8:00 A.M. - 6:00 P.M., Pacific Time Zone.

