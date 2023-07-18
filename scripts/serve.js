const handler = require("serve-handler");
const http = require("http");

const server = http.createServer((request, response) => {
	return handler(request, response, {
		public: "./dist",

		headers: [
			{
				source: "*",
				headers: [
					{
						key: "Cross-Origin-Opener-Policy",
						value: "same-origin",
					},
					{
						key: "Cross-Origin-Embedder-Policy",
						value: "require-corp",
					},
				],
			},
		],
	});
});

server.listen(3000, () => {
	console.log("Running at http://localhost:3000");
});