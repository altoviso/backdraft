import {watch, toWatchable, fromWatchable, UNKNOWN_OLD_VALUE} from "../lib.js";

let path = [];

function _deepEql(x, y, name){
	function test(x, y){
		if(x instanceof Object){
			if(!(y instanceof Object)){
				console.log("deepEql fail", path);
				return false;
			}
			if(!x && x !== y){
				console.log("deepEql fail", path);
				return false;
			}
			if(Reflect.ownKeys(x).some(k => !_deepEql(x[k], y[k], k))){
				return false;
			}
			if(Reflect.ownKeys(y).some(k => !_deepEql(x[k], y[k], k))){
				return false;
			}
			return true;
		}else if(x !== y){
			console.log("deepEql fail", path);
			return false;
		}
		return true;
	}

	name && path.push(name);
	let result = test(x, y);
	name && path.pop();
	return result;
}


const smoke = typeof window !== "undefined" ? window.smoke : require("bd-smoke");
const assert = smoke.assert;

let data;
let logResult;

function deepEql(expected){
	return _deepEql(JSON.parse(JSON.stringify(logResult)), expected);
}

function logWatcher(watchId){
	return function(newValue, oldValue, target, prop){
		let result = {
			[watchId]: {
				newValue: fromWatchable(newValue),
				oldValue: oldValue === UNKNOWN_OLD_VALUE ? "UNKNOWN_OLD_VALUE" : fromWatchable(oldValue),
				target: fromWatchable(target),
				prop: prop
			}
		};
		logResult.push(result);
	};
}

smoke.defTest({
	id: "watchable",
	beforeEach: function(){
		// window.data so we can play with data in the debug console
		logResult = [];
		data = window.data = toWatchable(
			[
				{label: "A", value: 0},
				{label: "B", value: 1},
				{label: "C", value: 2},
				{label: "D", value: 3},
				{label: "E", value: 4},
				{label: "F", value: 5}
			]
		);
		watch(data, logWatcher("(data)"));
		for(let i = 0; i < data.length; i++){
			watch(data, i, logWatcher(`(data, ${i})`));
			watch(data[i], "label", logWatcher(`(data[${i}], "label")`));
		}
		watch(data, "length", logWatcher(`(data, "length")`));
	},
	tests: [
		["test1", function(){
			logResult.push(`data[0].label = "a"`);
			data[0].label = "a";
			assert(deepEql(test1));

		}],
		["test2", function(){
			logResult.push(`data[0] = {label: "g", value: 6}`);
			data[0] = {label: "g", value: 6};
			assert(deepEql(test2));
		}],
		["test3", function(){
			logResult.push(`data.pop()`);
			data.pop();
			assert(deepEql(test3));

		}],
		["test4", function(){
			logResult.push(`data.push({label: "g", value: 6})`);
			data.push({label: "g", value: 6});
			assert(deepEql(test4));
		}],
		["test5", function(){
			logResult.push(`data.shift()`);
			let item = data.shift();

			assert(item.label === "A");
			assert(item.value === 0);
			assert(deepEql(test5));
		}],
		["test6", function(){
			logResult.push(`data.unshift({label: "g", value: 6}, {label: "h", value: 7})`);
			data.unshift({label: "g", value: 6}, {label: "h", value: 7});
			assert(deepEql(test6));
		}],
		["test7", function(){
			logResult.push(`data.reverse()`);
			data.reverse();
			logResult.push(`data.reverse, odd number of elements`);
			data.pop();
			data.reverse();
			logResult.push(`data.reverse, one element`);
			data.splice(1, data.length);
			data.reverse();
			logResult.push(`data.reverse, zero elements`);
			data.pop();
			data.reverse();
			assert(deepEql(test7));
		}],
		["test8", function(){
			// inserts by splice
			data.splice(3, 3);
			logResult = [];
			logResult.push(`data.splice(0, 0, {label:"AA", value:10})`);
			data.splice(0, 0, {label: "AA", value: 10});
			logResult.push(`data.splice(1, 0, {label:"BB", value:20})`);
			data.splice(1, 0, {label: "BB", value: 20});
			logResult.push(`data.splice(5, 0, {label:"CC", value:30})`);
			data.splice(5, 0, {label: "CC", value: 30});
			assert(deepEql(test8));
		}],
		["test9", function(){
			// deletes by splice
			data.splice(4, 2);
			logResult.push(`data.splice(0, 1)`);
			data.splice(0, 1);
			logResult.push(`data.splice(1, 1)`);
			data.splice(1, 1);
			logResult.push(`data.splice(1, 1)`);
			data.splice(1, 1);
			assert(deepEql(test9));
		}],
		["test10", function(){
			// delete, insert
			data.splice(3, 3);
			logResult.push(`data.splice(0, 1, {label:"AA", value:10})`);
			data.splice(0, 1, {label: "AA", value: 10});
			logResult.push(`data.splice(0, 1, {label:"BB", value:20}, {label:"CC", value:30})`);
			data.splice(0, 1, {label: "BB", value: 20}, {label: "CC", value: 30});
			logResult.push(`data.splice(0, 2, {label: "DD", value: 40})`);
			data.splice(0, 2, {label: "DD", value: 40});
			assert(deepEql(test10));
		}],
		["test11", function(){
			// delete, insert
			data.splice(3, 3);
			logResult.push(`data.splice(1, 1, {label:"AA", value:10})`);
			data.splice(1, 1, {label: "AA", value: 10});
			logResult.push(`data.splice(1, 1, {label:"BB", value:20}, {label:"CC", value:30})`);
			data.splice(1, 1, {label: "BB", value: 20}, {label: "CC", value: 30});
			logResult.push(`data.splice(1, 2, {label: "DD", value: 40})`);
			data.splice(1, 2, {label: "DD", value: 40});
			assert(deepEql(test11));
		}],
		["test12", function(){
			// delete, insert
			data.splice(3, 3);
			logResult.push(`data.splice(2, 1, {label:"AA", value:10})`);
			data.splice(2, 1, {label: "AA", value: 10});
			logResult.push(`data.splice(2, 1, {label:"BB", value:20}, {label:"CC", value:30})`);
			data.splice(2, 1, {label: "BB", value: 20}, {label: "CC", value: 30});
			logResult.push(`data.splice(3, 2, {label: "DD", value: 40})`);
			data.splice(3, 2, {label: "DD", value: 40});
			assert(deepEql(test12));
		}],
		["testSort", function(){
			data.sort((lhs, rhs) => lhs.label < rhs.label ? 1 : -1);
			assert(deepEql(testSort));
		}]
	]
});
//console.log(JSON.stringify(logResult));

