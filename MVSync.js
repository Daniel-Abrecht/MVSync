"use strict";

(function(){

window['model'] = window['model'] || {};

/** @type {function(Object,function(Object))} */
Object.observe;

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
    function add(name){
      change(name);
    }
    function change(name){
      if(name in mapping)
        for(var i in mapping[name]){(function(){
          var b = mapping[name][i];
          var something = scope[name]||'';
          something = (new Function("v","return v"+b.expr+";"))(something);
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
                if(b.which in b.element)
                  b.element[b.which] = value;
                else
                  b.element.setAttribute(b.which,value);
              }else if(b.what=="content"){
                b.element.innerHTML='';
                b.element.appendChild(document.createTextNode(value));
              }
            } break;
          }
        })();}
    }
    function remove(name){
      change(name);
    }

    this.root = template.cloneNode(true);
    this.root.classList.add(attrName);

    function setup(e){
      var bind = e.getAttribute("data-bind");
      if(bind){
        bind = bind.split("|");
        for(var i=0;i<bind.length;i++){
          var b = bind[i].split(":");
          var expr = b[1];
          expr = expr.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)(.*)/);
          var name = expr[1];
          expr = expr[2];
          var attr = b[0];
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
        expr = expr[2];
        mapping[name] = mapping[name] || [];
        mapping[name].push({
          which: "$$content",
          what: "content",
          type: "value",
          expr: expr,
          element: e
        });
      }
      var getter = e.getAttribute("data-getter");
      if(getter){
        getter = getter.split("|");
        for(var i=0;i<getter.length;i++){
          var g = getter[i].split(":");
          var expr = g[1];
          expr = expr.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)(.*)/);
          var name = expr[1];
          expr = expr[2];
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
        setter = setter.split("|");
        for(var i=0;i<setter.length;i++){
          var s = setter[i].split(":");
          var expr = s[1];
          expr = expr.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)(.*)/);
          var name = expr[1];
          expr = expr[2];
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
            (new Function("s","n","v","if(s[n]"+map.expr+".toString()!=v)s[n]"+map.expr+"=Object(s[n]"+map.expr+").constructor(v);")).call(scope,scope,name,value);
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
          if(!target)
            return;
          target = Object((new Function("v","return v"+expr+";"))(target));
          if(!target)
            return;
          e.innerHTML = '';
          if("length" in target){
            e.content = [];
            Object.observe(target,function(changes){
              syncLists(e.content,target,e,templates[v[1]]);
            });
            syncLists(e.content,target,e,templates[v[1]]);
          }else{
            e.appendChild(templates[v[1]].instance(target));
          }
        };
        Object.observe(scope,function(changes){
          changes.forEach(function(ch){
            if(ch.name!=v[0])
              return;
            if(ch.type=="add"||ch.type=="update")
              setup_mapping();
            if(ch.type=="delete")
              e.innerHTML='';
          });
        });
        setup_mapping();
      }

      if(!map)
        for(var i=0;i<e.children.length;i++)
          setup(e.children[i]);
    }

    function syncLists(a,b,e,t){
      for(var i=a.length;i--;)
        if(b.indexOf(a[i])==-1){
          a.splice(i,1);
          e.removeChild(e.children[i]);
        }
      for(var i=0;i<b.length;i++)
        if(a.indexOf(b[i])==-1){
          a.push(b[i]);
          e.appendChild(t.instance(b[i]));
        }
    }

    setup(this.root);

    Object.observe(scope,function(changes){
      changes.forEach(function(ch){
        if(ch.type=="add")
          add(ch.name);
        if(ch.type=="update")
          change(ch.name);
        if(ch.type=="delete")
          remove(ch.name);
      });
    });

    for(var i in scope){
      add(i);
    }

  };
  this.instance = function(scope){
    var instance = new Instance(scope);
    return instance.root;
  };
}

function compileTemplate(e){
  var name = e.getAttribute("data-template");
  if(e==document.body)
    name = "body";
  if(e.parentElement)
    e.parentElement.removeChild(e);
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
  var t = compileTemplate(document.body);
  document.documentElement.appendChild(document.body=t.instance(model));
});

})();
