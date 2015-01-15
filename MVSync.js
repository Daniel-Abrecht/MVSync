(function(){
"use strict";

window['model'] = window['model'] || {};

/** @type {function(Object,function(Object))} */
Object.observe;
/** @type {function(Object,function(Object))} */
Object.unobserve;

var templates = {};
var requiredTemplates = {};

Object.observe(requiredTemplates,function(changes){
  changes.forEach(function(ch){
    if(ch.type=="add")
      loadTemplate(ch.name);
  });
});

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
        for(var i in mapping[name]){(function(){
          var b = mapping[name][i];
          var something = null;
          if(b.expr)
            something = evaluateExpression(b.expr);
          var value = null;
          switch(b.type){
            case "getter": {
              var cache
                =  getterCache[name+b.expr]
                =  getterCacheByProperty[b.which]
                =  getterCache[name+b.expr]
                || getterCacheByProperty[b.which]
                || {};
              if(setterCacheByProperty[b.which]){
                cache.relatedSetter = setterCacheByProperty[b.which];
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
                =  setterCache[name+b.expr]
                =  setterCacheByProperty[b.which]
                =  setterCache[name+b.expr]
                || setterCacheByProperty[b.which]
                || {};
              var gcache
                =  getterCacheByProperty[b.which]
                || getterCacheByProperty[b.which]
                || {};
              gcache.relatedSetter = scache;
              scache.func = something;
            } break;
            case "value": {
              var value = something;
              if(
                !(name in getterCacheByProperty) ||
                getterCacheByProperty[name].lastValue != value
              ){ // value wasn't changed by a getter
                var setter = null;
                if(name in getterCacheByProperty){
                  setter = getterCacheByProperty[name].relatedSetter.func;
                  delete getterCacheByProperty[name].lastValue;
                }
                if( !setter && (name in setterCacheByProperty) )
                  setter = setterCacheByProperty[name].func;
                if(setter){
                  var callback = setter(value);
                  if(callback)
                    callback();
                }
              }
              if(b.what=="attribute"){
                setAttr(b.element,b.which,value);
              }else if(b.what=="content"){
                setContent(b.element,value);
              }
            } break;
            case "map": {
              b.update();
            } break;
          }
        })();}
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
        element.setAttribute(name,value);
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
          var attr = b[0];
          var value = evaluateExpression(expr);
          setAttr(e,attr,value);
          mapping[name] = mapping[name] || [];
          mapping[name].push({
            which: attr,
            what: "attribute",
            type: "value",
            expr: expr,
            element: e
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
          element: e
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
            element: e
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
            element: e
          });
        }
      }
      var updateScope = function(attr){
        var value = e.getAttribute(attr);
        for(var name in mapping){
          var maps = mapping[name];
          for(var i in maps){
            var map = maps[i];
            if(map.type!="value"||map.which!=attr)
              continue;
            (new Function("s","v","if(s."+map.expr+".toString()!=v)s."+map.expr+"=Object(s."+map.expr+").constructor(v);")).call(scope,scope,value);
          }
        }
      };
      var observer = new MutationObserver(function(mutations){
        mutations.forEach(function(mutation){;
          updateScope(mutation.attributeName);
        });
      });
      observer.observe( e, /** @type {!MutationObserverInit} */ ({ attributes: true }) );
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

    function syncLists(contentDatas,b,e,t){
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

addEventListener("load",function(){
  if(window['templateRoot']){
    base = window['templateRoot'] + "/";
  }else if(document.querySelector("[data-template-root]")){
    base = document.querySelector("[data-template-root]").getAttribute("data-template-root") + "/";
  }
  compileTemplates(document);
  var t = compileTemplate(document.documentElement);
  t.instance(model);
});

})();