let test1 = ["data[0].label = \"a\"", {
	"(data[0], \"label\")": {
		"newValue": "a",
		"oldValue": "A",
		"target": {"label": "a", "value": 0},
		"prop": ["0", "label"]
	}
}, {
	"(data, 0)": {
		"newValue": {"label": "a", "value": 0},
		"oldValue": "UNKNOWN_OLD_VALUE",
		"target": [{"label": "a", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}, {
			"label": "D",
			"value": 3
		}, {"label": "E", "value": 4}, {"label": "F", "value": 5}],
		"prop": ["0", "label"]
	}
}, {
	"(data)": {
		"newValue": [{"label": "a", "value": 0}, {"label": "B", "value": 1}, {
			"label": "C",
			"value": 2
		}, {"label": "D", "value": 3}, {"label": "E", "value": 4}, {"label": "F", "value": 5}],
		"oldValue": "UNKNOWN_OLD_VALUE",
		"target": [{"label": "a", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}, {
			"label": "D",
			"value": 3
		}, {"label": "E", "value": 4}, {"label": "F", "value": 5}],
		"prop": ["0", "label"]
	}
}];

let test2 = ["data[0] = {label: \"g\", value: 6}", {
	"(data, 0)": {
		"newValue": {"label": "g", "value": 6},
		"oldValue": {"label": "A", "value": 0},
		"target": [{"label": "g", "value": 6}, {"label": "B", "value": 1}, {"label": "C", "value": 2}, {
			"label": "D",
			"value": 3
		}, {"label": "E", "value": 4}, {"label": "F", "value": 5}],
		"prop": ["0"]
	}
}, {
	"(data)": {
		"newValue": [{"label": "g", "value": 6}, {"label": "B", "value": 1}, {
			"label": "C",
			"value": 2
		}, {"label": "D", "value": 3}, {"label": "E", "value": 4}, {"label": "F", "value": 5}],
		"oldValue": {"label": "A", "value": 0},
		"target": [{"label": "g", "value": 6}, {"label": "B", "value": 1}, {"label": "C", "value": 2}, {
			"label": "D",
			"value": 3
		}, {"label": "E", "value": 4}, {"label": "F", "value": 5}],
		"prop": ["0"]
	}
}];

let test3 = ["data.pop()", {
	"(data, \"length\")": {
		"newValue": 5,
		"oldValue": 6,
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}, {
			"label": "D",
			"value": 3
		}, {"label": "E", "value": 4}],
		"prop": ["length"]
	}
}, {
	"(data)": {
		"newValue": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {
			"label": "C",
			"value": 2
		}, {"label": "D", "value": 3}, {"label": "E", "value": 4}],
		"oldValue": 6,
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}, {
			"label": "D",
			"value": 3
		}, {"label": "E", "value": 4}],
		"prop": ["length"]
	}
}];

let test4 = ["data.push({label: \"g\", value: 6})", {
	"(data)": {
		"newValue": [{"label": "A", "value": 0}, {
			"label": "B",
			"value": 1
		}, {"label": "C", "value": 2}, {"label": "D", "value": 3}, {"label": "E", "value": 4}, {
			"label": "F",
			"value": 5
		}, {"label": "g", "value": 6}],
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}, {
			"label": "D",
			"value": 3
		}, {"label": "E", "value": 4}, {"label": "F", "value": 5}, {"label": "g", "value": 6}],
		"prop": ["6"]
	}
}, {
	"(data, \"length\")": {
		"newValue": 7,
		"oldValue": 6,
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}, {
			"label": "D",
			"value": 3
		}, {"label": "E", "value": 4}, {"label": "F", "value": 5}, {"label": "g", "value": 6}],
		"prop": ["length"]
	}
}, {
	"(data)": {
		"newValue": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {
			"label": "C",
			"value": 2
		}, {"label": "D", "value": 3}, {"label": "E", "value": 4}, {"label": "F", "value": 5}, {
			"label": "g",
			"value": 6
		}],
		"oldValue": 6,
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}, {
			"label": "D",
			"value": 3
		}, {"label": "E", "value": 4}, {"label": "F", "value": 5}, {"label": "g", "value": 6}],
		"prop": ["length"]
	}
}];


let test5 = ["data.shift()", {
	"(data, 0)": {
		"newValue": {"label": "B", "value": 1},
		"oldValue": {"label": "A", "value": 0},
		"target": [{"label": "B", "value": 1}, {"label": "C", "value": 2}, {"label": "D", "value": 3}, {
			"label": "E",
			"value": 4
		}, {"label": "F", "value": 5}],
		"prop": [0]
	}
}, {
	"(data, 1)": {
		"newValue": {"label": "C", "value": 2},
		"oldValue": {"label": "B", "value": 1},
		"target": [{"label": "B", "value": 1}, {"label": "C", "value": 2}, {"label": "D", "value": 3}, {
			"label": "E",
			"value": 4
		}, {"label": "F", "value": 5}],
		"prop": [1]
	}
}, {
	"(data, 2)": {
		"newValue": {"label": "D", "value": 3},
		"oldValue": {"label": "C", "value": 2},
		"target": [{"label": "B", "value": 1}, {"label": "C", "value": 2}, {"label": "D", "value": 3}, {
			"label": "E",
			"value": 4
		}, {"label": "F", "value": 5}],
		"prop": [2]
	}
}, {
	"(data, 3)": {
		"newValue": {"label": "E", "value": 4},
		"oldValue": {"label": "D", "value": 3},
		"target": [{"label": "B", "value": 1}, {"label": "C", "value": 2}, {"label": "D", "value": 3}, {
			"label": "E",
			"value": 4
		}, {"label": "F", "value": 5}],
		"prop": [3]
	}
}, {
	"(data, 4)": {
		"newValue": {"label": "F", "value": 5},
		"oldValue": {"label": "E", "value": 4},
		"target": [{"label": "B", "value": 1}, {"label": "C", "value": 2}, {"label": "D", "value": 3}, {
			"label": "E",
			"value": 4
		}, {"label": "F", "value": 5}],
		"prop": [4]
	}
}, {
	"(data, 5)": {
		"oldValue": {"label": "F", "value": 5},
		"target": [{"label": "B", "value": 1}, {"label": "C", "value": 2}, {"label": "D", "value": 3}, {
			"label": "E",
			"value": 4
		}, {"label": "F", "value": 5}],
		"prop": [5]
	}
}, {
	"(data, \"length\")": {
		"newValue": 5,
		"oldValue": 6,
		"target": [{"label": "B", "value": 1}, {"label": "C", "value": 2}, {"label": "D", "value": 3}, {
			"label": "E",
			"value": 4
		}, {"label": "F", "value": 5}],
		"prop": ["length"]
	}
}, {
	"(data)": {
		"newValue": [{"label": "B", "value": 1}, {"label": "C", "value": 2}, {
			"label": "D",
			"value": 3
		}, {"label": "E", "value": 4}, {"label": "F", "value": 5}],
		"oldValue": "UNKNOWN_OLD_VALUE",
		"target": [{"label": "B", "value": 1}, {"label": "C", "value": 2}, {"label": "D", "value": 3}, {
			"label": "E",
			"value": 4
		}, {"label": "F", "value": 5}],
		"prop": [null]
	}
}];

