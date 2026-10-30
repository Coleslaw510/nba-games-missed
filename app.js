(async function(){
const res=await fetch('data.json'); const D=await res.json();
const C=D.columns; const ALL=D.rows.map(r=>Object.fromEntries(C.map((c,i)=>[c,r[i]])));
const $=s=>document.querySelector(s);
const seasons=[...new Set(ALL.map(r=>r.season))].sort();
const teams=[...new Set(ALL.flatMap(r=>r.team.split('/')))].filter(Boolean).sort();
$('#f-season').innerHTML='<option value="all">All 5 seasons</option>'+seasons.slice().reverse().map(s=>`<option>${s}</option>`).join('');
$('#f-team').innerHTML='<option value="all">All teams</option>'+teams.map(t=>`<option>${t}</option>`).join('');
const st=D.stats; let tot=0,m=0;
for(const s of Object.values(st.seasons)){tot+=s.stat_players;m+=s.stat_players_with_salary;}
$('#match-note').textContent=`Salary match rate: ${m} of ${tot} player-seasons with stats (${(100*m/tot).toFixed(1)}%) had a salary-table entry; unmatched players (mostly two-way/10-day contracts) are excluded. ${st.with_salary} player-seasons shown.`;

const fmt$=v=>v==null?'—':v>=1e9?'$'+(v/1e9).toFixed(2)+'B':v>=1e6?'$'+(v/1e6).toFixed(v>=1e7?1:2)+'M':'$'+Math.round(v/1e3)+'K';
const fmtN=(v,d=0)=>v==null?'—':Number(v).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});
const TIERS=[['<$5M',0,5e6],['$5–15M',5e6,15e6],['$15–30M',15e6,30e6],['$30–45M',30e6,45e6],['$45M+',45e6,Infinity]];

let sortK='lost',asc=false,limit=100,xKey='salary',lbMode='missed';
function filtered(){
  const s=$('#f-season').value,t=$('#f-team').value,smin=(+$('#f-smin').value||0)*1e6,
    smaxv=$('#f-smax').value,smax=smaxv===''?Infinity:+smaxv*1e6,gp=+$('#f-gp').value||0,mn=+$('#f-min').value||0,
    q=$('#f-q').value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  return ALL.filter(r=>(s==='all'||r.season===s)&&(t==='all'||r.team.split('/').includes(t))&&r.salary>=smin&&r.salary<=smax&&r.gp>=gp&&r.min>=mn&&
    (!q||r.player.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(q)));
}
function pearson(xs,ys){const n=xs.length;if(n<3)return null;const mx=xs.reduce((a,b)=>a+b)/n,my=ys.reduce((a,b)=>a+b)/n;
  let sxy=0,sxx=0,syy=0;for(let i=0;i<n;i++){const dx=xs[i]-mx,dy=ys[i]-my;sxy+=dx*dy;sxx+=dx*dx;syy+=dy*dy;}return sxy/Math.sqrt(sxx*syy);}
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const median=a=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y),k=b.length>>1;return b.length%2?b[k]:(b[k-1]+b[k])/2};
function rWord(r){const a=Math.abs(r);const s=a<.1?'essentially no':a<.3?'a weak':a<.5?'a moderate':'a strong';return `${s} ${a<.1?'':r>0?'positive ':'negative '}relationship`;}

