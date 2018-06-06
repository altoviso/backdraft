export default {
	input: "src/backdraft.js",
	output: [{
		format: "umd",
		name: "backdraft",
		file: "dist/backdraft-umd.js"
	}, {
		format: "es",
		name: "backdraft",
		file: "dist/backdraft.js"
	}]
};