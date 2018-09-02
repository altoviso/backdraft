const ppVariables = Symbol("WatchHub-ppVariables");

function mutate(owner, name, privateName, newValue){
	let oldValue = owner[name];
	if(!newValue || !oldValue ? newValue !== oldValue : (newValue.eq ? !newValue.eq(oldValue) : (oldValue.eq ? !oldValue.eq(newValue) : newValue !== oldValue))){
		if(privateName in owner){
			owner[privateName] = newValue;
		}else{
			Object.defineProperty(owner, privateName, {writable: true, value: newValue});
		}
		return [name, oldValue, newValue];
	}else{
		return false;
	}
}

export default function WatchHub(superClass){
	if(!superClass){
		superClass = class {
		};
	}
	return class extends superClass {
		constructor(){
			super();
		}

		// protected interface...
		_applyWatchersRaw(name, oldValue, newValue){
			let watchers;
			if(this[ppVariables] && (watchers = this[ppVariables][name])){
				watchers.slice().forEach(w => w.watcher(newValue, oldValue, this));
			}
		}

		_applyWatchers(name, privateName, newValue){
			if(arguments.length > 3){
				let i = 0;
				let results = [];
				while(i < arguments.length){
					results.push(mutate(this, arguments[i++], arguments[i++], arguments[i++]));
				}
				for(const p of results) p && this._applyWatchersRaw(...p);
			}else{
				let result = mutate(this, name, privateName, newValue);
				result && this._applyWatchersRaw(...result);
			}
		}

		// public interface...
		watch(name, watcher){
			if(!this[ppVariables]){
				Object.defineProperty(this, ppVariables, {value: {}, configurable:true});
			}
			if(!watcher){
				let hash = name;
				return Reflect.ownKeys(hash).map((name) => this.watch(name, hash[name]));
			}else if(Array.isArray(name)){
				return name.map((name) => this.watch(name, watcher));
			}else{
				let watchers = this[ppVariables][name] || (this[ppVariables][name] = []);
				let wrappedwatcher = {watcher: watcher};
				watchers.push(wrappedwatcher);
				return {
					destroy: () => {
						let watchers = this[ppVariables][name];
						let index = watchers ? watchers.indexOf(wrappedwatcher) : -1;
						if(index !== -1){
							watchers.splice(index, 1);
						}
					}
				};
			}
		}

		destroyWatch(name){
			if(this[ppVariables]){
				if(name){
					delete this[ppVariables][name];
				}else{
					delete this[ppVariables];
				}
			}
		}
	};
}

WatchHub.ppVariables = ppVariables;



