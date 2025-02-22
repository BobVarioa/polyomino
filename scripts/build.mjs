import esbuild from "esbuild";
import fs from "fs-extra";
import { globSync } from "glob";
import pbjs from "protobufjs-cli/pbjs.js";
import pbts from "protobufjs-cli/pbts.js";

await new Promise((res, rej) => {
	pbjs.main(
		[
			"--target",
			"static-module",
			"-w",
			"es6",
			"./src/game/network/network.proto",
			"-o",
			"./src/game/network/network-compiled.js",
		],
		(err, out) => {
			res();
		}
	);
});

await new Promise((res, rej) => {
	pbts.main(
		[
			"./src/game/network/network-compiled.js",
			"-o",
			"./src/game/network/network-compiled.d.ts",
		],
		(err, out) => {
			res();
		}
	);
});

// fs.rmSync("./dist", {recursive: true, force: true});
if (!(await fs.exists("./dist/"))) await fs.mkdir("./dist");

for (const file of globSync("./static/**/*.*")) {
	const f = file.split("/").slice(1).join("/");
	fs.copy(`./static/${f}`, `./dist/${f}`);
}

await esbuild.build({
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