let test6 = ["data.unshift({label: \"g\", value: 6}, {label: \"h\", value: 7})", {
	"(data, 0)": {
		"newValue": {
			"label": "g",
			"value": 6
		},
		"oldValue": {"label": "A", "value": 0},
		"target": [{"label": "g", "value": 6}, {"label": "h", "value": 7}, {"label": "A", "value": 0}, {
			"label": "B",
			"value": 1
		}, {"label": "C", "value": 2}, {"label": "D", "value": 3}, {"label": "E", "value": 4}, {
			"label": "F",
			"value": 5
		}],
		"prop": [0]
	}
}, {
	"(data, 1)": {
		"newValue": {"label": "h", "value": 7},
		"oldValue": {"label": "B", "value": 1},
		"target": [{"label": "g", "value": 6}, {"label": "h", "value": 7}, {"label": "A", "value": 0}, {
			"label": "B",
			"value": 1
		}, {"label": "C", "value": 2}, {"label": "D", "value": 3}, {"label": "E", "value": 4}, {
			"label": "F",
			"value": 5
		}],
		"prop": [1]
	}
}, {
	"(data, 2)": {
		"newValue": {"label": "A", "value": 0},
		"oldValue": {"label": "C", "value": 2},
		"target": [{"label": "g", "value": 6}, {"label": "h", "value": 7}, {"label": "A", "value": 0}, {
			"label": "B",
			"value": 1
		}, {"label": "C", "value": 2}, {"label": "D", "value": 3}, {"label": "E", "value": 4}, {
			"label": "F",
			"value": 5
		}],
		"prop": [2]
	}
}, {
	"(data, 3)": {
		"newValue": {"label": "B", "value": 1},
		"oldValue": {"label": "D", "value": 3},
		"target": [{"label": "g", "value": 6}, {"label": "h", "value": 7}, {"label": "A", "value": 0}, {
			"label": "B",
			"value": 1
		}, {"label": "C", "value": 2}, {"label": "D", "value": 3}, {"label": "E", "value": 4}, {
			"label": "F",
			"value": 5
		}],
		"prop": [3]
	}
}, {
	"(data, 4)": {
		"newValue": {"label": "C", "value": 2},
		"oldValue": {"label": "E", "value": 4},
		"target": [{"label": "g", "value": 6}, {"label": "h", "value": 7}, {"label": "A", "value": 0}, {
			"label": "B",
			"value": 1
		}, {"label": "C", "value": 2}, {"label": "D", "value": 3}, {"label": "E", "value": 4}, {
			"label": "F",
			"value": 5
		}],
		"prop": [4]
	}
}, {
	"(data, 5)": {
		"newValue": {"label": "D", "value": 3},
		"oldValue": {"label": "F", "value": 5},
		"target": [{"label": "g", "value": 6}, {"label": "h", "value": 7}, {"label": "A", "value": 0}, {
			"label": "B",
			"value": 1
		}, {"label": "C", "value": 2}, {"label": "D", "value": 3}, {"label": "E", "value": 4}, {
			"label": "F",
			"value": 5
		}],
		"prop": [5]
	}
}, {
	"(data, \"length\")": {
		"newValue": 8,
		"oldValue": 6,
		"target": [{"label": "g", "value": 6}, {"label": "h", "value": 7}, {"label": "A", "value": 0}, {
			"label": "B",
			"value": 1
		}, {"label": "C", "value": 2}, {"label": "D", "value": 3}, {"label": "E", "value": 4}, {
			"label": "F",
			"value": 5
		}],
		"prop": ["length"]
	}
}, {
	"(data)": {
		"newValue": [{"label": "g", "value": 6}, {"label": "h", "value": 7}, {
			"label": "A",
			"value": 0
		}, {"label": "B", "value": 1}, {"label": "C", "value": 2}, {"label": "D", "value": 3}, {
			"label": "E",
			"value": 4
		}, {"label": "F", "value": 5}],
		"oldValue": "UNKNOWN_OLD_VALUE",
		"target": [{"label": "g", "value": 6}, {"label": "h", "value": 7}, {"label": "A", "value": 0}, {
			"label": "B",
			"value": 1
		}, {"label": "C", "value": 2}, {"label": "D", "value": 3}, {"label": "E", "value": 4}, {
			"label": "F",
			"value": 5
		}],
		"prop": [null]
	}
}];


