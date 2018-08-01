const ppEvents = Symbol("EventHub-ppEvents");

function EventHub(superClass){
	if(!superClass){
		superClass = class {
		};
	}
	return class extends superClass {
		constructor(){
			super();
			Object.defineProperty(this, ppEvents, {value: {}});
		}

		// protected interface...
		_applyHandlers(e){
			let handlers;
			if(e instanceof Event){
				handlers = this[ppEvents][e.type];
			}else{
				if(!e.name){
					e = {name: e, target: this};
				}else{
					e.target = this;
				}
				handlers = this[ppEvents][e.name];
			}
			if(handlers){
				handlers.slice().forEach(handler => handler.handler(e));
			}
		}

		// public interface...
		advise(eventName, handler){
			if(!handler){
				let hash = eventName;
				Reflect.ownKeys(hash).map(key => this.advise(key, hash[key]));
			}else if(Array.isArray(eventName)){
				return eventName.map(name => this.advise(name, handler));
			}else{
				let handlers = this[ppEvents][eventName] || (this[ppEvents][eventName] = []),
					wrappedHandler = {handler: handler};
				handlers.push(wrappedHandler);
				return {
					destroy: () =>{
						let handlers = this[ppEvents][eventName];
						let index = handlers ? handlers.indexOf(wrappedHandler) : -1;
						if(index !== -1){
							handlers.splice(index, 1);
						}
					}
				}
			}
		}

		destroyAdvise(eventName){
			if(eventName){
				delete this[ppEvents][eventName];
			}else{
				let events = this[ppEvents];
				Reflect.ownKeys(events).forEach((key) =>{
					delete events[key];
				});
			}
		}
	};
}
EventHub.ppEvents = ppEvents;

let postProcessingSet = new Set();

function Element(type, ctorProps, ppProps, children){
	this.type = type;
	this.ctorProps = ctorProps;
	if(ctorProps.className){
		if(Array.isArray(ctorProps.className)){
			ctorProps.className = ctorProps.className.reduce((result, item) => item ? result + " " + item : result, "").replace(/\s{2,}/g, " ").trim();
		}else{
			ctorProps.className = ctorProps.className.replace(/\s{2,}/g, " ").trim();
		}
	}

	this.ppProps = ppProps;
	if(children.length === 1){
		this.children = children[0];
	}else if(children.length){
		this.children = children;
	}

	//TODO: should we freeze the object up?
}

function element(type, props = {}, ...children){
	if(type instanceof Element){
		// copy
		return new Element(type.type, type.ctorProps, type.ppProps, type.children);
	}

	// figure out if signature was actually element(type, child, [,child...])
	if(!props || props instanceof Element || Array.isArray(props) || typeof props === "string"){
		// props was actually a child
		children.unshift(props);
		props = {};
	}// else props is really props

	// the children can be falsey, single children (of type Element or string), or arrays of children of arbitrary depth; e.g.
	let flattenedChildren = [];
	function flatten(child){
		if(Array.isArray(child)){
			child.forEach((child)=>flatten(child));
		}else if(child){
			flattenedChildren.push(child);
		}
	}
	flatten(children);

	let ctorProps = {};
	let postProcessingProps = {};
	Reflect.ownKeys(props).forEach((k) =>{
		if(postProcessingSet.has(k)){
			postProcessingProps[k] = props[k];
		}else{
			ctorProps[k] = props[k];
		}
	});

	return new Element(type, ctorProps, postProcessingProps, flattenedChildren);
}

element.insPostProcessingFunction = function(name, func){
	if(element[name]){
		throw Error("duplicate postprocessing function name");
	}
	let symbol = Symbol("post-process-function-" + name);
	Object.defineProperty(element, name, {value: symbol, enumerable: true});
	Object.defineProperty(element, symbol, {value: func, enumerable: true});
	postProcessingSet.add(symbol);
};

const ppVariables = Symbol("WatchHub-ppVariables");

