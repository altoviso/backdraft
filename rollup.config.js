export default {
	input: "lib.js",
	output: [{
		format: "umd",
		name: "bd",
		file: "dist/lib-umd.js"
	}, {
		format: "es",
		file: "dist/lib.js"
	}]
};