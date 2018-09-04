const listenerCatalog = new WeakMap();

export default function EventHub(superClass){
	if(!superClass){
		superClass = class {
		};
	}
	return class extends superClass {
		constructor(){
			super();
		}

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
					console.warn("event.name is deprecated; use event.type");
					handlers = events[e.name];
					e.type = e.name;
					e.target = this;
				}
			}

			if(handlers){
				handlers.slice().forEach(handler => handler(e));
			}
		}

		// public interface...
		advise(eventName, handler){
			if(!handler){
				let hash = eventName;
				Reflect.ownKeys(hash).map(key => this.advise(key, hash[key]));
			}else{
				let events = listenerCatalog.get(this);
				if(!events){
					listenerCatalog.set(this, (events = {}))
				}

				let handlers = events[eventName] || (events[eventName] = []);
				handlers.push(handler);
				return {
					destroy(){
						let index = handlers.indexOf(handler);
						if(index !== -1){
							handlers.splice(index, 1);
						}
					}
				};
			}
		}

		destroyAdvise(eventName){
			let events = listenerCatalog.get(this);
			if(!events){
				return;
			}
			if(eventName){
				delete events[eventName];
			}else{
				listenerCatalog.delete(this);
			}
		}
	};
}
