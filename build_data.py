"""Parse Basketball-Reference raw pages (raw/) into data/players.csv + data.json."""
import re, json, csv, os, unicodedata
from bs4 import BeautifulSoup, Comment
TEAMS="ATL BOS BRK CHO CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHO POR SAC SAS TOR UTA WAS".split()
SEASONS=[2022,2023,2024,2025,2026]
def label(y): return f"{y-1}-{str(y)[2:]}"
def num(s):
    try: return float(s.replace(',','').replace('$',''))
    except: return None
def rows(html, tid):
    soup=BeautifulSoup(html,'lxml'); t=soup.find('table',id=tid)
    if t is None:
        for c in soup.find_all(string=lambda x: isinstance(x,Comment) and f'id="{tid}"' in x):
            t=BeautifulSoup(c,'lxml').find('table',id=tid); break
    if t is None: return []
    out=[]
    for tr in t.find('tbody').find_all('tr'):
        if 'thead' in (tr.get('class') or []): continue
        d={}
        for c in tr.find_all(['th','td']):
            st=c.get('data-stat'); d[st]=c.get_text(strip=True)
            if c.get('data-append-csv'): d['pid']=c['data-append-csv']
        if d.get('pid'): out.append(d)
    return out
def league(y,kind,tid):
    by={}
    for d in rows(open(f'raw/{kind}_{y}.html').read(),tid):
        by.setdefault(d['pid'],[]).append(d)
    return by
records=[]; stats={'seasons':{}}
PG={y:league(y,'per_game','per_game_stats') for y in SEASONS+[2027] if os.path.exists(f'raw/per_game_{y}.html')}
for y in SEASONS:
    pg=PG[y]; adv=league(y,'advanced','advanced'); nxt=set().union(*[set(PG[z]) for z in PG if z>y]) if any(z>y for z in PG) else set()
    sal={}; team_games={}; missing_teams=[]
    for t in TEAMS:
        p=f'raw/team_{t}_{y}.html'
        if not os.path.exists(p): missing_teams.append(t); continue
        h=open(p).read()
        m=re.search(r'<strong>Record:</strong>\s*(\d+)-(\d+)',h)
        team_games[t]=int(m.group(1))+int(m.group(2))
        for d in rows(h,'salaries2'):
            s=num(d.get('salary',''))
            if s is None: continue
            e=sal.setdefault(d['pid'],{'name':d['player'],'by_team':{}})
            e['by_team'][t]=max(e['by_team'].get(t,0),s)
    tg=max(team_games.values()) if team_games else 82
    # salary for players who played: their max listed salary among teams they played for (traded players
    # appear on both teams' sheets with the same figure); fall back to max overall.
    # 0-GP salary entries include dead money (waived/stretched contracts), so a 0-GP player is kept only
    # if he played in the NBA in a later season (through 2026-27 to date) (i.e. he was an active player who sat out the year).
    dropped=[]
    for pid,e in list(sal.items()):
        if pid not in pg and pid not in nxt:
            dropped.append((e['name'],max(e['by_team'].values()))); del sal[pid]
    pids=set(pg)|set(sal)
    nstat=len(pg); matched=0
    for pid in pids:
        prows=pg.get(pid,[]); arows=adv.get(pid,[])
        tot=prows[0] if prows else None   # BBRef lists combined (2TM/TOT) row first
        a=arows[0] if arows else None
        if tot:
            teams=[r['team_name_abbr'] for r in prows if not re.match(r'(TOT|\dTM)$',r['team_name_abbr'])]
            name=tot['name_display']; gp=int(tot['games']); mpg=num(tot.get('mp_per_g',''))
            mp=num(a['mp']) if a and a.get('mp') else (round(mpg*gp) if mpg else 0)
            usg=num(a['usg_pct']) if a else None; pos=tot.get('pos'); age=num(tot.get('age',''))
        else:
            teams=list(sal[pid]['by_team']); name=sal[pid]['name']; gp=0; mpg=0.0; mp=0; usg=None; pos=None; age=None
        bt=sal.get(pid,{}).get('by_team',{})
        s=max([v for t,v in bt.items() if t in teams] or list(bt.values()) or [None])
        if tot and s: matched+=1
        tgames=sum(team_games.get(t,tg) for t in teams[:1]) if teams else tg
        tgames=tg  # all teams played 82 in these seasons; traded players use 82 - total GP
        missed=max(tgames-gp,0)
        records.append(dict(zero_gp=int(gp==0),pid=pid,player=name,season=label(y),year=y,team='/'.join(dict.fromkeys(teams)),pos=pos,age=age,
            salary=int(s) if s else None,gp=gp,team_games=tgames,missed=missed,pct_missed=round(missed/tgames*100,1),
            mpg=round(mpg,1) if mpg is not None else None,min=int(mp or 0),usg=usg,
            sal_per_gp=round(s/gp) if s and gp else None,lost=round(s*missed/tgames) if s else None))
    stats['seasons'][label(y)]=dict(team_games=team_games and sorted(set(team_games.values())),missing_team_pages=missing_teams,
        stat_players=nstat,salary_players=len(sal),stat_players_with_salary=matched,
        salary_players_zero_gp=sum(1 for p in sal if p not in pg),dropped_zero_gp_not_active=len(dropped),
        dropped_examples=[n for n,_ in sorted(dropped,key=lambda x:-x[1])[:8]])
records.sort(key=lambda r:(r['year'],-(r['salary'] or 0)))
os.makedirs('data',exist_ok=True)
keys=list(records[0].keys())
with open('data/player_seasons_all.csv','w',newline='') as f:
    w=csv.DictWriter(f,keys); w.writeheader(); w.writerows(records)
withsal=[r for r in records if r['salary']]
with open('data/player_seasons.csv','w',newline='') as f:
    w=csv.DictWriter(f,keys); w.writeheader(); w.writerows(withsal)
stats['total_records']=len(records); stats['with_salary']=len(withsal)
json.dump(stats,open('data/build_stats.json','w'),indent=1)
cols=['pid','player','season','team','pos','age','salary','gp','team_games','missed','pct_missed','mpg','min','usg','sal_per_gp','lost']
json.dump({'generated':'2026-10-30','columns':cols,'rows':[[r[c] for c in cols] for r in withsal],'stats':stats},open('data.json','w'),separators=(',',':'))
print(json.dumps(stats,indent=1))
