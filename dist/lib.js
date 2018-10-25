function noop(){
}

function destroyable(proc, container, onEmpty){
	let result = {proc: proc};
	if(container){
		result.destroy = () => {
			result.destroy = result.proc = noop;
			let index = container.indexOf(result);
			if(index !== -1){
				container.splice(index, 1);
			}
			!container.length && onEmpty && onEmpty();
		};
		container.push(result);
	}else{
		result.destroy = () => {
			result.destroy = result.proc = noop;
		};
	}

	return result;
}

function destroyAll(container){
	for(let i = 0, end = container.length; i < end && container.length; i++){
		container.pop().destroy();
	}
}

const listenerCatalog = new WeakMap();

function eventHub(superClass){
	return class extends (superClass || class {}) {
		// protected interface...
		bdNotify(e){
			let events = listenerCatalog.get(this);
			if(!events){
				return;
			}

			let handlers;
			if(e instanceof Event){
				handlers = events[e.type];
			}else{
				if(e.type){
					handlers = events[e.type];
					e.target = this;
				}else if(!e.name){
					handlers = events[e];
					e = {type: e, name: e, target: this};
				}else{
					// eslint-disable-next-line no-console
					console.warn("event.name is deprecated; use event.type");
					handlers = events[e.name];
					e.type = e.name;
					e.target = this;
				}
			}

			if(handlers){
				handlers.slice().forEach(destroyable$$1 => destroyable$$1.proc(e));
			}
		}

		// public interface...
		get isBdEventHub(){
			return true;
		}

		advise(eventName, handler){
			if(!handler){
				let hash = eventName;
				return Reflect.ownKeys(hash).map(key => this.advise(key, hash[key]));
			}else if(Array.isArray(eventName)){
				return eventName.map(name => this.advise(name, handler));
			}else{
				let events = listenerCatalog.get(this);
				if(!events){
					listenerCatalog.set(this, (events = {}));
				}
				let result= destroyable(handler, events[eventName] || (events[eventName] = []));
				this.own && this.own(result);
				return result;
			}
		}

		destroyAdvise(eventName){
			let events = listenerCatalog.get(this);
			if(!events){
				return;
			}
			if(eventName){
				let handlers = events[eventName];
				if(handlers){
					handlers.forEach(h => h.destroy());
					delete events[eventName];
				}
			}else{
				Reflect.ownKeys(events).forEach(eventName => {
					events[eventName].forEach(h => h.destroy());
				});
				listenerCatalog.delete(this);
			}
		}
	};
}

const EventHub = eventHub();

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
const UNKNOWN_OLD_VALUE = {
	value: "UNKNOWN_OLD_VALUE"
};

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
				this[pWatchableWatchers].slice().forEach(destroyable$$1 => destroyable$$1.proc((cValue = newValue), oldValue, target, referenceProp));
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

let holdStarNotifications = false;

function applyWatchers(newValue, oldValue, receiver, name){
	let catalog = watcherCatalog.get(receiver);
	if(catalog){
		if(name === STAR){
			let watchers = catalog[STAR];
			watchers && watchers.slice().forEach(destroyable$$1 => destroyable$$1.proc(receiver, oldValue, receiver, [STAR]));
		}else{
			let prop = name[0];
			let watchers = catalog[prop];
			watchers && watchers.slice().forEach(destroyable$$1 => destroyable$$1.proc(receiver[prop], oldValue, receiver, name));
			if(!holdStarNotifications){
				(watchers = catalog[STAR]) && watchers.slice().forEach(destroyable$$1 => destroyable$$1.proc(receiver, oldValue, receiver, name));
			}
		}
	}
	if(watch.log){
		// eslint-disable-next-line no-console
		console.log(name, newValue);
	}
	if(!holdStarNotifications && receiver[OWNER] !== OWNER_NULL){
		name.unshift(receiver[PROP]);
		applyWatchers(receiver, UNKNOWN_OLD_VALUE, receiver[OWNER], name);
	}
}

let pauseWatchers = false;
let _silentSet = false;

