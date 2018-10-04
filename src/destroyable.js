function noop(){
}

function destroyable(proc, container, onEmpty){
	let result = {
		proc: proc,
		destroy(){
			result.destroy = result.proc = noop;
			let index = container.indexOf(result);
			if(index !== -1){
				container.splice(index, 1);
			}
			!container.length && onEmpty && onEmpty();
		}
	};
	container.push(result);
	return result;
}

function destroyAll(container){
	for(let i= 0, end = container.length; i<end; i++){
		container.pop().destroy();
	}
}

export {destroyable, destroyAll};