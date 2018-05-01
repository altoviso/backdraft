const ppVariables = Symbol("WatchHub-ppVariables");

export default function WatchHub(){
	// a class that advises watchers on property value changes
	Object.defineProperty(this, ppVariables, {value: {}});
}
WatchHub.ppVariables = ppVariables;

Object.assign(WatchHub.prototype, {
	// protected interface...
	_applyWatchersRaw(name, oldValue, newValue){
		let watchers = this[ppVariables][name];
		if(watchers){
			watchers.slice().forEach(w => w.watcher(newValue, oldValue, this));
		}
	},

	_applyWatchers(name, privateName, newValue){
		let oldValue = this[privateName];
		if(oldValue !== newValue){
			this[privateName] = newValue;
			this._applyWatchersRaw(name, oldValue, newValue);
		}
	},

	// public interface...
	watch(name, watcher){
		if(!watcher){
			let hash = name;
			return Reflect.ownKeys(hash).map((name) => this.watch(name, hash[name]));
		}else{
			let watchers = this[ppVariables][name] || (this[ppVariables][name] = []);
			let wrappedwatcher = {watcher: watcher};
			watchers.push(wrappedwatcher);
			return {
				destroy: () =>{
					let watchers = this[ppVariables][name];
					let index = watchers ? watchers.indexOf(wrappedwatcher) : -1;
					if(index !== -1){
						watchers.splice(index, 1);
					}
				}
			}
		}
	},

	destroyWatch(name){
		if(name){
			delete this[ppVariables][name];
		}else{
			let watches = this[ppVariables];
			Reflect.ownKeys(watches).forEach((key) =>{
				delete watches[key];
			});
		}
	}
});


