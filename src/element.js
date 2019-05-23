import {getPostProcessingFunction} from "./postProcessingCatalog.js";

function flattenChildren(children) {
    // single children can be falsey, single children (of type Element or string), or arrays of single children, arbitrarily deep
    let result = [];

    function flatten_(child) {
        if (Array.isArray(child)) {
            child.forEach(flatten_);
        } else if (child) {
            result.push(child);
        }
    }

    flatten_(children);
    return result;
}

export class Element {
    constructor(type, props, ...children) {
        if (type instanceof Element) {
            // copy constructor
            this.type = type.type;
            type.isComponentType && (this.isComponentType = type.isComponentType);
            type.ctorProps && (this.ctorProps = type.ctorProps);
            type.ppFuncs && (this.ppFuncs = type.ppFuncs);
            type.children && (this.children = type.children);
        } else {
            // type must either be a constructor (a function) or a string; guarantee that as follows...
            if (type instanceof Function) {
                this.isComponentType = true;
                this.type = type;
            } else if (type) {
                // leave this.isComponentType === undefined
                this.type = Array.isArray(type) ? type : type + "";
            } else {
                throw new Error("type is required");
            }

            // if the second arg is an Object and not an Element or and Array, then it is props...
            if (props) {
                if (props instanceof Element || Array.isArray(props)) {
                    children.unshift(props);
                    this.ctorProps = {};
                } else if (props instanceof Object) {
                    let ctorProps = {};
                    let ppFuncs = {};
                    let ppFuncCount = 0;
                    let match, ppf;
                    let setPpFuncs = (ppKey, value) => {
                        if (ppFuncs[ppKey]) {
                            let dest = ppFuncs[ppKey];
                            Reflect.ownKeys(value).forEach(k => dest[k] = value[k]);
                        } else {
                            ppFuncCount++;
                            ppFuncs[ppKey] = value;
                        }
                    };
                    Reflect.ownKeys(props).forEach((k) => {
                        if ((ppf = getPostProcessingFunction(k))) {
                            let value = ppf.bdTransform(null, props[k]);
                            setPpFuncs(k, value);
                        } else if ((match = k.match(/^([A-Za-z0-9$]+)_(.+)$/)) && (ppf = getPostProcessingFunction(match[1]))) {
                            let ppKey = match[1];
                            let value = ppf.bdTransform(match[2], props[k]);
                            setPpFuncs(ppKey, value);
                        } else {
                            ctorProps[k] = props[k];
                        }
                    });
                    this.ctorProps = Object.freeze(ctorProps);
                    if (ppFuncCount) {
                        this.ppFuncs = Object.freeze(ppFuncs);
                    }
                } else {
                    children.unshift(props);
                    this.ctorProps = {};
                }
            } else {
                this.ctorProps = {};
            }


            let flattenedChildren = flattenChildren(children);
            if (flattenedChildren.length === 1) {
                let child = flattenedChildren[0];
                this.children = child instanceof Element ? child : child + "";
            } else if (flattenedChildren.length) {
                this.children = flattenedChildren.map(child => (child instanceof Element ? child : child + ""));
                Object.freeze(this.children);
            }// else children.length===0; therefore, no children
        }
        Object.freeze(this);
    }
}

export function element(type, props, ...children) {
    // make elements without having to use new
    return new Element(type, props, children);
}

let addElementType = element.addElementType = function (type) {
    if (typeof type === "function") {
        if (type.name in element) {
            console.error(type.name, "already in element");
        } else {
            element[type.name] = function (props, ...children) {
                return new Element(type, props, children);
            };
        }
    } else {
        if (type in element) {
            console.error(type, "already in element");
        } else {
            element[type] = function div(props, ...children) {
                return new Element(type, props, children);
            };
        }
    }
};

"a.abbr.address.area.article.aside.audio.base.bdi.bdo.blockquote.br.button.canvas.caption.cite.code.col.colgroup.data.datalist.dd.del.details.dfn.div.dl.dt.em.embed.fieldset.figcaption.figure.footer.form.h1.head.header.hr.html.i.iframe.img.input.ins.kbd.label.legend.li.link.main.map.mark.meta.meter.nav.noscript.object.ol.optgroup.option.output.p.param.picture.pre.progress.q.rb.rp.rt.rtc.ruby.s.samp.script.section.select.slot.small.source.span.strong.style.sub.summary.sup.table.tbody.td.template.textarea.tfoot.th.thead.time.title.tr.track.u.ul.var.video.wbr".split(".").forEach(addElementType);

export function div(props, ...children) {
    return new Element("div", props, children);
}

const SVG = Object.create(null, {
    toString: {
        value: () => "http://www.w3.org/2000/svg"
    }
});
Object.freeze(SVG);

export function svg(type, props, ...children) {
    if (typeof type !== "string") {
        children.unshift(props);
        props = type;
        type = "svg";
    }
    return new Element([SVG, type], props, children);
}

"altGlyph.altGlyphDef.altGlyphItem.animate.animateColor.animateMotion.animateTransform.circle.clipPath.colorprofile.cursor.defs.desc.ellipse.feBlend.feColorMatrix.feComponentTransfer.feComposite.feConvolveMatrix.feDiffuseLighting.feDisplacementMap.feDistantLight.feFlood.feFuncA.feFuncB.feFuncG.feFuncR.feGaussianBlur.feImage.feMerge.feMergeNode.feMorphology.feOffset.fePointLight.feSpecularLighting.feSpotLight.feTile.feTurbulence.filter.font.fontface.fontfaceformat.fontfacename.fontfacesrc.fontfaceuri.foreignObject.g.glyph.glyphRef.hkern.image.line.linearGradient.marker.mask.metadata.missingglyph.mpath.path.pattern.polygon.polyline.radialGradient.rect.script.set.stop.style.svg.switch.symbol.text.textPath.title.tref.tspan.use.view.vkern".split(".").forEach(tag => {
    svg[tag] = function (props, ...children) {
        return svg(tag, props, children);
    };
});
