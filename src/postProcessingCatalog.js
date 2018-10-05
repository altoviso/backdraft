let postProcessingFuncs = Object.create(null);

function insPostProcessingFunction(name, func){
	if(postProcessingFuncs[name]){
		throw Error("duplicate postprocessing function name: " + name);
	}
	postProcessingFuncs[name] = func;
}

function replacePostProcessingFunction(name, func){
	postProcessingFuncs[name] = func;
}

function getPostProcessingFunction(name){
	return postProcessingFuncs[name];
}

export {insPostProcessingFunction, replacePostProcessingFunction, getPostProcessingFunction};
