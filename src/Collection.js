import {Component} from "./Component.js";
import {watch} from "./watchUtils.js";
import {div} from "./element.js";

function watchCollection(owner){
	if(owner.bdDom.collectionWatcher){
		owner.bdDom.collectionWatcher.destroy();
	}
	owner.ownWhileRendered(owner.bdDom.collectionWatcher = watch(owner.bdCollection, "length", owner.bdSynchChildren.bind(owner)));
}

export class Collection extends Component {
	constructor(kwargs){
		super(kwargs);
		this.collection = kwargs.collection;
	}

	set collection(value){
		// always an array
		value = value || [];
		if(this.bdMutate("collection", "bdCollection", value)){
			if(this.rendered){
				this.children.slice().forEach(this.delChild.bind(this));
				this.bdSynchChildren();
				watchCollection(this);
			}
		}
	}

	get collection(){
		return this.bdCollection;
	}

	render(proc){
		if(!this.bdDom){
			super.render(proc);
			this.children = [];
			this.bdSynchChildren();
			watchCollection(this);
		}
		return this.bdDom.root;
	}

	insChild(i){
		let child = new this.kwargs.childType({index: i, mix: {collection: this.bdCollection}});
		let attachPoint = this.bdChildrenAttachPoint || this.bdDom.root;
		Component.insertNode(child.render(), attachPoint, i);
		this.children.push(child);
		child.bdMutate("parent", "bdParent", this);
		child.bdAttachToDoc(this.bdAttachedToDoc);
		return child;
	}

	bdSynchChildren(){
		let children = this.children;
		while(children.length < this.bdCollection.length){
			this.insChild(children.length);
		}
		while(children.length > this.bdCollection.length){
			this.delChild(this.children[this.children.length - 1]);
		}
	}
}