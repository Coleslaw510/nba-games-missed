import os, time, subprocess, sys
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
TEAMS="ATL BOS BRK CHO CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHO POR SAC SAS TOR UTA WAS".split()
os.makedirs("raw",exist_ok=True)
def get(url,path):
    if os.path.exists(path) and os.path.getsize(path)>50000: return
    for a in range(4):
        r=subprocess.run(["curl","-s","--max-time","90","-A",UA,"-o",path,"-w","%{http_code}",url],capture_output=True,text=True)
        print(r.stdout,url,flush=True)
        time.sleep(3.6)
        if r.stdout=="200": return
        time.sleep(60*(a+1))
get("https://www.basketball-reference.com/leagues/NBA_2027_per_game.html","raw/per_game_2027.html")
for y in [2022,2023,2024,2025,2026]:
    for k in ["per_game","advanced","totals"]:
        get(f"https://www.basketball-reference.com/leagues/NBA_{y}_{k}.html",f"raw/{k}_{y}.html")
    for t in TEAMS:
        get(f"https://www.basketball-reference.com/teams/{t}/{y}.html",f"raw/team_{t}_{y}.html")
print("DONE")
