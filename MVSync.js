(function(){
"use strict";

window['model'] = window['model'] || {};

/** @type {function(Object,function(Object))} */
Object.observe;
/** @type {function(Object,function(Object))} */
Object.unobserve;

var templates = {};
var requiredTemplates = {};
var eidc = 0;

function init(){
  Object.observe(requiredTemplates,function(changes){
    changes.forEach(function(ch){
      if(ch.type=="add")
        loadTemplate(ch.name);
    });
  });
}

/**
 * @constructor
 */
function Template(template){
  template.removeAttribute("data-template");
  var attrName = template.templateName;
  template.template = this;
  /**
   * @constructor
   */
  function Instance(scope){
    var sc = this;

    Object.defineProperty(scope,"this",{
      configurable: true,
      writable: true,
      enumerable: false,
      value: scope
    });

    var mapping = {};
    var getterCache = {};
    var getterCacheByProperty = {};
    var setterCache = {};
    var setterCacheByProperty = {};

    this.containingTemplateInstances = [];

    function evaluateExpression(expr){
      try {
        return (new Function("v","return v."+expr+";"))(scope);
      } catch(e) {
        return null;
      }
    }
    function update(name,modelAction){
      if(name in mapping)
        mapping[name].forEach(function(b){
          var something = null;
          if(b.expr)
            something = evaluateExpression(b.expr);
          var value = null;
          switch(b.type){
            case "getter": {
              var cache
                =  getterCache[name+'\0'+b.expr]
                =  getterCacheByProperty[b.which+'\0'+b.eid]
                =  getterCache[name+'\0'+b.expr]
                || getterCacheByProperty[b.which+'\0'+b.eid]
                || {};
              if(setterCacheByProperty[b.which+'\0'+b.eid]){
                cache.relatedSetter = setterCacheByProperty[b.which+'\0'+b.eid];
              }
              var update = function(value){
                cache.lastValue = value;
                while(cache.reqList.length){
                  var name = cache.reqList.pop();
                  (new Function("s","n","v","s[n]"+b.expr+"=v;")).call(scope,scope,name,value);
                }
              }
              cache.reqList = cache.reqList || [];
              if(!cache.reqList.length){
                value = something();
                if(value instanceof Function){
                  value(update); // value is a function which takes a callback function
                }else{
                  update(value);
                }
              }
              cache.reqList.push(b.which);
            } break;
            case "setter": {
              var scache
                =  setterCache[name+'\0'+b.expr]
                =  setterCacheByProperty[b.which+'\0'+b.eid]
                =  setterCache[name+'\0'+b.expr]
                || setterCacheByProperty[b.which+'\0'+b.eid]
                || {};
              var gcache
                =  getterCacheByProperty[b.which+'\0'+b.eid]
                || getterCacheByProperty[b.which+'\0'+b.eid]
                || {};
              gcache.relatedSetter = scache;
              scache.func = something;
            } break;
            case "value": {
              var value = something;
              if(
                !(name in getterCacheByProperty) ||
                getterCacheByProperty[name+'\0'+b.eid].lastValue != value
              ){ // value wasn't changed by a getter
                var setter = null;
                if(name in getterCacheByProperty){
                  setter = getterCacheByProperty[name+'\0'+b.eid].relatedSetter.func;
                  delete getterCacheByProperty[name+'\0'+b.eid].lastValue;
                }
                if( !setter && (name in setterCacheByProperty) )
                  setter = setterCacheByProperty[name+'\0'+b.eid].func;
                if(setter){
                  var callback = setter(value);
                  if(callback)
                    callback();
                }
              }
              if(b.what=="attribute"){
                setAttr(b.element,b.which,value);
              }else if(b.what=="style"){
                setStyle(b.element,b.which,value);
              }else if(b.what=="content"){
                setContent(b.element,value);
              }
            } break;
            case "map": {
              b.update();
            } break;
          }
        });
    }

    this.root = (template instanceof HTMLHtmlElement)?template:template.cloneNode(true);
    this.root.templateInstance = this;
    this.root.classList.add(attrName);

    function clearContent(el){
      while(el.childNodes.length){
        var e = el.childNodes[el.childNodes.length-1];
        if(e.templateInstance)
          e.templateInstance._cleanup();
        el.removeChild(e);
      }
      if("_content" in el)
        delete el._content;
    }
    this._cleanup = function(){
      Object.unobserve(this.observer.obj,this.observer.func);
      for(var i=0;i<this.containingTemplateInstances.length;i++){
        var templateInstance = this.containingTemplateInstances[i];
        templateInstance._cleanup();
      }
    }

    function setAttr(element,name,value){
      if(name in element)
        element[name] = value;
      else
        element.setAttribute(name,value===undefined?"":value);
    }

    function setStyle(element,name,value){
      element.style[name] = value===undefined?"":value;
    }

    function setContent(element,value){
      clearContent(element);
      if(value instanceof Node){
        var node = value.cloneNode(true);
        setup(node);
        element.appendChild(node);
      }else{
        element.appendChild(document.createTextNode(value||''));
      }
    }

    function setup(e){
      var bind = e.getAttribute("data-bind");
      if(bind){
        bind = bind.split("¦");
        for(var i=0;i<bind.length;i++){
          var b = bind[i].split(":");
          var expr = b[1];
          var name = expr.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)(.*)/)[1];
          var style = b[0].substr(0,1) == "@";
          var attr = style?b[0].substr(1):b[0];
          var value = evaluateExpression(expr);
          if(style)
            setStyle(e,attr,value);
          else
            setAttr(e,attr,value);
          mapping[name] = mapping[name] || [];
          mapping[name].push({
            which: attr,
            what: style?"style":"attribute",
            type: "value",
            expr: expr,
            element: e,
            eid: ( e.eid = ( e.eid || eidc++ ) )
          });
        }
      }
      var content = e.getAttribute("data-content");
      if(content){
        var expr = content.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)(.*)/);
        var name = expr[1];
        expr = content;
        var value = evaluateExpression(expr);
        setContent(e,value);
        mapping[name] = mapping[name] || [];
        mapping[name].push({
          what: "content",
          type: "value",
          expr: expr,
          element: e,
          eid: ( e.eid = ( e.eid || eidc++ ) )
        });
      }
      var getter = e.getAttribute("data-getter");
      if(getter){
        getter = getter.split("¦");
        for(var i=0;i<getter.length;i++){
          var g = getter[i].split(":");
          var expr = g[1];
          var name = expr.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)(.*)/)[1];
          var attr = g[0];
          mapping[name] = mapping[name] || [];
          mapping[name].push({
            which: attr,
            type: "getter",
            expr: expr,
            element: e,
            eid: ( e.eid = ( e.eid || eidc++ ) )
          });
        }
      }
      var setter = e.getAttribute("data-setter");
      if(setter){
        setter = setter.split("¦");
        for(var i=0;i<setter.length;i++){
          var s = setter[i].split(":");
          var expr = s[1];
          var name = expr.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)(.*)/)[1];
          var attr = s[0];
          mapping[name] = mapping[name] || [];
          mapping[name].push({
            which: attr,
            type: "setter",
            expr: expr,
            element: e,
            eid: ( e.eid = ( e.eid || eidc++ ) )
          });
        }
      }
      var updateScope = function(attr){
        var value = e[attr] || e.getAttribute(attr);
        for(var name in mapping){
          var maps = mapping[name];
          maps.forEach(function(map){
            if( map.type != "value" || map.which != attr || map.element != e )
              return;
            (new Function("s","v","if(s."+map.expr+".toString()!=v)s."+map.expr+"=Object(s."+map.expr+").constructor(v);")).call(scope,scope,value);
          });
        }
      };
      if("MutationObserver" in window){
        var observer = new MutationObserver(function(mutations){
          mutations.forEach(function(mutation){;
            updateScope(mutation.attributeName);
          });
        });
        observer.observe( e, /** @type {!MutationObserverInit} */ ({ attributes: true }) );
      }else if("value" in e){
        e.addEventListener("change",updateScope.bind(null,"value"),false);
        e.addEventListener("input",updateScope.bind(null,"value"),false);
      }
      if("value" in e)
        e.addEventListener("change",function(){
          e.setAttribute("value",e.value);
        });

      var map = e.getAttribute("data-map");
      if(map){
        var v = map.split(":");
        var expr = v[0].match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)(.*)/);
        var name = expr[1];
        expr=expr[2];
        var setup_mapping = function(){
          if(!(v[1] in templates)){
            ( requiredTemplates[v[1]] = requiredTemplates[v[1]] || [] ).push( setup_mapping );
            return;
          }
          var target = scope[name];
          if(target)
            target = Object((new Function("v","return v"+expr+";"))(target));
          if(!target)
            target=[];
//          clearContent(e);
          if(!("length" in target))
            target=[target];
          e._content = e._content || {
            subScopes: [],
            subScopeInfos: []
          };
          Object.observe(target,function(changes){
            syncLists(e._content,target,e,templates[v[1]]);
          });
          syncLists(e._content,target,e,templates[v[1]]);
        };
        ( mapping[v[0]] = mapping[v[0]] || [] ).push({
          "type": "map",
          "update": setup_mapping
        });
        setup_mapping();
      }

      if(!map)
        for(var i=0;i<e.children.length;i++)
          setup(e.children[i]);
    }

    function syncLists(contentDatas,orig,e,t){
      var b = [];
      for(var i=0;i<orig.length;i++){
        if(!(orig[i] instanceof Object))
          continue;
        if(b.indexOf(orig[i])!=-1)
          continue;
        b.push(orig[i]);
      }
      var a = contentDatas.subScopes;
      var d = contentDatas.subScopeInfos;
      for(var i=a.length;i--;){ // remove elements / objects
        if(b.indexOf(a[i])!=-1)
          continue;
        if(d[i].element.parentNode)
          d[i].element.parentNode.removeChild(d[i].element);
        a.splice(i,1);
        d.splice(i,1);
      }
      for(var i=0;i<b.length;i++){ // add elements / objects
        var j = a.indexOf(b[i]);
        if(j!=-1){
          d[j].index = i;
        }else{
          var newInfo = {
            element: t.instance(b[i]),
            index: i
          };
          if(!d.length){
            e.appendChild(newInfo.element);
          }else{
            var last = d[d.length-1].element;
            if(last.parentNode==e){
              e.insertBefore(newInfo.element,last.nextSibling);
            }else{
              e.appendChild(newInfo.element);
            }
          }
          a.push(b[i]);
          d.push(newInfo);
        }
      }
      for(var i=0;i<d.length;i++){ // move elements / objects to desired index
        var x = d[i];
        if(x.index==i)
          continue;
        var ae = x.element;
        var be = d[x.index].element;
        arraySwapValues(d,i,x.index);
        arraySwapValues(a,i,x.index);
        var ap = ae.parentNode;
        var bp = be.parentNode;
        if(ap&&bp){
          var an = ae.nextSibling;
          var bn = be.nextSibling;
          bp.insertBefore(ae,bn);
          ap.insertBefore(be,an);
        }
      }
    }

    setup(this.root);

    var observerFunc = function(changes){
      changes.forEach(function(ch){
        update(ch.name,ch.type);
      });
    }
    var observerObj = Object.observe(scope,observerFunc);
    sc.observer = {
      obj: observerObj,
      func: observerFunc
    };

    for(var i in scope){
      update(i,"add");
    }

  };
  this.instance = function(scope){
    var instance = new Instance(scope);
    return instance.root;
  };
}