let test7 = ["data.reverse()", {
	"(data, 0)": {
		"newValue": {"label": "F", "value": 5},
		"oldValue": {"label": "A", "value": 0},
		"target": [{"label": "F", "value": 5}, {"label": "E", "value": 4}, {"label": "D", "value": 3}, {
			"label": "C",
			"value": 2
		}, {"label": "B", "value": 1}, {"label": "A", "value": 0}],
		"prop": [0]
	}
}, {
	"(data, 1)": {
		"newValue": {"label": "E", "value": 4},
		"oldValue": {"label": "B", "value": 1},
		"target": [{"label": "F", "value": 5}, {"label": "E", "value": 4}, {"label": "D", "value": 3}, {
			"label": "C",
			"value": 2
		}, {"label": "B", "value": 1}, {"label": "A", "value": 0}],
		"prop": [1]
	}
}, {
	"(data, 2)": {
		"newValue": {"label": "D", "value": 3},
		"oldValue": {"label": "C", "value": 2},
		"target": [{"label": "F", "value": 5}, {"label": "E", "value": 4}, {"label": "D", "value": 3}, {
			"label": "C",
			"value": 2
		}, {"label": "B", "value": 1}, {"label": "A", "value": 0}],
		"prop": [2]
	}
}, {
	"(data, 3)": {
		"newValue": {"label": "C", "value": 2},
		"oldValue": {"label": "D", "value": 3},
		"target": [{"label": "F", "value": 5}, {"label": "E", "value": 4}, {"label": "D", "value": 3}, {
			"label": "C",
			"value": 2
		}, {"label": "B", "value": 1}, {"label": "A", "value": 0}],
		"prop": [3]
	}
}, {
	"(data, 4)": {
		"newValue": {"label": "B", "value": 1},
		"oldValue": {"label": "E", "value": 4},
		"target": [{"label": "F", "value": 5}, {"label": "E", "value": 4}, {"label": "D", "value": 3}, {
			"label": "C",
			"value": 2
		}, {"label": "B", "value": 1}, {"label": "A", "value": 0}],
		"prop": [4]
	}
}, {
	"(data, 5)": {
		"newValue": {"label": "A", "value": 0},
		"oldValue": {"label": "F", "value": 5},
		"target": [{"label": "F", "value": 5}, {"label": "E", "value": 4}, {"label": "D", "value": 3}, {
			"label": "C",
			"value": 2
		}, {"label": "B", "value": 1}, {"label": "A", "value": 0}],
		"prop": [5]
	}
}, {
	"(data)": {
		"newValue": [{"label": "F", "value": 5}, {"label": "E", "value": 4}, {
			"label": "D",
			"value": 3
		}, {"label": "C", "value": 2}, {"label": "B", "value": 1}, {"label": "A", "value": 0}],
		"oldValue": "UNKNOWN_OLD_VALUE",
		"target": [{"label": "F", "value": 5}, {"label": "E", "value": 4}, {"label": "D", "value": 3}, {
			"label": "C",
			"value": 2
		}, {"label": "B", "value": 1}, {"label": "A", "value": 0}],
		"prop": [null]
	}
}, "data.reverse, odd number of elements", {
	"(data, \"length\")": {
		"newValue": 5,
		"oldValue": 6,
		"target": [{"label": "F", "value": 5}, {"label": "E", "value": 4}, {"label": "D", "value": 3}, {
			"label": "C",
			"value": 2
		}, {"label": "B", "value": 1}],
		"prop": ["length"]
	}
}, {
	"(data)": {
		"newValue": [{"label": "F", "value": 5}, {"label": "E", "value": 4}, {
			"label": "D",
			"value": 3
		}, {"label": "C", "value": 2}, {"label": "B", "value": 1}],
		"oldValue": 6,
		"target": [{"label": "F", "value": 5}, {"label": "E", "value": 4}, {"label": "D", "value": 3}, {
			"label": "C",
			"value": 2
		}, {"label": "B", "value": 1}],
		"prop": ["length"]
	}
}, {
	"(data, 0)": {
		"newValue": {"label": "B", "value": 1},
		"oldValue": {"label": "F", "value": 5},
		"target": [{"label": "B", "value": 1}, {"label": "C", "value": 2}, {"label": "D", "value": 3}, {
			"label": "E",
			"value": 4
		}, {"label": "F", "value": 5}],
		"prop": [0]
	}
}, {
	"(data, 1)": {
		"newValue": {"label": "C", "value": 2},
		"oldValue": {"label": "E", "value": 4},
		"target": [{"label": "B", "value": 1}, {"label": "C", "value": 2}, {"label": "D", "value": 3}, {
			"label": "E",
			"value": 4
		}, {"label": "F", "value": 5}],
		"prop": [1]
	}
}, {
	"(data, 3)": {
		"newValue": {"label": "E", "value": 4},
		"oldValue": {"label": "C", "value": 2},
		"target": [{"label": "B", "value": 1}, {"label": "C", "value": 2}, {"label": "D", "value": 3}, {
			"label": "E",
			"value": 4
		}, {"label": "F", "value": 5}],
		"prop": [3]
	}
}, {
	"(data, 4)": {
		"newValue": {"label": "F", "value": 5},
		"oldValue": {"label": "B", "value": 1},
		"target": [{"label": "B", "value": 1}, {"label": "C", "value": 2}, {"label": "D", "value": 3}, {
			"label": "E",
			"value": 4
		}, {"label": "F", "value": 5}],
		"prop": [4]
	}
}, {
	"(data)": {
		"newValue": [{"label": "B", "value": 1}, {"label": "C", "value": 2}, {
			"label": "D",
			"value": 3
		}, {"label": "E", "value": 4}, {"label": "F", "value": 5}],
		"oldValue": "UNKNOWN_OLD_VALUE",
		"target": [{"label": "B", "value": 1}, {"label": "C", "value": 2}, {"label": "D", "value": 3}, {
			"label": "E",
			"value": 4
		}, {"label": "F", "value": 5}],
		"prop": [null]
	}
}, "data.reverse, one element", {
	"(data, 1)": {
		"oldValue": {"label": "C", "value": 2},
		"target": [{"label": "B", "value": 1}],
		"prop": [1]
	}
}, {
	"(data, 2)": {
		"oldValue": {"label": "D", "value": 3},
		"target": [{"label": "B", "value": 1}],
		"prop": [2]
	}
}, {
	"(data, 3)": {
		"oldValue": {"label": "E", "value": 4},
		"target": [{"label": "B", "value": 1}],
		"prop": [3]
	}
}, {
	"(data, 4)": {
		"oldValue": {"label": "F", "value": 5},
		"target": [{"label": "B", "value": 1}],
		"prop": [4]
	}
}, {
	"(data, \"length\")": {
		"newValue": 1,
		"oldValue": 5,
		"target": [{"label": "B", "value": 1}],
		"prop": ["length"]
	}
}, {
	"(data)": {
		"newValue": [{"label": "B", "value": 1}],
		"oldValue": "UNKNOWN_OLD_VALUE",
		"target": [{"label": "B", "value": 1}],
		"prop": [null]
	}
}, "data.reverse, zero elements", {
	"(data, \"length\")": {
		"newValue": 0,
		"oldValue": 1,
		"target": [],
		"prop": ["length"]
	}
}, {"(data)": {"newValue": [], "oldValue": 1, "target": [], "prop": ["length"]}}];

