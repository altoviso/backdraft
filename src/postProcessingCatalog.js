const postProcessingFuncs = Object.create(null);

function insPostProcessingFunction(name, transform, func) {
    if (typeof transform === "string") {
        // transform is an alias for name
        if (!postProcessingFuncs[name]) {
            throw Error(`cannot alias to a non-existing post-processing function: ${name}`);
        }
        postProcessingFuncs[transform] = postProcessingFuncs[name];
        return;
    }
    if (arguments.length === 3) {
        if (typeof transform !== "function") {
            transform = (prop, value) => prop ? {[prop]: value} : value;
        }
    } else {
        func = transform;
        transform = (prop, value) => value;
    }
    func.bdTransform = transform;
    if (postProcessingFuncs[name]) {
        throw Error(`duplicate postprocessing function name: ${name}`);
    }
    postProcessingFuncs[name] = func;
}

function replacePostProcessingFunction(name, func) {
    postProcessingFuncs[name] = func;
}

function getPostProcessingFunction(name) {
    return postProcessingFuncs[name];
}

export {insPostProcessingFunction, replacePostProcessingFunction, getPostProcessingFunction};
