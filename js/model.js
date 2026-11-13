/* Shared selection and aggregation for the offline Infra Atlas. All amounts are USD millions. */
(() => {
  'use strict';
  const data = typeof DATA !== 'undefined' ? DATA : window.DATA || JSON.parse(document.getElementById('board-data').textContent);
  const taxonomy = [...(data.taxonomy || [])].sort((a,b)=>(a.order||0)-(b.order||0)).map(p=>({...p,children:[...(p.children||[])].sort((a,b)=>(a.order||0)-(b.order||0))}));
  const byPrimary = new Map(taxonomy.map(p=>[p.id,p]));
  const bySecondary = new Map(taxonomy.flatMap(p=>p.children.map(s=>[s.id,{...s,primaryId:p.id}])));
  const normalize = value => String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  const catalog = new Map();
  for (const r of [...(data.records||[]),...(data.market?.externalCompanies||[])]) if(r.id&&!catalog.has(r.id)) catalog.set(r.id,r);
  const companies=[...catalog.values()], names=new Map(), searchIndex=new Map();
  for(const r of companies){
    const aliases=[r.name,r.company,...(Array.isArray(r.aliases)?r.aliases:[])];
    for(const name of [r.name,r.company]) if(name){aliases.push(name.replace(/[(][^)]*[)]/g,''));for(const part of name.matchAll(/[(]([^)]+)[)]/g)) aliases.push(part[1]);}
    for(const alias of aliases){const key=normalize(alias);if(key&&!names.has(key))names.set(key,r);}
    searchIndex.set(r.id,normalize([r.name,r.company,r.product,r.problem,r.customers,r.sector,r.primaryName,r.secondaryName,...(r.aliases||[]),...(r.countries||[])].join(' ')));
  }
  const cutoff=String(data.snapshotDate||data.market?.cutoff||'2026-11-01').slice(0,10);
  const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const numeric=v=>finite(v)?Number(v):null;
  const compact=v=>Number(v).toLocaleString('en-US',{maximumFractionDigits:2});
  function formatMoney(value){if(!finite(value))return'—';const v=Number(value),a=Math.abs(v);return '$'+compact(a>=1e6?v/1e6:a>=1e3?v/1e3:v)+(a>=1e6?'T':a>=1e3?'B':'M');}
  function formatRange(low,high){low=numeric(low);high=numeric(high);if(low===null&&high===null)return'—';if(low===null)return'≤ '+formatMoney(high);if(high===null)return'≥ '+formatMoney(low);if(Math.abs(low-high)<1e-9)return formatMoney(low);return formatMoney(low)+'–'+formatMoney(high);}
  function interval(e){let low=numeric(e.valueLowUsdM),high=numeric(e.valueHighUsdM),value=numeric(e.valueUsdM);if(low!==null||high!==null){if(low===null)low=0;if(high===null&&!e.lowerBound&&value!==null&&value>=low)high=value;return{low,high};}if(value===null)return null;return{low:value,high:e.lowerBound?null:value};}
  const sourceNames={regulatory:'Regulatory filing',company_disclosed:'Company disclosed',investor_disclosed:'Investor disclosed',media_report:'Media report',third_party_estimate:'Third-party estimate',negotiation:'Funding talks / rumor'};
  const formatDeal=e=>(e.buyer||'Buyer undisclosed')+' ← '+(e.target||e.company||'Target undisclosed');
  function sourceLabel(e){return e.sourceLabel||sourceNames[e.sourceBasis]||'Public information';}
  function basisLabel(e){const parts=[];if(e.basisLabel)parts.push(e.basisLabel);else if(e.type==='revenue')parts.push(e.kind==='ARR'?'ARR':e.kind==='annualized_revenue'?'Annualized revenue / run-rate':e.kind==='recognized_revenue'?'Period revenue':e.kind||'Operating metric');else if(e.type==='valuation')parts.push(e.valuationBasis||'Public valuation');else if(e.type==='funding')parts.push(e.round||'Equity funding');else if(e.type==='acquisition')parts.push(e.valueBasis||'M&A / consolidation');const original=e.originalDisplay||e.originalCurrencyDisplay;if(original)parts.push(original);if(e.fxNote)parts.push(e.fxNote);return parts.join(' · ');}
  const orderDate=e=>String(e.dateOrder||e.date||'').length===4?String(e.dateOrder||e.date)+'-12-31':String(e.dateOrder||e.date||'').length===7?String(e.dateOrder||e.date)+'-31':String(e.dateOrder||e.date||'');
  const sourceRank=e=>({regulatory:6,company_disclosed:5,investor_disclosed:4,media_report:3,third_party_estimate:2,negotiation:1}[e.sourceBasis]||0);
  const newest=(a,b)=>orderDate(b).localeCompare(orderDate(a))||sourceRank(b)-sourceRank(a)||String(b.id).localeCompare(String(a.id));
  const events=(data.market?.events||[]).map(e=>{const r=catalog.get(e.companyId)||names.get(normalize(e.company)),i=interval(e);const row={...e,companyId:r?.id||e.companyId,company:r?.name||e.company,primaryId:r?.primaryId||e.primaryId,secondaryId:r?.secondaryId||e.secondaryId,countries:r?.countries||e.countries||[],...(e.type==='acquisition'?{target:e.target||r?.name||e.company}:{}),dateOrder:orderDate(e)};row.display=e.display||(i?formatRange(i.low,i.high):e.valueText||'Amount undisclosed');row.sourceLabel=sourceLabel(e);row.basisLabel=basisLabel(e);row.countryDisplay=row.countries.join(' / ')||'Location to be added';if(e.fxNote&&!String(row.note||'').includes(e.fxNote))row.note=[row.note,e.fxNote].filter(Boolean).join('; ');return row;}).sort(newest);
  const eventsByCompany=new Map();for(const e of events){if(!eventsByCompany.has(e.companyId))eventsByCompany.set(e.companyId,[]);eventsByCompany.get(e.companyId).push(e);}
  const ctxDefaults={year:'2026',country:'',primary:'',secondary:'',search:''};
  const context=ctx=>({...ctxDefaults,...ctx,year:String(ctx?.year===undefined?ctxDefaults.year:ctx.year||'all')});
  const cacheRecords=new Map(),cacheRows=new Map(),cacheStats=new Map();
  const selectionKey=ctx=>JSON.stringify([ctx.country||'',ctx.primary||'',ctx.secondary||'',normalize(ctx.search)]);
  const fullKey=ctx=>JSON.stringify([ctx.year||'all',selectionKey(ctx)]);
  function records(input={}){const ctx=context(input),key=selectionKey(ctx);if(cacheRecords.has(key))return cacheRecords.get(key);const terms=String(ctx.search||'').trim().split(/\s+/).map(normalize).filter(Boolean);const rows=companies.filter(r=>(!ctx.primary||r.primaryId===ctx.primary)&&(!ctx.secondary||r.secondaryId===ctx.secondary)&&(!ctx.country||(r.countries||[]).includes(ctx.country))&&terms.every(term=>searchIndex.get(r.id).includes(term)));cacheRecords.set(key,rows);return rows;}
  function yearEnd(ctx){const year=ctx.year==='all'?cutoff.slice(0,4):ctx.year;return Math.min(Number(year),Number(cutoff.slice(0,4)))===Number(cutoff.slice(0,4))?cutoff:year+'-12-31';}
  function metricRows(input={},metric){const ctx=context(input),key=metric+'|'+fullKey(ctx);if(cacheRows.has(key))return cacheRows.get(key);const ids=new Set(records(ctx).map(r=>r.id)),end=yearEnd(ctx),start=ctx.year==='all'?'2023-01-01':ctx.year+'-01-01';let rows=events.filter(e=>ids.has(e.companyId)&&orderDate(e)<=end);
    if(metric==='funding')rows=rows.filter(e=>e.type==='funding'&&e.countableFunding===true&&e.kind!=='funding_combined_rounds'&&interval(e)&&orderDate(e)>=start);
    else if(metric==='acquisition')rows=rows.filter(e=>e.type==='acquisition'&&orderDate(e)>=start);
    else if(metric==='revenue'||metric==='valuation'){
      rows=rows.filter(e=>e.type===metric&&interval(e)&&(metric!=='revenue'||['ARR','annualized_revenue'].includes(e.kind)));
      const grouped=new Map();for(const e of rows){if(!grouped.has(e.companyId))grouped.set(e.companyId,[]);grouped.get(e.companyId).push(e);}
      rows=[...grouped.values()].map(list=>{const whole=list.filter(e=>!e.scope||e.scope==='company');return(whole.length?whole:list).sort(newest)[0];});
    }else rows=[];
    rows=rows.sort(newest);cacheRows.set(key,rows);return rows;
  }
  function median(values){const sorted=[...values].sort((a,b)=>a-b),n=sorted.length;if(!n)return null;const value=n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2;return Number.isFinite(value)?value:null;}
  function aggregate(rows,metric){const count=rows.length,intervals=rows.map(interval).filter(Boolean);let low=null,high=null;
    // Valuation is a median, never an additive capital or revenue total. Endpoints retain observed ranges.
    if(intervals.length){if(metric==='valuation'){low=median(intervals.map(i=>i.low));high=median(intervals.map(i=>i.high===null?Infinity:i.high));}else{low=intervals.reduce((sum,i)=>sum+i.low,0);high=intervals.some(i=>i.high===null)?null:intervals.reduce((sum,i)=>sum+i.high,0);}}
    const buyers=metric==='acquisition'?[...new Set(rows.map(e=>e.buyer).filter(Boolean))]:undefined;
    const deals=metric==='acquisition'?rows.map(e=>({id:e.id,buyer:e.buyer||'Buyer undisclosed',target:e.target||e.company,seller:e.seller||null,companyId:e.companyId,label:formatDeal(e)})):undefined;
    const medianLow=metric==='revenue'&&intervals.length?median(intervals.map(i=>i.low)):null;
    const medianHigh=metric==='revenue'&&intervals.length?median(intervals.map(i=>i.high===null?Infinity:i.high)):null;
    return{value:low,low,high,count,rows,buyers,deals,display:metric==='acquisition'?count+' deals':count?formatRange(low,high):'—',
      ...(metric==='revenue'?{medianLow,medianHigh,medianDisplay:formatRange(medianLow,medianHigh)}:{})};
  }
  function stats(input={}){const ctx=context(input),key=fullKey(ctx);if(cacheStats.has(key))return cacheStats.get(key);const result={companyCount:records(ctx).length};
    // Global (no layer selected) totals cover the infra stack only; the adjacent layer (frontier labs, unclassified) is reported in its own layer view.
    const coreOnly=!ctx.primary&&!ctx.secondary;result.excludesAdjacent=coreOnly;
    for(const metric of ['funding','revenue','valuation','acquisition']){let rows=metricRows(ctx,metric);if(coreOnly)rows=rows.filter(e=>e.primaryId!=='adjacent');result[metric]=aggregate(rows,metric);}cacheStats.set(key,result);return result;}
  function breakdown(input={},metric,level='primary'){const ctx=context(input),rows=metricRows(ctx,metric),groups=level==='primary'?taxonomy.filter(p=>!ctx.primary||p.id===ctx.primary):taxonomy.filter(p=>!ctx.primary||p.id===ctx.primary).flatMap(p=>p.children).filter(s=>!ctx.secondary||s.id===ctx.secondary);return groups.map(group=>{const list=rows.filter(e=>(level==='primary'?e.primaryId:e.secondaryId)===group.id);return{id:group.id,name:group.name,...aggregate(list,metric)};});}
  function company(id){return catalog.get(id)||null;}
  function companyEvents(id){return eventsByCompany.get(id)||[];}
  function findName(name){const exact=names.get(normalize(name));if(exact)return exact;const base=normalize(String(name||'').replace(/[(][^)]*[)]/g,''));return names.get(base)||null;}
  window.AtlasModel={data,taxonomy,records,stats,metricRows,breakdown,company,companyEvents,findName,formatMoney,formatRange,sourceLabel,normalize,interval,formatDeal};
})();