let test8 = ["data.splice(0, 0, {label:\"AA\", value:10})", {
	"(data, 0)": {
		"newValue": {"label": "AA", "value": 10},
		"oldValue": {"label": "A", "value": 0},
		"target": [{"label": "AA", "value": 10}, {"label": "A", "value": 0}, {"label": "B", "value": 1}, {
			"label": "C",
			"value": 2
		}],
		"prop": [0]
	}
}, {
	"(data, 1)": {
		"newValue": {"label": "A", "value": 0},
		"oldValue": {"label": "B", "value": 1},
		"target": [{"label": "AA", "value": 10}, {"label": "A", "value": 0}, {"label": "B", "value": 1}, {
			"label": "C",
			"value": 2
		}],
		"prop": [1]
	}
}, {
	"(data, 2)": {
		"newValue": {"label": "B", "value": 1},
		"oldValue": {"label": "C", "value": 2},
		"target": [{"label": "AA", "value": 10}, {"label": "A", "value": 0}, {"label": "B", "value": 1}, {
			"label": "C",
			"value": 2
		}],
		"prop": [2]
	}
}, {
	"(data, 3)": {
		"newValue": {"label": "C", "value": 2},
		"target": [{"label": "AA", "value": 10}, {"label": "A", "value": 0}, {"label": "B", "value": 1}, {
			"label": "C",
			"value": 2
		}],
		"prop": [3]
	}
}, {
	"(data, \"length\")": {
		"newValue": 4,
		"oldValue": 3,
		"target": [{"label": "AA", "value": 10}, {"label": "A", "value": 0}, {"label": "B", "value": 1}, {
			"label": "C",
			"value": 2
		}],
		"prop": ["length"]
	}
}, {
	"(data)": {
		"newValue": [{"label": "AA", "value": 10}, {"label": "A", "value": 0}, {
			"label": "B",
			"value": 1
		}, {"label": "C", "value": 2}],
		"oldValue": "UNKNOWN_OLD_VALUE",
		"target": [{"label": "AA", "value": 10}, {"label": "A", "value": 0}, {"label": "B", "value": 1}, {
			"label": "C",
			"value": 2
		}],
		"prop": [null]
	}
}, "data.splice(1, 0, {label:\"BB\", value:20})", {
	"(data, 1)": {
		"newValue": {"label": "BB", "value": 20},
		"oldValue": {"label": "A", "value": 0},
		"target": [{"label": "AA", "value": 10}, {"label": "BB", "value": 20}, {
			"label": "A",
			"value": 0
		}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": [1]
	}
}, {
	"(data, 2)": {
		"newValue": {"label": "A", "value": 0},
		"oldValue": {"label": "B", "value": 1},
		"target": [{"label": "AA", "value": 10}, {"label": "BB", "value": 20}, {
			"label": "A",
			"value": 0
		}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": [2]
	}
}, {
	"(data, 3)": {
		"newValue": {"label": "B", "value": 1},
		"oldValue": {"label": "C", "value": 2},
		"target": [{"label": "AA", "value": 10}, {"label": "BB", "value": 20}, {
			"label": "A",
			"value": 0
		}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": [3]
	}
}, {
	"(data, 4)": {
		"newValue": {"label": "C", "value": 2},
		"target": [{"label": "AA", "value": 10}, {"label": "BB", "value": 20}, {
			"label": "A",
			"value": 0
		}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": [4]
	}
}, {
	"(data, \"length\")": {
		"newValue": 5,
		"oldValue": 4,
		"target": [{"label": "AA", "value": 10}, {"label": "BB", "value": 20}, {
			"label": "A",
			"value": 0
		}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": ["length"]
	}
}, {
	"(data)": {
		"newValue": [{"label": "AA", "value": 10}, {"label": "BB", "value": 20}, {
			"label": "A",
			"value": 0
		}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"oldValue": "UNKNOWN_OLD_VALUE",
		"target": [{"label": "AA", "value": 10}, {"label": "BB", "value": 20}, {
			"label": "A",
			"value": 0
		}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": [null]
	}
}, "data.splice(5, 0, {label:\"CC\", value:30})", {
	"(data, 5)": {
		"newValue": {"label": "CC", "value": 30},
		"target": [{"label": "AA", "value": 10}, {"label": "BB", "value": 20}, {
			"label": "A",
			"value": 0
		}, {"label": "B", "value": 1}, {"label": "C", "value": 2}, {"label": "CC", "value": 30}],
		"prop": [5]
	}
}, {
	"(data, \"length\")": {
		"newValue": 6,
		"oldValue": 5,
		"target": [{"label": "AA", "value": 10}, {"label": "BB", "value": 20}, {
			"label": "A",
			"value": 0
		}, {"label": "B", "value": 1}, {"label": "C", "value": 2}, {"label": "CC", "value": 30}],
		"prop": ["length"]
	}
}, {
	"(data)": {
		"newValue": [{"label": "AA", "value": 10}, {"label": "BB", "value": 20}, {
			"label": "A",
			"value": 0
		}, {"label": "B", "value": 1}, {"label": "C", "value": 2}, {"label": "CC", "value": 30}],
		"oldValue": "UNKNOWN_OLD_VALUE",
		"target": [{"label": "AA", "value": 10}, {"label": "BB", "value": 20}, {
			"label": "A",
			"value": 0
		}, {"label": "B", "value": 1}, {"label": "C", "value": 2}, {"label": "CC", "value": 30}],
		"prop": [null]
	}
}];

let test9 = [{
	"(data, 4)": {
		"oldValue": {"label": "E", "value": 4},
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}, {
			"label": "D",
			"value": 3
		}],
		"prop": [4]
	}
}, {
	"(data, 5)": {
		"oldValue": {"label": "F", "value": 5},
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}, {
			"label": "D",
			"value": 3
		}],
		"prop": [5]
	}
}, {
	"(data, \"length\")": {
		"newValue": 4,
		"oldValue": 6,
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}, {
			"label": "D",
			"value": 3
		}],
		"prop": ["length"]
	}
}, {
	"(data)": {
		"newValue": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {
			"label": "C",
			"value": 2
		}, {"label": "D", "value": 3}],
		"oldValue": "UNKNOWN_OLD_VALUE",
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}, {
			"label": "D",
			"value": 3
		}],
		"prop": [null]
	}
}, "data.splice(0, 1)", {
	"(data, 0)": {
		"newValue": {"label": "B", "value": 1},
		"oldValue": {"label": "A", "value": 0},
		"target": [{"label": "B", "value": 1}, {"label": "C", "value": 2}, {"label": "D", "value": 3}],
		"prop": [0]
	}
}, {
	"(data, 1)": {
		"newValue": {"label": "C", "value": 2},
		"oldValue": {"label": "B", "value": 1},
		"target": [{"label": "B", "value": 1}, {"label": "C", "value": 2}, {"label": "D", "value": 3}],
		"prop": [1]
	}
}, {
	"(data, 2)": {
		"newValue": {"label": "D", "value": 3},
		"oldValue": {"label": "C", "value": 2},
		"target": [{"label": "B", "value": 1}, {"label": "C", "value": 2}, {"label": "D", "value": 3}],
		"prop": [2]
	}
}, {
	"(data, 3)": {
		"oldValue": {"label": "D", "value": 3},
		"target": [{"label": "B", "value": 1}, {"label": "C", "value": 2}, {"label": "D", "value": 3}],
		"prop": [3]
	}
}, {
	"(data, \"length\")": {
		"newValue": 3,
		"oldValue": 4,
		"target": [{"label": "B", "value": 1}, {"label": "C", "value": 2}, {"label": "D", "value": 3}],
		"prop": ["length"]
	}
}, {
	"(data)": {
		"newValue": [{"label": "B", "value": 1}, {"label": "C", "value": 2}, {"label": "D", "value": 3}],
		"oldValue": "UNKNOWN_OLD_VALUE",
		"target": [{"label": "B", "value": 1}, {"label": "C", "value": 2}, {"label": "D", "value": 3}],
		"prop": [null]
	}
}, "data.splice(1, 1)", {
	"(data, 1)": {
		"newValue": {"label": "D", "value": 3},
		"oldValue": {"label": "C", "value": 2},
		"target": [{"label": "B", "value": 1}, {"label": "D", "value": 3}],
		"prop": [1]
	}
}, {
	"(data, 2)": {
		"oldValue": {"label": "D", "value": 3},
		"target": [{"label": "B", "value": 1}, {"label": "D", "value": 3}],
		"prop": [2]
	}
}, {
	"(data, \"length\")": {
		"newValue": 2,
		"oldValue": 3,
		"target": [{"label": "B", "value": 1}, {"label": "D", "value": 3}],
		"prop": ["length"]
	}
}, {
	"(data)": {
		"newValue": [{"label": "B", "value": 1}, {"label": "D", "value": 3}],
		"oldValue": "UNKNOWN_OLD_VALUE",
		"target": [{"label": "B", "value": 1}, {"label": "D", "value": 3}],
		"prop": [null]
	}
}, "data.splice(1, 1)", {
	"(data, 1)": {
		"oldValue": {"label": "D", "value": 3},
		"target": [{"label": "B", "value": 1}],
		"prop": [1]
	}
}, {
	"(data, \"length\")": {
		"newValue": 1,
		"oldValue": 2,
		"target": [{"label": "B", "value": 1}],
		"prop": ["length"]
	}
}, {
	"(data)": {
		"newValue": [{"label": "B", "value": 1}],
		"oldValue": "UNKNOWN_OLD_VALUE",
		"target": [{"label": "B", "value": 1}],
		"prop": [null]
	}
}];

