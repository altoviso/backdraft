import {destroyable, destroyAll} from "./destroyable.js";

const watcherCatalog = new WeakMap();
const STAR = Symbol("star");
const OWNER = Symbol("owner");
const OWNER_NULL = Symbol("owner-null");
const PROP = Symbol("prop");
const UNKNOWN = Symbol("unknown");

const pWatchableWatchers = Symbol("pWatchableWatchers");
const pWatchableHandles = Symbol("pWatchableHandles");
const pWatchableSetup = Symbol("pWatchableSetup");

class Watchable {
	constructor(owner, prop, formatter){
		let getter = owner[OWNER] && prop === STAR ? () => owner : () => owner[prop];
		Object.defineProperty(this, "value", {
			enumerable: true,
			get: formatter ? (() => formatter(getter())) : getter
		});

		// if (owner[OWNER] && prop === STAR), then we cValue===newValue===owner...
		// therefore can't detect internal mutations to owner, so don't try
		let cannotDetectMutations = prop === STAR && owner[OWNER]

		this[pWatchableWatchers] = [];

		let cValue;
		let callback = (newValue, oldValue, target, prop) => {
			if(formatter){
				oldValue = oldValue === UNKNOWN ? oldValue : formatter(oldValue);
				newValue = formatter(newValue);
			}
			if(cannotDetectMutations || oldValue === UNKNOWN || newValue !== cValue){
				this[pWatchableWatchers].slice().forEach(destroyable => destroyable.proc((cValue = newValue), oldValue, target, prop));
			}
		};

		this[pWatchableSetup] = function(){
			cValue = this.value;
			if(owner[OWNER]){
				this[pWatchableHandles] = [watch(owner, prop, (newValue, oldValue, receiver, _prop) => {
					if(prop === STAR){
						callback(owner, UNKNOWN, owner, _prop);
					}else{
						callback(newValue, oldValue, owner, _prop);
					}
				})];
			}else if(owner.watch){
				this[pWatchableHandles] = [
					owner.watch(prop, (newValue, oldValue, target) => {
						callback(newValue, oldValue, target, prop);
						if(this[pWatchableHandles].length === 2){
							this[pWatchableHandles].pop().destroy();
						}
						if(newValue[OWNER]){
							// value is a watchable
							this[pWatchableHandles].push(watch(newValue, (newValue, oldValue, receiver, prop) => {
								callback(receiver, UNKNOWN, owner, prop);
							}));
						}
					})
				];
				let value = owner[prop];
				if(value && value[OWNER]){
					// value is a watchable
					this[pWatchableHandles].push(watch(value, (newValue, oldValue, receiver, prop) => {
						callback(receiver, UNKNOWN, owner, prop);
					}));
				}
				owner.own && owner.own(this);
			}else{
				throw new Error("don't know how to watch owner");
			}
		};
	}

	destroy(){
		destroyAll(this[pWatchableWatchers]);
	}

	watch(watcher){
		this[pWatchableHandles] || this[pWatchableSetup]();
		return destroyable(watcher, this[pWatchableWatchers], () => {
			destroyAll(this[pWatchableHandles]);
			delete this[pWatchableHandles];
		});
	}
}

Watchable.pWatchableWatchers = pWatchableWatchers;
Watchable.pWatchableHandles = pWatchableHandles;
Watchable.pWatchableSetup = pWatchableSetup;
Watchable.UNKNOWN = UNKNOWN;

function watchable(owner, prop, formatter){
	if(typeof prop === "function"){
		// no prop,...star watcher
		formatter = prop;
		prop = STAR;
	}
	return new Watchable(owner, prop, formatter);
}

watchable.UNKNOWN = UNKNOWN;

function watch(watchable, name, watcher){
	if(typeof name === "function"){
		watcher = name;
		name = STAR;
	}

	let variables = watcherCatalog.get(watchable);
	if(!variables){
		watcherCatalog.set(watchable, (variables = {}));
	}

	let insWatcher = (name, watcher) => destroyable(watcher, variables[name] || (variables[name] = []));
	if(!watcher){
		let hash = name;
		return Reflect.ownKeys(hash).map(name => insWatcher(name, hash[name]));
	}else if(Array.isArray(name)){
		return name.map(name => insWatcher(name, watcher));
	}else{
		return insWatcher(name, watcher);
	}
}

function applyWatchers(newValue, oldValue, receiver, name){
	let catalog = watcherCatalog.get(receiver);
	if(catalog){
		if(name.length === 1){
			// leaf
			let prop = name[0];
			let watchers = catalog[prop];
			watchers && watchers.slice().forEach(destroyable => destroyable.proc(newValue, oldValue, receiver, prop));
			(watchers = catalog[STAR]) && watchers.slice().forEach(destroyable => destroyable.proc(newValue, oldValue, receiver, prop));
		}else{
			let watchers = catalog[STAR];
			watchers && watchers.slice().forEach(destroyable => destroyable.proc(newValue, UNKNOWN, receiver, name));
		}
	}
	if(watch.log){
		// eslint-disable-next-line no-console
		console.log(name, newValue);
	}
	if(receiver[OWNER] !== OWNER_NULL){
		name.unshift(receiver[PROP]);
		applyWatchers(newValue, oldValue, receiver[OWNER], name);
	}
}

let pauseWatchers = false;
let inPlaceConverting = false;

