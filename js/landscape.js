/* Interactive industry landscape: ordered layers, subsectors and representative companies. */
(() => {
  'use strict';
  const M=window.AtlasModel;
  const preferred={
    hardware:['NVIDIA','Groq','Cerebras'],cloud:['CoreWeave','Nebius','Lambda','Crusoe'],
    training:['Together AI','Prime Intellect','Thinking Machines Lab','Applied Compute'],
    inference:['Fireworks AI','Modal','Baseten','Inferact'],
    database:['Databricks','ClickHouse','LanceDB','Qdrant'],
    retrieval:['Exa','Tavily','Firecrawl','Reducto'],memory:['Mem0','Zep','Supermemory'],
    'expert-data':['Surge AI','Mercor','Scale AI','Human Intelligence'],
    'rl-environment':['Halluminate','Deeptune','Mechanize','UniPat AI','Copula Lab'],
    simulation:['Applied Intuition','Lightwheel','Monolith AI'],
    sandbox:['E2B','Daytona','Runloop','Blaxel'],browser:['Browserbase','Browser Use','Kernel','Steel'],
    durable:['Temporal','Inngest','Trigger.dev','Restate'],connectors:['Composio','Arcade','Pipedream','Stainless'],
    frameworks:['LangChain','CrewAI','Mastra','Pydantic'],workflow:['n8n','Dify','Flowise','StackAI (Asana)'],
    gateway:['OpenRouter','Portkey','LiteLLM','Helicone'],evaluation:['Braintrust','Langfuse','Arize AI','Weights & Biases'],
    security:['WorkOS','Clerk','Protect AI','Keycard'],voice:['ElevenLabs','LiveKit','Deepgram','Retell AI'],
    payments:['Stripe','Skyfire','Catena Labs'],models:['OpenAI','Anthropic','Hugging Face','DeepSeek']
  };
  const dated=e=>String(e.dateOrder||e.date||'');
  function companySnapshot(record,ctx,cutoff){
    const events=M.companyEvents(record.id).filter(e=>dated(e)<=cutoff);
    const acquisition=events.find(e=>e.type==='acquisition');
    const valuation=events.find(e=>e.type==='valuation'&&M.interval(e));
    const round=events.find(e=>e.type==='funding'&&e.kind!=='funding_combined_rounds'&&M.interval(e));
    const combined=events.find(e=>e.type==='funding'&&e.kind==='funding_combined_rounds'&&e.dateBasis!=='catalogue_snapshot'&&M.interval(e));
    const catalogue=events.find(e=>e.dateBasis==='catalogue_snapshot'&&M.interval(e));
    const equityFloor=events.filter(e=>e.type==='funding'&&e.kind==='funding_equity'&&M.interval(e)).reduce((sum,e)=>sum+M.interval(e).low,0);
    const knownFloor=Math.max(equityFloor,combined?M.interval(combined).low:0);
    // A directory snapshot cannot replace a larger, attributable financing disclosure.
    const cumulative=combined&&(!round||dated(combined)>=dated(round))?combined:catalogue&&M.interval(catalogue).low>=knownFloor?catalogue:null;
    const revenue=events.find(e=>e.type==='revenue'&&['ARR','annualized_revenue'].includes(e.kind)&&M.interval(e));
    const observation=acquisition||valuation||cumulative||round||revenue;
    let label='',status='',acquired=Boolean(acquisition),note='';
    if(acquisition){
      const completedBy=acquisition.closedDate||acquisition.completedBy;
      status=acquisition.status==='signed'||(completedBy&&completedBy>cutoff)?'Signed':acquisition.scope==='team'?'Team joined':acquisition.scope==='product'?'Product acquired':'Acquired';
      label=status+' → '+(acquisition.buyer||'Buyer undisclosed');
    }else if(valuation){label=(valuation.sourceBasis==='negotiation'?'Valuation (in talks) ':valuation.sourceBasis==='third_party_estimate'?'Valuation (est.) ':valuation.sourceBasis==='media_report'?'Valuation (reported) ':'Valuation ')+valuation.display;}
    else if(cumulative){label=(cumulative.dateBasis==='catalogue_snapshot'?'Total raised (est.) ':'Funding (combined) ')+cumulative.display;}
    else if(round){label=(round.sourceBasis==='negotiation'?'Proposed raise ':round.kind==='funding_debt'?(/facility/i.test(round.valueText||'')?'Credit facility ':'Debt financing '):round.kind==='funding_equity'?'Equity round ':'Funding ')+round.display;}
    else if(revenue){label=(revenue.kind==='ARR'?'ARR ':'Annualized revenue ')+revenue.display;}
    else if(ctx.year==='all'||ctx.year===M.data.snapshotDate.slice(0,4)){
      acquired=['Acquired','Signed—pending close'].includes(record.status);
      if(acquired)label=record.buyer?('Acquired → '+record.buyer):'Acquired / signed';
    }
    if(!label)label=record.entity==='Product / open-source project'?'Product / open-source project':record.product?'Product profile':'Company profile';
    if(observation)note=observation.date.slice(0,7)+' · '+M.sourceLabel(observation);
    return{record,acquired,label,status,note,observation,valuation,acquisition};
  }
  function build(ctx){
    const year=ctx.year==='all'?M.data.snapshotDate.slice(0,4):ctx.year||'2026';
    const cutoff=year===M.data.snapshotDate.slice(0,4)?M.data.snapshotDate:year+'-12-31';
    const stats=M.stats(ctx),all=M.records(ctx),layers=M.taxonomy.map(primary=>{
      const pctx={...ctx,primary:primary.id,secondary:''},pstats=M.stats(pctx);
      const children=primary.children.map(secondary=>{
        const sctx={...pctx,secondary:secondary.id},records=M.records(sctx),ids=new Set(records.map(r=>r.id));
        const chosen=[],chosenIds=new Set();
        for(const name of preferred[secondary.id]||[]){const r=records.find(r=>M.normalize(r.name)===M.normalize(name))||M.findName(name);if(r&&ids.has(r.id)&&!chosenIds.has(r.id)){chosen.push(r);chosenIds.add(r.id);}}
        const limit=secondary.id==='rl-environment'?5:4;
        if(secondary.id!=='discovery')for(const record of [...records].sort((a,b)=>Number(b.core)-Number(a.core)||M.companyEvents(b.id).length-M.companyEvents(a.id).length||a.name.localeCompare(b.name))){if(chosen.length>=limit)break;if(!chosenIds.has(record.id)){chosen.push(record);chosenIds.add(record.id);}}
        return{...secondary,ctx:sctx,stats:M.stats(sctx),companies:chosen.slice(0,limit).map(r=>companySnapshot(r,ctx,cutoff))};
      });
      return{...primary,ctx:pctx,stats:pstats,children};
    });
    const capital=M.breakdown(ctx,'funding','primary').filter(g=>g.low>0&&g.id!=='adjacent').sort((a,b)=>b.low-a.low)[0];
    return{cutoff,all,stats,layers,capital,period:ctx.year==='all'?'2023–2026':year+(year===M.data.snapshotDate.slice(0,4)?' YTD':'')};
  }
  function render(root,ctx,ui){
    if(ctx.primary||ctx.secondary)return;
    const A=build(ctx),{make,btn,openCompany,openSector,openMetric,showCompanies}=ui;
    const section=make('section','infra-landscape');section.id='infra-landscape';section.setAttribute('aria-label','AI infrastructure landscape');
    const heading=make('div','landscape-heading'),title=make('div');title.append(make('div','eyebrow','AI INFRA / LANDSCAPE'),make('h2','','From usable compute to executable tasks and learning feedback'));
    const scope=make('span','landscape-scope',A.period+' · '+(ctx.country||'Global'));heading.append(title,scope);section.append(heading);
    const snapshot=make('div','landscape-snapshot');snapshot.append(btn(A.all.length+' companies / products','',()=>showCompanies(ctx)));
    for(const [metric,label]of [['funding','Funding'],['revenue','ARR / revenue'],['valuation','Median valuation'],['acquisition','M&A']]){const value=A.stats[metric];const node=btn(label+' '+value.display,'',()=>openMetric(metric,ctx));if(metric==='revenue')node.append(make('small','','Median '+value.medianDisplay));snapshot.append(node);}section.append(snapshot);
    const signals=make('div','landscape-signals');
    if(A.capital&&A.stats.funding.low>0){const share=(A.capital.low/A.stats.funding.low*100).toLocaleString('zh-CN',{maximumFractionDigits:1});signals.append(btn('Capital flow: '+A.capital.name+' · share of disclosed funding in the sample (lower bound) '+share+'%','',()=>openMetric('funding',{...ctx,primary:A.capital.id,secondary:''})));}
    const control=A.layers.find(p=>p.id==='control');if(control.stats.acquisition.count)signals.append(btn('Control-plane consolidation: '+control.stats.acquisition.count+' deals announced or signed','',()=>openMetric('acquisition',control.ctx)));
    section.append(signals);
    const legend=make('div','landscape-legend');legend.append(make('span','legend-dash','Dashed = acquired / signed / team joined'),make('span','','Company cards show the acquirer first, then valuation, then funding, with date and source type. Click a segment or company to drill down.'));section.append(legend);
    const layers=make('div','landscape-layers');
    for(const primary of A.layers){
      const layer=make('section','landscape-layer'+(primary.id==='adjacent'?' landscape-adjacent':''));layer.dataset.primary=primary.id;
      const header=make('div','landscape-layer-header'),name=make('div','landscape-layer-name');
      name.append(make('span','landscape-order',String(primary.order).padStart(2,'0')),btn(primary.name,'landscape-primary',()=>openSector(primary.id,'')));
      const facts=make('div','landscape-layer-facts');facts.append(btn(primary.stats.companyCount+' entries','',()=>showCompanies(primary.ctx)),btn('Funding '+primary.stats.funding.display,'',()=>openMetric('funding',primary.ctx)),btn('M&A '+primary.stats.acquisition.count+' deals','',()=>openMetric('acquisition',primary.ctx)));
      header.append(name,facts);layer.append(header);
      const children=make('div','landscape-children');children.style.setProperty('--landscape-columns',Math.min(4,primary.children.length));
      for(const secondary of primary.children){
        const child=make('section','landscape-subsector'+(!secondary.stats.companyCount?' is-empty':''));child.dataset.secondary=secondary.id;
        const subhead=make('div','landscape-subhead');subhead.append(btn(secondary.name,'landscape-secondary',()=>openSector(primary.id,secondary.id)),btn(secondary.stats.companyCount+' →','landscape-subcount',()=>showCompanies(secondary.ctx)));child.append(subhead);
        const companies=make('div','landscape-companies');
        for(const info of secondary.companies){
          const record=info.record,tile=btn('','landscape-company'+(info.acquired?' is-acquired':''),()=>openCompany(record.id));tile.dataset.companyId=record.id;
          const countries=ctx.country?[ctx.country,...(record.countries||[]).filter(c=>c!==ctx.country)]:record.countries||[];
          const top=make('span','landscape-company-top');top.append(make('strong','',record.name),make('span','landscape-country',countries.slice(0,2).join(' / ')));
          tile.append(top,make('span','landscape-company-number',info.label+(info.observation?' · '+info.observation.date.slice(0,7):'')));
          tile.title=[record.name,record.product,info.label,info.note].filter(Boolean).join('\n');companies.append(tile);
        }
        if(!secondary.companies.length)companies.append(btn(secondary.id==='discovery'?'View discovery pool →':'View this segment →','landscape-empty',()=>showCompanies(secondary.ctx)));
        child.append(companies);children.append(child);
      }
      layer.append(children);layers.append(layer);
    }
    section.append(layers,make('p','landscape-footnote','Layers run from base resources → data and feedback → execution → development and control → application components. The adjacent ecosystem is listed separately: headline totals and capital flow exclude layer 08, because single rounds at foundation-model labs run to tens of billions of dollars and would swamp the infrastructure sample. The directory is current coverage; amounts are public observations up to the end of the selected year. Funding is counted by announcement date; lower-bound shares are not industry market share.'));
    root.append(section);
  }
  window.InfraLandscape={build,render,companySnapshot};
})();
