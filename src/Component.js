import {default as element, Element} from "./element.js";
import EventHub from "./EventHub.js";
import WatchHub from "./WatchHub.js";

element.insPostProcessingFunction("attach",
	function(target, source, resultIsDomNode, name){
		if(typeof name === "function"){
			name(source);
		}else{
			target[name] = source;
			target.ownWhileRendered({
				destroy: function(){
					delete target[name];
				}
			});
		}
	}
);

element.insPostProcessingFunction("watch",
	function(target, source, resultIsDomNode, watchers){
		Reflect.ownKeys(watchers).forEach((name) => {
			source.ownWhileRendered(source.watch(name, watchers[name]));
		});
	}
);

element.insPostProcessingFunction("exec",
	function(target, source, resultIsDomNode, ...args){
		for(let i = 0; i < args.length;){
			let f = args[i++];
			if(typeof f === "function"){
				f(target, source);
			}else if(typeof f === "string"){
				if(!(typeof source[f] === "function")){
					// eslint-disable-next-line no-console
					console.error("unexpected");
				}
				if(i < args.length && Array.isArray(args[i])){
					source[f](...args[i++], target, source);
				}else{
					source[f](target, source);
				}
			}else{
				// eslint-disable-next-line no-console
				console.error("unexpected");
			}
		}
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

element.insPostProcessingFunction("reflectClassPart",
	function(target, source, resultIsDomNode, ...args){
		// possibly many of the following sequences....
		// <string>
		// <string>, <formatter>
		// <watchable>
		//
		// note that <watchable>, <formatter> works, but should not be used and is not guaranteed; instead, ensure
		// that any required formatter is built into the watchable
		function install(prop, formatter){
			let watcher = formatter ?
				(newValue, oldValue) => {
					newValue = formatter(newValue);
					oldValue = formatter(oldValue);
					newValue !== oldValue && target.removeClassName(oldValue).addClassName(newValue);
				} :
				(newValue, oldValue) => {
					newValue !== oldValue && target.removeClassName(oldValue).addClassName(newValue);
				};
			if(typeof prop === "string"){
				target.addClassName(formatter ? formatter(target[prop]) : target[prop]);
				target.ownWhileRendered(target.watch(prop, watcher));
			}else{
				target.addClassName(prop.value);
				target.ownWhileRendered(prop.watch(watcher));
			}
		}

		while(args.length){
			install(args.shift(), typeof args[0] === "function" ? args.shift() : null);
		}
	}
);

element.insPostProcessingFunction("reflect",
	function(target, source, resultIsDomNode, prop, formatter){
		// <string>
		// <string>, <formatter>
		// <watchable>
		let p = source.tagName === "INPUT" ? "value" : "innerHTML";
		if(typeof prop === "string"){
			source[p] = formatter ? formatter(target[prop]) : target[prop];
			let watcher = formatter ?
				newValue => {
					source[p] = formatter(newValue);
				} :
				newValue => {
					source[p] = newValue;
				};
			target.ownWhileRendered(target.watch(prop, watcher));
		}else{
			source[p] = prop.value;
			target.ownWhileRendered(prop.watch(newValue => (source[p] = newValue)));
		}
	}
);

element.insPostProcessingFunction("reflectProp",
	function(target, source, resultIsDomNode, props){
		// props is a hash from property to one of...
		//     <string>
		//     <string>, <formatter>
		//     <watchable>
		Object.keys(props).forEach(destProp => {
			let srcProp = props[destProp];
			let formatter = null;
			if(Array.isArray(srcProp)){
				formatter = srcProp[1];
				srcProp = srcProp[0];
			}
			if(typeof srcProp === "string"){
				source[destProp] = formatter ? formatter(target[srcProp]) : target[srcProp];
				let watcher = formatter ?
					(newValue) => {
						source[destProp] = formatter(newValue);
					} :
					(newValue) => {
						source[destProp] = newValue;
					};
				target.ownWhileRendered(target.watch(srcProp, watcher));
			}else{
				source[destProp] = srcProp.value;
				target.ownWhileRendered(srcProp.watch(newValue => (source[destProp] = newValue)));
			}
		});
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

function conditionClassNameArgs(args){
	return args.reduce((acc, item) => {
		return acc.concat(item.split(" ").map(s => s.trim()).filter(s => !!s));
	}, []);
}

function classValueToRegExp(v, args){
	return v instanceof RegExp ? v : RegExp(" " + v + " ", args);
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

function componentType(element){
	return element instanceof Element ?
		(typeof element.type === "string" ? TypeDomNode : TypeComponentNode) :
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
		throw new Error("Illegal: root elements for a Component cannot be Components");
	}

	if(Array.isArray(elements)){
		elements.forEach((e) => {
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
	Reflect.ownKeys(ppProps).forEach((ppProp) => {
		let args = ppProps[ppProp];
		if(Array.isArray(args)){
			element[ppProp](owner, target, targetIsDomNode, ...args);
		}else{
			element[ppProp](owner, target, targetIsDomNode, args);
		}
	});
}

function pushHandles(dest, ...handles){
	handles.forEach(h => {
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

export default class Component extends EventHub(WatchHub()) {
	constructor(kwargs){
		super(kwargs);

		this[ppHasFocus] = false;

		let saveKwargs = false;
		let theConstructor = this.constructor;
		if(theConstructor.saveKwargs !== false){
			kwargs = this.kwargs = Object.assign({}, kwargs);
			saveKwargs = true;
		}

		// id, if provided, is read-only
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

				if(this._dom.tabIndexNode){
					if(this[ppTabIndex] === undefined){
						this[ppTabIndex] = this._dom.tabIndexNode.tabIndex;
					}else{
						this._dom.tabIndexNode.tabIndex = this[ppTabIndex];
					}
				}else if(this[ppTabIndex] !== undefined){
					(this._dom.tabIndexNode || this._dom.root).tabIndex = this[ppTabIndex];
				}
				if(this[ppTitle] !== undefined){
					(this._dom.titleNode || this._dom.root).title = this[ppTitle];
				}

				this[this[ppEnabled] ? "removeClassName" : "addClassName"]("bd-disabled");
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
				this.children.slice().forEach((child) => {
					child.destroy();
				});
			}
			delete this.children;

			let root = this._dom.root;
			if(Array.isArray(root)){
				root.forEach((node) => {
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
		child._attachToDoc(this[ppAttachedToDoc]);
	}

	_attachToDoc(value){
		if(this._applyWatchers("attachedToDoc", ppAttachedToDoc, !!value)){
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
			}else if(position !== undefined){
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
			childRoot.slice(1).reduce((prevNode, node) => {
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
			let removeNode = (node) => {
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

		children.forEach((child, i) => {
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
			this[ppSetClassName]("", this[ppClassName]);
		}else if(!this[ppClassName]){
			this[ppSetClassName](value, "");
		}else if(value !== this[ppClassName]){
			this[ppSetClassName](value, this[ppClassName]);
		}
	}

	containsClassName(value){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT considered

		value = cleanClassName(value);
		return (" " + this[ppClassName] + " ").indexOf(value) !== -1;
	}

	addClassName(...values){
		this[ppSetClassName](conditionClassNameArgs(values).reduce((className, value) => {
			if(!value){
				return className;
			}
			return classValueToRegExp(value).test(className) ? className : className + value + " ";
		}, " " + this[ppClassName] + " ").trim(), this[ppClassName]);
		return this;
	}

	removeClassName(...values){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT considered
		this[ppSetClassName](conditionClassNameArgs(values).reduce((className, value) => {
			if(!value){
				return className;
			}
			return className.replace(classValueToRegExp(value, "g"), " ");
		}, " " + this[ppClassName] + " ").trim(), this[ppClassName]);
		return this;
	}

	toggleClassName(...values){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT considered
		this[ppSetClassName](conditionClassNameArgs(values).reduce((className, value) => {
			if(!value){
				return className;
			}
			if(classValueToRegExp(value).test(className)){
				return className.replace(classValueToRegExp(value, "g"), " ");
			}else{
				return className + value + " ";
			}
		}, " " + this[ppClassName] + " ").trim(), this[ppClassName]);
		return this;
	}

	[ppSetClassName](newValue, oldValue){
		if(newValue !== oldValue){
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
			return this[ppTabIndex];
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

export function render(...args){
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
			root.slice(1).reduce((prevNode, node) => {
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
