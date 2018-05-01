let postProcessingSet = new Set();

export function Element(type, ctorProps, ppProps, children){
	this.type = type;
	this.ctorProps = ctorProps;
	this.ppProps = ppProps;
	if(children.length === 1){
		this.children = children[0];
	}else if(children.length){
		this.children = children;
	}
}

export default function element(type, props = {}, ...children){
	if(type instanceof Element){
		// copy
		return new Element(type.type, type.ctorProps, type.ppProps, type.children);
	}

	// figure out if signature was actually element(type, child, [,child...])
	if(props instanceof Element || Array.isArray(props) || typeof props === "string"){
		// props was actually a child
		children.unshift(props)
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

element.insPostProcessingFunction = function(test, name, symbol, func){
	if(element[name]){
		throw Error("duplicate postprocessing function name");
	}
	if(element[symbol]){
		throw Error("duplicate postprocessing function symbol");
	}
	Object.defineProperty(element, name, {value: symbol, enumerable: true});
	Object.defineProperty(element, symbol, {value: func, enumerable: true});
	postProcessingSet.add(symbol);
};