const watcher = {
	set(target, prop, value, receiver){
		if(prop === OWNER || prop === PROP){
			target[prop] = value;
		}else{
			let oldValue = target[prop];
			if(value instanceof Object){
				let holdPauseWatchers = pauseWatchers;
				try{
					pauseWatchers = true;
					value = createWatchable(value, receiver, prop);
					pauseWatchers = holdPauseWatchers;
				}catch(e){
					pauseWatchers = holdPauseWatchers;
					throw e;
				}

			}
			// we would like to set and applyWatchers iff target[prop] !== value. Unfortunately, sometimes target[prop] === value
			// even though we haven't seen the mutation before, e.g., length in an Array instance
			let result = Reflect.set(target, prop, value, receiver);
			!pauseWatchers && applyWatchers(value, oldValue, receiver, [prop]);
			return result;
		}
		return true;
	}
};

function createWatchable(src, owner, prop){
	let keys = Reflect.ownKeys(src);
	let result = new Proxy(inPlaceConverting ? src : (Array.isArray(src) ? [] : {}), watcher);
	keys.forEach(k => result[k] = src[k]);
	result[OWNER] = owner;
	prop && (result[PROP] = prop);
	return result;
}

function toWatchable(data){
	if(!(data instanceof Object)){
		throw new Error("scalar values are not watchable");
	}
	try{
		pauseWatchers = true;
		inPlaceConverting = true;
		return createWatchable(data, OWNER_NULL);
	}finally{
		pauseWatchers = false;
		inPlaceConverting = false;
	}
}

function mutate(owner, name, privateName, newValue){
	let oldValue = owner[privateName];
	let eq;
	if(!oldValue){
		eq = newValue === oldValue;
	}else if(newValue){
		if(newValue.eq){
			eq = newValue.eq(oldValue);
		}else if(oldValue.eq){
			eq = oldValue.eq(newValue);
		}else{
			eq = newValue === oldValue;
		}
	}else{
		eq = false;
	}

	if(eq){
		return false;
	}else{
		let onMutate = owner[name + "OnMutate"];
		onMutate && onMutate.call(owner, newValue, oldValue, true);
		if(owner.hasOwnProperty(privateName)){
			owner[privateName] = newValue;
		}else{
			// not enumerable or configurable
			Object.defineProperty(owner, privateName, {writable: true, value: newValue});
		}
		onMutate && onMutate.call(owner, newValue, oldValue, true);
		return [name, oldValue, newValue];
	}
}

function WatchHub(superClass){
	if(!superClass){
		superClass = class {
		};
	}
	return class extends superClass {
		// protected interface...
		bdMutateNotify(name, oldValue, newValue){
			let variables = watcherCatalog.get(this);
			if(!variables){
				return;
			}
			if(Array.isArray(name)){
				// each element in name is either a triple ([name, oldValue, newValue]) or false
				let doStar = false;
				for(const p of name) if(p){
					doStar = true;
					let watchers = variables[p[0]];
					if(watchers){
						oldValue = p[1];
						newValue = p[2];
						watchers.slice().forEach(destroyable => destroyable.proc(newValue, oldValue, this));
					}
				}
				if(doStar){
					let watchers = variables["*"];
					if(watchers){
						watchers.slice().forEach(destroyable => destroyable.proc(this));
					}
				}
			}else{
				let watchers = variables[name];
				if(watchers){
					watchers.slice().forEach(destroyable => destroyable.proc(newValue, oldValue, this));
				}
				watchers = variables["*"];
				if(watchers){
					watchers.slice().forEach(destroyable => destroyable.proc(this));
				}
			}
		}

		bdMutate(name, privateName, newValue){
			if(arguments.length > 3){
				let i = 0;
				let results = [];
				let mutateOccurred = false;
				while(i < arguments.length){
					let mutateResult = mutate(this, arguments[i++], arguments[i++], arguments[i++]);
					mutateOccurred = mutateOccurred || mutateResult;
					results.push(mutateResult);
				}
				if(mutateOccurred){
					this.bdMutateNotify(results);
					return results;
				}
				return false;
			}else{
				let result = mutate(this, name, privateName, newValue);
				if(result){
					this.bdMutateNotify(...result);
					return result;
				}
				return false;
			}
		}

		// public interface...
		watch(name, watcher){
			let variables = watcherCatalog.get(this);
			if(!variables){
				watcherCatalog.set(this, (variables = {}));
			}
			if(!watcher){
				let hash = name;
				return Reflect.ownKeys(hash).map((name) => this.watch(name, hash[name]));
			}else{
				if(typeof watcher !== "function"){
					watcher = this[watcher];
				}
				if(Array.isArray(name)){
					return name.map(name => this.watch(name, watcher));
				}else{
					return destroyable(watcher, variables[name] || (variables[name] = []));
				}
			}
		}

		destroyWatch(name){
			let variables = watcherCatalog.get(this);

			function destroyList(list){
				if(list){
					while(list.length) list.shift().destroy();
				}
			}

			if(variables){
				if(name){
					destroyList(variables[name]);
					delete variables[name];
				}else{
					Reflect.ownKeys(variables).forEach(k => destroyList(variables[k]));
					watcherCatalog.delete(this);
				}
			}
		}

		getWatchable(name, formatter){
			let result = new Watchable(this, name, formatter);
			this.own && this.own(result);
			return result;
		}
	};
}

function isWatchable(target){
	return target && target[OWNER] || target.watch;
}

export {Watchable, watchable, watch, toWatchable, WatchHub, isWatchable, UNKNOWN};



