let postProcessingSet = new Set();

export function Element(type, ctorProps, ppProps, children){
	//TODO: should we validate type, ctorProps, ppProps, and children

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

export default function element(type, props = {}, ...children){
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
			child.forEach(flatten);
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
		throw Error("duplicate postprocessing function name: " + name);
	}
	let symbol = Symbol("post-process-function-" + name);
	Object.defineProperty(element, name, {value: symbol, enumerable: true});
	Object.defineProperty(element, symbol, {value: func, enumerable: true});
	postProcessingSet.add(symbol);
};
