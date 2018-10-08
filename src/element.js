import {getPostProcessingFunction} from "./postProcessingCatalog.js";

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

export class Element {
	constructor(type, props, ...children){
		if(type instanceof Element){
			// copy constructor
			this.type = type.type;
			type.isComponentType && (this.isComponentType = type.isComponentType);
			type.ctorProps && (this.ctorProps = type.ctorProps);
			type.ppProps && (this.ppProps = type.ppProps);
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
					let ppProps = {};
					let ppPropCount = 0;
					let match, ppf;
					let setPpProps = (ppKey, value)=>{
						if(ppProps[ppKey]){
							let dest = ppProps[ppKey];
							Reflect.ownKeys(value).forEach(k => dest[k] = value[k]);
						}else{
							ppPropCount++;
							ppProps[ppKey] = value;
						}
					};
					Reflect.ownKeys(props).forEach((k) => {
						if((ppf = getPostProcessingFunction(k))){
							let value = ppf.bdTransform(null, props[k]);
							setPpProps(k, value);
						}else if((match = k.match(/^([A-Za-z0-9$]+)_(.+)$/)) && (ppf = getPostProcessingFunction(match[1]))){
							let ppKey = match[1];
							let value = ppf.bdTransform(match[2], props[k]);
							setPpProps(ppKey, value);
						}else{
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

export function element(type, props, ...children){
	// make elements without having to use new

	return new Element(type, props, children);
}

export function div(props, ...children){
	return new Element("div", props, children);
}

const SVG = Object.create(null, {
	toString: {
		value: () => "http://www.w3.org/2000/svg"
	}
});
Object.freeze(SVG);

export function svg(type, props, ...children){
	if(typeof type !== "string"){
		children.unshift(props);
		props = type;
		type = "svg";
	}
	return new Element([SVG, type], props, children);
}