let scatter,tiers;
function render(){
  const rows=filtered();
  // KPIs
  const totMiss=rows.reduce((a,r)=>a+r.missed,0),totLost=rows.reduce((a,r)=>a+(r.lost||0),0),totSal=rows.reduce((a,r)=>a+r.salary,0);
  $('#kpis').innerHTML=[
    ['Player-seasons',fmtN(rows.length)],['Avg games missed',fmtN(mean(rows.map(r=>r.missed)),1)],
    ['Median games missed',fmtN(median(rows.map(r=>r.missed)),1)],['Total games missed',fmtN(totMiss)],
    ['Salary tied to missed games',fmt$(totLost)],['Share of payroll',totSal?(100*totLost/totSal).toFixed(1)+'%':'—']
  ].map(([l,v])=>`<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div></div>`).join('');
  // correlations
  const withUsg=rows.filter(r=>r.usg!=null&&r.gp>0);
  const pairs=[
    ['Salary ↔ games missed',pearson(rows.map(r=>r.salary),rows.map(r=>r.missed)),rows.length],
    ['MPG ↔ games missed',pearson(rows.filter(r=>r.gp>0).map(r=>r.mpg),rows.filter(r=>r.gp>0).map(r=>r.missed)),rows.filter(r=>r.gp>0).length],
    ['USG% ↔ games missed',pearson(withUsg.map(r=>r.usg),withUsg.map(r=>r.missed)),withUsg.length],
    ['Salary ↔ USG%',pearson(withUsg.map(r=>r.salary),withUsg.map(r=>r.usg)),withUsg.length],
  ];
  $('#corr').innerHTML=pairs.map(([l,r,n])=>{const w=r==null?0:Math.abs(r)*50;const col=r>0?'var(--accent)':'var(--accent2)';
    return `<div class="c"><div class="small muted">${l}</div><div class="r">${r==null?'—':'r = '+r.toFixed(2)}</div>
    <div class="bar"><i style="width:${w}%;${r>=0?'left:50%':'left:'+(50-w)+'%'};background:${col}"></i></div><div class="small muted">n = ${fmtN(n)}${r==null?'':' · '+rWord(r)}</div></div>`}).join('');
  $('#corr-n').textContent='Pearson r, current filter (MPG/USG exclude 0-GP seasons)';
  // tiers
  const tierStats=TIERS.map(([l,a,b])=>{const t=rows.filter(r=>r.salary>=a&&r.salary<b);return {l,n:t.length,avg:mean(t.map(r=>r.missed)),med:median(t.map(r=>r.missed)),
    pct20:t.length?100*t.filter(r=>r.missed>=20).length/t.length:null,lost:t.reduce((x,r)=>x+(r.lost||0),0)}});
  // takeaways
  const tk=[];
  const [rs,rm,ru]=pairs.map(p=>p[1]);
  if(rs!=null)tk.push(`Salary and games missed show <b>${rWord(rs)}</b> (r = ${rs.toFixed(2)}): pay explains about ${(rs*rs*100).toFixed(1)}% of the variation in games missed.`);
  const big=rows.filter(r=>r.salary>=5e6);
  if(rs!=null&&big.length>=20&&big.length<rows.length){const rb=pearson(big.map(r=>r.salary),big.map(r=>r.missed));
    tk.push(`Much of that comes from minimum-contract and fringe players, who miss lots of games for non-injury reasons (waived, G League, DNP). Among players earning <b>$5M+</b> (n=${big.length}), salary vs games missed is r = <b>${rb.toFixed(2)}</b>: ${rWord(rb)}.`);}
  const tv=tierStats.filter(t=>t.n>=5);
  if(tv.length>=2){const hi=tv.reduce((a,b)=>b.avg>a.avg?b:a),lo=tv.reduce((a,b)=>b.avg<a.avg?b:a);
    tk.push(`The <b>${hi.l}</b> tier misses the most games on average (<b>${hi.avg.toFixed(1)}</b>, n=${hi.n}); the <b>${lo.l}</b> tier misses the fewest (${lo.avg.toFixed(1)}, n=${lo.n}).`);
    const top=tierStats[4];if(top.n>=5)tk.push(`${top.pct20.toFixed(0)}% of $45M+ player-seasons missed 20+ games, vs ${tierStats[0].n?tierStats[0].pct20.toFixed(0):'—'}% under $5M.`);}
  if(ru!=null)tk.push(`Usage rate vs games missed: <b>${rWord(ru)}</b> (r = ${ru.toFixed(2)}). MPG vs games missed: r = ${rm.toFixed(2)} — players who play big minutes when healthy ${rm<0?'tend to miss fewer games, partly because coaches give minutes to healthy players':'tend to miss more games'}.`);
  if(totSal)tk.push(`Across this selection, <b>${fmt$(totLost)}</b> of ${fmt$(totSal)} in salary (${(100*totLost/totSal).toFixed(1)}%) was paid for games players didn't play.`);
  $('#takeaways').innerHTML=tk.map(t=>`<li>${t}</li>`).join('');
  // scatter
  const xl={salary:'Salary ($M)',mpg:'Minutes per game',usg:'Usage rate (USG%)'}[xKey];
  $('#sc-xlabel').textContent={salary:'salary',mpg:'MPG',usg:'usage rate'}[xKey];
  const pts=rows.filter(r=>xKey==='salary'||(r.gp>0&&r[xKey]!=null)).map(r=>({x:xKey==='salary'?r.salary/1e6:r[xKey],y:r.missed,r}));
  const cfg={type:'scatter',data:{datasets:[{data:pts,pointRadius:3,pointHoverRadius:6,backgroundColor:pts.map(p=>p.r.salary>=3e7?'rgba(255,107,44,.75)':'rgba(58,160,255,.45)')}]},
    options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>{const r=c.raw.r;return `${r.player} (${r.season}, ${r.team}) · ${fmt$(r.salary)} · ${r.missed} missed · ${r.mpg} MPG · USG ${r.usg??'—'}%`}}}},
    scales:{x:{title:{display:true,text:xl,color:'#8a96ad'},grid:{color:'#1c2436'},ticks:{color:'#8a96ad'}},y:{title:{display:true,text:'Games missed',color:'#8a96ad'},min:0,max:82,grid:{color:'#1c2436'},ticks:{color:'#8a96ad'}}}}};
  if(scatter){scatter.data=cfg.data;scatter.options=cfg.options;scatter.update();}else scatter=new Chart($('#scatter'),cfg);
  const tcfg={type:'bar',data:{labels:tierStats.map(t=>t.l),datasets:[{label:'Avg games missed',data:tierStats.map(t=>t.avg),backgroundColor:['#3aa0ff','#4fb3c9','#ffb02c','#ff8a2c','#ff4d5e'],borderRadius:6}]},
    options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false},tooltip:{callbacks:{afterLabel:c=>{const t=tierStats[c.dataIndex];return [`n = ${t.n}`,`median ${t.med??'—'}`,`missed 20+: ${t.pct20==null?'—':t.pct20.toFixed(0)+'%'}`,`$ lost: ${fmt$(t.lost)}`]}}}},
    scales:{x:{grid:{display:false},ticks:{color:'#8a96ad'}},y:{beginAtZero:true,title:{display:true,text:'Avg games missed',color:'#8a96ad'},grid:{color:'#1c2436'},ticks:{color:'#8a96ad'}}}}};
  if(tiers){tiers.data=tcfg.data;tiers.update();}else tiers=new Chart($('#tiers'),tcfg);
  $('#tier-note').textContent=tierStats.map(t=>`${t.l}: n=${t.n}`).join(' · ');
  // leaderboard (aggregate by player across selected seasons)
  const agg={};for(const r of rows){const a=agg[r.pid]??={player:r.player,missed:0,lost:0,seasons:0,sal:0,gp:0,teams:new Set()};a.missed+=r.missed;a.lost+=r.lost||0;a.seasons++;a.sal+=r.salary;a.gp+=r.gp;r.team.split('/').forEach(t=>a.teams.add(t));}
  const lb=Object.values(agg).sort((a,b)=>b[lbMode]-a[lbMode]).slice(0,20);
  $('#lb-scope').textContent=$('#f-season').value==='all'?'· 5-year totals':'· '+$('#f-season').value;
  $('#leader').innerHTML=lb.map(a=>`<li><span class="nm">${a.player}<span class="sub">${[...a.teams].join(', ')} · ${a.seasons} season${a.seasons>1?'s':''} · ${a.gp} GP · ${fmt$(a.sal)} paid</span></span>
    <span class="val">${lbMode==='missed'?a.missed+' <small>games missed</small>':fmt$(a.lost)+' <small>'+a.missed+' games missed</small>'}</span></li>`).join('');
  // table
  const sorted=[...rows].sort((a,b)=>{let x=a[sortK],y=b[sortK];if(x==null)return 1;if(y==null)return -1;if(typeof x==='string')return asc?x.localeCompare(y):y.localeCompare(x);return asc?x-y:y-x;});
  const heat=v=>`background:hsla(${Math.max(0,120-v*1.6)},70%,45%,.28)`;
  $('#tbl tbody').innerHTML=sorted.slice(0,limit).map(r=>`<tr><td class="l"><a href="https://www.basketball-reference.com/players/${r.pid[0]}/${r.pid}.html" target="_blank" rel="noopener">${r.player}</a></td><td class="l">${r.season}</td><td class="l">${r.team}</td>
    <td>${fmt$(r.salary)}</td><td>${r.gp}</td><td><span class="pill" style="${heat(r.missed)}">${r.missed}</span></td><td>${r.pct_missed.toFixed(1)}%</td><td>${fmtN(r.mpg,1)}</td><td>${fmtN(r.min)}</td><td>${r.usg==null?'—':r.usg.toFixed(1)}</td><td>${fmt$(r.sal_per_gp)}</td><td>${fmt$(r.lost)}</td></tr>`).join('');
  document.querySelectorAll('#tbl th').forEach(th=>{th.classList.toggle('sorted',th.dataset.k===sortK);th.classList.toggle('asc',th.dataset.k===sortK&&asc);});
  $('#tbl-n').textContent=`${fmtN(Math.min(limit,rows.length))} of ${fmtN(rows.length)} shown · click headers to sort`;
  $('#more').hidden=limit>=rows.length;
}
document.querySelectorAll('.filters input,.filters select').forEach(e=>e.addEventListener('input',()=>{limit=100;render();}));
$('#f-reset').onclick=()=>{$('#f-season').value='all';$('#f-team').value='all';$('#f-smin').value=0;$('#f-smax').value='';$('#f-gp').value=0;$('#f-min').value=0;$('#f-q').value='';render();};
document.querySelectorAll('#tbl th').forEach(th=>th.onclick=()=>{const k=th.dataset.k;if(k===sortK)asc=!asc;else{sortK=k;asc=['player','season','team'].includes(k);}render();});
$('#more').onclick=()=>{limit+=200;render();};
document.querySelectorAll('#sc-x button').forEach(b=>b.onclick=()=>{xKey=b.dataset.x;document.querySelectorAll('#sc-x button').forEach(x=>x.setAttribute('aria-pressed',x===b));render();});
document.querySelectorAll('#lb-mode button').forEach(b=>b.onclick=()=>{lbMode=b.dataset.m;document.querySelectorAll('#lb-mode button').forEach(x=>x.setAttribute('aria-pressed',x===b));render();});
render();
})();