function WatchHub(superClass){
	if(!superClass){
		superClass = class {};
	}
	return class extends superClass {
		constructor(){
			super();
			Object.defineProperty(this, ppVariables, {value: {}});
		}

		// protected interface...
		_applyWatchersRaw(name, oldValue, newValue){
			let watchers = this[ppVariables][name];
			if(watchers){
				watchers.slice().forEach(w => w.watcher(newValue, oldValue, this));
			}
		}

		_applyWatchers(name, privateName, newValue){
			let oldValue = this[privateName];
			if(oldValue !== newValue){
				this[privateName] = newValue;
				this._applyWatchersRaw(name, oldValue, newValue);
				return true;
			}else{
				return false;
			}
		}

		// public interface...
		watch(name, watcher){
			if(!watcher){
				let hash = name;
				return Reflect.ownKeys(hash).map((name) => this.watch(name, hash[name]));
			}else if(Array.isArray(name)){
				return name.map((name)=>this.watch(name, watcher));
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
		}

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
	};
}

WatchHub.ppVariables = ppVariables;

element.insPostProcessingFunction("attach",
	function(target, source, resultIsDomNode, name){
		target[name] = source;
		target.ownWhileRendered({
			destroy: function(){
				delete target[name];
			}
		});
	}
);

element.insPostProcessingFunction("watch",
	function(target, source, resultIsDomNode, watchers){
		Reflect.ownKeys(watchers).forEach((name) =>{
			source.ownWhileRendered(source.watch(name, watchers[name]));
		});
	}
);

element.insPostProcessingFunction("applyMethod",
	function(target, source, resultIsDomNode, name, ...args){
		source[name](...args);
	}
);

element.insPostProcessingFunction("tabIndexNode",
	function(target, source){
		target._dom.tabIndexNode = source;
	}
);

element.insPostProcessingFunction("titleNode",
	function(target, source){
		target._dom.titleNode = source;
	}
);

element.insPostProcessingFunction("staticClassName",
	function(target, source, resultIsDomNode, className){
		target[ppStaticClassName] = className;
	}
);

element.insPostProcessingFunction("parentAttachPoint",
	function(target, source, resultIsDomNode, propertyName){
		// source should be a component instance and resultIsDomNode should be false
		source[ppParentAttachPoint] = propertyName;
	}
);

element.insPostProcessingFunction("childrenAttachPoint",
	function(target, source, resultIsDomNode, value){
		// source should be a DOM node and resultIsDomNode should be true
		if(value){
			target[ppChildrenAttachPoint] = source;
		}
	}
);

// private properties
const
	ppClassName = Symbol("bd-component-ppClassName"),
	ppStaticClassName = Symbol("bd-component-ppStaticClassName"),
	ppEnabled = Symbol("bd-component-ppEnabled"),
	ppTabIndex = Symbol("bd-component-ppTabIndex"),
	ppTitle = Symbol("bd-component-ppTitle"),
	ppParent = Symbol("bd-component-ppParent"),
	ppHasFocus = Symbol("bd-component-ppHasFocus"),
	ppOnFocus = Symbol("bd-component-ppOnFocus"),
	ppOnBlur = Symbol("bd-component-pponBlur"),
	ppSetClassName = Symbol("bd-component-ppSetClassName"),
	ppParentAttachPoint = Symbol("bd-component-ppParentAttachPoint"),
	ppChildrenAttachPoint = Symbol("bd-component-ppChildrenAttachPoint"),
	ppAttachedToDoc = Symbol("bd-component-ppAttachedToDoc"),
	ppOwnedHandles = Symbol("bd-component-ppOwnedHandles");

function cleanClassName(s){
	return s.replace(/\s{2,}/g, " ").trim();
}

function calcDomClassName(component){
	let rootStaticDomClass = component[ppStaticClassName];
	let className = component[ppClassName];
	if(rootStaticDomClass && className){
		return rootStaticDomClass + " " + className;
	}else{
		return rootStaticDomClass || className;
	}
}

const TypeDomNode = Symbol("dom-node");
const TypeTextNode = Symbol("text-node");
const TypeComponentNode = Symbol("component-node");

function componentType(element$$1){
	return element$$1 instanceof Element ?
		(typeof element$$1.type === "string" ? TypeDomNode : TypeComponentNode) :
		TypeTextNode;
}

function addChildToDomNode(parent, domNode, child, childType){
	if(childType === TypeComponentNode){
		let childDomRoot = child._dom.root;
		if(Array.isArray(childDomRoot)){
			childDomRoot.forEach((node) => Component.insertNode(node, domNode));
		}else{
			Component.insertNode(childDomRoot, domNode);
		}
		parent._adopt(child);
	}else{
		Component.insertNode(child, domNode);
	}
}

function validateElements(instance, elements){
	function error(){
		throw new Error("Illegal: root elements for a Component cannot be Components")
	}

	if(Array.isArray(elements)){
		elements.forEach((e) =>{
			if(componentType(e) !== TypeDomNode){
				error();
			}
		});
	}else{
		if(componentType(elements) !== TypeDomNode){
			error();
		}
	}
}

function postProcess(ppProps, owner, target, targetIsDomNode){
	Reflect.ownKeys(ppProps).forEach((ppProp) =>{
		let args = ppProps[ppProp];
		if(Array.isArray(args)){
			element[ppProp](owner, target, targetIsDomNode, ...args);
		}else{
			element[ppProp](owner, target, targetIsDomNode, args);
		}
	});
}

function pushHandles(dest, ...handles){
	handles.forEach(h =>{
		if(Array.isArray(h)){
			pushHandles(dest, ...h);
		}else if(h){
			dest.push(h);
		}
	});
}

function isComponentDerivedCtor(f){
	return f === Component || (f && isComponentDerivedCtor(Object.getPrototypeOf(f)));
}

class Component extends EventHub(WatchHub()) {
	constructor(kwargs){
		super(kwargs);

		this[ppHasFocus] = false;

		let saveKwargs = false;
		let theConstructor = this.constructor;
		if(theConstructor.saveKwargs !== false){
			kwargs = this.kwargs = Object.assign({}, kwargs);
			saveKwargs = true;
		}

		Object.defineProperty(this, "id", {value: kwargs.id, enumerable: true});
		saveKwargs && kwargs.id && delete kwargs.id;

		if(kwargs.staticClassName){
			this[ppStaticClassName] = kwargs.staticClassName + (theConstructor.className ? " " + theConstructor.className : "");
			if(saveKwargs) delete kwargs.staticClassName;
		}else if(theConstructor.className){
			this[ppStaticClassName] = theConstructor.className;
		}

		if(kwargs.className){
			this[ppClassName] = kwargs.className;
			if(saveKwargs) delete kwargs.className;
		}else{
			this[ppClassName] = "";
		}

		if(kwargs.tabIndex){
			this[ppTabIndex] = kwargs.tabIndex;
			if(saveKwargs) delete kwargs.tabIndex;
		}

		if(kwargs.title){
			this[ppTitle] = kwargs.title;
			if(saveKwargs) delete kwargs.title;
		}

		if(kwargs.enabled !== undefined){
			this[ppEnabled] = !!kwargs.enabled;
			if(saveKwargs) delete kwargs.enabled;
		}else{
			this[ppEnabled] = true;
		}

		if(kwargs.elements){
			if(typeof kwargs.elements === "function"){
				Object.defineProperty(this, "_elements", {value: kwargs.elements});
			}else{
				let _elements = (function(elements){
					return function(){
						return elements;
					};
				})(kwargs.elements);
				Object.defineProperty(this, "_elements", {value: _elements});
			}
			if(saveKwargs) delete kwargs.elements;
		}

		if(kwargs.postRender){
			this.postRender = kwargs.postRender;
			if(saveKwargs) delete kwargs.postRender;
		}
	}

	destroy(){
		this.unrender();
		this[ppOwnedHandles] && this[ppOwnedHandles].forEach(handle => handle.destroy());
		this.destroyWatch();
		this.destroyAdvise();
		delete this.kwargs;
		this.destroyed = true;
	}

	_renderElements(e){
		if(Array.isArray(e)){
			return e.map((e) => this._renderElements(e));
		}else if(e instanceof Element){
			const {type, ctorProps, ppProps, children} = e;
			let result;
			if(componentType(e) === TypeDomNode){
				let domNode = result = Component.createNode(type, ctorProps);
				postProcess(ppProps, this, domNode, true);
				if(children){
					let renderedChildren = this._renderElements(children);
					if(Array.isArray(renderedChildren)){
						renderedChildren.forEach((child, i) => addChildToDomNode(this, domNode, child, componentType(children[i])));
					}else{
						addChildToDomNode(this, domNode, renderedChildren, componentType(children));
					}
				}
			}else{
				let componentInstance = result = new type(ctorProps);
				componentInstance.render();
				postProcess(ppProps, this, componentInstance, false);
				if(children){
					let renderedChildren = this._renderElements(children);
					if(Array.isArray(renderedChildren)){
						renderedChildren.forEach((child) => result.insChild(child));
					}else{
						result.insChild(renderedChildren);
					}
				}
			}
			return result;
		}else{
			// e must be convertible to a string
			return document.createTextNode(e);
		}
	}

	render(
		proc // [function, optional] called after this class's render work is done, called in context of this
	){
		if(!this._dom){
			let dom = this._dom = {};
			let elements = this._elements();
			validateElements(this, elements);
			let root = dom.root = this._renderElements(elements);
			if(Array.isArray(root)){
				root.forEach((node) => Component.catalog.set(node, this));
			}else{
				Component.catalog.set(root, this);
				if(this.id){
					root.id = this.id;
				}
				this.addClassName(root.className);
				let className = calcDomClassName(this);
				if(className){
					root.className = className;

				}

				if(this[ppTabIndex] !== undefined){
					(this._dom.tabIndexNode || this._dom.root).tabIndex = this[ppTabIndex];
				}
				if(this[ppTitle] !== undefined){
					(this._dom.titleIndexNode || this._dom.root).title = this[ppTitle];
				}
			}
			if(this.postRender){
				this.ownWhileRendered(this.postRender());
			}
			proc && proc.call(this);
			this._applyWatchersRaw("rendered", false, true);
		}
		return this._dom.root;
	}

	_elements(){
		return element("div", {});
	}

	unrender(){
		if(this.rendered){
			if(this[ppParent]){
				this[ppParent].delChild(this, true);
			}

			if(this.children){
				this.children.slice().forEach((child) =>{
					child.destroy();
				});
			}
			delete this.children;

			let root = this._dom.root;
			if(Array.isArray(root)){
				root.forEach((node) =>{
					Component.catalog.delete(node);
					node.parentNode && node.parentNode.removeChild(node);
				});
			}else{
				Component.catalog.delete(root);
				root.parentNode && root.parentNode.removeChild(root);
			}
			if(this._dom.handles){
				this._dom.handles.forEach(handle => handle.destroy());
			}
			delete this._dom;
			this._attachToDoc(false);
			this._applyWatchersRaw("rendered", true, false);
		}
	}

	get rendered(){
		return !!(this._dom && this._dom.root);
	}

	own(...handles){
		pushHandles(this[ppOwnedHandles] || (this[ppOwnedHandles] = []), ...handles);
	}

	ownWhileRendered(...handles){
		pushHandles(this._dom.handles || (this._dom.handles = []), ...handles);
	}

	get parent(){
		return this[ppParent];
	}

	_setParent(parent){
		if(this._applyWatchers("parent", ppParent, parent)){
			if(parent){
				let root = parent._dom.root;
				this._attachToDoc(document.body.contains(Array.isArray(root) ? root[0] : root));
			}else{
				this._attachToDoc(false);
			}
		}
	}

	_adopt(child){
		if(child[ppParent]){
			throw new Error("unexpected");
		}
		(this.children || (this.children = [])).push(child);
		child._setParent(this);
	}


	_attachToDoc(value){
		if(this._applyWatchers("attachedToBody", ppAttachedToDoc, !!value)){
			this.children && this.children.forEach(child => child._attachToDoc(value));
			return true;
		}else{
			return false;
		}
	}

	get attachedToDoc(){
		return !!this[ppAttachedToDoc];
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
			if(componentType(src) !== TypeComponentNode){
				src = element(Component, {elements: src});
			}
			child = this._renderElements(src);
		}

		if(/before|after|replace|only|first|last/.test(attachPoint) || typeof attachPoint === "number"){
			position = attachPoint;
			attachPoint = 0;
		}

		if(attachPoint){
			if(attachPoint in this){
				// node reference
				attachPoint = this[attachPoint];
			}else if(position!==undefined){
				// attachPoint must be a child Component
				let index = this.children ? this.children.indexOf(attachPoint) : -1;
				if(index !== -1){
					// attachPoint is a child
					attachPoint = attachPoint._dom.root;
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
		}else if(child[ppParentAttachPoint]){
			if(child[ppParentAttachPoint] in this){
				attachPoint = this[child[ppParentAttachPoint]];
			}else{
				throw new Error("unexpected");
			}
		}else{
			attachPoint = this[ppChildrenAttachPoint] || this._dom.root;
			if(Array.isArray(attachPoint)){
				throw new Error("unexpected");
			}
		}

		let childRoot = child._dom.root;
		if(Array.isArray(childRoot)){
			let firstChildNode = childRoot[0];
			unrender(Component.insertNode(firstChildNode, attachPoint, position));
			childRoot.slice(1).reduce((prevNode, node) =>{
				Component.insertNode(node, prevNode, "after");
				return node;
			}, firstChildNode);
		}else{
			unrender(Component.insertNode(childRoot, attachPoint, position));
		}

		this._adopt(child);
		return child;
	}

	delChild(child, preserve){
		let index = this.children ? this.children.indexOf(child) : -1;
		if(index !== -1){
			let root = child._dom && child._dom.root;
			let removeNode = (node) =>{
				node.parentNode && node.parentNode.removeChild(node);
			};
			Array.isArray(root) ? root.forEach(removeNode) : removeNode(root);
			child._setParent(null);
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
		let node = this.children[0]._dom.root.parentNode;

		children.forEach((child, i) =>{
			if(thisChildren[i] !== child){
				let index = thisChildren.indexOf(child, i + 1);
				thisChildren.splice(index, 1);
				node.insertBefore(child._dom.root, thisChildren[i]._dom.root);
				thisChildren.splice(i, 0, child);
			}
		});
	}


	get className(){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT returned
		if(this.rendered){
			// if rendered, then look at what's actually in the document...maybe client code _improperly_ manipulated directly
			let root = this._dom.root;
			if(Array.isArray(root)){
				root = root[0];
			}
			let className = root.className;
			if(this[ppStaticClassName]){
				this[ppStaticClassName].split(" ").forEach(s => className = className.replace(s, ""));
			}
			return cleanClassName(className);
		}else{
			return this[ppClassName];
		}
	}

	set className(value){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT affected

		// clean up any space sloppiness, sometimes caused by client-code algorithms that manipulate className
		value = cleanClassName(value);
		if(!value){
			if(this[ppClassName]){
				this[ppSetClassName]("", this[ppClassName]);
			}
		}else if(!this[ppClassName]){
			this[ppSetClassName](value, "");
		}else{
			if(value !== this[ppClassName]){
				this[ppSetClassName](value, this[ppClassName]);
			}
		}
	}

	containsClassName(value){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT considered

		value = cleanClassName(value);
		return this[ppClassName].indexOf(value) !== -1;
	}

	addClassName(...values){
		values.forEach((value) =>{
			value = cleanClassName(value);
			if(this[ppClassName].indexOf(value) === -1){
				this[ppSetClassName]((this[ppClassName] ? this[ppClassName] + " " : "") + value, this[ppClassName]);
			}
		});
		return this;
	}

	removeClassName(...values){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT considered
		values.forEach((value) =>{
			value = cleanClassName(value);
			if(this[ppClassName].indexOf(value) !== -1){
				this[ppSetClassName](this[ppClassName].replace(value, ""), this[ppClassName]);
			}
		});
		return this;
	}

	toggleClassName(...values){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT considered
		values.forEach((value) =>{
			value = cleanClassName(value);
			if(this[ppClassName].indexOf(value) !== -1){
				this[ppSetClassName](this[ppClassName].replace(value, ""), this[ppClassName]);
			}else{
				this[ppSetClassName](this[ppClassName] + " " + value, this[ppClassName]);
			}
		});
		return this;
	}

	[ppSetClassName](newValue, oldValue){
		newValue = cleanClassName(newValue);
		this[ppClassName] = newValue;
		if(this.rendered){
			this._dom.root.className = calcDomClassName(this);
		}
		this._applyWatchersRaw("className", oldValue, newValue);
		let oldVisibleValue = oldValue ? oldValue.indexOf("hidden") === -1 : true,
			newVisibleValue = newValue ? newValue.indexOf("hidden") === -1 : true;
		if(oldVisibleValue !== newVisibleValue){
			this._applyWatchersRaw("visible", oldVisibleValue, newVisibleValue);
		}
	}

	[ppOnFocus](){
		this.addClassName("bd-focused");
		this._applyWatchers("hasFocus", ppHasFocus, true);
	}

	[ppOnBlur](){
		this.removeClassName("bd-focused");
		this._applyWatchers("hasFocus", ppHasFocus, false);
	}

	get hasFocus(){
		return this[ppHasFocus];
	}

	get tabIndex(){
		if(this.rendered){
			// unconditionally make sure this[ppTabIndex] and the dom is synchronized on each get
			return (this[ppTabIndex] = (this._dom.tabIndexNode || this._dom.root).tabIndex);
		}else{
			return this[ppTabIndex]
		}
	}

	set tabIndex(value){
		if(value !== this[ppTabIndex]){
			this.rendered && ((this._dom.tabIndexNode || this._dom.root).tabIndex = value);
			this._applyWatchers("tabIndex", ppTabIndex, value);
		}
	}

	get enabled(){
		return this[ppEnabled];
	}

	set enabled(value){
		if(this._applyWatchers("enabled", ppEnabled, !!value)){
			this[value ? "removeClassName" : "addClassName"]("bd-disabled");
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
			this._applyWatchersRaw("visible", !value, value);
		}
	}

	get title(){
		if(this.rendered){
			return (this._dom.titleNode || this._dom.root).title;
		}else{
			return this[ppTitle];
		}
	}

	set title(value){
		if(this._applyWatchers("title", ppTitle, value)){
			this.rendered && ((this._dom.titleNode || this._dom.root).title = value);
		}
	}
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
	//     => isComponentDerivedCtor(e.type), then render e.type(e.props); render Component({elements:e})
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
			return {src: element(arg1)};
		}else{
			// more than one argument; the second argument is either props or not
			if(Object.getPrototypeOf(arg2) === prototypeOfObject){
				// [4] or [6]
				// WARNING: this signature requires kwargs to be a plain Javascript Object (which is should be!)
				return {src: element(arg1, arg2), attachPoint: arg3, position: arg4};
			}else{
				// [5]
				return {src: element(arg1), attachPoint: arg2, position: arg3};
			}
		}
	}
}

function unrender(node){
	function unrender_(node){
		let component = Component.catalog.get(node);
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
		if(componentType(src) === TypeComponentNode){
			result = new src.type(src.ctorProps);
		}else{
			result = new Component({elements: src});
		}
		result.render();
	}else{ // src instanceof Component
		result = src;
		result.render();
	}

	if(attachPoint){
		let root = result._dom.root;
		if(Array.isArray(root)){
			let firstChildNode = root[0];
			unrender(Component.insertNode(firstChildNode, attachPoint, position));
			root.slice(1).reduce((prevNode, node) =>{
				Component.insertNode(node, prevNode, "after");
				return node;
			}, firstChildNode);
		}else{
			unrender(Component.insertNode(root, attachPoint, position));
		}
		result._attachToDoc(document.body.contains(attachPoint));
	}
	return result;
}

Object.assign(Component, {
	ppClassName: ppClassName,
	ppStaticClassName: ppStaticClassName,
	ppEnabled: ppEnabled,
	ppTabIndex: ppTabIndex,
	ppTitle: ppTitle,
	ppParent: ppParent,
	ppHasFocus: ppHasFocus,
	ppOnFocus: ppOnFocus,
	ppOnBlur: ppOnBlur,
	ppSetClassName: ppSetClassName,
	ppOwnedHandles: ppOwnedHandles,
	ppParentAttachPoint: ppParentAttachPoint,
	ppChildrenAttachPoint: ppChildrenAttachPoint,
	ppAttachedToDoc: ppAttachedToDoc,
	catalog: new Map(),
	render: render
});

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

function setAttr(node, name, value){
	if(arguments.length === 2){
		let hash = name;
		Object.keys(hash).forEach(name =>{
			setAttr(node, name, hash[name]);
		});
	}else{
		if(name === "style"){
			setStyle(node, value);
		}else if(name in node){
			node[name] = value;
		}else{
			node.setAttribute(name, value);
		}
	}
}

let lastComputedStyleNode = 0;
let lastComputedStyle = 0;

function getComputedStyle_(node){
	if(lastComputedStyleNode !== node){
		lastComputedStyle = window.getComputedStyle((lastComputedStyleNode = node));
	}
	return lastComputedStyle;
}

function getStyle(node, property){
	if(lastComputedStyleNode !== node){
		lastComputedStyle = window.getComputedStyle((lastComputedStyleNode = node));
	}
	let result = lastComputedStyle[property];
	return (typeof result === "string" && /px$/.test(result)) ? parseFloat(result) : result;
}

function getStyles(node, ...styleNames){
	if(lastComputedStyleNode !== node){
		lastComputedStyle = window.getComputedStyle((lastComputedStyleNode = node));
	}

	let styles = [];
	styleNames.forEach((p) =>{
		if(Array.isArray(p)){
			styles = styles.concat(p);
		}else if(typeof p === "string"){
			styles.push(p);
		}else{
			Object.keys(p).forEach((p) => styles.push(p));
		}
	});

	let result = {};
	styles.forEach((property) =>{
		let result = lastComputedStyle[property];
		result[property] = (typeof result === "string" && /px$/.test(result)) ? parseFloat(result) : result;
	});
	return result;
}

function setStyle(node, property, value){
	if(arguments.length === 2){
		if(typeof property === "string"){
			node.style = property;
		}else{
			let hash = property;
			Object.keys(hash).forEach(property =>{
				node.style[property] = hash[property];
			});
		}
	}else{
		node.style[property] = value;
	}
}

function getPosit(target){
	let result = normalizeNodeArg(target).getBoundingClientRect();
	result.t = result.top;
	result.b = result.bottom;
	result.l = result.left;
	result.r = result.right;
	result.h = result.height;
	result.w = result.width;
	return result;
}

function setPosit(node, posit){
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
	if(position===undefined || position === "last"){
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
		case "only":
			let result = [];
			while(refNode.firstChild){
				result.push(refNode.removeChild(refNode.firstChild));
			}
			refNode.appendChild(node);
			return result;
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
	let result = document.createElement(tag);
	if(props){
		for(let p in props){
			setAttr(result, p, props[p]);
		}
	}
	return result;
}

function normalizeNodeArg(arg){
	return (arg._dom && arg._dom.root) || (typeof arg === "string" && document.getElementById(arg)) || arg;
}

const DATA_BD_HIDE_SAVED_VALUE = "data-bd-hide-saved-value";

function hide(...nodes){
	nodes.forEach((node) =>{
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
	nodes.forEach((node) =>{
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
		cs = node && node.nodeType === 1 && getComputedStyle_(node);
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

element.insPostProcessingFunction("advise",
	function(target, source, resultIsDomNode, listeners){
		Reflect.ownKeys(listeners).forEach((name) =>{
			let listener = listeners[name];
			target.ownWhileRendered(resultIsDomNode ? connect(source, name, listener) : source.advise(name, listener));
		});
	}
);

let focusedComponent = null,
	focusedNode = null,
	focusedStack = [],
	previousFocusedComponent = null,
	previousFocusedNode = null;

class FocusManager extends EventHub() {
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
const ppOnFocus$1 = Component.ppOnFocus;
const ppOnBlur$1 = Component.ppOnBlur;

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
	let catalog = Component.catalog;
	while(node && (!catalog.has(node))){
		node = node.parentNode;
	}
	let focusedComponent_ = node && catalog.get(node),
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
		component[ppOnBlur$1]();
		focusManager._applyHandlers({name: "blurComponent", component: component});
	}

	// signal focus for all new components that just gained the focus
	for(j = i; j < newStackLength; j++){
		focusStack.push(component = stack[j]);
		component[ppOnFocus$1]();
		focusManager._applyHandlers({name: "focusComponent", component: component});
	}

	previousFocusedComponent = focusedComponent;
	focusedComponent = focusedComponent_;
	focusManager._applyHandlers({name: "focusedComponent", component: focusedComponent_});
}

connect(document.body, "focusin", function(e){
	let node = e.target;
	if(!node || node.parentNode == null || node === self[focusedNode]){
		return;
	}
	processNode(node);
});

connect(document.body, "focusout", function(e){
	// If the blur event isn't followed by a focus event, it means the user clicked on something unfocusable,
	// so clear focus.
	if(focusWatcher){
		clearTimeout(focusWatcher);
	}

	focusWatcher = setTimeout(function(){
		processNode(null);
	}, 5);
});

let viewportWatcher = new (EventHub());

let scrollTimeoutHandle = 0;
connect(window, "scroll", function(e){
	if(scrollTimeoutHandle){
		clearTimeout(scrollTimeoutHandle);
	}
	scrollTimeoutHandle = setTimeout(function(){
		scrollTimeoutHandle = 0;
		viewportWatcher._applyHandlers({name: "scroll"});
	}, 10);
}, true);


let resizeTimeoutHandle = 0;
connect(window, "resize", function(e){
	if(resizeTimeoutHandle){
		clearTimeout(resizeTimeoutHandle);
	}
	resizeTimeoutHandle = setTimeout(function(){
		resizeTimeoutHandle = 0;
		viewportWatcher._applyHandlers({name: "resize"});
	}, 10);
}, true);

Component.createNode = create;
Component.insertNode = insert;

function version(){
	return "2.2.1";
}

export { Component, version, element as e, Element, EventHub, WatchHub, render, getAttributeValueFromEvent, setAttr, getStyle, getStyles, setStyle, setPosit, create, insert, hide, show, getPosit, getMaxZIndex, destroyDomChildren, destroyDomNode, connect, stopEvent, focusManager, viewportWatcher };