function arraySwapValues(a,i,j){
  a[i]=[a[j],a[j]=a[i]][0];
}

function compileTemplate(e){
  var name = e.getAttribute("data-template");
  if(!name&&e instanceof HTMLHtmlElement)
    name = "root";
  if(e.parentNode&&!(e instanceof HTMLHtmlElement))
    e.parentNode.removeChild(e);
  e.templateName = name;
  var t = templates[name] = new Template(e);
  if(name in requiredTemplates){
    while(requiredTemplates[name].length){
      requiredTemplates[name].pop()();
    }
    delete requiredTemplates[name];
  }
  return t;
}

function compileTemplates( templates ){
  if( "querySelectorAll" in templates )
    templates = templates.querySelectorAll("[data-template]");
  for(var i=0;i<templates.length;i++){
    compileTemplate(templates[i]);
  }
}

var base = "/";

function loadTemplate(name){
  var url = base+"templates/"+name+".html";
  var xhr = new XMLHttpRequest();
  xhr.open("GET",url,true);
  xhr.onload = function(e){
    var result = null;//this.responseXML;
    if(!result){
      result = document.createDocumentFragment();
      var div = document.createElement("div");
      div.innerHTML = this.responseText;
      result.appendChild(div);
    }
    compileTemplates(result);
  };
  xhr.send();
}

var initialized = false;

function initMVSync(ignoreReadystate){
  if(initialized)
    return;
  if(!( document.readyState == "complete" 
     || document.readyState == "loaded" 
     || document.readyState == "interactive"
     || ignoreReadystate
  )) return;
  if(!("observe" in Object))
    return;
  initialized = true;
  if(window['templateRoot']){
    base = window['templateRoot'] + "/";
  }else if(document.querySelector("[data-template-root]")){
    base = document.querySelector("[data-template-root]").getAttribute("data-template-root") + "/";
  }
  init();
  compileTemplates(document);
  var t = compileTemplate(document.documentElement);
  t.instance(model);
};

window['initMVSync'] = initMVSync;

})();

addEventListener("load",initMVSync.bind(null,true));
addEventListener("DOMContentLoaded",initMVSync.bind(null,true));
initMVSync(false);

