const esbuild = require("esbuild");
const fs = require("fs-extra");
const { globSync } = require("glob");

// fs.rmSync("./dist", {recursive: true, force: true});
if (!fs.existsSync("./dist/")) fs.mkdirSync("./dist");

for (const file of globSync("./static/**/*.*")) {
	const f = file.split("/").slice(1).join("/");
	fs.copy(`./static/${f}`, `./dist/${f}`);
}

esbuild.buildSync({
	entryPoints: ["./src/index.ts"],
	bundle: true,
	outfile: "./dist/index.js",
	sourcemap: true,
	platform: "browser",
	loader: { ".js": "jsx" },
	minify: false,
	jsx: "automatic",
	
	jsxImportSource: "preact",
});