/**
 * Entrypoint to build files required by extension
 * - wrapper.js: Entrypoint for VSC, calls extension, enables hot-reload.
 * - extension.js: Main file containing extension logic.Simple web-based script to be in the VSC webview, which embeds Source Academy's frontend as iframe
 *
 * To be called by `npm run build`
 */

// @ts-check: Show errors in this js file

const esbuild = require("esbuild");

const outputFolder = "dist";

const extensionConfig = esbuild.context({
  entryPoints: ["./main.ts"],
  bundle: true,
  format: "cjs",
  platform: "node",
  outfile: `./${outputFolder}/main.js`,
  sourcemap: true,
});

main();

async function main() {
  if (process.argv.includes("--watch")) {
    await watch();
  } else {
    await build();
  }
  process.exit(0);
}

async function resolveContexts() {
  return await Promise.all([extensionConfig]);
}

async function watch() {
  const contexts = await resolveContexts();
  contexts.forEach((ctx) => ctx.watch());
  console.log("Watching files...");
  await new Promise(() => {});
}

async function build() {
  const contexts = await resolveContexts();
  await Promise.all(contexts.map((ctx) => ctx.rebuild()));
  console.log("Builds completed successfully.");
}