let test10 = [{
	"(data, 3)": {
		"oldValue": {"label": "D", "value": 3},
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": [3]
	}
}, {
	"(data, 4)": {
		"oldValue": {"label": "E", "value": 4},
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": [4]
	}
}, {
	"(data, 5)": {
		"oldValue": {"label": "F", "value": 5},
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": [5]
	}
}, {
	"(data, \"length\")": {
		"newValue": 3,
		"oldValue": 6,
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": ["length"]
	}
}, {
	"(data)": {
		"newValue": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"oldValue": "UNKNOWN_OLD_VALUE",
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": [null]
	}
}, "data.splice(0, 1, {label:\"AA\", value:10})", {
	"(data, 0)": {
		"newValue": {"label": "AA", "value": 10},
		"oldValue": {"label": "A", "value": 0},
		"target": [{"label": "AA", "value": 10}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": [0]
	}
}, {
	"(data)": {
		"newValue": [{"label": "AA", "value": 10}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"oldValue": "UNKNOWN_OLD_VALUE",
		"target": [{"label": "AA", "value": 10}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": [null]
	}
}, "data.splice(0, 1, {label:\"BB\", value:20}, {label:\"CC\", value:30})", {
	"(data, 0)": {
		"newValue": {
			"label": "BB",
			"value": 20
		},
		"oldValue": {"label": "AA", "value": 10},
		"target": [{"label": "BB", "value": 20}, {"label": "CC", "value": 30}, {
			"label": "B",
			"value": 1
		}, {"label": "C", "value": 2}],
		"prop": [0]
	}
}, {
	"(data, 1)": {
		"newValue": {"label": "CC", "value": 30},
		"oldValue": {"label": "B", "value": 1},
		"target": [{"label": "BB", "value": 20}, {"label": "CC", "value": 30}, {
			"label": "B",
			"value": 1
		}, {"label": "C", "value": 2}],
		"prop": [1]
	}
}, {
	"(data, 2)": {
		"newValue": {"label": "B", "value": 1},
		"oldValue": {"label": "C", "value": 2},
		"target": [{"label": "BB", "value": 20}, {"label": "CC", "value": 30}, {
			"label": "B",
			"value": 1
		}, {"label": "C", "value": 2}],
		"prop": [2]
	}
}, {
	"(data, 3)": {
		"newValue": {"label": "C", "value": 2},
		"target": [{"label": "BB", "value": 20}, {"label": "CC", "value": 30}, {
			"label": "B",
			"value": 1
		}, {"label": "C", "value": 2}],
		"prop": [3]
	}
}, {
	"(data, \"length\")": {
		"newValue": 4,
		"oldValue": 3,
		"target": [{"label": "BB", "value": 20}, {"label": "CC", "value": 30}, {
			"label": "B",
			"value": 1
		}, {"label": "C", "value": 2}],
		"prop": ["length"]
	}
}, {
	"(data)": {
		"newValue": [{"label": "BB", "value": 20}, {"label": "CC", "value": 30}, {
			"label": "B",
			"value": 1
		}, {"label": "C", "value": 2}],
		"oldValue": "UNKNOWN_OLD_VALUE",
		"target": [{"label": "BB", "value": 20}, {"label": "CC", "value": 30}, {
			"label": "B",
			"value": 1
		}, {"label": "C", "value": 2}],
		"prop": [null]
	}
}, "data.splice(0, 2, {label: \"DD\", value: 40})", {
	"(data, 0)": {
		"newValue": {"label": "DD", "value": 40},
		"oldValue": {"label": "BB", "value": 20},
		"target": [{"label": "DD", "value": 40}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": [0]
	}
}, {
	"(data, 1)": {
		"newValue": {"label": "B", "value": 1},
		"oldValue": {"label": "CC", "value": 30},
		"target": [{"label": "DD", "value": 40}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": [1]
	}
}, {
	"(data, 2)": {
		"newValue": {"label": "C", "value": 2},
		"oldValue": {"label": "B", "value": 1},
		"target": [{"label": "DD", "value": 40}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": [2]
	}
}, {
	"(data, 3)": {
		"oldValue": {"label": "C", "value": 2},
		"target": [{"label": "DD", "value": 40}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": [3]
	}
}, {
	"(data, \"length\")": {
		"newValue": 3,
		"oldValue": 4,
		"target": [{"label": "DD", "value": 40}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": ["length"]
	}
}, {
	"(data)": {
		"newValue": [{"label": "DD", "value": 40}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"oldValue": "UNKNOWN_OLD_VALUE",
		"target": [{"label": "DD", "value": 40}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": [null]
	}
}];

let test11 = [{
	"(data, 3)": {
		"oldValue": {"label": "D", "value": 3},
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": [3]
	}
}, {
	"(data, 4)": {
		"oldValue": {"label": "E", "value": 4},
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": [4]
	}
}, {
	"(data, 5)": {
		"oldValue": {"label": "F", "value": 5},
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": [5]
	}
}, {
	"(data, \"length\")": {
		"newValue": 3,
		"oldValue": 6,
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": ["length"]
	}
}, {
	"(data)": {
		"newValue": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"oldValue": "UNKNOWN_OLD_VALUE",
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": [null]
	}
}, "data.splice(1, 1, {label:\"AA\", value:10})", {
	"(data, 1)": {
		"newValue": {"label": "AA", "value": 10},
		"oldValue": {"label": "B", "value": 1},
		"target": [{"label": "A", "value": 0}, {"label": "AA", "value": 10}, {"label": "C", "value": 2}],
		"prop": [1]
	}
}, {
	"(data)": {
		"newValue": [{"label": "A", "value": 0}, {"label": "AA", "value": 10}, {"label": "C", "value": 2}],
		"oldValue": "UNKNOWN_OLD_VALUE",
		"target": [{"label": "A", "value": 0}, {"label": "AA", "value": 10}, {"label": "C", "value": 2}],
		"prop": [null]
	}
}, "data.splice(1, 1, {label:\"BB\", value:20}, {label:\"CC\", value:30})", {
	"(data, 1)": {
		"newValue": {
			"label": "BB",
			"value": 20
		},
		"oldValue": {"label": "AA", "value": 10},
		"target": [{"label": "A", "value": 0}, {"label": "BB", "value": 20}, {
			"label": "CC",
			"value": 30
		}, {"label": "C", "value": 2}],
		"prop": [1]
	}
}, {
	"(data, 2)": {
		"newValue": {"label": "CC", "value": 30},
		"oldValue": {"label": "C", "value": 2},
		"target": [{"label": "A", "value": 0}, {"label": "BB", "value": 20}, {
			"label": "CC",
			"value": 30
		}, {"label": "C", "value": 2}],
		"prop": [2]
	}
}, {
	"(data, 3)": {
		"newValue": {"label": "C", "value": 2},
		"target": [{"label": "A", "value": 0}, {"label": "BB", "value": 20}, {
			"label": "CC",
			"value": 30
		}, {"label": "C", "value": 2}],
		"prop": [3]
	}
}, {
	"(data, \"length\")": {
		"newValue": 4,
		"oldValue": 3,
		"target": [{"label": "A", "value": 0}, {"label": "BB", "value": 20}, {
			"label": "CC",
			"value": 30
		}, {"label": "C", "value": 2}],
		"prop": ["length"]
	}
}, {
	"(data)": {
		"newValue": [{"label": "A", "value": 0}, {"label": "BB", "value": 20}, {
			"label": "CC",
			"value": 30
		}, {"label": "C", "value": 2}],
		"oldValue": "UNKNOWN_OLD_VALUE",
		"target": [{"label": "A", "value": 0}, {"label": "BB", "value": 20}, {
			"label": "CC",
			"value": 30
		}, {"label": "C", "value": 2}],
		"prop": [null]
	}
}, "data.splice(1, 2, {label: \"DD\", value: 40})", {
	"(data, 1)": {
		"newValue": {"label": "DD", "value": 40},
		"oldValue": {"label": "BB", "value": 20},
		"target": [{"label": "A", "value": 0}, {"label": "DD", "value": 40}, {"label": "C", "value": 2}],
		"prop": [1]
	}
}, {
	"(data, 2)": {
		"newValue": {"label": "C", "value": 2},
		"oldValue": {"label": "CC", "value": 30},
		"target": [{"label": "A", "value": 0}, {"label": "DD", "value": 40}, {"label": "C", "value": 2}],
		"prop": [2]
	}
}, {
	"(data, 3)": {
		"oldValue": {"label": "C", "value": 2},
		"target": [{"label": "A", "value": 0}, {"label": "DD", "value": 40}, {"label": "C", "value": 2}],
		"prop": [3]
	}
}, {
	"(data, \"length\")": {
		"newValue": 3,
		"oldValue": 4,
		"target": [{"label": "A", "value": 0}, {"label": "DD", "value": 40}, {"label": "C", "value": 2}],
		"prop": ["length"]
	}
}, {
	"(data)": {
		"newValue": [{"label": "A", "value": 0}, {"label": "DD", "value": 40}, {"label": "C", "value": 2}],
		"oldValue": "UNKNOWN_OLD_VALUE",
		"target": [{"label": "A", "value": 0}, {"label": "DD", "value": 40}, {"label": "C", "value": 2}],
		"prop": [null]
	}
}];

let test12 = [{
	"(data, 3)": {
		"oldValue": {"label": "D", "value": 3},
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": [3]
	}
}, {
	"(data, 4)": {
		"oldValue": {"label": "E", "value": 4},
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": [4]
	}
}, {
	"(data, 5)": {
		"oldValue": {"label": "F", "value": 5},
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": [5]
	}
}, {
	"(data, \"length\")": {
		"newValue": 3,
		"oldValue": 6,
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": ["length"]
	}
}, {
	"(data)": {
		"newValue": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"oldValue": "UNKNOWN_OLD_VALUE",
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "C", "value": 2}],
		"prop": [null]
	}
}, "data.splice(2, 1, {label:\"AA\", value:10})", {
	"(data, 2)": {
		"newValue": {"label": "AA", "value": 10},
		"oldValue": {"label": "C", "value": 2},
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "AA", "value": 10}],
		"prop": [2]
	}
}, {
	"(data)": {
		"newValue": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "AA", "value": 10}],
		"oldValue": "UNKNOWN_OLD_VALUE",
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "AA", "value": 10}],
		"prop": [null]
	}
}, "data.splice(2, 1, {label:\"BB\", value:20}, {label:\"CC\", value:30})", {
	"(data, 2)": {
		"newValue": {
			"label": "BB",
			"value": 20
		},
		"oldValue": {"label": "AA", "value": 10},
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "BB", "value": 20}, {
			"label": "CC",
			"value": 30
		}],
		"prop": [2]
	}
}, {
	"(data, 3)": {
		"newValue": {"label": "CC", "value": 30},
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "BB", "value": 20}, {
			"label": "CC",
			"value": 30
		}],
		"prop": [3]
	}
}, {
	"(data, \"length\")": {
		"newValue": 4,
		"oldValue": 3,
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "BB", "value": 20}, {
			"label": "CC",
			"value": 30
		}],
		"prop": ["length"]
	}
}, {
	"(data)": {
		"newValue": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {
			"label": "BB",
			"value": 20
		}, {"label": "CC", "value": 30}],
		"oldValue": "UNKNOWN_OLD_VALUE",
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "BB", "value": 20}, {
			"label": "CC",
			"value": 30
		}],
		"prop": [null]
	}
}, "data.splice(3, 2, {label: \"DD\", value: 40})", {
	"(data, 3)": {
		"newValue": {"label": "DD", "value": 40},
		"oldValue": {"label": "CC", "value": 30},
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "BB", "value": 20}, {
			"label": "DD",
			"value": 40
		}],
		"prop": [3]
	}
}, {
	"(data)": {
		"newValue": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {
			"label": "BB",
			"value": 20
		}, {"label": "DD", "value": 40}],
		"oldValue": "UNKNOWN_OLD_VALUE",
		"target": [{"label": "A", "value": 0}, {"label": "B", "value": 1}, {"label": "BB", "value": 20}, {
			"label": "DD",
			"value": 40
		}],
		"prop": [null]
	}
}];

