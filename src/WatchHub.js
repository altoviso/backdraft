const watcherCatalog = new WeakMap();

class Watchable {
	constructor(owner, prop, formatter){
		this.owner = owner;
		this.prop = prop;
		this.handles = [];
		formatter && (this.formatter = formatter);
	}

	destroy(){
		// explicit destruction
		this.handles.forEach(h => h.destroy());
	}

	get value(){
		return this.formatter ? this.formatter(this.owner[this.prop]) : this.owner[this.prop];
	}

	watch(watcher){
		let formatterWatcher;
		if(this.formatter){
			formatterWatcher = (newValue, oldValue, src) => watcher(this.formatter(newValue), this.formatter(oldValue), src);
		}
		let h = this.owner.watch(this.prop, formatterWatcher || watcher);
		this.handles.push(h);
		return h
	}
}


function mutate(owner, name, privateName, newValue){
	let oldValue = owner[name];
	let notEq;
	if(!oldValue){
		notEq = newValue !== oldValue;
	}else if(newValue){
		if(newValue.eq){
			notEq = !newValue.eq(oldValue);
		}else if(oldValue.eq){
			notEq = !oldValue.eq(newValue);
		}else{
			notEq = newValue !== oldValue;
		}
	}else{
		notEq = true;
	}

	if(notEq){
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
						watchers.slice().forEach(w => w(newValue, oldValue, this));
					}
				}
				if(doStar){
					let watchers = variables["*"];
					watchers.slice().forEach(w => w(this));
				}
			}else{
				let watchers = variables[name];
				if(watchers){
					watchers.slice().forEach(w => w(newValue, oldValue, this));
				}
				watchers = variables["*"];
				if(watchers){
					watchers.slice().forEach(w => w(this));
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
				this.bdMutateNotify(results);
			}else{
				let result = mutate(this, name, privateName, newValue);
				if(result){
					this.bdMutateNotify(...result);
					return true;
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
			}else if(Array.isArray(name)){
				return name.map((name) => this.watch(name, watcher));
			}else{
				let watchers = variables[name] || (variables[name] = []);
				watchers.push(watcher);
				return {
					destroy: () => {
						let index = watchers.indexOf(watcher);
						if(index !== -1){
							watchers.splice(index, 1);
						}
					}
				};
			}
		}

		destroyWatch(name){
			let variables = watcherCatalog.get(this);
			if(variables){
				if(name){
					delete variables[name];
				}else{
					watcherCatalog.delete(this);
				}
			}
		}

		getWatchable(name, formatter){
			return new Watchable(this, name, formatter);
		}
	};
}

WatchHub.Watchable = Watchable;



