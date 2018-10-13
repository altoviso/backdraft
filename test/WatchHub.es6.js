import {watchHub} from "../lib.js";

const smoke = typeof window !== "undefined" ? window.smoke : require("bd-smoke");
const assert = smoke.assert;

smoke.defTest({
	id: "watchHub",
	tests: [
		["usage", function(){
			// Typically, watchHub is used to provide watchers on member data of some other class.
			// In this example, we define the class Coord which models an (x, y) coordinate and
			// uses watchHub to provide machinery that allows the x, y, and coordinate value can be watched.
			//
			// Notice that watchHub is _not_ a class, but rather a function that returns a class.
			class Coord extends watchHub() {
				constructor(x, y){
					super();
					Object.defineProperties(this, {
						_x: {value: x || 0, writable: true},
						_y: {value: y || 0, writable: true}
					});
				}

				get x(){
					return this._x;
				}

				set x(value){
					// Normally matations are signaled on watchable data by applying watchHub::bdMutate which _both_
					// updates the private data _and_ applies any watchers. bdMutate returns true if a mutation actually
					// occured; otherwise, it returns false. This example wraps to application of bdMutate so we can
					// see this behavior below.
					Coord.xMutated = false;
					if(this.bdMutate("x", "_x", value)){
						Coord.xMutated = true;
					}
				}


				get y(){
					return this._y;
				}

				set y(value){
					// For more complicated scenarios, the decision to mutate and mutation can be done manually and then
					// the watchers called only if an actual mutation occurred:
					value = Number(value);
					if(isNaN(value)){
						throw new Error("Illegal value provided for y");
					}
					if(this._y !== value){
						let oldValue = this._y;
						this.bdMutateNotify("y", oldValue, this._y = value);
					}
				}

				set(x, y){
					if(x instanceof Coord){
						return this.set(x.x, x.y);
					}
					// We want to set both x and y before signaling changes to either;
					// this is how to do it:
					this.bdMutate("x", "_x", x, "y", "_y", y);
				}
			}

			let c = new Coord();
			assert(c.x === 0);
			assert(c.y === 0);
			assert(c.isBdWatchHub);

			// Declare some variables that we'll use demonstrate watchers.
			let watched_x;
			let watched_y;
			let expectdOldValue_x;
			let expectdOldValue_y;
			let expectedFinalValueOfCoord;
			let xHandlerAppliedCount = 0;
			let yHandlerAppliedCount = 0;
			let starHandlerAppliedCount = 0;

			// Set up a watch on x.
			let xWatcher = c.watch("x", (newValue, oldValue, src) => {
				xHandlerAppliedCount++;

				assert(oldValue === expectdOldValue_x);
				assert(src === c);

				// See this.bdMutate in Coord::set.
				assert(src.x === expectedFinalValueOfCoord.x && src.y === expectedFinalValueOfCoord.y);

				watched_x = newValue;
			});

			// Similarly for y.
			let yWatcher = c.watch("y", (newValue, oldValue, src) => {
				yHandlerAppliedCount++;
				assert(oldValue === expectdOldValue_y);
				assert(src === c);

				// See this.bdMutate in Coord::set.
				assert(src.x === expectedFinalValueOfCoord.x && src.y === expectedFinalValueOfCoord.y);

				watched_y = newValue;
			});

			// Lastly set up a watch for any change on the coord; notice the signature is different.
			// "*" watches are always applied after specific watches, so c should == (watched_x, watched_y)
			// when this particular watcher is applied.
			let starWatcher = c.watch("*", (src) => {
				starHandlerAppliedCount++;

				assert(src === c);
				assert(src.x === watched_x);
				assert(src.y === watched_y);

				// See this.bdMutate in Coord::set.
				assert(src.x === expectedFinalValueOfCoord.x && src.y === expectedFinalValueOfCoord.y);
			});

			watched_x = 0;
			watched_y = 0;
			expectdOldValue_x = c.x;
			expectdOldValue_y = c.y;

			// Setting x causes the x and the star watcher, but not the y watcher.
			expectedFinalValueOfCoord = {x: 1, y: 0};
			c.x = 1;
			assert(watched_x === 1);
			assert(Coord.xMutated);
			assert(xHandlerAppliedCount === 1);
			assert(yHandlerAppliedCount === 0);
			assert(starHandlerAppliedCount === 1);

			// Setting x to the same value is essentially a no-op
			c.x = 1;
			assert(!Coord.xMutated);
			assert(xHandlerAppliedCount === 1);
			assert(yHandlerAppliedCount === 0);
			assert(starHandlerAppliedCount === 1);

			// Similarly for y.
			expectdOldValue_x = c.x;
			expectdOldValue_y = c.y;
			expectedFinalValueOfCoord = {x: 1, y: 2};
			c.y = 2;
			assert(watched_y === 2);
			assert(xHandlerAppliedCount === 1);
			assert(yHandlerAppliedCount === 1);
			assert(starHandlerAppliedCount === 2);

			// Owing to the way we defined Coord::set, setting both x and y causes all the watchers
			// to be called, but only _after_ all mutations have completed.
			expectdOldValue_x = c.x;
			expectdOldValue_y = c.y;
			expectedFinalValueOfCoord = {x: 3, y: 4};
			c.set(3, 4);
			assert(watched_x === 3);
			assert(watched_y === 4);
			assert(xHandlerAppliedCount === 2);
			assert(yHandlerAppliedCount === 2);
			assert(starHandlerAppliedCount === 3);

			// Destroy the x and star watchers.
			xWatcher.destroy();
			starWatcher.destroy();

			// Set up expectations for our watchers.
			expectdOldValue_x = c.x;
			expectdOldValue_y = c.y;
			expectedFinalValueOfCoord = {x: 5, y: 6};

			// Mutate x and y.
			c.x = 5;
			c.y = 6;

			// Neither the x watcher or star watchers were applied because they were destroyed.
			assert(watched_x === 3);
			assert(watched_y === 6);
			assert(xHandlerAppliedCount === 2);
			assert(starHandlerAppliedCount === 3);

			// Of course, the y watcher is still around.
			assert(yHandlerAppliedCount === 3);

		}],
		["star", function(){
			class Useless extends watchHub() {
				constructor(x){
					super();
					this._x = 0;
					this._y = 0;
				}

				get x(){
					return this._x;
				}

				set x(value){
					this.bdMutate("x", "_x", value);
				}

				get y(){
					return this._y;
				}

				set y(value){
					this.bdMutate("y", "_y", value);
				}

				set(x, y){
					this.bdMutate("x", "_x", x, "y", "_y", y);
				}
			}

			let expectedX = 0;
			let expectedY = 0;

			let applyCount_x = 0;

			function xWatcher(newValue){
				applyCount_x++;
				assert(newValue === expectedX);
			}

			let applyCount_y = 0;

			function yWatcher(newValue){
				applyCount_y++;
				assert(newValue === expectedY);
			}

			let applyCount_star = 0;

			function starWatcher(src){
				applyCount_star++;
				assert(src._x === expectedX);
				assert(src._y === expectedY);
			}

			let useless = new Useless();
			useless.watch("x", xWatcher);
			useless.watch("y", yWatcher);
			useless.x = expectedX = 1;
			assert(applyCount_x === 1);
			assert(applyCount_y === 0);

			useless.y = expectedY = 2;
			assert(applyCount_x === 1);
			assert(applyCount_y === 1);

			expectedX = 3;
			expectedY = 4;
			useless.set(3, 4);
			assert(applyCount_x === 2);
			assert(applyCount_y === 2);

			useless.watch("*", starWatcher);
			useless.x = expectedX = 5;
			assert(applyCount_x === 3);
			assert(applyCount_y === 2);
			assert(applyCount_star === 1);

			useless.y = expectedY = 6;
			assert(applyCount_x === 3);
			assert(applyCount_y === 3);
			assert(applyCount_star === 2);

			expectedX = 7;
			expectedY = 8;
			useless.set(7, 8);
			assert(applyCount_x === 4);
			assert(applyCount_y === 4);
			assert(applyCount_star === 3);
		}],
		["structure", function(){
			// watchHubs do not define any instance variables.
			class Useless extends watchHub() {
				constructor(x){
					super();
					Object.defineProperty(this, "_x", {value: x || 0, writable: true});
				}

				get x(){
					return this._x;
				}

				set x(value){
					this.bdMutate("x", "_x", value);
				}
			}

			let x = new Useless();
			let ownKeys = Reflect.ownKeys(x);
			assert(ownKeys.length === 1);
			assert(ownKeys[0] === "_x");

			// And EventHubs can be in the middle of a derivation chain.
			class Base {
				constructor(){
					this.base = "BASE";
				}
			}

			class Useless2 extends watchHub(Base) {
				constructor(x){
					super();
					Object.defineProperty(this, "_x", {value: x || 0, writable: true});
				}

				get x(){
					return this._x;
				}

				set x(value){
					this.bdMutate("x", "_x", value);
				}
			}

			// Useless2 instances have both Base and watchHub machinery.
			let instance = new Useless2();
			assert(instance.base === "BASE");
			assert(typeof instance.watch === "function");
			assert(typeof instance.bdMutateNotify === "function");
			assert(typeof instance.bdMutate === "function");
			assert(typeof instance.destroyWatch === "function");
			assert(typeof instance.getWatchableRef === "function");

			// EventHubs can be at the start of a derivation chain.
			class IncompleteUseless3 {
				constructor(x){
					Object.defineProperty(this, "_x", {value: x || 0, writable: true});
				}

				get x(){
					return this._x;
				}

				set x(value){
					// This won't work unless a watchHub is mixed in.
					this.bdMutate("x", "_x", value);
				}
			}

			// IncompleteUseless2 will throw when attempting to mutate x because bdMutate isn't defined
			instance = new IncompleteUseless3();
			try{
				instance.x = 1;
				assert(false);
			}catch(e){
			}

			// Mix in a watchHub, and it works.
			class CompleteUseless3 extends watchHub(IncompleteUseless3) {
			}

			instance = new CompleteUseless3();
			instance.x = 1;
		}],
		["watcher-eq-calc", function(){
			// Watchable::bdMutate compares the current value of the private data to a new value and mutates the private
			// data if and only if the comparison indicates the values are not the same "scalar" values.

			// The comparison uses this algorithm:
			function ScalarEqual(newValue, oldValue){
				if(!oldValue){
					return newValue === oldValue;
				}
				if(!newValue){
					return false;
				}
				if(newValue.eq){
					return newValue.eq(oldValue);
				}
				if(oldValue.eq){
					return oldValue.eq(newValue);
				}
				return newValue !== oldValue;
			}

			// To see this work, here's a little class that makes _x watchable at x.
			class Example extends watchHub() {
				get x(){
					return this._x;
				}

				set x(value){
					Example.mutated = this.bdMutate("x", "_x", value)
				}
			}

			let test = new Example();

			// All the dissimlar false-like values are considered _not_ scalar equivalents. Here we go from undefined to 0, false, and null.
			test._x = undefined;
			test.x = 0;
			assert(Example.mutated);
			assert(test._x === 0);
			test._x = undefined;
			test.x = false;
			assert(Example.mutated);
			assert(test._x === false);
			test._x = undefined;
			test.x = null;
			assert(Example.mutated);
			assert(test._x === null);

			// From 0 to undefined, false, and null.
			test._x = 0;
			test.x = undefined;
			assert(Example.mutated);
			assert(test._x === undefined);
			test._x = 0;
			test.x = false;
			assert(Example.mutated);
			assert(test._x === false);
			test._x = 0;
			test.x = null;
			assert(Example.mutated);
			assert(test._x === null);

			// From false to undefined, 0, and null.
			test._x = false;
			test.x = undefined;
			assert(Example.mutated);
			assert(test._x === undefined);
			test._x = false;
			test.x = 0;
			assert(Example.mutated);
			assert(test._x === 0);
			test._x = false;
			test.x = null;
			assert(Example.mutated);
			assert(test._x === null);

			// Lastly, from null to undefined, 0, and false.
			test._x = null;
			test.x = undefined;
			assert(Example.mutated);
			assert(test._x === undefined);
			test._x = null;
			test.x = 0;
			assert(Example.mutated);
			assert(test._x === 0);
			test._x = null;
			test.x = false;
			assert(Example.mutated);
			assert(test._x === false);

			// Of course strictly equal false like value are scalar equivalents;
			test._x = undefined;
			test.x = undefined;
			assert(!Example.mutated);
			assert(test._x === undefined);

			test._x = 0;
			test.x = 0;
			assert(!Example.mutated);
			assert(test._x === 0);

			test._x = null;
			test.x = null;
			assert(!Example.mutated);
			assert(test._x === null);

			test._x = false;
			test.x = false;
			assert(!Example.mutated);
			assert(test._x === false);

			// When neither the existing value nor the new value provide an eq method, strict equivalence is  used to compute scalar equivalence.
			test._x = "test";
			test.x = "test";
			assert(!Example.mutated);
			test.x = String("test");
			assert(!Example.mutated);

			test._x = 1;
			test.x = 1;
			assert(!Example.mutated);
			test.x = 2;
			assert(Example.mutated);
			test.x = "2";
			assert(Example.mutated);
			assert(test.x === "2");
			test._x = true;
			test.x = true;
			assert(!Example.mutated);

			// When values define eq, that is preferred over strict equivalence
			class MyNumber {
				constructor(value){
					this.value = value;
				}

				eq(value){
					return value instanceof MyNumber ?
						this.value === this.value :
						this.value === Number(value);
				}
			}

			test._x = 1;
			test.x = new MyNumber(1);
			assert(!Example.mutated);
			test.x = new MyNumber(2);
			assert(Example.mutated);
			test.x = "2";
			assert(!Example.mutated);
			test.x = 3;
			assert(Example.mutated);
			assert(test._x === 3);
		}],
		["watchable", function(){
			// watchHub allows pulling out a Watchable from instances of classes derived from watchHub
			// which implement a watchable member variable.

			// We'll use the Coord class again.
			class Coord extends watchHub() {
				constructor(x, y){
					super();
					Object.defineProperties(this, {
						_x: {value: x || 0, writable: true},
						_y: {value: y || 0, writable: true}
					});
				}

				get x(){
					return this._x;
				}

				set x(value){
					this.bdMutate("x", "_x", value);
				}


				get y(){
					return this._y;
				}

				set y(value){
					this.bdMutate("y", "_y", value);
				}

				set(x, y){
					if(x instanceof Coord){
						return this.set(x.x, x.y);
					}
					// We want to set both x and y before signaling changes to either;
					// this is how to do it:
					this.bdMutate("x", "_x", x, "y", "_y", y);
				}
			}

			let c = new Coord();
			let x = c.getWatchable("x");

			// Watchables always reflect the current value of the member variable to which they are bound.
			assert(x.value === 0);
			c.x = 1;
			assert(x.value === 1);

			// Watchables can set up watchers on the member variable to which they are bound. Here's a watcher that gives
			// us feedback on what happens when its applied.
			let expectedOldValue;
			let watchResult = "?";
			let handlerApplyCount = 0;
			let watcher = (newValue, oldValue, src) => {
				handlerApplyCount++;
				assert(oldValue === expectedOldValue);
				assert(src === c);
				watchResult = newValue;
			};

			// Connect to watcher to the watchable
			x.watch(watcher);

			expectedOldValue = c.x;
			c.x = 2;
			assert(handlerApplyCount === 1);
			assert(x.value === 2);
			assert(watchResult === 2);


			// Watchable::watch returns a destroyable handle.
			let handle = x.watch(watcher);

			// At this point, x has two watchers watching it (both watchers are the same function in this demo)
			expectedOldValue = c.x;
			c.x = 3;
			assert(x.value === 3);
			assert(watchResult === 3);
			// Both watchers are the same function in this demo; we see that by noticing it was called twice.
			assert(handlerApplyCount === 3);

			// Let's destroy the second watcher, the first watcher is still connected.
			handle.destroy();
			expectedOldValue = c.x;
			c.x = 4;
			// Only one watcher, and it was only called once.
			assert(handlerApplyCount === 4);
			assert(x.value === 4);
			assert(watchResult === 4);

			// Add a couple of watchers.
			x.watch(watcher);
			x.watch(watcher);

			// At this point there are three watchers watching x.
			assert(handlerApplyCount === 4);
			expectedOldValue = c.x;
			c.x = 5;
			assert(handlerApplyCount === 7);

			// Applying Watchable::destroy(true) removes all watchers, but does not destroy the watcher.
			x.destroy(true);
			expectedOldValue = c.x;
			c.x = 6;
			// Notice the handler function was never called.
			assert(handlerApplyCount === 7);
			// But x is still alive.
			assert(x.value === 6);
			// And watchers can be added back.
			x.watch(watcher);
			expectedOldValue = c.x;
			c.x = 7;
			assert(handlerApplyCount === 8);
		}]
	]
});