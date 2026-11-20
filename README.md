# NEON BAY — a complete open-world crime game

**Neon Bay** is a 2D top-down open-world crime game that plays offline in a
desktop browser from static files — no libraries, no network requests, no
build step. Everything in it is original: the city, the characters, the
vehicles, the names, the story, the art and the sound. Nothing is taken from
Rockstar Games or any other commercial game.

## The story

Jax Moreno is a wheelman in Neon Bay, a sun-soaked coastal city of palm
beaches, downtown towers, a marina park and a working docks district. He owes
the wrong people money, and the only way out is five jobs for the city's
underworld — each one hotter than the last.

## The five missions

1. **First Wheels** — steal a car and drive to the yellow marker.
2. **The Pickup** — collect a package, then deliver it while the police chase you.
3. **Lose the Heat** — escape a 3-star wanted level: stay out of sight until the heat dies.
4. **The Setup** — collect 3 stashes hidden across the city.
5. **The Big Score** — final run to the docks and escape Neon Bay.

Finishing a mission pays cash and autosaves. Finishing all five wins the game.

## Every system in the game

- **On foot and by car** — walk with WASD/arrows; the same keys drive with
  arcade physics (acceleration, braking, steering, drift, building and
  traffic collisions). Press **E** to enter, exit, or steal a car.
- **Traffic and pedestrians** — traffic cars drive the road grid, turn at
  intersections and bump your car; pedestrians walk the sidewalks and flee
  when scared by a speeding car or gunfire.
- **Stealing cars** — steal any parked or traffic car with E. The driver
  flees on foot; stealing raises your wanted level by 1 star.
- **Wanted 0–5 stars and police** — police cars spawn by star level, chase
  and ram you; on foot, officers chase and brawl, and at wanted ≥ 2 they can
  bust you. Wanted decays after time without crime and when you are far from
  police. Running over a pedestrian or shooting one also raises the heat.
- **Combat** — punch with Space/F, pistol with mouse aim and click to shoot
  (limited ammo). Health and ammo pickups are scattered around the city.
- **Health, WASTED and BUSTED** — at 0 health you wake up at the hospital
  (WASTED); caught on foot at wanted ≥ 2 you wake up at the police station
  (BUSTED). Both cost 10% of your cash.
- **HUD** — cash, health bar, wanted stars, ammo, the current objective
  line, on-screen messages, and a live minimap (top-right: roads, player,
  cars, police, mission blip).
- **Start, pause, save** — title screen with story intro, controls and
  New Game / Continue; pause with P/Esc; game-over and victory screens;
  localStorage save (cash, missions completed, best wanted) with autosave
  and a save on every mission complete.
- **Sound** — fully synthesised WebAudio SFX (engine, siren, gunshot,
  punch, pickup, crash, mission jingle) plus a procedural bass-and-hat
  music loop. **M** toggles mute.
- **Polish** — skid/exhaust/muzzle/crash particles, screen shake, damage
  smoke on beaten-up cars, distinct districts (Palm Beach, Downtown,
  Marina Park, The Docks, Old Town), a day palette, and a pulsing mission
  marker with a direction beam.
- **Deterministic** — seeded RNG (mulberry32) builds the same city from the
  same seed; the simulation runs on a fixed 1/60 s timestep.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive (Up = gas, Down = brake/reverse) |
| E | Enter, exit, or steal a car |
| Space / F | Punch |
| Mouse + click | Aim and shoot the pistol |
| P / Esc | Pause |
| M | Mute sound |

## How to run

```sh
node serve.ts
# open http://localhost:8080
```

Node 22 is all you need. `file://` does not work (ES modules need HTTP).

## How the screenshots are staged

Each screenshot is a real render of the game's own code, staged by playing
the real rules forward with a simple autopilot (see `game/src/shots.js`):

- `?shot=drive&seed=1` — steal a car and drive, police in pursuit (cover)
- `?shot=onfoot&seed=1` — on foot in the city, pedestrians + mission marker
- `?shot=wanted&seed=1` — 3-star police chase
- `?shot=start&seed=1` — title screen over the live city

`?selftest=1` runs ~10 seconds of scripted play (walk, steal, drive,
shoot, punch, mission progress) with no input and writes PASS/FAIL into
`document.title` and the `#selftest` node, so a headless run can prove the
game runs without errors.

## Files

- `main.ts` — the entry program: copies `game/` + `screenshots/` to
  `/output` (or `$MAKEFUN_OUTPUT_DIR`) and writes `dossier.json`.
- `game/index.html` — the page; `game/src/` — the game, split by job:
  `config.js` (tuning/places), `random.js` (seeded RNG), `input.js`
  (keyboard/mouse), `audio.js` (synthesised sound + music), `world.js`
  (all rules: city, traffic, police, wanted, missions, combat),
  `render.js` (drawing, HUD, minimap, screens), `shots.js` (screenshot
  staging), `selftest.js` (headless check), `main.js` (boot + loop + save).
- `serve.ts` — dev static server for testing.
- `screenshots/` — 4 real renders; `shots.json` lists their `?shot=` queries.
- `LICENSE` — MIT.

## License

MIT — see `LICENSE`.
