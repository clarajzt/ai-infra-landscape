/* Sector analysis derived from the same public observations used in the map. */
(() => {
  'use strict';
  const M = window.AtlasModel;
  const numeric = v => v !== null && v !== undefined && Number.isFinite(Number(v));
  const date = e => String(e.dateOrder || e.date || '');
  const pct = v => (v * 100).toLocaleString('zh-CN', {maximumFractionDigits: 1}) + '%';
  const sum = rows => {
    const parts = rows.map(M.interval).filter(Boolean);
    return {low: parts.length ? parts.reduce((s, p) => s + p.low, 0) : null,
      high: !parts.length || parts.some(p => p.high === null) ? null : parts.reduce((s, p) => s + p.high, 0)};
  };
  const amount = rows => { const value = sum(rows); return M.formatRange(value.low, value.high); };
  const metricNames={funding:'Funding',revenue:'ARR / annualized revenue',valuation:'Valuation',acquisition:'M&A'};
  function rankCompanies(rows, limit = 5) {
    const grouped = new Map();
    for (const e of rows) {
      if (!grouped.has(e.companyId)) grouped.set(e.companyId, []);
      grouped.get(e.companyId).push(e);
    }
    const ranked = [...grouped].map(([id, list]) => ({id, name: M.company(id)?.name || list[0].company,
      rows: list, ...sum(list), display: amount(list)})).sort((a,b) => b.low - a.low);
    const total = sum(rows).low;
    return {all: ranked, top: ranked.slice(0, limit), top3: ranked.slice(0, 3),
      share: total > 0 ? ranked.slice(0, 3).reduce((s,r) => s + r.low, 0) / total : null,
      usesBounds: rows.some(e => {const i=M.interval(e); return i && (i.high===null || i.high!==i.low);})};
  }
  function analyze(ctx) {
    const currentYear = M.data.snapshotDate.slice(0, 4), year = ctx.year === 'all' ? currentYear : String(ctx.year || currentYear);
    const end = year === currentYear ? M.data.snapshotDate : year + '-12-31';
    const start = ctx.year === 'all' ? '2023-01-01' : year + '-01-01';
    const companies = M.records(ctx), ids = new Set(companies.map(r => r.id));
    const observations = [...new Map(companies.flatMap(r => M.companyEvents(r.id)).filter(e => date(e) <= end).map(e=>[e.id,e])).values()];
    const financialRows = observations.filter(e => ['funding','revenue','valuation'].includes(e.type) && M.interval(e));
    const covered = new Set(financialRows.map(e=>e.companyId));
    const stats = M.stats(ctx), previousCtx = {...ctx, year: String(Number(year)-1)};
    const previous = M.stats(previousCtx);
    const funding = rankCompanies(stats.funding.rows), revenue = rankCompanies(stats.revenue.rows);
    const previousIncome = new Map(previous.revenue.rows.map(e=>[e.companyId,e]));
    const updatedIncome = stats.revenue.rows.filter(e => {
      const before = previousIncome.get(e.companyId);
      return before && before.id !== e.id && e.kind === before.kind && (e.scope||'company') === (before.scope||'company');
    });
    // Only finite comparable ranges enter the cohort; no inferred ARR from usage multiples.
    const comparable = updatedIncome.map(after=>({after,before:previousIncome.get(after.companyId)})).filter(pair=>{
      const a=M.interval(pair.after), b=M.interval(pair.before);
      return a && b && b.low>0 && a.high!==null && b.high!==null;
    });
    const afterTotal = sum(comparable.map(p=>p.after)), beforeTotal = sum(comparable.map(p=>p.before));
    const cohort = {pairs:comparable, updated:updatedIncome.length, before:beforeTotal, after:afterTotal,
      low: beforeTotal.high>0 ? afterTotal.low/beforeTotal.high-1 : null,
      high: beforeTotal.low>0 ? afterTotal.high/beforeTotal.low-1 : null};
    cohort.changes = comparable.map(pair => {
      const a=M.interval(pair.after),b=M.interval(pair.before);
      return {...pair,low:a.low/b.high-1,high:a.high/b.low-1};
    }).sort((a,b) => Math.abs((b.low+b.high)/2)-Math.abs((a.low+a.high)/2));
    const buyers = new Map();
    for (const event of stats.acquisition.rows) {
      const buyer=event.buyer||'Buyer undisclosed';
      if (!buyers.has(buyer)) buyers.set(buyer,[]);
      buyers.get(buyer).push(event);
    }
    const buyerRows = [...buyers].map(([name,rows])=>({name,rows,count:rows.length,known:rows.filter(e=>M.interval(e)),display:amount(rows)}))
      .sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
    const annual = ['2023','2024','2025','2026'].filter(y=>y<=year).map(y=>({year:y,stats:M.stats({...ctx,year:y})}));
    const primary = M.taxonomy.find(p=>p.id===ctx.primary);
    const children = !ctx.secondary && primary ? primary.children.map(s=>({id:s.id,name:s.name,stats:M.stats({...ctx,secondary:s.id})})) : [];
    const signals = observations.filter(e => date(e)>=start && (e.kind==='growth'||e.type==='usage'||e.kind==='usage'))
      .sort((a,b)=>date(b).localeCompare(date(a)));
    const signalCompanies=new Set();
    const latestSignals=signals.filter(e=>{if(signalCompanies.has(e.companyId))return false;signalCompanies.add(e.companyId);return true;}).slice(0,6);
    return {ctx,year,end,start,companies,ids,stats,previousCtx,previous,financialRows,covered:covered.size,
      funding,revenue,cohort,buyers:buyerRows,annual,children,signals:latestSignals,
      period:ctx.year==='all'?'2023–'+year:year+(year===currentYear?' YTD':''),
      priorPeriod:String(Number(year)-1)+' full year',isYtd:ctx.year!=='all' && year===currentYear};
  }
  function growthText(low, high) {
    const signed=v=>(v>=0?'+':'−')+pct(Math.abs(v));
    if(low===null || high===null)return'No comparable amounts';
    return Math.abs(low-high)<1e-8?signed(low):signed(low)+' to '+signed(high);
  }
  function render(root,ctx,ui) {
    if(!ctx.primary&&!ctx.secondary)return;
    const A=analyze(ctx),{make,btn,sectionHead,openRows,openCompany,openSector,openObservation,showCompanies}=ui;
    const wrapper=make('section','sector-summary');wrapper.dataset.sector=ctx.secondary||ctx.primary;
    wrapper.append(sectionHead('Segment summary and key data',A.period+' · follows the current year, country, segment and search filters'));
    const table=(headers,cls='')=>{const wrap=make('div','table-wrap'),t=make('table',cls),head=make('thead'),tr=make('tr');headers.forEach(h=>tr.append(make('th','',h)));head.append(tr);const body=make('tbody');t.append(head,body);wrap.append(t);return{wrap,body};};
    const category=M.taxonomy.find(p=>p.id===ctx.primary),scope=category?.children.find(s=>s.id===ctx.secondary)?.name||category?.name||'';
    const drill=(text,rows,title)=>btn(text,'table-button summary-drill',()=>openRows(title,rows,A.period+' / '+scope+(ctx.country?' / '+ctx.country:'')));
    const medianDrills=(value,metric,title)=>{if(metric!=='revenue')return[];const node=drill('Median '+value.medianDisplay,value.rows,title+' · median sample');node.classList.add('metric-median');return[node];};
    const dealDrills=(value,metric,title)=>{if(metric!=='acquisition'||!value.deals?.length)return[];const box=make('div','acquisition-pairs');box.append(make('span','deal-parties-label','Buyer ← seller / target'));for(const deal of value.deals){const node=drill(deal.label,value.rows.filter(e=>e.id===deal.id),title+' · deal parties');node.classList.add('deal-pair');box.append(node);}return[box];};
    const comparison=make('div','sector-takeaways');
    const addTakeaway=(label,value,detail,rows)=>{const item=make('article','sector-takeaway');item.append(make('span','',label),drill(value,rows,label+' · breakdown'),make('p','',detail));comparison.append(item);};
    const capitalRatio=ctx.year!=='all' && A.previous.funding.low>0 && A.stats.funding.low!==null ? A.stats.funding.low/A.previous.funding.low : null;
    const fundingDetail=A.stats.funding.count ? A.stats.funding.count+' rounds with disclosed amounts across '+A.funding.all.length+' companies; '+(capitalRatio!==null?'on disclosed lower bounds, vs '+A.priorPeriod+': '+pct(capitalRatio)+(A.isYtd?' (year to date against a full year)':'')+'.':'counted by announcement date.') : 'No dated funding amounts in the sample for this period; total raised is kept in company details.';
    addTakeaway('Funding activity',A.stats.funding.display,fundingDetail,A.stats.funding.rows);
    if(A.stats.revenue.count || !A.signals.length){
      addTakeaway('Revenue disclosure',A.stats.revenue.count+' / '+A.companies.length+' companies',
        A.stats.revenue.count?'Sample ARR / annualized revenue total '+A.stats.revenue.display+'; median '+A.stats.revenue.medianDisplay+'; disclosure coverage '+pct(A.stats.revenue.count/Math.max(1,A.companies.length))+'.':'Where no absolute revenue is available, metrics, funding and valuation are shown.',A.stats.revenue.rows);
    }else{
      addTakeaway('Operating signals',A.signals.length+' companies with operating disclosures',A.signals.slice(0,2).map(e=>e.company+': '+(e.valueText||e.note||e.display)).join('; '),A.signals);
    }
    addTakeaway('Funding concentration',A.funding.share===null?'—':'Top '+A.funding.top3.length+': '+pct(A.funding.share),
      A.funding.top3.length?A.funding.top3.map(r=>r.name).join(', ')+'; by disclosed funding'+(A.funding.usesBounds?' (lower bound)':'')+', not industry share.':'No rankable round amounts in this period.',A.funding.top3.flatMap(r=>r.rows));
    addTakeaway('Consolidation activity',A.stats.acquisition.count+' deals / '+A.buyers.length+' buyers',
      A.buyers.length?'Parties: '+A.stats.acquisition.rows.slice(0,3).map(M.formatDeal).join('; ')+(A.stats.acquisition.count>3?'; more in the breakdown.':'.'):'No acquisition announcements in the sample for this period.',A.stats.acquisition.rows);
    wrapper.append(comparison);
    const summary=table(['Dimension','This period','Comparison / structure','Reading and basis'],'sector-summary-table');
    function summaryRow(label,current,comparison,conclusion){const tr=make('tr');tr.append(make('th','',label));for(const cell of [current,comparison,conclusion]){const td=make('td');td.append(typeof cell==='string'?make('span','',cell):cell);tr.append(td);}summary.body.append(tr);}
    summaryRow('Funding',drill(A.stats.funding.display+' · '+A.stats.funding.count+' rounds',A.stats.funding.rows,'Funding this period'),
      ctx.year==='all'?'Cumulative announced rounds since 2023':drill(A.priorPeriod+': '+A.previous.funding.display+' · '+A.previous.funding.count+' rounds',A.previous.funding.rows,'Prior-year funding'),
      A.funding.top.length?'Largest raiser: '+A.funding.top[0].name+', total this period '+A.funding.top[0].display+'; multiple rounds by one company are combined.':'Total raised, debt facilities and secondary sales are not counted as new equity funding.');
    summaryRow('Revenue scale',drill('Total '+A.stats.revenue.display+'; median '+A.stats.revenue.medianDisplay+' · '+A.stats.revenue.count+' companies',A.stats.revenue.rows,'Public revenue breakdown and median sample'),
      A.revenue.share===null?'No absolute amounts yet':drill('Top '+A.revenue.top3.length+' by revenue: '+pct(A.revenue.share)+(A.revenue.usesBounds?' (lower bound)':''),A.revenue.top3.flatMap(r=>r.rows),'Top companies by revenue'),
      'Each company contributes its latest ARR or run-rate before period end. This is a total of the disclosed sample across different business models, not segment revenue.');
    const cohortRows=A.cohort.pairs.flatMap(p=>[p.before,p.after]);
    summaryRow('Like-for-like change',ctx.year==='all'?'See yearly observations below':drill(A.cohort.pairs.length+' comparable companies · '+growthText(A.cohort.low,A.cohort.high),cohortRows,'Same-company, same-basis revenue change'),
      A.cohort.pairs.length?M.formatRange(A.cohort.before.low,A.cohort.before.high)+' → '+M.formatRange(A.cohort.after.low,A.cohort.after.high):'No same-company, same-basis sample with finite amounts in both periods',
      'Only companies with a new disclosure on the same basis are compared. Undisclosed amounts are not treated as zero, and sample changes are not read as industry growth.');
    summaryRow('Valuation',drill(A.stats.valuation.display+' · '+A.stats.valuation.count+' companies',A.stats.valuation.rows,'Public valuation sample'),
      drill(A.priorPeriod+' median: '+A.previous.valuation.display+' · '+A.previous.valuation.count+' companies',A.previous.valuation.rows,'Prior-year valuation sample'),
      'The median moves with the sample and round timing. Media estimates and in-talks values keep their labels and are not investment returns.');
    summaryRow('M&A and parties',drill(A.stats.acquisition.count+' announced deals',A.stats.acquisition.rows,'Acquisition announcements'),
      ctx.year==='all'?'Cumulative announcements since 2023':drill(A.priorPeriod+': '+A.previous.acquisition.count+' deals',A.previous.acquisition.rows,'Prior-year acquisition announcements'),
      A.buyers.length?'Buyers: '+A.buyers.length+'; disclosed value '+amount(A.stats.acquisition.rows)+'; signing and closing are listed separately in events.':'No recorded deals does not mean no deals in the industry.');
    summaryRow('Data coverage',drill(A.covered+' / '+A.companies.length+' companies with financial amounts',A.financialRows,'Companies and observations with financial data'),
      drill(A.financialRows.length+' financial observations',A.financialRows,'All financial observations'),
      'Directory total-raised figures count toward coverage but not annual flow. Companies without ARR keep their operating and usage signals.');
    wrapper.append(summary.wrap);
    if(A.children.length){
      wrapper.append(sectionHead('Segment comparison','Same observation period. Revenue is the latest disclosed snapshot; funding and M&A are announcement flows.'));
      const child=table(['Segment','Company / product','Equity funding','ARR / annualized revenue','Median valuation','M&A'],'sector-structure-table');
      for(const group of A.children){const row=make('tr'),name=make('td');name.append(btn(group.name,'table-button',()=>openSector(ctx.primary,group.id)));row.append(name);const count=make('td');count.append(btn(group.stats.companyCount+' companies','table-button',()=>showCompanies({...ctx,secondary:group.id})));row.append(count);for(const metric of ['funding','revenue','valuation','acquisition']){const value=group.stats[metric],td=make('td');td.append(drill(value.display,value.rows,group.name+' · '+metricNames[metric]),...medianDrills(value,metric,group.name),...dealDrills(value,metric,group.name),make('div','subtle',value.count+(metric==='funding'?' rounds':metric==='acquisition'?' deals':' companies')));row.append(td);}child.body.append(row);}wrapper.append(child.wrap);
    }
    wrapper.append(sectionHead('Year by year','Amounts shown with sample sizes. '+(A.isYtd?A.year+' is year to date as of '+A.end+'; other years are full years.':'New disclosures in the sample are not treated as organic growth.')));
    const years=table(['Year','Funding / rounds','ARR / annualized revenue / sample','Median valuation / sample','Acquisition announcements'],'sector-year-table');
    for(const period of A.annual){const row=make('tr');row.append(make('th','',period.year+(period.year===M.data.snapshotDate.slice(0,4)?' YTD':'')));for(const metric of ['funding','revenue','valuation','acquisition']){const value=period.stats[metric],td=make('td');td.append(drill(value.display,value.rows,period.year+' · '+metricNames[metric]),...medianDrills(value,metric,period.year),...dealDrills(value,metric,period.year),make('div','subtle',value.count+(metric==='funding'?' rounds':metric==='acquisition'?' deals':' companies')));row.append(td);}years.body.append(row);}wrapper.append(years.wrap);
    const rankings=make('div','sector-rankings');
    for(const [label,ranking] of [['Funding by company',A.funding],['Largest by revenue',A.revenue]]){
      const box=make('section','sector-ranking');box.append(sectionHead(label,'Ranked by disclosed amounts in the sample'+(ranking.usesBounds?' (lower bound)':'')+'; not industry market share.'));
      if(!ranking.top.length)box.append(make('p','subnote','No absolute amounts recorded for this period; see operating and usage signals below.'));
      for(const [i,r] of ranking.top.entries()){const entry=make('div','sector-rank-row'),name=btn((i+1)+'. '+r.name,'table-button',()=>openCompany(r.id));entry.append(name,drill(r.display,r.rows,label+' · '+r.name));const bar=make('div','sector-rank-bar'),fill=make('i');fill.style.width=(ranking.top[0].low>0?r.low/ranking.top[0].low*100:0)+'%';bar.append(fill);entry.append(bar,make('span','sector-rank-meta',label==='Funding by company'?r.rows.length+' rounds · '+A.period:r.rows[0].date+' · '+r.rows[0].basisLabel+' · '+M.sourceLabel(r.rows[0])));box.append(entry);}rankings.append(box);
    }wrapper.append(rankings);
    if(A.cohort.changes.length && ctx.year!=='all'){
      wrapper.append(sectionHead('Same-company operating change','Two public observations on the same basis. Click an amount for its date and source; missing periods are not extrapolated.'));
      const changes=table(['Company','Earlier observation','Latest observation','Change'],'sector-cohort-table');
      for(const pair of A.cohort.changes.slice(0,8)){const row=make('tr'),name=make('td');name.append(btn(pair.after.company,'table-button',()=>openCompany(pair.after.companyId)));row.append(name);for(const e of [pair.before,pair.after]){const td=make('td');td.append(btn(e.display,'table-button',()=>openObservation(e)),make('div','subtle',e.date+' · '+e.basisLabel));row.append(td);}row.append(make('td','',growthText(pair.low,pair.high)));changes.body.append(row);}wrapper.append(changes.wrap);
    }
    if(A.buyers.length){
      wrapper.append(sectionHead('Acquirers','Buyers paired with sellers or targets. Click a deal count for deal status.'));
      const buyers=table(['Buyer','Deals','Seller / acquired company / product','Disclosed value'],'sector-buyer-table');
      for(const b of A.buyers.slice(0,8)){const row=make('tr'),name=make('td');name.append(drill(b.name,b.rows,b.name+' · M&A'));row.append(name);const count=make('td');count.append(drill(b.count+' deals',b.rows,b.name+' · M&A'));row.append(count);const targets=make('td');for(const e of b.rows.slice(0,5))targets.append(btn(e.company,'company-pill',()=>openCompany(e.companyId)));if(b.rows.length>5)targets.append(drill('+'+(b.rows.length-5)+' more',b.rows,b.name+' · M&A'));row.append(targets);const value=make('td');value.append(drill(b.known.length?b.display:'Amount undisclosed',b.rows,b.name+' · deal value'),make('div','subtle',b.known.length+' / '+b.count+' with a disclosed value'));row.append(value);buyers.body.append(row);}wrapper.append(buyers.wrap);
    }
    if(A.signals.length){
      wrapper.append(sectionHead('Operating and usage signals','Growth, retention, task volume and developer adoption beyond absolute revenue, on the original basis.'));
      const signals=table(['Company','Date','Public operating signal','View'],'sector-signal-table');
      for(const e of A.signals){const row=make('tr'),company=make('td');company.append(btn(e.company,'table-button',()=>openCompany(e.companyId)));const inspect=make('td');inspect.append(btn('Observation ↗','table-button',()=>openObservation(e)));row.append(company,make('td','',e.date),make('td','',e.valueText||e.note||e.display),inspect);signals.body.append(row);}wrapper.append(signals.wrap);
    }
    root.append(wrapper);
  }
  window.InfraSectorSummary={analyze,render,growthText};
})();
