export default {
	input: "lib.js",
	output: [{
		format: "umd",
		name: "backdraft",
		file: "dist/lib-umd.js"
	}, {
		format: "es",
		name: "backdraft",
		file: "dist/lib.js"
	}]
};