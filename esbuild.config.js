// esbuild.config.js
const esbuild = require("esbuild");

// Define common build options
const buildOptions = {
  entryPoints: ["./src/ConcurrentCallbackQueue.js"], // Path to the entry file of your library
  bundle: true, // Bundle all dependencies into the output file
  sourcemap: true, // Generate source maps for easier debugging
  target: "es2015", // Target ECMAScript version
  legalComments: "linked", // Preserve comments with a URL to the source code
};

// Build for CommonJS (CJS)
esbuild
  .build({
    ...buildOptions,
    format: "cjs", // CommonJS format
    outfile: "./dist/ConcurrentCallbackQueue.cjs.js", // Output file
    platform: "node", // Platform target
  })
  .catch(() => process.exit(1));

// Build for ES Module (ESM)
esbuild
  .build({
    ...buildOptions,
    format: "esm", // ES Module format
    outfile: "./dist/ConcurrentCallbackQueue.esm.js", // Output file
    platform: "browser", // Platform target
  })
  .catch(() => process.exit(1));

// Build for IIFE (unminified)
esbuild
  .build({
    ...buildOptions,
    format: "iife", // IIFE format
    globalName: "ConcurrentCallbackQueue", // Global variable name for IIFE build
    outfile: "./dist/ConcurrentCallbackQueue.iife.js", // Output file
    platform: "browser", // Platform target
  })
  .catch(() => process.exit(1));

// Build for IIFE (minified)
esbuild
  .build({
    ...buildOptions,
    format: "iife", // IIFE format
    globalName: "ConcurrentCallbackQueue", // Global variable name for IIFE build
    outfile: "./dist/ConcurrentCallbackQueue.iife.min.js", // Output file
    minify: true, // Minify the output
    platform: "browser", // Platform target
  })
  .catch(() => process.exit(1));
