# NBA Games Missed vs. Salary (2021-22 → 2025-26)

Interactive static dashboard: how salary, minutes and usage relate to games missed over the last five completed NBA regular seasons.

**Live:** https://coleslaw510.github.io/nba-games-missed/

- `index.html`, `style.css`, `app.js` – static front end (Chart.js via CDN) rendering `data.json`. Filters (season, team, salary range, min GP, min minutes, player search), sortable player-season table, salary/MPG/USG% vs games-missed scatter, salary-tier chart, 5-year leaderboards, Pearson correlations and auto-computed takeaways.
- `data/player_seasons.csv` – cleaned dataset (player-seasons with a salary record). `data/player_seasons_all.csv` also includes players with stats but no salary-table entry. `data/build_stats.json` – match rates and per-season counts.
- `fetch_raw.py` – downloads the Basketball-Reference pages into `raw/` (not committed), throttled to ~1 request / 3.6 s.
- `build_data.py` – parses `raw/` into the CSV/JSON.

## Method
- **Stats:** Basketball-Reference league per-game (GP, MPG) and advanced (total MP, USG%) tables, `NBA_2022` … `NBA_2026`. Traded players use the combined (2TM/3TM) row.
- **Salary:** the "Salaries" table on each Basketball-Reference team page (30 teams × 5 seasons). Joined to stats by Basketball-Reference player ID (no fuzzy name matching needed). A traded player's salary is the figure listed by the teams he played for.
- **Games missed** = 82 − games played (every team played 82 regular-season games in this window; traded players: 82 − combined GP). The In-Season Tournament final is not a regular-season game and isn't counted.
- **0-GP seasons:** players on a salary sheet who never played are kept only if they played in the NBA the following season (e.g. Kawhi Leonard 2021-22, John Wall 2021-22). This drops dead money for waived/stretched players.
- **$ "lost"** = salary × missed ÷ 82. **$ / GP** = salary ÷ GP.

## Caveats
Missed games include injury, rest, suspension, personal reasons, G League assignment and DNP-coach's decision, which can't be separated. Players waived mid-season count the rest of the season as missed. Salaries are the Basketball-Reference listed figures (cap numbers), not cash actually paid. Two-way and 10-day contracts often have no salary entry and are excluded.

Refresh:

    python3 fetch_raw.py && python3 build_data.py
    python3 -m http.server 8765   # open http://localhost:8765/
