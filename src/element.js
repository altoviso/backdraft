export class Element {
	constructor(type, props, ...children){
		if(type instanceof Element){
			// copy constructor
			this.type = type.type;
			type.isComponentRef && (this.isComponentType = type.isComponentRef);
			type.ctorProps && (this.ctorProps = type.ctorProps);
			type.ppProps && (this.ppProps = type.ppProps);
			type.children && (this.children = type.children);
		}else{
			// type must either be a constructor (a function) or a string; guarantee that as follows...
			if(type instanceof Function){
				this.isComponentType = true;
				this.type = type;
			}else if(type){
				//this.isComponentType === undefined
				this.type = type + "";
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
					let ppProps = {};
					let ctorCount = 0;
					let ppPropCount = 0;
					Reflect.ownKeys(props).forEach((k) => {
						if(postProcessingSet.has(k)){
							ppPropCount++;
							ppProps[k] = props[k];
						}else{
							ctorCount++;
							ctorProps[k] = props[k];
						}
					});
					this.ctorProps = Object.freeze(ctorProps);
					if(ppPropCount){
						this.ppProps = Object.freeze(ppProps);
					}
				}else{
					children.unshift(props);
					this.ctorProps = {};
				}
			}else{
				this.ctorProps = {};
			}

			// single children can be falsey, single children (of type Element or string), or arrays of single children, arbitrarily deep
			let flattenedChildren = [];

			// noinspection JSAnnotator
			function flatten(child){
				if(Array.isArray(child)){
					child.forEach(flatten);
				}else if(child){
					flattenedChildren.push(child);
				}
			}

			flatten(children);

			if(flattenedChildren.length === 1){
				let child = flattenedChildren[0];
				this.children = child instanceof Element ? child : child + "";
			}else if(flattenedChildren.length){
				this.children = flattenedChildren.map(child => (child instanceof Element ? child : child + ""));
				Object.freeze(this.children)
			}// else children.length===0; therefore, no children
		}
		Object.freeze(this);
	}
}

export default function element(type, props, ...children){
	// make elements without having to use new
	return new Element(type, props, children);
}

let postProcessingSet = new Set();

element.insPostProcessingFunction = function(name, func){
	if(element[name]){
		throw Error("duplicate postprocessing function name: " + name);
	}
	// ppf => post-processing function
	let lcName = name.toLowerCase();
	Object.defineProperty(element, name, {value: func, enumerable: true});
	Object.defineProperty(element, lcName, {value: func, enumerable: true});
	postProcessingSet.add(name);
	postProcessingSet.add(lcName);
};
