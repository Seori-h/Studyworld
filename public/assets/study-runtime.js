/* STUDYWORLD Study Runtime Core
 * The room shell is stable; scene manifests select engines and interactions at runtime.
 * This file intentionally contains no learning-mode or layout switch statements.
 */
(function(global){
  'use strict';

  class EngineRegistry{
    constructor(){this.engines=new Map()}
    register(id,engine){
      if(!id||typeof id!=='string')throw new Error('ENGINE_ID_REQUIRED');
      if(!engine||typeof engine.render!=='function')throw new Error(`ENGINE_RENDER_REQUIRED:${id}`);
      this.engines.set(id,Object.freeze({...engine,id}));
      return this;
    }
    has(id){return this.engines.has(id)}
    get(id){return this.engines.get(id)||null}
    ids(){return [...this.engines.keys()]}
    render(id,context){
      const engine=this.get(id);
      if(!engine)throw new Error(`ENGINE_NOT_REGISTERED:${id}`);
      return engine.render(context);
    }
  }

  class InteractionRuntime{
    constructor(){this.handlers=new Map();this.roots=new WeakSet()}
    register(type,handler){
      if(!type||typeof handler!=='function')throw new Error('INTERACTION_HANDLER_REQUIRED');
      this.handlers.set(type,handler);
      return this;
    }
    async dispatch(type,detail={}){
      const handler=this.handlers.get(type);
      if(!handler)return false;
      await handler(detail);
      return true;
    }
    attach(root){
      if(!root||this.roots.has(root))return;
      this.roots.add(root);
      root.addEventListener('click',(event)=>{
        const target=event.target.closest?.('[data-runtime-action]');
        if(!target||!root.contains(target)||target.disabled)return;
        const type=target.dataset.runtimeAction;
        this.dispatch(type,{event,element:target,value:target.dataset.runtimeValue,payload:target.dataset.runtimePayload||''});
      });
      root.addEventListener('input',(event)=>{
        const target=event.target.closest?.('[data-runtime-input]');
        if(!target||!root.contains(target))return;
        const type=target.dataset.runtimeInput;
        this.dispatch(type,{event,element:target,value:target.value,payload:target.dataset.runtimePayload||''});
      });
      root.addEventListener('change',(event)=>{
        const target=event.target.closest?.('[data-runtime-change]');
        if(!target||!root.contains(target))return;
        const type=target.dataset.runtimeChange;
        this.dispatch(type,{event,element:target,value:target.value,payload:target.dataset.runtimePayload||''});
      });
    }
  }

  class StudyRuntime{
    constructor({engines,interactions}){
      if(!(engines instanceof EngineRegistry))throw new Error('ENGINE_REGISTRY_REQUIRED');
      if(!(interactions instanceof InteractionRuntime))throw new Error('INTERACTION_RUNTIME_REQUIRED');
      this.engines=engines;
      this.interactions=interactions;
      this.activeEngine=null;
    }
    render({root,manifest,context,decorate}){
      if(!root)throw new Error('RUNTIME_ROOT_REQUIRED');
      const engineId=manifest?.scene?.engine_id;
      const engine=this.engines.get(engineId);
      if(!engine)throw new Error(`ENGINE_NOT_REGISTERED:${engineId||'unknown'}`);
      if(this.activeEngine?.unmount)this.activeEngine.unmount({root,manifest,context});
      const sceneHtml=engine.render({manifest,context});
      root.dataset.engineId=engineId;
      root.dataset.studyMode=manifest?.activity||'';
      root.dataset.environment=manifest?.scene?.environment||'';
      root.innerHTML=typeof decorate==='function'?decorate(sceneHtml):sceneHtml;
      this.interactions.attach(root);
      engine.mount?.({root,manifest,context,interactions:this.interactions});
      this.activeEngine=engine;
      return engine;
    }
    destroy({root,manifest,context}={}){
      this.activeEngine?.unmount?.({root,manifest,context});
      this.activeEngine=null;
    }
  }

  global.STUDYWORLD_RUNTIME_CORE=Object.freeze({EngineRegistry,InteractionRuntime,StudyRuntime});
})(window);