function set(target, prop, value, receiver){
	if(_silentSet){
		target[prop] = value;
		return true;
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
}

const watcher = {
	set: set
};

const SWAP_OLD_LENGTH = Symbol("SWAP_OLD_LENGTH");
const OLD_LENGTH = Symbol("old-length");
const NO_CHANGE = Symbol("splice-no-change");
const QUICK_COPY = Symbol("slice-quick-copy");
const BEFORE_ADVICE = Symbol("BEFORE_ADVICE");
const noop$1 = () => {
};

const arrayWatcher = {
	set(target, prop, value, receiver){
		if(prop === "length"){
			let result = Reflect.set(target, prop, value, receiver);
			let oldValue = target[SWAP_OLD_LENGTH](value);
			!pauseWatchers && !_silentSet && applyWatchers(value, oldValue, receiver, ["length"]);
			return result;
		}else{
			return set(target, prop, value, receiver);
		}
	}
};


function getAdvice(owner, method){
	let advice = owner[BEFORE_ADVICE] && owner[BEFORE_ADVICE][method];
	return advice && advice.map(f => f());
}

class WatchableArray extends Array {
	// note: we can make all of these much more efficient, particularly shift and unshift.
	// But, it's probably rare that it will matter, so we'll do it when the need arises
	[SWAP_OLD_LENGTH](newLength){
		let result = this[OLD_LENGTH];
		this[OLD_LENGTH] = newLength;
		return result;
	}

	before(method, proc){
		let beforeAdvice = this[BEFORE_ADVICE];
		if(!beforeAdvice){
			Object.defineProperty(this, BEFORE_ADVICE, {value: {}});
			beforeAdvice = this[BEFORE_ADVICE];
		}
		let stack = beforeAdvice[method] || (beforeAdvice[method] = []);
		stack.push(proc);
		let handle = {
			destroy(){
				handle.destroy = noop$1;
				let index = stack.indexOf(proc);
				if(index !== -1) stack.splice(index, 1);
			}
		};
		return handle;
	}

	_splice(...args){
		let oldValues = this.slice(QUICK_COPY);
		let changeSet = [];
		let result;
		try{
			_silentSet = true;
			result = super.splice(...args);
			for(let i = 0, end = Math.max(oldValues.length, this.length); i < end; i++){
				let value = this[i];
				if(value instanceof Object){
					if(value[OWNER]){
						if(value[OWNER] !== this){
							// a new item that came from another watchable
							value = this[i] = createWatchable(value, this, i);
							changeSet.push(value);
						}else if(value[PROP] != i){ // INTENTIONAL !=
							// an item that was moved within this
							value[PROP] = i;
							changeSet.push(value);
						}else{
							changeSet.push(NO_CHANGE);
						}
					}else{
						// a new item that is not already a watchable
						value = this[i] = createWatchable(value, this, i);
						changeSet.push(value);
					}
				}else if(value !== oldValues[i]){
					changeSet.push(value);
				}else{
					changeSet.push(NO_CHANGE);
				}
			}
			_silentSet = false;
		}catch(e){
			try{
				oldValues.forEach((value, i) => (this[i] = value));
			}catch(e){
				// eslint-disable-next-line no-console
				console.error(e);
			}
			_silentSet = false;
			throw e;
		}
		try{
			holdStarNotifications = true;
			let change = false;
			changeSet.forEach((value, i) => {
				if(value !== NO_CHANGE){
					change = true;
					applyWatchers(value, oldValues[i], this, [i]);
				}
			});
			if(this.length !== oldValues.length){
				change = true;
				applyWatchers(this.length, oldValues.length, this, ["length"]);
			}
			holdStarNotifications = false;
			if(change){
				applyWatchers(this, UNKNOWN_OLD_VALUE, this, STAR);
			}
		}catch(e){
			holdStarNotifications = false;
			throw e;
		}
		return result;
	}

	splice(...args){
		let advice = getAdvice(this, "splice");
		let result = this._splice(...args);
		advice && advice.map(f => f && f(result));
		return result;
	}

	pop(){
		let advice = getAdvice(this, "pop");
		let result = fromWatchable(super.pop());
		advice && advice.map(f => f && f(result));
		return result;
	}

	shift(){
		let advice = getAdvice(this, "shift");
		let result = fromWatchable(this._splice(0, 1)[0]);
		advice && advice.map(f => f && f(result));
		return result;
	}

	slice(...args){
		return args[0] === QUICK_COPY ? super.slice() : fromWatchable(super.slice(...args));
	}

	unshift(...args){
		let advice = getAdvice(this, "unshift");
		this._splice(0, 0, ...args);
		advice && advice.map(f => f && f());
	}

	reverse(){
		let advice = getAdvice(this, "reverse");
		let oldValues = this.slice(QUICK_COPY);
		try{
			_silentSet = true;
			for(let i = 0, j = this.length - 1; i < j; i++, j--){
				let temp = this[i];
				this[i] = this[j];
				this[i][PROP] = i;
				this[j] = temp;
				temp[PROP] = j;
			}
			_silentSet = false;
		}catch(e){
			_silentSet = false;
			throw e;
		}
		try{
			holdStarNotifications = true;
			if(this.length % 2){
				for(let i = 0, end = Math.floor(this.length / 2); i < end; i++){
					applyWatchers(this[i], oldValues[i], this, [i]);
				}
				for(let i = Math.ceil(this.length / 2), end = this.length; i < end; i++){
					applyWatchers(this[i], oldValues[i], this, [i]);
				}
			}else{
				this.forEach((value, i) => applyWatchers(value, oldValues[i], this, [i]));
			}
			holdStarNotifications = false;
			if(this.length > 1){
				applyWatchers(this, UNKNOWN_OLD_VALUE, this, STAR);
			}
		}catch(e){
			holdStarNotifications = false;
			throw e;
		}
		advice && advice.map(f => f && f(this));
		return this;
	}

	_reorder(proc){
		let oldValues = this.slice(QUICK_COPY);
		let changeSet = Array(this.length).fill(false);
		let changes = false;
		try{
			_silentSet = true;
			proc(this);
			this.forEach((value, i) => {
				if(value[PROP] != i){ // INTENTIONAL !=
					value[PROP] = i;
					changeSet[i] = true;
					changes = true;
				}
			});
			_silentSet = false;
		}catch(e){
			_silentSet = false;
			throw e;
		}
		try{
			holdStarNotifications = true;
			changeSet.forEach((value, i) => {
				if(value){
					applyWatchers(this[i], oldValues[i], this, [i]);
				}
			});
			holdStarNotifications = false;
			if(changes){
				applyWatchers(this, UNKNOWN_OLD_VALUE, this, STAR);
			}
		}catch(e){
			holdStarNotifications = false;
			throw e;
		}
	}

	reorder(proc){
		let advice = getAdvice(this, "reorder");
		this._reorder(proc);
		advice && advice.map(f => f && f(this));
		return this;
	}

	sort(...args){
		let advice = getAdvice(this, "sort");
		this._reorder(theArray => super.sort.apply(theArray, args));
		advice && advice.map(f => f && f(this));
		return this;
	}
}

function silentSet(watchable, prop, value, enumerable, configurable){
	try{
		_silentSet = true;
		if(value === undefined){
			delete watchable[prop];
		}else if(enumerable !== undefined && !enumerable && !watchable.hasOwnProperty(prop)){
			Object.defineProperty(watchable, prop, {
				writable: true,
				configurable: configurable !== undefined ? configurable : true,
				value: value
			});
		}else{
			watchable[prop] = value;
		}
		_silentSet = false;
	}catch(e){
		_silentSet = false;
		throw e;
	}
}

function createWatchable(src, owner, prop){
	let keys = Reflect.ownKeys(src);
	let isArray = Array.isArray(src);
	let result = isArray ? new Proxy(new WatchableArray(), arrayWatcher) : new Proxy({}, watcher);
	if(isArray){
		keys.forEach(k => k !== "length" && (result[k] = src[k]));
		Object.defineProperty(result, OLD_LENGTH, {writable: true, value: result.length});
	}else{
		keys.forEach(k => (result[k] = src[k]));
	}

	let silentHold = _silentSet;
	_silentSet = true;
	Object.defineProperty(result, OWNER, {writable: true, value: owner});
	prop !== undefined && Object.defineProperty(result, PROP, {writable: true, value: prop});
	_silentSet = silentHold;
	return result;
}

function toWatchable(data){
	if(!(data instanceof Object)){
		throw new Error("scalar values are not watchable");
	}
	try{
		pauseWatchers = true;
		data = createWatchable(data, OWNER_NULL, false);
		pauseWatchers = false;
		return data;
	}catch(e){
		pauseWatchers = false;
		throw e;
	}
}

function fromWatchable(data){
	if(data instanceof Object){
		if(!data){
			return data;
		}
		let result = Array.isArray(data) ? Array(data.length) : {};
		Reflect.ownKeys(data).forEach(k => {
			if(k !== OWNER && k !== PROP){
				result[k] = fromWatchable(data[k]);
			}
		});
		return result;
	}else{
		return data;
	}
}

let onMutateBeforeNames = {};
let onMutateNames = {};

function mutate(owner, name, privateName, newValue){
	let oldValue = owner[privateName];
	if(eql(oldValue, newValue)){
		return false;
	}else{
		let onMutateBeforeName, onMutateName;
		if(typeof name !== "symbol"){
			onMutateBeforeName = onMutateBeforeNames[name];
			if(!onMutateBeforeName){
				let suffix = name.substring(0, 1).toUpperCase() + name.substring(1);
				onMutateBeforeName = onMutateBeforeNames[name] = "onMutateBefore" + suffix;
				onMutateName = onMutateNames[name] = "onMutate" + suffix;
			}else{
				onMutateName = onMutateNames[name];
			}
		}

		onMutateBeforeName && owner[onMutateBeforeName] && owner[onMutateBeforeName](newValue, oldValue);
		if(owner.hasOwnProperty(privateName)){
			owner[privateName] = newValue;
		}else{
			// not enumerable or configurable
			Object.defineProperty(owner, privateName, {writable: true, value: newValue});
		}
		onMutateName && owner[onMutateName] && owner[onMutateName](newValue, oldValue);
		return [name, newValue, oldValue];
	}
}

function getWatcher(owner, watcher){
	return typeof watcher === "function" ? watcher : owner[watcher].bind(owner);
}

function watchHub(superClass){
	return class extends (superClass || class {
	}) {
		// protected interface...
		bdMutateNotify(name, newValue, oldValue){
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
						newValue = p[1];
						oldValue = p[2];
						watchers.slice().forEach(destroyable$$1 => destroyable$$1.proc(newValue, oldValue, this, name));
					}
				}
				if(doStar){
					let watchers = variables[STAR];
					if(watchers){
						watchers.slice().forEach(destroyable$$1 => destroyable$$1.proc(this, oldValue, this, name));
					}
				}
			}else{
				let watchers = variables[name];
				if(watchers){
					watchers.slice().forEach(destroyable$$1 => destroyable$$1.proc(newValue, oldValue, this, name));
				}
				watchers = variables[STAR];
				if(watchers){
					watchers.slice().forEach(destroyable$$1 => destroyable$$1.proc(this, oldValue, this, name));
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
			// 2: name[], watcher
			// 3: hash: name -> watcher
			// 4: watchable, name, watcher
			// 5: watchable, name[], watcher
			// 6: watchable, hash: name -> watcher
			// 7: watchable, watcher // STAR watcher

			if(arguments.length === 1){
				// sig 3
				let hash = args[0];
				return Reflect.ownKeys(hash).map(name => this.watch(name, hash[name]));
			}
			if(args[0][OWNER]){
				// sig 4-6
				let result;
				if(arguments.length === 2){
					if(typeof args[1] === "object"){
						// sig 6
						let hash = args[1];
						Reflect.ownKeys(hash).map(name => (hash[name] = getWatcher(this, hash[name])));
						result = watch(args[0], hash);
					}else{
						// sig 7
						result = watch(args[0], STAR, getWatcher(this, args[1]));
					}
				}else{
					// sig 4 or 5
					result = watch(args[0], args[1], getWatcher(this, args[2]));
				}
				this.own && this.own(result);
				return result;
			}
			if(Array.isArray(args[0])){
				// sig 2
				return args[0].map(name => this.watch(name, getWatcher(this, args[1])));
			}
			// sig 1
			let name = args[0];
			let watcher = getWatcher(this, args[1]);
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
	return target && target[OWNER];
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

let postProcessingFuncs = Object.create(null);

function insPostProcessingFunction(name, transform, func){
	if(typeof transform==="string"){
		// transform is an alias for name
		if(!postProcessingFuncs[name]){
			throw Error("cannot alias to a non-existing post-processing function: " + name);
		}
		postProcessingFuncs[transform] = postProcessingFuncs[name];
		return;
	}
	if(arguments.length===3){
		if(typeof transform!=="function"){
			transform = (prop, value) => prop ? {[prop]:value} : value;
		}
	}else{
		func = transform;
		transform = (prop, value) => value;
	}
	func.bdTransform = transform;
	if(postProcessingFuncs[name]){
		throw Error("duplicate postprocessing function name: " + name);
	}
	postProcessingFuncs[name] = func;
}

function replacePostProcessingFunction(name, func){
	postProcessingFuncs[name] = func;
}

function getPostProcessingFunction(name){
	return postProcessingFuncs[name];
}

function flattenChildren(children){
	// single children can be falsey, single children (of type Element or string), or arrays of single children, arbitrarily deep
	let result = [];

	function flatten_(child){
		if(Array.isArray(child)){
			child.forEach(flatten_);
		}else if(child){
			result.push(child);
		}
	}

	flatten_(children);
	return result;
}

class Element {
	constructor(type, props, ...children){
		if(type instanceof Element){
			// copy constructor
			this.type = type.type;
			type.isComponentType && (this.isComponentType = type.isComponentType);
			type.ctorProps && (this.ctorProps = type.ctorProps);
			type.ppFuncs && (this.ppFuncs = type.ppFuncs);
			type.children && (this.children = type.children);
		}else{
			// type must either be a constructor (a function) or a string; guarantee that as follows...
			if(type instanceof Function){
				this.isComponentType = true;
				this.type = type;
			}else if(type){
				// leave this.isComponentType === undefined
				this.type = Array.isArray(type) ? type : type + "";
			}else{
				throw new Error("type is required");
			}

			// if the second arg is an Object and not an Element or and Array, then it is props...
			if(props){
				if(props instanceof Element || Array.isArray(props)){
					children.unshift(props);
					this.ctorProps = {};
				}else if(props instanceof Object){
					let ctorProps = {};
					let ppFuncs = {};
					let ppFuncCount = 0;
					let match, ppf;
					let setPpFuncs = (ppKey, value) => {
						if(ppFuncs[ppKey]){
							let dest = ppFuncs[ppKey];
							Reflect.ownKeys(value).forEach(k => dest[k] = value[k]);
						}else{
							ppFuncCount++;
							ppFuncs[ppKey] = value;
						}
					};
					Reflect.ownKeys(props).forEach((k) => {
						if((ppf = getPostProcessingFunction(k))){
							let value = ppf.bdTransform(null, props[k]);
							setPpFuncs(k, value);
						}else if((match = k.match(/^([A-Za-z0-9$]+)_(.+)$/)) && (ppf = getPostProcessingFunction(match[1]))){
							let ppKey = match[1];
							let value = ppf.bdTransform(match[2], props[k]);
							setPpFuncs(ppKey, value);
						}else{
							ctorProps[k] = props[k];
						}
					});
					this.ctorProps = Object.freeze(ctorProps);
					if(ppFuncCount){
						this.ppFuncs = Object.freeze(ppFuncs);
					}
				}else{
					children.unshift(props);
					this.ctorProps = {};
				}
			}else{
				this.ctorProps = {};
			}


			let flattenedChildren = flattenChildren(children);
			if(flattenedChildren.length === 1){
				let child = flattenedChildren[0];
				this.children = child instanceof Element ? child : child + "";
			}else if(flattenedChildren.length){
				this.children = flattenedChildren.map(child => (child instanceof Element ? child : child + ""));
				Object.freeze(this.children);
			}// else children.length===0; therefore, no children
		}
		Object.freeze(this);
	}
}

function element(type, props, ...children){
	// make elements without having to use new
	return new Element(type, props, children);
}

"a.abbr.address.area.article.aside.audio.base.bdi.bdo.blockquote.br.button.canvas.caption.cite.code.col.colgroup.data.datalist.dd.del.details.dfn.div.dl.dt.em.embed.fieldset.figcaption.figure.footer.form.h1.head.header.hr.html.i.iframe.img.input.ins.kbd.label.legend.li.link.main.map.mark.meta.meter.nav.noscript.object.ol.optgroup.option.output.p.param.picture.pre.progress.q.rb.rp.rt.rtc.ruby.s.samp.script.section.select.slot.small.source.span.strong.style.sub.summary.sup.table.tbody.td.template.textarea.tfoot.th.thead.time.title.tr.track.u.ul.var.video.wbr".split(".").forEach(tag => {
	element[tag] = function div(props, ...children){
		return new Element(tag, props, children);
	};
});

function div(props, ...children){
	return new Element("div", props, children);
}

const SVG = Object.create(null, {
	toString: {
		value: () => "http://www.w3.org/2000/svg"
	}
});
Object.freeze(SVG);

function svg(type, props, ...children){
	if(typeof type !== "string"){
		children.unshift(props);
		props = type;
		type = "svg";
	}
	return new Element([SVG, type], props, children);
}

let document$1 = 0;
let createNode = 0;
let insertNode = 0;

function initialize(_document, _createNode, _insertNode){
	document$1 = _document;
	Component.createNode = createNode = _createNode;
	Component.insertNode = insertNode = _insertNode;
}

function cleanClassName(s){
	return s.replace(/\s{2,}/g, " ").trim();
}

function conditionClassNameArgs(args){
	return args.reduce((acc, item) => {
		if(item instanceof RegExp){
			acc.push(item);
		}else{
			acc = acc.concat(item.split(" ").map(s => s.trim()).filter(s => !!s));
		}
		return acc;
	}, []);
}

function classValueToRegExp(v, args){
	return v instanceof RegExp ? v : RegExp(" " + v + " ", args);
}

function calcDomClassName(component){
	let staticClassName = component.staticClassName;
	let className = component.bdClassName;
	return staticClassName && className ? (staticClassName + " " + className) : (staticClassName || className);
}

function addChildToDomNode(parent, domNode, child, childIsComponent){
	if(childIsComponent){
		let childDomRoot = child.bdDom.root;
		if(Array.isArray(childDomRoot)){
			childDomRoot.forEach((node) => insertNode(node, domNode));
		}else{
			insertNode(childDomRoot, domNode);
		}
		parent.bdAdopt(child);
	}else{
		insertNode(child, domNode);
	}
}

function validateElements(elements){
	if(Array.isArray(elements)){
		elements.forEach(validateElements);
	}else if(elements.isComponentType){
		throw new Error("Illegal: root element(s) for a Component cannot be Components");
	}
}

function postProcess(ppFuncs, owner, target){
	Reflect.ownKeys(ppFuncs).forEach(ppf => {
		let args = ppFuncs[ppf];
		if(Array.isArray(args)){
			getPostProcessingFunction(ppf)(owner, target, ...args);
		}else{
			getPostProcessingFunction(ppf)(owner, target, args);
		}
	});
}

function noop$2(){
}

function pushHandles(dest, ...handles){
	handles.forEach(h => {
		if(Array.isArray(h)){
			pushHandles(dest, ...h);
		}else if(h){
			let destroy = h.destroy.bind(h);
			h.destroy = function(){
				destroy();
				let index = dest.indexOf(h);
				if(index !== -1){
					dest.splice(index, 1);
				}
				h.destroy = noop$2;
			};
			dest.push(h);
		}
	});
}

const ownedHandlesCatalog = new WeakMap();
const domNodeToComponent = new Map();

class Component extends eventHub(WatchHub) {
	constructor(kwargs = {}){
		// notice that this class requires only the per-instance data actually used by its subclass/instance
		super();

		if(!this.constructor.noKwargs){
			this.kwargs = kwargs;
		}

		// id, if provided, is read-only
		if(kwargs.id){
			Object.defineProperty(this, "id", {value: kwargs.id + "", enumerable: true});
		}

		if(kwargs.className){
			Array.isArray(kwargs.className) ? this.addClassName(...kwargs.className) : this.addClassName(kwargs.className);
		}

		if(kwargs.tabIndex !== undefined){
			this.tabIndex = kwargs.tabIndex;
		}

		if(kwargs.title){
			this.title = kwargs.title;
		}

		if(kwargs.disabled || (kwargs.enabled !== undefined && !kwargs.enabled)){
			this.disabled = true;
		}

		if(kwargs.elements){
			if(typeof kwargs.elements === "function"){
				this.bdElements = kwargs.elements;
			}else{
				this.bdElements = () => kwargs.elements;
			}
		}

		if(kwargs.postRender){
			this.postRender = kwargs.postRender;
		}

		if(kwargs.mix){
			Reflect.ownKeys(kwargs.mix).forEach(p => (this[p] = kwargs.mix[p]));
		}

		if(kwargs.callbacks){
			let events = this.constructor.events;
			Reflect.ownKeys(kwargs.callbacks).forEach(key => {
				if(events.indexOf(key) !== -1){
					this.advise(key, kwargs.callbacks[key]);
				}else{
					this.watch(key, kwargs.callbacks[key]);
				}
			});
		}
	}

	destroy(){
		this.unrender();
		let handles = ownedHandlesCatalog.get(this);
		if(handles){
			while(handles.length) handles.shift().destroy();
			ownedHandlesCatalog.delete(this);
		}
		this.destroyWatch();
		this.destroyAdvise();
		delete this.kwargs;
		this.destroyed = true;
	}

	render(
		proc // [function, optional] called after this class's render work is done, called in context of this
	){
		if(!this.bdDom){
			let dom = this.bdDom = this._dom = {};
			let elements = this.bdElements();
			validateElements(elements);
			let root = dom.root = this.constructor.renderElements(this, elements);
			if(Array.isArray(root)){
				root.forEach((node) => domNodeToComponent.set(node, this));
			}else{
				domNodeToComponent.set(root, this);
				if(this.id){
					root.id = this.id;
				}
				this.addClassName(root.getAttribute("class") || "");
				let className = calcDomClassName(this);
				if(className){
					root.setAttribute("class", className);
				}

				if(this.bdDom.tabIndexNode){
					if(this.bdTabIndex === undefined){
						this.bdTabIndex = this.bdDom.tabIndexNode.tabIndex;
					}else{
						this.bdDom.tabIndexNode.tabIndex = this.bdTabIndex;
					}
				}else if(this.bdTabIndex !== undefined){
					(this.bdDom.tabIndexNode || this.bdDom.root).tabIndex = this.bdTabIndex;
				}
				if(this.bdTitle !== undefined){
					(this.bdDom.titleNode || this.bdDom.root).title = this.bdTitle;
				}

				this[this.bdDisabled ? "addClassName" : "removeClassName"]("bd-disabled");
			}
			this.ownWhileRendered(this.postRender());
			proc && proc.call(this);
			this.bdMutateNotify("rendered", true, false);
		}
		return this.bdDom.root;
	}

	postRender(){
		// no-op
	}

	bdElements(){
		return new Element("div", {});
	}

	unrender(){
		if(this.rendered){
			if(this.bdParent){
				this.bdParent.delChild(this, true);
			}

			if(this.children){
				this.children.slice().forEach((child) => {
					child.destroy();
				});
			}
			delete this.children;

			let root = this.bdDom.root;
			if(Array.isArray(root)){
				root.forEach((node) => {
					domNodeToComponent.delete(node);
					node.parentNode && node.parentNode.removeChild(node);
				});
			}else{
				domNodeToComponent.delete(root);
				root.parentNode && root.parentNode.removeChild(root);
			}
			if(this.bdDom.handles){
				this.bdDom.handles.forEach(handle => handle.destroy());
			}
			delete this.bdDom;
			delete this._dom;
			this.bdAttachToDoc(false);
			this.bdMutateNotify("rendered", false, true);
		}
	}

	get rendered(){
		return !!(this.bdDom && this.bdDom.root);
	}

	own(...handles){
		let _handles = ownedHandlesCatalog.get(this);
		if(!_handles){
			ownedHandlesCatalog.set(this, (_handles = []));
		}
		pushHandles(_handles, ...handles);
	}

	ownWhileRendered(...handles){
		pushHandles(this.bdDom.handles || (this.bdDom.handles = []), ...handles);
	}

	get parent(){
		return this.bdParent;
	}

	bdAdopt(child){
		if(child.bdParent){
			throw new Error("unexpected");
		}
		(this.children || (this.children = [])).push(child);

		child.bdMutate("parent", "bdParent", this);
		child.bdAttachToDoc(this.bdAttachedToDoc);
	}

	bdAttachToDoc(value){
		if(this.bdMutate("attachedToDoc", "bdAttachedToDoc", !!value)){
			this.children && this.children.forEach(child => child.bdAttachToDoc(value));
			return true;
		}else{
			return false;
		}
	}

	get attachedToDoc(){
		return !!this.bdAttachedToDoc;
	}

	insChild(...args){
		if(!this.rendered){
			throw new Error("parent component must be rendered before explicitly inserting a child");
		}
		let {src, attachPoint, position} = decodeRender(args);
		let child;
		if(src instanceof Component){
			child = src;
			if(child.parent){
				child.parent.delChild(child, true);
			}
			child.render();
		}else{ // child instanceof Element
			if(!src.isComponentType){
				src = new Element(Component, {elements: src});
			}
			child = this.constructor.renderElements(this, src);
		}

		if(/before|after|replace|only|first|last/.test(attachPoint) || typeof attachPoint === "number"){
			position = attachPoint;
			attachPoint = 0;
		}

		if(attachPoint){
			if(attachPoint in this){
				// node reference
				attachPoint = this[attachPoint];
			}else if(typeof attachPoint === "string"){
				attachPoint = document$1.getElementById(attachPoint);
				if(!attachPoint){
					throw new Error("unexpected");
				}
			}else if(position !== undefined){
				// attachPoint must be a child Component
				let index = this.children ? this.children.indexOf(attachPoint) : -1;
				if(index !== -1){
					// attachPoint is a child
					attachPoint = attachPoint.bdDom.root;
					if(Array.isArray(attachPoint)){
						switch(position){
							case "replace":
							case "only":
							case "before":
								attachPoint = attachPoint[0];
								break;
							case "after":
								attachPoint = attachPoint[attachPoint.length - 1];
								break;
							default:
								throw new Error("unexpected");
						}
					}
				}else{
					throw new Error("unexpected");
				}
			}else{
				// attachPoint without a position must give a node reference
				throw new Error("unexpected");
			}
		}else if(child.bdParentAttachPoint){
			// child is telling the parent where it wants to go; this is more specific than pChildrenAttachPoint
			if(child.bdParentAttachPoint in this){
				attachPoint = this[child.bdParentAttachPoint];
			}else{
				throw new Error("unexpected");
			}
		}else{
			attachPoint = this.bdChildrenAttachPoint || this.bdDom.root;
			if(Array.isArray(attachPoint)){
				throw new Error("unexpected");
			}
		}

		let childRoot = child.bdDom.root;
		if(Array.isArray(childRoot)){
			let firstChildNode = childRoot[0];
			unrender(insertNode(firstChildNode, attachPoint, position));
			childRoot.slice(1).reduce((prevNode, node) => {
				insertNode(node, prevNode, "after");
				return node;
			}, firstChildNode);
		}else{
			unrender(insertNode(childRoot, attachPoint, position));
		}

		this.bdAdopt(child);
		return child;
	}

	delChild(child, preserve){
		let index = this.children ? this.children.indexOf(child) : -1;
		if(index !== -1){
			let root = child.bdDom && child.bdDom.root;
			let removeNode = (node) => {
				node.parentNode && node.parentNode.removeChild(node);
			};
			Array.isArray(root) ? root.forEach(removeNode) : removeNode(root);
			child.bdMutate("parent", "bdParent", null);
			child.bdAttachToDoc(false);
			this.children.splice(index, 1);
			if(!preserve){
				child.destroy();
				child = false;
			}
			return child;
		}
		return false;
	}

	reorderChildren(children){
		let thisChildren = this.children;
		let node = this.children[0].bdDom.root.parentNode;

		children.forEach((child, i) => {
			if(thisChildren[i] !== child){
				let index = thisChildren.indexOf(child, i + 1);
				thisChildren.splice(index, 1);
				node.insertBefore(child.bdDom.root, thisChildren[i].bdDom.root);
				thisChildren.splice(i, 0, child);
			}
		});
	}

	get staticClassName(){
		return this.kwargs.hasOwnProperty("staticClassName") ?
			this.kwargs.staticClassName : (this.constructor.className || "");
	}

	get className(){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT returned
		if(this.rendered){
			// if rendered, then look at what's actually in the document...maybe client code _improperly_ manipulated directly
			let root = this.bdDom.root;
			if(Array.isArray(root)){
				root = root[0];
			}
			let className = root.className;
			let staticClassName = this.staticClassName;
			if(staticClassName){
				staticClassName.split(" ").forEach(s => className = className.replace(s, ""));
			}
			return cleanClassName(className);
		}else{
			return this.bdClassName || "";
		}
	}

	set className(value){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT affected

		// clean up any space sloppiness, sometimes caused by client-code algorithms that manipulate className
		value = cleanClassName(value);
		if(!this.bdClassName){
			this.bdSetClassName(value, "");
		}else if(!value){
			this.bdSetClassName("", this.bdClassName);
		}else if(value !== this.bdClassName){
			this.bdSetClassName(value, this.bdClassName);
		}
	}

	containsClassName(value){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT considered

		value = cleanClassName(value);
		return (" " + (this.bdClassName || "") + " ").indexOf(value) !== -1;
	}

	addClassName(...values){
		let current = this.bdClassName || "";
		this.bdSetClassName(conditionClassNameArgs(values).reduce((className, value) => {
			return classValueToRegExp(value).test(className) ? className : className + value + " ";
		}, " " + current + " ").trim(), current);
		return this;
	}

	removeClassName(...values){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT considered
		let current = this.bdClassName || "";
		this.bdSetClassName(conditionClassNameArgs(values).reduce((className, value) => {
			return className.replace(classValueToRegExp(value, "g"), " ");
		}, " " + current + " ").trim(), current);
		return this;
	}

	toggleClassName(...values){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT considered
		let current = this.bdClassName || "";
		this.bdSetClassName(conditionClassNameArgs(values).reduce((className, value) => {
			if(classValueToRegExp(value).test(className)){
				return className.replace(classValueToRegExp(value, "g"), " ");
			}else{
				return className + value + " ";
			}
		}, " " + current + " ").trim(), current);
		return this;
	}

	bdSetClassName(newValue, oldValue){
		if(newValue !== oldValue){
			this.bdClassName = newValue;
			if(this.rendered){
				this.bdDom.root.setAttribute("class", calcDomClassName(this));
			}
			this.bdMutateNotify("className", newValue, oldValue);
			let oldVisibleValue = oldValue ? oldValue.indexOf("hidden") === -1 : true,
				newVisibleValue = newValue ? newValue.indexOf("hidden") === -1 : true;
			if(oldVisibleValue !== newVisibleValue){
				this.bdMutateNotify("visible", newVisibleValue, oldVisibleValue);
			}
		}
	}

	bdOnFocus(){
		this.addClassName("bd-focused");
		this.bdMutate("hasFocus", "bdHasFocus", true);
	}

	bdOnBlur(){
		this.removeClassName("bd-focused");
		this.bdMutate("hasFocus", "bdHasFocus", false);
	}

	get hasFocus(){
		return !!this.bdHasFocus;
	}

	focus(){
		if(this.bdDom){
			(this.bdDom.tabIndexNode || this.bdDom.root).focus();
		}
	}

	get tabIndex(){
		if(this.rendered){
			// unconditionally make sure this.bdTabIndex and the dom is synchronized on each get
			return (this.bdTabIndex = (this.bdDom.tabIndexNode || this.bdDom.root).tabIndex);
		}else{
			return this.bdTabIndex;
		}
	}

	set tabIndex(value){
		if(!value && value !== 0){
			value = "";
		}
		if(value !== this.bdTabIndex){
			this.rendered && ((this.bdDom.tabIndexNode || this.bdDom.root).tabIndex = value);
			this.bdMutate("tabIndex", "bdTabIndex", value);
		}
	}

	get enabled(){
		return !this.bdDisabled;
	}

	set enabled(value){
		this.disabled = !value;
	}

	get disabled(){
		return !!this.bdDisabled;
	}

	set disabled(value){
		value = !!value;
		if(this.bdDisabled !== value){
			this.bdDisabled = value;
			this.bdMutateNotify([["disabled", value, !value], ["enabled", !value, value]]);
			this[value ? "addClassName" : "removeClassName"]("bd-disabled");
		}
	}

	get visible(){
		return !this.containsClassName("bd-hidden");
	}

	set visible(value){
		value = !!value;
		if(value !== !this.containsClassName("bd-hidden")){
			if(value){
				this.removeClassName("bd-hidden");
				this.resize && this.resize();
			}else{
				this.addClassName("bd-hidden");
			}
			this.bdMutateNotify("visible", value, !value);
		}
	}

	get title(){
		if(this.rendered){
			return (this.bdDom.titleNode || this.bdDom.root).title;
		}else{
			return this.bdTitle;
		}
	}

	set title(value){
		if(this.bdMutate("title", "bdTitle", value)){
			this.rendered && ((this.bdDom.titleNode || this.bdDom.root).title = value);
		}
	}

	static get(domNode){
		return domNodeToComponent.get(domNode);
	}

	static renderElements(owner, e){
		if(Array.isArray(e)){
			return e.map((e) => Component.renderElements(owner, e));
		}else if(e instanceof Element){
			const {type, ctorProps, ppFuncs, children} = e;
			let result;
			if(e.isComponentType){
				let componentInstance = result = new type(ctorProps);
				componentInstance.render();
				ppFuncs && postProcess(ppFuncs, owner, componentInstance);
				if(children){
					let renderedChildren = Component.renderElements(owner, children);
					if(Array.isArray(renderedChildren)){
						renderedChildren.forEach((child) => result.insChild(child));
					}else{
						result.insChild(renderedChildren);
					}
				}
			}else{
				let domNode = result = createNode(type, ctorProps);
				if("tabIndex" in ctorProps && ctorProps.tabIndex !== false){
					owner.bdDom.tabIndexNode = domNode;
				}
				ppFuncs && postProcess(ppFuncs, owner, domNode);
				if(children){
					let renderedChildren = Component.renderElements(owner, children);
					if(Array.isArray(renderedChildren)){
						renderedChildren.forEach((child, i) => addChildToDomNode(owner, domNode, child, children[i].isComponentType));
					}else{
						addChildToDomNode(owner, domNode, renderedChildren, children.isComponentType);
					}
				}
			}
			return result;
		}else{
			// e must be convertible to a string
			return document$1.createTextNode(e);
		}
	}
}

Component.watchables = ["rendered", "parent", "attachedToDoc", "className", "hasFocus", "tabIndex", "enabled", "visible", "title"];
Component.events = [];
Component.withWatchables = (...args) => withWatchables(Component, ...args);

insPostProcessingFunction("bdAttach",
	function(ppfOwner, ppfTarget, name){
		if(typeof name === "function"){
			name(ppfTarget);
		}else{
			ppfOwner[name] = ppfTarget;
			ppfOwner.ownWhileRendered({
				destroy: function(){
					delete ppfOwner[name];
				}
			});
		}
	}
);

insPostProcessingFunction("bdWatch", true,
	function(ppfOwner, ppfTarget, watchers){
		Reflect.ownKeys(watchers).forEach(eventType => {
			let watcher = watchers[eventType];
			if(typeof watcher !== "function"){
				watcher = ppfOwner[eventType].bind(ppfOwner);
			}
			ppfTarget.ownWhileRendered(ppfTarget.watch(eventType, watcher));
		});
	}
);

insPostProcessingFunction("bdExec",
	function(ppfOwner, ppfTarget, ...args){
		for(let i = 0; i < args.length;){
			let f = args[i++];
			if(typeof f === "function"){
				f(ppfOwner, ppfTarget);
			}else if(typeof f === "string"){
				if(!(typeof ppfTarget[f] === "function")){
					// eslint-disable-next-line no-console
					console.error("unexpected");
				}
				if(i < args.length && Array.isArray(args[i])){
					ppfTarget[f](...args[i++], ppfOwner, ppfTarget);
				}else{
					ppfTarget[f](ppfOwner, ppfTarget);
				}
			}else{
				// eslint-disable-next-line no-console
				console.error("unexpected");
			}
		}
	}
);

insPostProcessingFunction("bdTitleNode",
	function(ppfOwner, ppfTarget){
		ppfOwner.bdDom.titleNode = ppfTarget;
	}
);

insPostProcessingFunction("bdParentAttachPoint",
	function(ppfOwner, ppfTarget, propertyName){
		ppfTarget.bdParentAttachPoint = propertyName;
	}
);

insPostProcessingFunction("bdChildrenAttachPoint",
	function(ppfOwner, ppfTarget){
		ppfOwner.bdChildrenAttachPoint = ppfTarget;
	}
);

insPostProcessingFunction("bdReflectClass",
	function(ppfOwner, ppfTarget, ...args){
		// args is a list of ([owner, ] property, [, formatter])...
		// very much like bdReflect, except we're adding/removing components (words) from this.classname

		function normalize(value){
			return !value ? "" : value + "";
		}

		function install(owner, prop, formatter){
			let watchable = getWatchableRef(owner, prop, formatter);
			ppfOwner.ownWhileRendered(watchable);
			let value = normalize(watchable.value);
			value && ppfOwner.addClassName(value);
			ppfOwner.ownWhileRendered(watchable.watch((newValue, oldValue) => {
				newValue = normalize(newValue);
				oldValue = normalize(oldValue);
				if(newValue !== oldValue){
					oldValue && ppfOwner.removeClassName(oldValue);
					newValue && ppfOwner.addClassName(newValue);

				}
			}));
		}

		args = args.slice();
		let owner, prop;
		while(args.length){
			owner = args.shift();
			if(typeof owner === "string" || typeof owner === "symbol"){
				prop = owner;
				owner = ppfOwner;
			}else{
				prop = args.shift();
			}
			install(owner, prop, typeof args[0] === "function" ? args.shift() : null);
		}
	}
);

function isComponentDerivedCtor(f){
	return f === Component || (f && isComponentDerivedCtor(Object.getPrototypeOf(f)));
}

const prototypeOfObject = Object.getPrototypeOf({});

function decodeRender(args){
	// eight signatures...
	//     Signatures 1-2 render an element, 3-6 render a Component, 7-8 render an instance of a Component
	//
	//     Each of the above groups may or may not have the args node:domNode[, position:Position="last"]
	//     which indicate where to attach the rendered Component instance (or not).
	//
	//     when this decode routine is used by Component::insertChild, then node can be a string | symbol, indicating
	//     an instance property that holds the node
	//
	//     1. render(e:Element)
	//     => isComponentDerivedCtor(e.type), then render e.type(e.props); otherwise, render Component({elements:e})
	//
	//     2. render(e:Element, node:domNode[, position:Position="last"])
	// 	   => [1] with attach information
	//
	//     3. render(C:Component)
	//     => render(C, {})
	//
	//     4. render(C:Component, args:kwargs)
	//     => render(C, args)
	//     // note: args is kwargs for C's constructor; therefore, postprocessing instructions are meaningless unless C's
	//     // construction defines some usage for them (atypical)
	//
	//     5. render(C:Component, node:domNode[, position:Position="last"])
	//     => [3] with attach information
	//
	//     6. render(C:Component, args:kwargs, node:domNode[, position:Position="last"])
	//     => [4] with attach information
	//
	//     7. render(c:instanceof Component)
	//     => c.render()
	//
	//     8. render(c:instanceof Component, node:domNode[, position:Position="last"])
	// 	   => [7] with attach information
	//
	//     Position one of "first", "last", "before", "after", "replace", "only"; see dom::insert
	//
	//     returns {
	//	       src: instanceof Component | Element
	//		   attachPoint: node | string | undefined
	//		   position: string | undefined
	//     }
	//
	//     for signatures 3-6, an Element is manufactured given the arguments
	//
	let [arg1, arg2, arg3, arg4] = args;
	if(arg1 instanceof Element || arg1 instanceof Component){
		// [1] or [2] || [7] or [8]
		return {src: arg1, attachPoint: arg2, position: arg3};
	}else{
		if(!isComponentDerivedCtor(arg1)){
			throw new Error("first argument must be an Element, Component, or a class derived from Component");
		}
		if(args.length === 1){
			// [3]
			return {src: new Element(arg1)};
		}else{
			// more than one argument; the second argument is either props or not
			if(Object.getPrototypeOf(arg2) === prototypeOfObject){
				// [4] or [6]
				// WARNING: this signature requires kwargs to be a plain Javascript Object (which is should be!)
				return {src: new Element(arg1, arg2), attachPoint: arg3, position: arg4};
			}else{
				// [5]
				return {src: new Element(arg1), attachPoint: arg2, position: arg3};
			}
		}
	}
}

function unrender(node){
	function unrender_(node){
		let component = domNodeToComponent.get(node);
		if(component){
			component.destroy();
		}
	}

	Array.isArray(node) ? node.forEach(unrender_) : (node && unrender_(node));
}

function render(...args){
	let result;
	let {src, attachPoint, position} = decodeRender(args);
	if(src instanceof Element){
		if(src.isComponentType){
			result = new src.type(src.ctorProps);
		}else{
			result = new Component({elements: src});
		}
		result.render();
	}else{ // src instanceof Component
		result = src;
		result.render();
	}

	if(typeof attachPoint === "string"){
		attachPoint = document$1.getElementById(attachPoint);
	}

	if(attachPoint){
		let root = result.bdDom.root;
		if(Array.isArray(root)){
			let firstChildNode = root[0];
			unrender(insertNode(firstChildNode, attachPoint, position));
			root.slice(1).reduce((prevNode, node) => {
				insertNode(node, prevNode, "after");
				return node;
			}, firstChildNode);
		}else{
			unrender(insertNode(root, attachPoint, position));
		}
		result.bdAttachToDoc(document$1.body.contains(attachPoint));
	}
	return result;
}

function getAttributeValueFromEvent(e, attributeName, stopNode){
	let node = e.target;
	while(node && node !== stopNode){
		if(node.getAttributeNode(attributeName)){
			return node.getAttribute(attributeName);
		}
		node = node.parentNode;
	}
	return undefined;
}


function normalizeNodeArg(arg){
	return arg instanceof Component ? arg.bdDom.root : (typeof arg === "string" ? document.getElementById(arg) : arg);
}

function setAttr(node, name, value){
	node = normalizeNodeArg(node);
	if(arguments.length === 2){
		let hash = name;
		Object.keys(hash).forEach(name => {
			setAttr(node, name, hash[name]);
		});
	}else{
		if(name === "style"){
			setStyle(node, value);
		}else if(name === "innerHTML" || (name in node && node instanceof HTMLElement)){
			node[name] = value;
		}else{
			node.setAttribute(name, value);
		}
	}
}


function getAttr(node, name){
	node = normalizeNodeArg(node);
	if(name in node && node instanceof HTMLElement){
		return node[name];
	}else{
		return node.getAttribute(name);
	}
}

let lastComputedStyleNode = 0;
let lastComputedStyle = 0;

function getComputedStyle(node){
	node = normalizeNodeArg(node);
	if(lastComputedStyleNode !== node){
		lastComputedStyle = window.getComputedStyle((lastComputedStyleNode = node));
	}
	return lastComputedStyle;
}

function getStyle(node, property){
	node = normalizeNodeArg(node);
	if(lastComputedStyleNode !== node){
		lastComputedStyle = window.getComputedStyle((lastComputedStyleNode = node));
	}
	let result = lastComputedStyle[property];
	return (typeof result === "string" && /px$/.test(result)) ? parseFloat(result) : result;
}

function getStyles(node, ...styleNames){
	node = normalizeNodeArg(node);
	if(lastComputedStyleNode !== node){
		lastComputedStyle = window.getComputedStyle((lastComputedStyleNode = node));
	}

	let styles = [];
	styleNames.forEach((p) => {
		if(Array.isArray(p)){
			styles = styles.concat(p);
		}else if(typeof p === "string"){
			styles.push(p);
		}else{
			Object.keys(p).forEach((p) => styles.push(p));
		}
	});

	let result = {};
	styles.forEach((property) => {
		let result = lastComputedStyle[property];
		result[property] = (typeof result === "string" && /px$/.test(result)) ? parseFloat(result) : result;
	});
	return result;
}

function setStyle(node, property, value){
	node = normalizeNodeArg(node);
	if(arguments.length === 2){
		if(typeof property === "string"){
			node.style = property;
		}else{
			let hash = property;
			Object.keys(hash).forEach(property => {
				node.style[property] = hash[property];
			});
		}
	}else{
		node.style[property] = value;
	}
}

function getPosit(node){
	let result = normalizeNodeArg(node).getBoundingClientRect();
	result.t = result.top;
	result.b = result.bottom;
	result.l = result.left;
	result.r = result.right;
	result.h = result.height;
	result.w = result.width;
	return result;
}

function setPosit(node, posit){
	node = normalizeNodeArg(node);
	for(let p in posit){
		switch(p){
			case "t":
				node.style.top = posit.t + "px";
				break;
			case "b":
				node.style.bottom = posit.b + "px";
				break;
			case "l":
				node.style.left = posit.l + "px";
				break;
			case "r":
				node.style.right = posit.r + "px";
				break;
			case "h":
				node.style.height = posit.h + "px";
				break;
			case "w":
				node.style.width = posit.w + "px";
				break;
			case "maxH":
				node.style.maxHeight = posit.maxH + "px";
				break;
			case "maxW":
				node.style.maxWidth = posit.maxW + "px";
				break;
			case "z":
				node.style.zIndex = posit.z;
				break;
			default:
		}
	}
}

function insertBefore(node, refNode){
	refNode.parentNode.insertBefore(node, refNode);
}

function insertAfter(node, refNode){
	let parent = refNode.parentNode;
	if(parent.lastChild === refNode){
		parent.appendChild(node);
	}else{
		parent.insertBefore(node, refNode.nextSibling);
	}
}

function insert(node, refNode, position){
	if(position === undefined || position === "last"){
		// short circuit the common case
		refNode.appendChild(node);
	}else switch(position){
		case "before":
			insertBefore(node, refNode);
			break;
		case "after":
			insertAfter(node, refNode);
			break;
		case "replace":
			refNode.parentNode.replaceChild(node, refNode);
			return (refNode);
		case "only":{
			let result = [];
			while(refNode.firstChild){
				result.push(refNode.removeChild(refNode.firstChild));
			}
			refNode.appendChild(node);
			return result;
		}
		case "first":
			if(refNode.firstChild){
				insertBefore(node, refNode.firstChild);
			}else{
				refNode.appendChild(node);
			}
			break;
		default:
			if(typeof position === "number"){
				let children = refNode.childNodes;
				if(!children.length || children.length <= position){
					refNode.appendChild(node);
				}else{
					insertBefore(node, children[position < 0 ? Math.max(0, children.length + position) : position]);
				}
			}else{
				throw new Error("illegal position");
			}
	}
}

function create(tag, props){
	let result = Array.isArray(tag) ? document.createElementNS(tag[0] + "", tag[1]) : document.createElement(tag);
	if(props){
		Reflect.ownKeys(props).forEach(p => setAttr(result, p, props[p]));
	}
	return result;
}


const DATA_BD_HIDE_SAVED_VALUE = "data-bd-hide-saved-value";

function hide(...nodes){
	nodes.forEach((node) => {
		node = normalizeNodeArg(node);
		if(node){
			if(!node.hasAttribute(DATA_BD_HIDE_SAVED_VALUE)){
				node.setAttribute(DATA_BD_HIDE_SAVED_VALUE, node.style.display);
				node.style.display = "none";
			}//else, ignore, multiple calls to hide
		}
	});
}

function show(...nodes){
	nodes.forEach((node) => {
		node = normalizeNodeArg(node);
		if(node){
			let displayValue = "";
			if(node.hasAttribute(DATA_BD_HIDE_SAVED_VALUE)){
				displayValue = node.getAttribute(DATA_BD_HIDE_SAVED_VALUE);
				node.removeAttribute(DATA_BD_HIDE_SAVED_VALUE);
			}
			node.style.display = displayValue;
		}
	});
}

function getMaxZIndex(parent){
	let node, cs, max = 0, children = parent.childNodes, i = 0, end = children.length;
	while(i < end){
		node = children[i++];
		cs = node && node.nodeType === 1 && getComputedStyle(node);
		max = Math.max(max, (cs && cs.zIndex && Number(cs.zIndex)) || 0);
	}
	return max;
}

function destroyDomChildren(node){
	let childNode;
	while((childNode = node.lastChild)){
		node.removeChild(childNode);
	}
}

function destroyDomNode(node){
	node && node.parentNode && node.parentNode.removeChild(node);
}

let hasTouchEvents = "ontouchstart" in document,
	touchMap = {
		mousedown: "touchstart",
		mousemove: "touchmove",
		mouseup: "touchend"
	};

function connect(target, type, listener, useCapture){
	// if you don't want to register touch events, set useCapture to either true or false
	let touchEvent = touchMap[type],
		destroyed = false;
	if(touchEvent && hasTouchEvents && useCapture === undefined){
		target.addEventListener(type, listener);
		target.addEventListener(touchEvent, listener);
		return {
			destroy: function(){
				if(!destroyed){
					destroyed = true;
					target.removeEventListener(type, listener);
					target.removeEventListener(touchEvent, listener);
				}
			}
		};
	}else{
		useCapture = !!useCapture;
		target.addEventListener(type, listener, useCapture);
		return {
			destroy: function(){
				if(!destroyed){
					destroyed = true;
					target.removeEventListener(type, listener, useCapture);
				}
			}
		};
	}
}

function stopEvent(event){
	if(event && event.preventDefault){
		event.preventDefault();
		event.stopPropagation();
	}
}


let focusedComponent = null,
	focusedNode = null,
	focusedStack = [],
	previousFocusedComponent = null,
	previousFocusedNode = null;

class FocusManager extends EventHub {
	get focusedComponent(){
		return focusedComponent;
	}

	get focusedNode(){
		return focusedNode;
	}

	get focusedStack(){
		return focusedStack;
	}

	get previousFocusedComponent(){
		return previousFocusedComponent;
	}

	get previousFocusedNode(){
		return previousFocusedNode;
	}
}

let focusManager = new FocusManager();
let focusWatcher = 0;

function processNode(node){
	if(focusWatcher){
		clearTimeout(focusWatcher);
		focusWatcher = 0;
	}

	previousFocusedNode = focusedNode;
	focusedNode = node;
	if(previousFocusedNode === focusedNode){
		return;
	}

	// find the focused component, if any
	while(node && (!Component.get(node))){
		node = node.parentNode;
	}
	let focusedComponent_ = node && Component.get(node),
		stack = [];
	if(focusedComponent_){
		let p = focusedComponent_;
		while(p){
			stack.unshift(p);
			p = p.parent;
		}
	}

	let focusStack = focusedStack,
		newStackLength = stack.length,
		oldStackLength = focusStack.length,
		i = 0,
		j, component;
	while(i < newStackLength && i < oldStackLength && stack[i] === focusStack[i]){
		i++;
	}
	// [0..i-1] are identical in each stack


	// signal blur from the path end to the first identical component (not including the first identical component)
	for(j = i; j < oldStackLength; j++){
		component = focusStack.pop();
		component.bdOnBlur();
		focusManager.bdNotify({type: "blurComponent", component: component});
	}

	// signal focus for all new components that just gained the focus
	for(j = i; j < newStackLength; j++){
		focusStack.push(component = stack[j]);
		component.bdOnFocus();
		focusManager.bdNotify({type: "focusComponent", component: component});
	}

	previousFocusedComponent = focusedComponent;
	focusedComponent = focusedComponent_;
	focusManager.bdNotify({type: "focusedComponent", component: focusedComponent_});
}

connect(document.body, "focusin", function(e){
	let node = e.target;
	if(!node || node.parentNode == null || node === self[focusedNode]){
		return;
	}
	processNode(node);
});

// eslint-disable-next-line no-unused-vars
connect(document.body, "focusout", function(){
	// If the blur event isn't followed by a focus event, it means the user clicked on something unfocusable,
	// so clear focus.
	if(focusWatcher){
		clearTimeout(focusWatcher);
	}

	focusWatcher = setTimeout(function(){
		processNode(null);
	}, 5);
});

let viewportWatcher = new EventHub;

let scrollTimeoutHandle = 0;

// eslint-disable-next-line no-unused-vars
connect(window, "scroll", function(){
	if(scrollTimeoutHandle){
		clearTimeout(scrollTimeoutHandle);
	}
	scrollTimeoutHandle = setTimeout(function(){
		scrollTimeoutHandle = 0;
		viewportWatcher.bdNotify({type: "scroll"});
	}, 10);
}, true);


let resizeTimeoutHandle = 0;

// eslint-disable-next-line no-unused-vars
connect(window, "resize", function(){
	if(resizeTimeoutHandle){
		clearTimeout(resizeTimeoutHandle);
	}
	resizeTimeoutHandle = setTimeout(function(){
		resizeTimeoutHandle = 0;
		viewportWatcher.bdNotify({type: "resize"});
	}, 10);
}, true);


insPostProcessingFunction("bdReflect",
	function(prop, value){
		if(prop === null && value instanceof Object && !Array.isArray(value)){
			// e.g., bdReflect:{p1:"someProp", p2:[refObject, "someOtherProp", someFormatter]}
			return value;
		}else if (prop){
			// e.g., bdReflect_someProp: [refObject, ] prop [, someFormatter]
			return {[prop]: value};
		}else{
			// e.g., bdReflect: [refObject, ] prop [, someFormatter]
			return {innerHTML: value};
		}
	},
	function(ppfOwner, ppfTarget, props){
		// props is a hash from property in ppfTarget to a list of ([refObject, ] property, [, formatter])...
		let install, watchable;
		if(ppfTarget instanceof Component){
			install = function(destProp, refObject, prop, formatter){
				ppfOwner.ownWhileRendered((watchable = getWatchableRef(refObject, prop, formatter)));
				ppfTarget[destProp] = watchable.value;
				ppfOwner.ownWhileRendered(watchable.watch(newValue => {
					ppfTarget[destProp] = newValue;
				}));
			};
		}else{
			install = function(destProp, refObject, prop, formatter){
				ppfOwner.ownWhileRendered((watchable = getWatchableRef(refObject, prop, formatter)));
				setAttr(ppfTarget, destProp, watchable.value);
				ppfOwner.ownWhileRendered(watchable.watch(newValue => {
					setAttr(ppfTarget, destProp, newValue);
				}));
			};
		}

		Reflect.ownKeys(props).forEach(destProp => {
			let args = Array.isArray(props[destProp]) ? props[destProp].slice() : [props[destProp]];
			let refObject, prop;
			while(args.length){
				refObject = args.shift();
				if(typeof refObject === "string" || typeof refObject === "symbol"){
					prop = refObject;
					refObject = ppfOwner;
				}else{
					prop = args.shift();
				}
				install(destProp, refObject, prop, typeof args[0] === "function" ? args.shift() : null);
			}
		});
	}
);

insPostProcessingFunction("bdAdvise", true,
	function(ppfOwner, ppfTarget, listeners){
		Reflect.ownKeys(listeners).forEach(eventType => {
			let listener = listeners[eventType];
			if(typeof listener !== "function"){
				listener = ppfOwner[listener].bind(ppfOwner);
			}
			ppfOwner.ownWhileRendered(ppfTarget instanceof Component ? ppfTarget.advise(eventType, listener) : connect(ppfTarget, eventType, listener));
		});
	}
);
insPostProcessingFunction("bdAdvise", "bdOn");

function applyLengthWatchers(owner, newValue, oldValue){
	if(oldValue !== newValue){
		owner.children.forEach(child => {
			child.onMutateCollectionLength && child.onMutateCollectionLength(newValue, oldValue);
			child.bdMutateNotify("collectionLength", newValue, oldValue);
		});
	}
}

function updateChildren(collection, owner, oldLength){
	let children = owner.children;
	let newLength = collection.length;
	for(let i = 0, end = newLength; i < end; i++){
		let item = collection[i];
		let child, j = i, childrenCount = children.length;
		while(j < childrenCount && (child = children[j]) && child.collectionItem !== item) j++;
		if(j >= childrenCount){
			// new item
			owner.insChild(i);
		}else{
			if(j !== i){
				// moved child
				Component.insertNode(child.bdDom.root, child.bdDom.root.parentNode, i);
				children.splice(j, 1);
				children.splice(i, 0, child);
			}
			// child may have moved by inserting new children before it; therefore...
			child.collectionIndex = i;
		}
	}
	children.slice(newLength).forEach(child => owner.delChild(child));
	applyLengthWatchers(owner, newLength, oldLength);
}

function setSpliceAdvice(collection, owner){
	return collection.before("splice", () => {
		if(!owner.rendered){
			return;
		}
		let oldLength = collection.length;
		let holdSuspendWatchAdvise = owner.suspendWatchAdvise;
		owner.suspendWatchAdvise = true;
		return () => {
			owner.suspendWatchAdvise = holdSuspendWatchAdvise;
			updateChildren(collection, owner, oldLength);
		};
	});
}

function setShiftAdvice(collection, owner){
	return collection.before("shift", () => {
		if(!owner.rendered || !collection.length){
			return;
		}
		let holdSuspendWatchAdvise = owner.suspendWatchAdvise;
		owner.suspendWatchAdvise = true;
		return () => {
			owner.suspendWatchAdvise = holdSuspendWatchAdvise;
			let children = owner.children;
			owner.delChild(children[0]);
			let newLength = collection.length;
			let oldLength = newLength + 1;
			children.forEach((child, i) => (child.collectionIndex = i));
			applyLengthWatchers(owner, newLength, oldLength);
		};
	});
}

function setUnshiftAdvice(collection, owner){
	return collection.before("unshift", () => {
		if(!owner.rendered){
			return;
		}
		let oldLength = collection.length;
		let holdSuspendWatchAdvise = owner.suspendWatchAdvise;
		owner.suspendWatchAdvise = true;
		return () => {
			owner.suspendWatchAdvise = holdSuspendWatchAdvise;
			let newLength = collection.length;
			for(let i = 0, end = newLength - oldLength; i < end; i++){
				owner.insChild(i);
			}
			for(let children = owner.children, i = newLength - oldLength; i < newLength; i++){
				children[i].collectionIndex = i;
			}
			applyLengthWatchers(owner, newLength, oldLength);
		};
	});
}

function setReverseAdvice(collection, owner){
	return collection.before("reverse", () => {
		if(!owner.rendered){
			return;
		}
		let holdSuspendWatchAdvise = owner.suspendWatchAdvise;
		owner.suspendWatchAdvise = true;
		return () => {
			owner.suspendWatchAdvise = holdSuspendWatchAdvise;
			let children = owner.children;
			for(let i = children.length - 1; i >= 0; i--){
				let node = children[i].bdDom.root;
				node.parentNode.appendChild(node);
			}
			children.reverse();
			children.forEach((child, i) => child.collectionIndex = i);
		};
	});
}

function setSortAdvice(collection, owner){
	return collection.before("sort", () => {
		if(!owner.rendered){
			return;
		}
		let holdSuspendWatchAdvise = owner.suspendWatchAdvise;
		owner.suspendWatchAdvise = true;
		return () => {
			owner.suspendWatchAdvise = holdSuspendWatchAdvise;
			updateChildren(collection, owner, collection.length);
		};
	});
}

function setOrderAdvice(collection, owner){
	return collection.before("order", () => {
		if(!owner.rendered){
			return;
		}
		let holdSuspendWatchAdvise = owner.suspendWatchAdvise;
		owner.suspendWatchAdvise = true;
		return () => {
			owner.suspendWatchAdvise = holdSuspendWatchAdvise;
			updateChildren(collection, owner, collection.length);
		};
	});
}

class Collection extends Component {
	constructor(kwargs){
		super(kwargs);
		this.collection = kwargs.collection;
	}

	set collection(value){
		// always an array
		value = value || toWatchable([]);
		if(this.bdMutate("collection", "bdCollection", value)){
			this.bdSetupHandle && this.bdSetupHandle.destroy();

			if(this.rendered){
				let children = this.children;
				let collection = this.bdCollection;
				let oldLength = children.length;
				let newLength = collection.length;
				let mutateLength = oldLength !== newLength;
				for(let i = 0, end = Math.min(oldLength, newLength); i < end; i++){
					let child = children[i];
					child.collectionItem = collection[i];
					if(mutateLength){
						child.onMutateCollectionLength && child.onMutateCollectionLength(newLength, oldLength);
						child.bdMutateNotify("collectionLength", newLength, oldLength);
					}
				}
			}

			let collection = this.bdCollection;
			if(isWatchable(collection) && !this.kwargs.collectionIsScalars){
				let handles = [
					this.watch(this.bdCollection, "length", (newValue, oldValue) => {
						if(this.suspendWatchAdvise) return;
						if(this.rendered){
							this.bdSynchChildren();
							applyLengthWatchers(this, newValue, oldValue);
						}
					}),
					setSpliceAdvice(collection, this),
					setShiftAdvice(collection, this),
					setUnshiftAdvice(collection, this),
					setReverseAdvice(collection, this),
					setSortAdvice(collection, this),
					setOrderAdvice(collection, this)
				];
				let setupHandle = this.bdSetupHandle  = {
					destroy(){
						// multiple calls imply no-op
						setupHandle.destroy = () => 0;
						destroyAll(handles);
					}
				};
				this.own(setupHandle);
			}
		}
	}

	get collection(){
		return this.bdCollection;
	}

	render(proc){
		if(!this.bdDom){
			super.render();
			this.children = [];
			this.bdSynchChildren();
			proc && proc();
		}
		return this.bdDom.root;
	}

	insChild(collectionIndex){
		let child = new this.kwargs.childType({parent: this, collectionIndex: collectionIndex});
		Component.insertNode(child.render(), this.bdChildrenAttachPoint || this.bdDom.root, collectionIndex);
		this.children.splice(collectionIndex, 0, child);
		child.bdAttachToDoc(this.bdAttachedToDoc);
		return child;
	}

	bdSynchChildren(){
		let children = this.children;
		let collection = this.collection;
		while(children.length < collection.length){
			this.insChild(children.length);
		}
		while(children.length > collection.length){
			this.delChild(children[children.length - 1]);
		}
	}
}

let onMutateNames$1 = {};

function onMutateItemWatchable(propName, owner, newValue, oldValue){
	let procName = onMutateNames$1[propName];
	if(procName === undefined){
		if(typeof propName === "symbol"){
			return (onMutateNames$1[propName] = false);
		}
		procName = onMutateNames$1[propName] = "onMutate" + propName.substring(0, 1).toUpperCase() + propName.substring(1);
	}
	procName && owner[procName] && owner[procName](newValue, oldValue);
}

class CollectionChild extends Component {
	constructor(kwargs){
		super(kwargs);
		this._itemWatchHandles = [];
		this.bdParent = kwargs.parent;
		this.bdCollectionIndex = kwargs.collectionIndex;
		this.bdCollectionItem = kwargs.parent.collection[kwargs.collectionIndex];
		this.constructor.itemWatchables.forEach(prop => Object.defineProperty(this, prop, {
			enumerable: true,
			get: () => this.bdCollectionItem[prop]
		}));
		this._connectWatchers();
	}

	get collectionIndex(){
		// watchable
		return this.bdCollectionIndex;
	}

	set collectionIndex(newValue){
		if(newValue !== this.bdCollectionIndex){
			let oldValue = this.bdCollectionIndex;
			this.bdCollectionIndex = newValue;
			this.onMutateCollectionIndex && this.onMutateCollectionIndex(newValue, oldValue);
			this.bdMutateNotify("collectionIndex", newValue, oldValue);
			this._connectWatchers();
		}
	}

	get collectionLength(){
		// watchable iff the parent, like Collection, applies the watchers
		return this.parent.collection.length;
	}

	get collectionItem(){
		// watchable, see setter and _connectWatchers
		return this.bdCollectionItem;
	}

	set collectionItem(newValue){
		this._applyWatchers(newValue, this.bdCollectionItem);
		this.bdCollectionItem = newValue;
		this._connectWatchers();
	}

	_applyWatchers(newValue, oldValue){
		if(newValue !== oldValue){
			this.onMutateCollectionItem && this.onMutateCollectionItem(newValue, oldValue);
			this.bdMutateNotify("collectionItem", newValue, oldValue);
			this.constructor.itemWatchables.forEach(prop => {
				onMutateItemWatchable(prop, this, newValue[prop], oldValue[prop]);
				this.bdMutateNotify(prop, newValue[prop], oldValue[prop]);
			});
		}
	}

	_connectWatchers(){
		this._itemWatchHandles.forEach(h => h.destroy());
		let handles = this._itemWatchHandles = [];
		if(isWatchable(this.parent.collection)){
			let collectionItem = this.bdCollectionItem;
			handles.push(this.watch(this.parent.collection, this.collectionIndex, (newValue, oldValue, target, prop) => {
				if(this.parent.suspendWatchAdvise) return;
				if(prop.length === 1){
					// the whole item changed; therefore, reset the watch
					this._applyWatchers(newValue, oldValue);
					this._connectWatchers();
				}else{
					this.onMutateCollectionItem && this.onMutateCollectionItem(collectionItem, UNKNOWN_OLD_VALUE);
					this.bdMutateNotify("collectionItem", collectionItem, UNKNOWN_OLD_VALUE);
				}
			}));
			this.constructor.itemWatchables.forEach(prop =>
				handles.push(this.watch(collectionItem, prop, (newValue, oldValue, target, _prop) => {
					if(this.parent.suspendWatchAdvise) return;
					onMutateItemWatchable(prop, this, newValue, oldValue, target, _prop);
					this.bdMutateNotify(prop, newValue, oldValue);
				}))
			);
		}

	}
}

CollectionChild.itemWatchables = [];

CollectionChild.withWatchables = function(...args){
	let superclass = typeof args[0] === "function" ? args.shift() : CollectionChild;
	let itemWatchables = [];
	args = args.filter(prop => {
		let match = prop.match(/^item:(.+)/);
		if(match){
			itemWatchables = itemWatchables.concat(match[1].split(",").map(p => p.trim()).filter(p => !!p));
			return false;
		}
		return true;
	});
	let result = withWatchables(superclass, ...args);
	result.itemWatchables = itemWatchables;
	return result;
};

initialize(document, create, insert);

const version = "2.3.1";

export { element as e, version, insPostProcessingFunction, replacePostProcessingFunction, getPostProcessingFunction, Element, element, div, svg, destroyable, destroyAll, eventHub, EventHub, eqlComparators, eql, UNKNOWN_OLD_VALUE, STAR, OWNER, OWNER_NULL, PROP, silentSet, WatchableRef, getWatchableRef, watch, toWatchable, fromWatchable, watchHub, WatchHub, isWatchable, withWatchables, bind, biBind, initialize, Component, render, Collection, CollectionChild, getAttributeValueFromEvent, setAttr, getAttr, getComputedStyle, getStyle, getStyles, setStyle, setPosit, create, insert, hide, show, getPosit, getMaxZIndex, destroyDomChildren, destroyDomNode, connect, stopEvent, focusManager, viewportWatcher };