let testSort = [{
	"(data, 0)": {
		"newValue": {"label": "F", "value": 5},
		"oldValue": {"label": "A", "value": 0},
		"target": [{"label": "F", "value": 5}, {"label": "E", "value": 4}, {"label": "D", "value": 3}, {
			"label": "C",
			"value": 2
		}, {"label": "B", "value": 1}, {"label": "A", "value": 0}],
		"prop": [0]
	}
}, {
	"(data, 1)": {
		"newValue": {"label": "E", "value": 4},
		"oldValue": {"label": "B", "value": 1},
		"target": [{"label": "F", "value": 5}, {"label": "E", "value": 4}, {"label": "D", "value": 3}, {
			"label": "C",
			"value": 2
		}, {"label": "B", "value": 1}, {"label": "A", "value": 0}],
		"prop": [1]
	}
}, {
	"(data, 2)": {
		"newValue": {"label": "D", "value": 3},
		"oldValue": {"label": "C", "value": 2},
		"target": [{"label": "F", "value": 5}, {"label": "E", "value": 4}, {"label": "D", "value": 3}, {
			"label": "C",
			"value": 2
		}, {"label": "B", "value": 1}, {"label": "A", "value": 0}],
		"prop": [2]
	}
}, {
	"(data, 3)": {
		"newValue": {"label": "C", "value": 2},
		"oldValue": {"label": "D", "value": 3},
		"target": [{"label": "F", "value": 5}, {"label": "E", "value": 4}, {"label": "D", "value": 3}, {
			"label": "C",
			"value": 2
		}, {"label": "B", "value": 1}, {"label": "A", "value": 0}],
		"prop": [3]
	}
}, {
	"(data, 4)": {
		"newValue": {"label": "B", "value": 1},
		"oldValue": {"label": "E", "value": 4},
		"target": [{"label": "F", "value": 5}, {"label": "E", "value": 4}, {"label": "D", "value": 3}, {
			"label": "C",
			"value": 2
		}, {"label": "B", "value": 1}, {"label": "A", "value": 0}],
		"prop": [4]
	}
}, {
	"(data, 5)": {
		"newValue": {"label": "A", "value": 0},
		"oldValue": {"label": "F", "value": 5},
		"target": [{"label": "F", "value": 5}, {"label": "E", "value": 4}, {"label": "D", "value": 3}, {
			"label": "C",
			"value": 2
		}, {"label": "B", "value": 1}, {"label": "A", "value": 0}],
		"prop": [5]
	}
}, {
	"(data)": {
		"newValue": [{"label": "F", "value": 5}, {"label": "E", "value": 4}, {
			"label": "D",
			"value": 3
		}, {"label": "C", "value": 2}, {"label": "B", "value": 1}, {"label": "A", "value": 0}],
		"oldValue": "UNKNOWN_OLD_VALUE",
		"target": [{"label": "F", "value": 5}, {"label": "E", "value": 4}, {"label": "D", "value": 3}, {
			"label": "C",
			"value": 2
		}, {"label": "B", "value": 1}, {"label": "A", "value": 0}],
		"prop": [null]
	}
}];