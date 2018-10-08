import {watch, toWatchable} from "../lib.js";

const smoke = typeof window !== "undefined" ? window.smoke : require("bd-smoke");
const assert = smoke.assert;

smoke.defTest({
	id: "watchable",
	tests: [
		["test1", function(){
			window.z = toWatchable(
				[
					{label: 'A', value: 100},
					{label: 'B', value: 100},
					{label: 'C', value: 100},
					{label: 'D', value: 100},
					{label: 'E', value: 100},
					{label: 'F', value: 100}
				]
			);

		}],
		["test2", function(){

		}],
		["test3", function(){
		}]
	]
});
