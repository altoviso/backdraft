import {destroyable, destroyAll} from "./destroyable.js";

let eqlComparators = new Map();

function eql(refValue, otherValue){
	if(!refValue){
		return otherValue === refValue;
	}
	if(refValue instanceof Object){
		let comparator = eqlComparators.get(refValue.constructor);
		if(comparator){
			return comparator(refValue, otherValue);
		}
	}
	if(otherValue instanceof Object){
		let comparator = eqlComparators.get(otherValue.constructor);
		if(comparator){
			return comparator(otherValue, refValue);
		}
	}
	return refValue === otherValue;
}

const watcherCatalog = new WeakMap();
const STAR = Symbol("bd-star");
const OWNER = Symbol("bd-owner");
const OWNER_NULL = Symbol("bd-owner-null");
const PROP = Symbol("bd-prop");
const UNKNOWN_OLD_VALUE = Symbol("bd-unknown-old-value");

const pWatchableWatchers = Symbol("bd-pWatchableWatchers");
const pWatchableHandles = Symbol("bd-pWatchableHandles");
const pWatchableSetup = Symbol("bd-pWatchableSetup");

class WatchableRef {
	constructor(referenceObject, referenceProp, formatter){
		if(typeof referenceProp === "function"){
			// no referenceProp,...star watcher
			formatter = referenceProp;
			referenceProp = STAR;
		}

		Object.defineProperty(this, "value", {
			enumerable: true,
			get: (function(){
				if(formatter){
					if(referenceProp === STAR){
						return () => formatter(referenceObject);
					}else{
						return () => formatter(referenceObject[referenceProp]);
					}
				}else if(referenceProp === STAR){
					return () => referenceObject;
				}else{
					return () => referenceObject[referenceProp];
				}
			})()
		});

		// if (referenceObject[OWNER] && referenceProp === STAR), then we cValue===newValue===referenceObject...
		// therefore can't detect internal mutations to referenceObject, so don't try
		let cannotDetectMutations = referenceProp === STAR && referenceObject[OWNER];

		this[pWatchableWatchers] = [];

		let cValue;
		let callback = (newValue, oldValue, target, referenceProp) => {
			if(formatter){
				oldValue = oldValue === UNKNOWN_OLD_VALUE ? oldValue : formatter(oldValue);
				newValue = formatter(newValue);
			}
			if(cannotDetectMutations || oldValue === UNKNOWN_OLD_VALUE || !eql(cValue, newValue)){
				this[pWatchableWatchers].slice().forEach(destroyable => destroyable.proc((cValue = newValue), oldValue, target, referenceProp));
			}
		};

		this[pWatchableSetup] = function(){
			cValue = this.value;
			if(referenceObject[OWNER]){
				this[pWatchableHandles] = [watch(referenceObject, referenceProp, (newValue, oldValue, receiver, _prop) => {
					if(referenceProp === STAR){
						callback(referenceObject, UNKNOWN_OLD_VALUE, referenceObject, _prop);
					}else{
						callback(newValue, oldValue, referenceObject, _prop);
					}
				})];
			}else if(referenceObject.watch){
				this[pWatchableHandles] = [
					referenceObject.watch(referenceProp, (newValue, oldValue, target) => {
						callback(newValue, oldValue, target, referenceProp);
						if(this[pWatchableHandles].length === 2){
							this[pWatchableHandles].pop().destroy();
						}
						if(newValue[OWNER]){
							// value is a watchable
							this[pWatchableHandles].push(watch(newValue, (newValue, oldValue, receiver, referenceProp) => {
								callback(receiver, UNKNOWN_OLD_VALUE, referenceObject, referenceProp);
							}));
						}
					})
				];
				let value = referenceObject[referenceProp];
				if(value && value[OWNER]){
					// value is a watchable
					this[pWatchableHandles].push(watch(value, (newValue, oldValue, receiver, referenceProp) => {
						callback(receiver, UNKNOWN_OLD_VALUE, referenceObject, referenceProp);
					}));
				}
				referenceObject.own && referenceObject.own(this);
			}else{
				throw new Error("don't know how to watch referenceObject");
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

WatchableRef.pWatchableWatchers = pWatchableWatchers;
WatchableRef.pWatchableHandles = pWatchableHandles;
WatchableRef.pWatchableSetup = pWatchableSetup;
WatchableRef.UNKNOWN_OLD_VALUE = UNKNOWN_OLD_VALUE;
WatchableRef.STAR = STAR;

function getWatchableRef(referenceObject, referenceProp, formatter){
	// (referenceObject, referenceProp, formatter)
	// (referenceObject, referenceProp)
	// (referenceObject, formatter) => (referenceObject, STAR, formatter)
	// (referenceObject) => (referenceObject, STAR)
	if(typeof referenceProp === "function"){
		// no referenceProp,...star watcher
		formatter = referenceProp;
		referenceProp = STAR;
	}
	return new WatchableRef(referenceObject, referenceProp || STAR, formatter);
}

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
			watchers && watchers.slice().forEach(destroyable => destroyable.proc(newValue, oldValue, receiver, name));
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
	if(eql(oldValue, newValue)){
		return false;
	}else{
		let onMutateBefore = owner[name + "OnMutateBefore"];
		onMutateBefore && onMutateBefore.call(owner, newValue, oldValue);
		if(owner.hasOwnProperty(privateName)){
			owner[privateName] = newValue;
		}else{
			// not enumerable or configurable
			Object.defineProperty(owner, privateName, {writable: true, value: newValue});
		}
		let onMutate = owner[name + "OnMutate"];
		onMutate && onMutate.call(owner, newValue, oldValue);
		return [name, oldValue, newValue];
	}
}

function watchHub(superClass){
	return class extends (superClass || class {
	}) {
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
		get isBdWatchHub(){
			return true;
		}

		watch(...args){
			// possible sigs:
			// 1: name, watcher
			// 2: [name], watcher
			// 3: hash: name -> watcher
			// 4: watchable, name, watcher
			// 5: watchable, [names], watcher
			// 6: watchable, hash: name -> watcher

			if(arguments.length === 1){
				// sig 3
				let hash = args[0];
				return Reflect.ownKeys(hash).map(name => this.watch(name, hash[name]));
			}
			if(args[0][OWNER]){
				// sig 4-6
				let result = watch(...args);
				this.own && this.own(result);
				return result;
			}
			if(Array.isArray(args[0])){
				// sig 2
				return args[0].map(name => this.watch(name, watcher));
			}
			// sig 1
			let [name, watcher] = args;
			let variables = watcherCatalog.get(this);
			if(!variables){
				watcherCatalog.set(this, (variables = {}));
			}
			let result = destroyable(watcher, variables[name] || (variables[name] = []));
			this.own && this.own(result);
			return result;
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

		getWatchableRef(name, formatter){
			let result = new WatchableRef(this, name, formatter);
			this.own && this.own(result);
			return result;
		}
	};
}

const WatchHub = watchHub();

function isWatchable(target){
	return target && (target[OWNER] || target.isBdWatchHub);
}

function withWatchables(superClass, ...args){
	let prototype;
	let publicPropNames = [];

	function def(name){
		let pname;
		if(Array.isArray(name)){
			pname = name[1];
			name = name[0];
		}else{
			pname = "_" + name;
		}
		publicPropNames.push(name);
		Object.defineProperty(prototype, name, {
			enumerable: true,
			get: function(){
				return this[pname];
			},
			set: function(value){
				this.bdMutate(name, pname, value);
			}
		});
	}

	function init(owner, kwargs){
		publicPropNames.forEach(name => {
			if(kwargs.hasOwnProperty(name)){
				owner[name] = kwargs[name];
			}
		});
	}

	let result = class extends superClass {
		constructor(kwargs){
			kwargs = kwargs || {};
			super(kwargs);
			init(this, kwargs);
		}
	};
	prototype = result.prototype;
	args.forEach(def);
	return result;
}

function bind(src, srcProp, dest, destProp){
	dest[destProp] = src[srcProp];
	if(src.isBdWatchHub){
		return src.watch(srcProp, newValue => dest[destProp] = newValue);
	}else if(src[OWNER]){
		return watch(srcProp, newValue => dest[destProp] = newValue);
	}else{
		throw new Error("src is not watchable");
	}
}

function biBind(src1, prop1, src2, prop2){
	src2[prop2] = src1[prop1];
	return [bind(src1, prop1, src2, prop2), bind(src2, prop2, src1, prop1)];
}

export {
	eqlComparators,
	eql,
	UNKNOWN_OLD_VALUE,
	STAR,
	OWNER,
	OWNER_NULL,
	PROP,
	WatchableRef,
	getWatchableRef,
	watch,
	toWatchable,
	watchHub,
	WatchHub,
	isWatchable,
	withWatchables,
	bind,
	biBind
};



