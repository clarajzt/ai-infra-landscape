/* Browser navigation for the single-file atlas, including offline file URLs. */
(() => {
  'use strict';
  window.createAtlasNavigation = ({state,model,renderMain,renderDetail,dialog,cancelPending}) => {
    const events=new Map(model.records({year:'all'}).flatMap(r=>model.companyEvents(r.id)).map(e=>[e.id,e]));
    let current=null,restoring=false,epoch=0,positionTimer=0;
    const clone=value=>JSON.parse(JSON.stringify(value));
    function packDrawer(d){
      if(d.type==='event')return{type:d.type,eventId:d.event.id};
      if(d.type==='rows')return{type:d.type,title:d.title,subtitle:d.subtitle,page:d.page,rowIds:d.rows.map(e=>e.id)};
      return clone(d);
    }
    function unpackDrawer(d){
      if(d.type==='event')return events.has(d.eventId)?{type:'event',event:events.get(d.eventId)}:null;
      if(d.type==='rows')return{type:'rows',title:d.title,subtitle:d.subtitle,page:d.page||1,rows:(d.rowIds||[]).map(id=>events.get(id)).filter(Boolean)};
      if(d.type==='company')return model.company(d.id)?d:null;
      if(d.type==='metric'&&['funding','revenue','valuation','acquisition'].includes(d.metric))return d;
      return null;
    }
    function snapshot(){return{view:state.view,ctx:{...state.ctx},expanded:[...state.expanded],annualMetric:state.annualMetric,
      companyPage:state.companyPage,eventPage:state.eventPage,generation:state.generation,drawers:state.drawers.map(packDrawer)};}
    const key=route=>JSON.stringify({...route,expanded:undefined});
    const searchBase=route=>JSON.stringify({...route,expanded:undefined,ctx:{...route.ctx,search:''}});
    function position(){return{x:scrollX,y:scrollY,dialog:dialog.scrollTop,tables:[...document.querySelectorAll('.table-wrap')].map(n=>n.scrollLeft)};}
    function restorePosition(p){
      if(!p)return;
      scrollTo({left:p.x||0,top:p.y||0,behavior:'instant'});dialog.scrollTop=p.dialog||0;
      document.querySelectorAll('.table-wrap').forEach((n,i)=>{n.scrollLeft=p.tables?.[i]||0;});
    }
    function urlFor(route){
      const params=new URLSearchParams({view:route.view,year:route.ctx.year});
      for(const name of ['country','primary','secondary','search'])if(route.ctx[name])params.set(name,route.ctx[name]);
      if(route.companyPage>1)params.set('page',route.companyPage);
      if(route.eventPage>1)params.set('events',route.eventPage);
      if(route.annualMetric!=='funding')params.set('annual',route.annualMetric);
      if(route.generation!=='G5')params.set('generation',route.generation);
      if(route.expanded.length)params.set('expanded',route.expanded.join(','));
      if(route.drawers.length)params.set('detail',JSON.stringify(route.drawers.at(-1)));
      return location.pathname+location.search+'#'+params.toString();
    }
    function fromUrl(){
      const params=new URLSearchParams(location.hash.slice(1)),route=snapshot();
      route.view=['market','companies','research'].includes(params.get('view'))?params.get('view'):'market';
      route.ctx={year:['2023','2024','2025','2026','all'].includes(params.get('year'))?params.get('year'):'2026',country:params.get('country')||'',primary:params.get('primary')||'',secondary:params.get('secondary')||'',search:params.get('search')||''};
      if(!model.taxonomy.some(p=>p.id===route.ctx.primary))route.ctx.primary='';
      const parent=model.taxonomy.find(p=>p.children.some(s=>s.id===route.ctx.secondary));
      if(parent)route.ctx.primary=parent.id;else route.ctx.secondary='';
      route.companyPage=Math.max(1,Number(params.get('page'))||1);route.eventPage=Math.max(1,Number(params.get('events'))||1);
      route.annualMetric=['funding','revenue','valuation','acquisition'].includes(params.get('annual'))?params.get('annual'):'funding';
      route.generation=/^G[1-5]$/.test(params.get('generation'))?params.get('generation'):'G5';
      route.expanded=(params.get('expanded')||'').split(',').filter(id=>model.taxonomy.some(p=>p.id===id));route.drawers=[];
      try{const detail=JSON.parse(params.get('detail')||'null');if(detail&&unpackDrawer(detail))route.drawers=[detail];}catch{}
      return route;
    }
    function write(mode,entry){
      const url=urlFor(entry.route);entry.url=url;history[mode+'State'](entry,'',url);current=entry;
    }
    function savePosition(){
      if(!current||restoring)return;
      const next=position();if(JSON.stringify(next)===JSON.stringify(current.position))return;
      current={...current,position:next};history.replaceState(current,'');
    }
    function commit(){
      if(restoring||!current)return;
      epoch++;
      const route=snapshot();
      if(key(route)===key(current.route)||searchBase(route)===searchBase(current.route)){
        write('replace',{...current,route});return;
      }
      // The old entry's position was captured before the click/change mutated the DOM.
      const index=current.index+1,baseIndex=route.drawers.length?current.baseIndex:index;
      write('push',{infraAtlas:1,index,baseIndex,route,position:position()});
    }
    function restore(entry){
      restoring=true;epoch++;cancelPending?.();
      const route=entry.route;Object.assign(state,{
        view:route.view,ctx:{...route.ctx},expanded:new Set(route.expanded||[]),annualMetric:route.annualMetric,
        companyPage:route.companyPage||1,eventPage:route.eventPage||1,generation:route.generation||'G5',
        drawers:(route.drawers||[]).map(unpackDrawer).filter(Boolean)
      });
      current=entry;renderMain();
      if(state.drawers.length){renderDetail();if(!dialog.open)dialog.showModal();}
      else if(dialog.open)dialog.close();
      restorePosition(entry.position);restoring=false;
      const token=epoch;requestAnimationFrame(()=>{if(token===epoch)restorePosition(entry.position);});
    }
    function start(){
      history.scrollRestoration='manual';
      const saved=history.state;
      const entry=saved?.infraAtlas===1&&saved.url===location.pathname+location.search+location.hash?saved:
        {infraAtlas:1,index:0,baseIndex:0,route:fromUrl(),position:position()};
      write('replace',entry);restore(entry);
      addEventListener('popstate',event=>{
        const entry=event.state?.infraAtlas===1?event.state:{infraAtlas:1,index:0,baseIndex:0,route:fromUrl(),position:{x:0,y:0}};
        restore(entry);
      });
      addEventListener('hashchange',()=>{
        if(current.url===location.pathname+location.search+location.hash)return;
        const entry={infraAtlas:1,index:0,baseIndex:0,route:fromUrl(),position:{x:0,y:0}};
        write('replace',entry);restore(entry);
      });
      for(const name of ['click','change','input'])document.addEventListener(name,savePosition,true);
      document.addEventListener('scroll',()=>{clearTimeout(positionTimer);positionTimer=setTimeout(savePosition,250);},true);
      addEventListener('pagehide',savePosition);
    }
    function closeDrawers(){
      cancelPending?.();
      if(current.index>current.baseIndex){history.go(current.baseIndex-current.index);return;}
      state.drawers=[];if(dialog.open)dialog.close();write('replace',{...current,route:snapshot(),position:position()});
    }
    function backDetail(){
      if(current.index>current.baseIndex){history.back();return;}
      state.drawers.pop();if(state.drawers.length)renderDetail();else closeDrawers();
    }
    function checkpoint(){
      if(!current||restoring)return;
      write('replace',{...current,route:snapshot(),position:position()});
    }
    return{start,commit,checkpoint,closeDrawers,backDetail};
  };
})();
