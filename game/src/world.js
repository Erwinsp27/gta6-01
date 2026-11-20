// Neon Bay world: all rules, no drawing, no browser in here.
// Top-down city 3200x2400, road grid, buildings, traffic, pedestrians,
// police, wanted level, combat, pickups, particles and 5 story missions.
// step() advances one fixed 1/60 s step and returns event bit flags.
import { CAR, MISSIONS, PLAYER, POLICE, ROADS_H, ROADS_V, ROAD_W, WORLD } from './config.js';
import { angleLerp, clamp, dist2, pick, range } from './random.js';

export const EVENT_MISSION = 1;
export const EVENT_WASTED = 2;
export const EVENT_BUSTED = 4;
export const EVENT_PICKUP = 8;
export const EVENT_SHOT = 16;
export const EVENT_CRASH = 32;
export const EVENT_WON = 64;
export const EVENT_STEAL = 128;

const HOSPITAL = { x: 1520, y: 300 };
const STATION = { x: 920, y: 300 };
const DOCKS = { x: 2900, y: 2250 };

function onRoad(x, y) {
  for (const rx of ROADS_V) if (Math.abs(x - rx) < ROAD_W / 2 + 8) return true;
  for (const ry of ROADS_H) if (Math.abs(y - ry) < ROAD_W / 2 + 8) return true;
  return false;
}
function nearestRoadPoint(x, y) {
  let best = { x, y, d: 1e18 };
  for (const rx of ROADS_V) { const d = Math.abs(x - rx); if (d < best.d) best = { x: rx, y, d }; }
  for (const ry of ROADS_H) { const d = Math.abs(y - ry); if (d < best.d) best = { x, y: ry, d }; }
  return best;
}

export function createWorld(random) {
  // --- city: buildings fill the blocks between roads -----------------------
  const buildings = [];
  const bColors = ['#5b6b8c', '#7a5b6b', '#4a6b5b', '#8c7a4a', '#6b5a8c'];
  const xs = [0, ...ROADS_V, WORLD.width], ys = [0, ...ROADS_H, WORLD.height];
  for (let bi = 0; bi < xs.length - 1; bi += 1) {
    for (let bj = 0; bj < ys.length - 1; bj += 1) {
      const x0 = xs[bi] + (bi === 0 ? 140 : ROAD_W / 2 + 24);
      const x1 = xs[bi + 1] - (bi === xs.length - 2 ? 24 : ROAD_W / 2 + 24);
      const y0 = ys[bj] + (bj === 0 ? 24 : ROAD_W / 2 + 24);
      const y1 = ys[bj + 1] - (bj === ys.length - 2 ? 24 : ROAD_W / 2 + 24);
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      // Park block stays green; beach strip stays sand.
      if (x0 > 1200 && x0 < 1850 && y0 > 1200 && y0 < 1850) continue;
      if (x0 < 300) continue;
      const n = 1 + Math.floor(random() * 2);
      for (let k = 0; k < n; k += 1) {
        const w = range(random, 90, Math.min(220, (x1 - x0) / n - 20));
        const h = range(random, 80, Math.min(200, y1 - y0 - 20));
        buildings.push({
          x: x0 + k * ((x1 - x0) / n) + 8, y: y0 + 8, w, h,
          color: pick(random, bColors), tall: random() < 0.35,
        });
      }
    }
  }
  function hitsBuilding(x, y, r) {
    for (const b of buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
    }
    return null;
  }

  const player = { x: 1520, y: 920, angle: -Math.PI / 2, health: 100, cash: 50, ammo: 24, inCar: null, punchCd: 0, shootCd: 0, bustedTimer: 0, invuln: 0 };
  const cars = []; const peds = []; const police = []; const bullets = []; const particles = []; const pickups = [];
  const state = {
    player, cars, peds, police, bullets, particles, pickups, buildings,
    wanted: 0, wantedTimer: 0, missionIndex: 0, missionStage: 0, stashesLeft: 0,
    target: { x: 2720, y: 320 }, elapsed: 0, shake: 0, message: '', messageTimer: 0,
    won: false, bestWanted: 0, kills: 0, carsStolen: 0, shotsFired: 0,
    camX: 1520, camY: 920, sirenTimer: 0, engineTimer: 0,
  };

  function spawnParticles(x, y, color, n, speed) {
    for (let i = 0; i < n; i += 1) {
      if (particles.length > 220) return;
      const a = random() * Math.PI * 2, s = range(random, 20, speed || 120);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: range(random, 0.3, 0.8), max: 0.8, color, size: range(random, 2, 5) });
    }
  }
  function say(text, seconds) { state.message = text; state.messageTimer = seconds || 3; }
  function addWanted(n) {
    state.wanted = clamp(state.wanted + n, 0, 5);
    state.bestWanted = Math.max(state.bestWanted, state.wanted);
    state.wantedTimer = 0;
  }
  function makeCar(x, y, angle, color, isPolice, parked) {
    return { x, y, angle, speed: 0, color, police: !!isPolice, parked: !!parked, health: 100, driver: !parked, turn: 0, roadAxis: 'v', dir: 1, smoke: 0 };
  }
  function spawnTrafficCar() {
    const vertical = random() < 0.5;
    const road = vertical ? pick(random, ROADS_V) : pick(random, ROADS_H);
    const along = range(random, 200, vertical ? WORLD.height - 200 : WORLD.width - 200);
    const lane = (random() < 0.5 ? -22 : 22);
    const x = vertical ? road + lane : along;
    const y = vertical ? along : road + lane;
    const angle = vertical ? (lane < 0 ? Math.PI / 2 : -Math.PI / 2) : (lane < 0 ? 0 : Math.PI);
    const c = makeCar(x, y, angle, pick(random, ['#4fc3f7', '#f2c94c', '#9b7ede', '#e8e8e8', '#5ad08a', '#e07a4f']), false, false);
    c.roadAxis = vertical ? 'v' : 'h'; c.dir = lane < 0 ? 1 : -1; c.speed = range(random, 110, 190);
    return c;
  }
  function spawnPed(x, y) {
    return { x: x ?? range(random, 300, 3000), y: y ?? range(random, 300, 2200), angle: random() * Math.PI * 2, speed: range(random, 35, 70), color: pick(random, ['#f28b82', '#81c995', '#a8c7fa', '#f9ab00', '#d7aefb']), flee: 0, wander: range(random, 1, 3), alive: true };
  }
  function spawnPoliceCar() {
    const a = random() * Math.PI * 2;
    const c = makeCar(state.player.x + Math.cos(a) * 700, state.player.y + Math.sin(a) * 700, a, '#2f6fd0', true, false);
    c.x = clamp(c.x, 150, WORLD.width - 150); c.y = clamp(c.y, 150, WORLD.height - 150);
    c.speed = 200;
    return c;
  }
  function spawnPoliceFoot() {
    const a = random() * Math.PI * 2;
    return { x: clamp(state.player.x + Math.cos(a) * 420, 100, WORLD.width - 100), y: clamp(state.player.y + Math.sin(a) * 420, 100, WORLD.height - 100), angle: a, speed: POLICE.footSpeed, color: '#2f6fd0', foot: true, health: 60, brawlCd: 0, police: true };
  }

  function missionTarget() {
    const i = state.missionIndex, s = state.missionStage;
    if (i === 0) return s === 0 ? { x: 2120, y: 920, label: 'Steal a car' } : { x: 2720, y: 320, label: 'Drive to the marker' };
    if (i === 1) return s === 0 ? { x: 920, y: 1520, label: 'Collect the package' } : { x: 2720, y: 2120, label: 'Deliver the package' };
    if (i === 2) return { x: state.player.x, y: state.player.y, label: 'Lose the police — stay hidden' };
    if (i === 3) return { x: state.target.x, y: state.target.y, label: `Stashes left: ${state.stashesLeft}` };
    return { x: DOCKS.x, y: DOCKS.y, label: 'Reach the docks and escape' };
  }
  function startMission(i) {
    state.missionIndex = i; state.missionStage = 0;
    if (i === 2) { state.wanted = 3; state.bestWanted = Math.max(state.bestWanted, 3); state.heatLeft = 22; }
    if (i === 3) {
      state.stashesLeft = 3;
      state.stashSpots = [{ x: 320, y: 2120 }, { x: 2720, y: 920 }, { x: 1520, y: 2120 }];
      state.target = state.stashSpots[0];
    }
    if (i === 4) state.target = { ...DOCKS };
    say(`Mission ${i + 1}: ${MISSIONS[i].title} — ${MISSIONS[i].brief}`, 4);
  }
  function completeMission() {
    const m = MISSIONS[state.missionIndex];
    state.player.cash += m.pay;
    say(`Mission complete: ${m.title}! +$${m.pay}`, 4);
    spawnParticles(state.player.x, state.player.y, '#f2c94c', 30, 220);
    if (state.missionIndex >= MISSIONS.length - 1) { state.won = true; return EVENT_MISSION | EVENT_WON; }
    startMission(state.missionIndex + 1);
    return EVENT_MISSION;
  }

  function reset() {
    player.x = 1520; player.y = 920; player.angle = -Math.PI / 2; player.health = 100; player.cash = 50; player.ammo = 24;
    player.inCar = null; player.punchCd = 0; player.shootCd = 0; player.bustedTimer = 0;
    cars.length = 0; peds.length = 0; police.length = 0; bullets.length = 0; particles.length = 0; pickups.length = 0;
    state.wanted = 0; state.wantedTimer = 0; state.elapsed = 0; state.won = false; state.bestWanted = 0;
    state.kills = 0; state.carsStolen = 0; state.shotsFired = 0; state.heatLeft = 0;
    // Parked cars near the start, traffic, pedestrians, pickups.
    cars.push(makeCar(1620, 920, 0, '#e5534b', false, true));
    cars.push(makeCar(1520, 1020, Math.PI / 2, '#4fc3f7', false, true));
    cars.push(makeCar(920, 420, 0, '#f2c94c', false, true));
    cars.push(makeCar(2720, 1520, Math.PI, '#5ad08a', false, true));
    for (let i = 0; i < 9; i += 1) cars.push(spawnTrafficCar());
    for (let i = 0; i < 22; i += 1) peds.push(spawnPed());
    const spots = [[700, 700, 'health'], [2400, 700, 'ammo'], [700, 1800, 'ammo'], [2400, 1800, 'health'], [1520, 1520, 'health'], [920, 1520, 'ammo']];
    for (const [x, y, kind] of spots) pickups.push({ x, y, kind, respawn: 0 });
    startMission(0);
    state.target = missionTarget();
  }

  function nearestCar(x, y, maxD) {
    let best = null, bd = maxD * maxD;
    for (const c of cars) { const d = dist2(x, y, c.x, c.y); if (d < bd) { bd = d; best = c; } }
    return best;
  }
  function enterCar(car) {
    player.inCar = car; car.parked = false; car.driver = true;
    if (car.stolenMark) { /* already counted */ } else { car.stolenMark = true; }
  }
  function exitCar() {
    const car = player.inCar; if (!car) return;
    player.inCar = null;
    const a = car.angle + Math.PI / 2;
    player.x = clamp(car.x + Math.cos(a) * 46, 20, WORLD.width - 20);
    player.y = clamp(car.y + Math.sin(a) * 46, 20, WORLD.height - 20);
    player.angle = car.angle;
    car.speed = 0;
  }
  function stealCar(car) {
    const wasParked = car.parked;
    enterCar(car);
    if (!wasParked && car.driver) { /* driver flees */ const p = spawnPed(car.x + 40, car.y + 40); p.flee = 5; peds.push(p); }
    if (!wasParked || true) { addWanted(1); state.carsStolen += 1; say(wasParked ? 'Car taken! The police noticed. +1 star' : 'Carjacked! Driver fled. +1 star', 3); spawnParticles(car.x, car.y, '#e5534b', 10, 120); return EVENT_STEAL; }
    return 0;
  }

  function shootAt(wx, wy) {
    if (player.inCar || player.ammo <= 0 || player.shootCd > 0) return 0;
    player.ammo -= 1; player.shootCd = 0.28; state.shotsFired += 1;
    const a = Math.atan2(wy - player.y, wx - player.x);
    bullets.push({ x: player.x + Math.cos(a) * 20, y: player.y + Math.sin(a) * 20, vx: Math.cos(a) * 950, vy: Math.sin(a) * 950, life: 0.7 });
    spawnParticles(player.x + Math.cos(a) * 24, player.y + Math.sin(a) * 24, '#ffd76a', 5, 160);
    // Nearby pedestrians flee from gunfire.
    for (const p of peds) if (dist2(p.x, p.y, player.x, player.y) < 500 * 500) p.flee = 4;
    return EVENT_SHOT;
  }
  function punch() {
    if (player.inCar || player.punchCd > 0) return 0;
    player.punchCd = PLAYER.punchCooldown;
    const px = player.x + Math.cos(player.angle) * 26, py = player.y + Math.sin(player.angle) * 26;
    let hit = false;
    for (const p of police) {
      if (p.foot && dist2(px, py, p.x, p.y) < PLAYER.punchRange * PLAYER.punchRange + 400) { p.health -= PLAYER.punchDamage; hit = true; if (p.health <= 0) { p.dead = true; state.kills += 1; } }
    }
    for (const p of peds) {
      if (p.alive && dist2(px, py, p.x, p.y) < PLAYER.punchRange * PLAYER.punchRange + 400) { p.flee = 5; hit = true; }
    }
    spawnParticles(px, py, '#ffffff', hit ? 8 : 3, 140);
    return hit ? EVENT_SHOT : 0;
  }

  function respawn(place, label) {
    const loss = Math.floor(player.cash * 0.1);
    player.cash -= loss; player.health = 100; player.inCar = null; player.ammo = Math.max(player.ammo, 12);
    player.x = place.x; player.y = place.y; player.bustedTimer = 0; state.wanted = 0; state.wantedTimer = 0;
    for (const pc of police) pc.dead = true;
    say(`${label} — lost $${loss}. Back on your feet.`, 4);
  }

  // Autopilot for ?shot= scenes and the self-test: returns {x,y} drive/walk input.
  function autopilotInput() {
    const t = missionTarget();
    const tx = t.x, ty = t.y;
    const dx = tx - player.x, dy = ty - player.y;
    const d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d, target: t };
  }

  function step(dt, input, aim) {
    let events = 0;
    state.elapsed += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (player.punchCd > 0) player.punchCd -= dt;
    if (player.shootCd > 0) player.shootCd -= dt;
    if (player.invuln > 0) player.invuln -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 3);

    // --- input: virtual axis (autopilot/selftest) overrides keys -----------
    const virt = input && input.virtualAxis ? input.virtualAxis() : null;
    const axis = virt || (input ? input.axis() : { x: 0, y: 0 });
    const car = player.inCar;

    if (car) {
      // Arcade car physics: accelerate along heading, steer with lateral input, drift.
      const fwd = axis.y < 0 ? 1 : axis.y > 0 ? -0.6 : 0; // up = gas
      const steering = axis.x;
      if (fwd > 0) car.speed += CAR.accel * dt * fwd;
      else if (fwd < 0) car.speed -= CAR.brake * dt * 0.6;
      else car.speed -= Math.sign(car.speed) * CAR.drag * 120 * dt;
      car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
      if (Math.abs(car.speed) > 20) car.angle += steering * CAR.turn * dt * Math.sign(car.speed) * clamp(Math.abs(car.speed) / 200, 0.3, 1);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const b = hitsBuilding(nx, ny, 26);
      if (b) {
        if (Math.abs(car.speed) > 150) { events |= EVENT_CRASH; state.shake = 0.5; spawnParticles(car.x, car.y, '#cccccc', 14, 180); car.health -= 12; if (car.health <= 0) { car.health = 100; car.speed = 0; } }
        car.speed *= -0.25;
      } else { car.x = clamp(nx, 30, WORLD.width - 30); car.y = clamp(ny, 30, WORLD.height - 30); }
      player.x = car.x; player.y = car.y; player.angle = car.angle;
      if (Math.abs(car.speed) > 300 && random() < 0.3) spawnParticles(car.x - Math.cos(car.angle) * 30, car.y - Math.sin(car.angle) * 30, '#888888', 1, 40);
      if (Math.abs(car.speed) > 60 && random() < 0.08) spawnParticles(car.x - Math.cos(car.angle) * 28, car.y - Math.sin(car.angle) * 28, '#bbbbbb', 1, 30);
      // Scare pedestrians.
      for (const p of peds) if (dist2(p.x, p.y, car.x, car.y) < 160 * 160 && Math.abs(car.speed) > 120) p.flee = 3;
      // Running over a pedestrian is a crime.
      for (const p of peds) {
        if (p.alive && dist2(p.x, p.y, car.x, car.y) < 30 * 30 && Math.abs(car.speed) > 60) {
          p.alive = false; addWanted(1); spawnParticles(p.x, p.y, '#e5534b', 12, 160); say('Pedestrian hit! +1 star', 2);
        }
      }
    } else {
      // On foot: move in the input direction, face it; aim follows the mouse.
      const mag = Math.hypot(axis.x, axis.y);
      if (mag > 0.1) {
        const nx = player.x + (axis.x / mag) * PLAYER.walkSpeed * dt;
        const ny = player.y + (axis.y / mag) * PLAYER.walkSpeed * dt;
        if (!hitsBuilding(nx, player.y, PLAYER.radius)) player.x = clamp(nx, 20, WORLD.width - 20);
        if (!hitsBuilding(player.x, ny, PLAYER.radius)) player.y = clamp(ny, 20, WORLD.height - 20);
        player.angle = Math.atan2(axis.y, axis.x);
      }
      if (aim) player.angle = Math.atan2(aim.y - player.y, aim.x - player.x);
    }

    // --- one-shot actions ---------------------------------------------------
    if (input) {
      const acts = input.takeActions ? input.takeActions() : 0;
      if (acts & 4) { // E: enter / exit / steal
        if (car) exitCar();
        else {
          const near = nearestCar(player.x, player.y, 78);
          if (near) events |= stealCar(near);
        }
      }
      if (acts & 8) events |= punch();
      if (acts & 32) { if (aim) events |= shootAt(aim.x, aim.y); }
    }

    // --- traffic ------------------------------------------------------------
    for (const c of cars) {
      if (c === car) continue;
      if (c.parked) continue;
      // Follow the road grid: drive along its axis, turn at intersections.
      const speed = c.police ? POLICE.carSpeed : c.speed;
      const tx = c.x + Math.cos(c.angle) * speed * dt;
      const ty = c.y + Math.sin(c.angle) * speed * dt;
      if (c.police) {
        // Police chase the player directly.
        const want = Math.atan2(player.y - c.y, player.x - c.x);
        c.angle = angleLerp(c.angle, want, dt * 2.2);
        c.x = clamp(tx, 30, WORLD.width - 30); c.y = clamp(ty, 30, WORLD.height - 30);
        const d = Math.hypot(player.x - c.x, player.y - c.y);
        if (d < 70) {
          if (player.inCar) {
            const pc = player.inCar;
            if (player.invuln <= 0) { pc.health -= POLICE.ramDamage * dt * 3; player.health -= 1; state.shake = 0.4; if (random() < 0.1) { events |= EVENT_CRASH; spawnParticles(c.x, c.y, '#cccccc', 8, 140); } }
            c.x -= Math.cos(c.angle) * 40 * dt * 10; c.y -= Math.sin(c.angle) * 40 * dt * 10;
          } else if (player.invuln <= 0) {
            player.health -= POLICE.brawlDamage * dt * 2; state.shake = 0.3;
          }
        }
      } else {
        // Traffic: keep to its road; at an intersection sometimes turn.
        const onV = ROADS_V.some((rx) => Math.abs(c.x - rx) < 30);
        const onH = ROADS_H.some((ry) => Math.abs(c.y - ry) < 30);
        if (onV && onH && random() < dt * 0.25) {
          const vertical = random() < 0.5;
          c.angle = vertical ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI);
        }
        // Steer back onto the nearest road line if drifting off.
        const rp = nearestRoadPoint(c.x, c.y);
        const want = Math.atan2((c.roadAxis === 'v' ? rp.y + c.dir * 100 : c.y) - c.y, (c.roadAxis === 'v' ? c.x : rp.x + c.dir * 100) - c.x);
        if (!onRoad(c.x, c.y)) c.angle = angleLerp(c.angle, want, dt * 3);
        c.x = clamp(tx, 30, WORLD.width - 30); c.y = clamp(ty, 30, WORLD.height - 30);
        if (c.x <= 31 || c.x >= WORLD.width - 31 || c.y <= 31 || c.y >= WORLD.height - 31) { const n = spawnTrafficCar(); c.x = n.x; c.y = n.y; c.angle = n.angle; c.speed = n.speed; }
        // Bump the player's car.
        if (car && dist2(c.x, c.y, car.x, car.y) < 55 * 55) {
          car.speed *= 0.6; c.speed = Math.max(60, c.speed * 0.5);
          if (random() < 0.2) { events |= EVENT_CRASH; spawnParticles(car.x, car.y, '#cccccc', 6, 120); }
        }
      }
      if (c.health < 40 && random() < 0.1) spawnParticles(c.x, c.y, '#666666', 1, 50);
    }

    // --- pedestrians --------------------------------------------------------
    for (const p of peds) {
      if (!p.alive) continue;
      p.wander -= dt;
      let ax = 0, ay = 0;
      if (p.flee > 0) {
        p.flee -= dt;
        const d = Math.hypot(p.x - player.x, p.y - player.y) || 1;
        ax = (p.x - player.x) / d; ay = (p.y - player.y) / d;
        p.speed = 170;
      } else {
        p.speed = 55;
        if (p.wander <= 0) { p.wander = range(random, 1, 4); p.angle = random() * Math.PI * 2; }
        ax = Math.cos(p.angle); ay = Math.sin(p.angle);
      }
      const nx = p.x + ax * p.speed * dt, ny = p.y + ay * p.speed * dt;
      if (!hitsBuilding(nx, ny, 10) && !onRoad(nx, ny)) { p.x = clamp(nx, 20, WORLD.width - 20); p.y = clamp(ny, 20, WORLD.height - 20); }
      else p.angle += Math.PI / 2;
    }

    // --- police spawning by wanted level ------------------------------------
    const wantCars = state.wanted >= 1 ? Math.min(state.wanted, 3) : 0;
    const wantFoot = (!player.inCar && state.wanted >= 2) ? Math.min(state.wanted - 1, 3) : 0;
    let carCount = 0, footCount = 0;
    for (const pc of police) { if (pc.foot) footCount += 1; else carCount += 1; }
    if (carCount < wantCars && random() < dt * 1.2) police.push(spawnPoliceCar());
    if (footCount < wantFoot && random() < dt * 1.2) police.push(spawnPoliceFoot());
    // Move police cars in the traffic loop above via cars? Police live in `police`
    // but chase like cars: handle them here (they are not in `cars`).
    for (const pc of police) {
      if (pc.dead) continue;
      if (pc.foot) {
        const d = Math.hypot(player.x - pc.x, player.y - pc.y) || 1;
        pc.angle = Math.atan2(player.y - pc.y, player.x - pc.x);
        pc.x += Math.cos(pc.angle) * pc.speed * dt; pc.y += Math.sin(pc.angle) * pc.speed * dt;
        if (d < 34 && !player.inCar) {
          pc.brawlCd -= dt;
          if (pc.brawlCd <= 0) { pc.brawlCd = POLICE.brawlCooldown; if (player.invuln <= 0) { player.health -= POLICE.brawlDamage; player.invuln = 0.4; state.shake = 0.35; } }
          if (state.wanted >= 2) {
            player.bustedTimer += dt;
            if (player.bustedTimer > 1.4) { respawn(STATION, 'BUSTED'); events |= EVENT_BUSTED; }
          }
        } else player.bustedTimer = Math.max(0, player.bustedTimer - dt);
      } else {
        const want = Math.atan2(player.y - pc.y, player.x - pc.x);
        pc.angle = angleLerp(pc.angle, want, dt * 2.4);
        pc.x = clamp(pc.x + Math.cos(pc.angle) * POLICE.carSpeed * dt, 30, WORLD.width - 30);
        pc.y = clamp(pc.y + Math.sin(pc.angle) * POLICE.carSpeed * dt, 30, WORLD.height - 30);
        const d = Math.hypot(player.x - pc.x, player.y - pc.y);
        if (d < 72 && player.invuln <= 0) {
          state.shake = 0.45; spawnParticles(pc.x, pc.y, '#cccccc', 6, 130);
          if (player.inCar) { player.inCar.health -= 8; player.health -= 2; }
          else player.health -= POLICE.ramDamage;
          player.invuln = 0.5; events |= EVENT_CRASH;
        }
      }
    }
    // Remove dead / far police.
    for (let i = police.length - 1; i >= 0; i -= 1) {
      const pc = police[i];
      if (pc.dead || (state.wanted === 0 && Math.hypot(pc.x - player.x, pc.y - player.y) > 900)) police.splice(i, 1);
    }

    // --- bullets ------------------------------------------------------------
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      let dead = b.life <= 0 || b.x < 0 || b.x > WORLD.width || b.y < 0 || b.y > WORLD.height;
      if (!dead) {
        for (const pc of police) {
          if (!pc.dead && dist2(b.x, b.y, pc.x, pc.y) < 26 * 26) {
            if (pc.foot) { pc.health -= 34; if (pc.health <= 0) { pc.dead = true; state.kills += 1; addWanted(1); } }
            else { pc.health = (pc.health ?? 100) - 20; }
            dead = true; spawnParticles(b.x, b.y, '#e5534b', 6, 120); break;
          }
        }
        if (!dead) for (const p of peds) {
          if (p.alive && dist2(b.x, b.y, p.x, p.y) < 20 * 20) { p.alive = false; addWanted(1); dead = true; spawnParticles(b.x, b.y, '#e5534b', 8, 130); break; }
        }
      }
      if (dead) bullets.splice(i, 1);
    }

    // --- pickups ------------------------------------------------------------
    for (const pk of pickups) {
      if (pk.respawn > 0) { pk.respawn -= dt; continue; }
      if (dist2(player.x, player.y, pk.x, pk.y) < 40 * 40) {
        if (pk.kind === 'health') player.health = Math.min(100, player.health + 30);
        else player.ammo += 12;
        pk.respawn = 25; events |= EVENT_PICKUP; spawnParticles(pk.x, pk.y, '#5ad08a', 10, 120);
        say(pk.kind === 'health' ? 'Health +30' : 'Ammo +12', 2);
      }
    }

    // --- wanted decay -------------------------------------------------------
    if (state.wanted > 0) {
      state.wantedTimer += dt;
      const nearestPolice = police.reduce((m, pc) => Math.min(m, Math.hypot(pc.x - player.x, pc.y - player.y)), 1e9);
      if (state.missionIndex === 2) {
        if (nearestPolice > 500) state.heatLeft -= dt;
        if (state.heatLeft <= 0) { state.wanted = 0; events |= completeMission(); }
      } else if (state.wantedTimer > 14 && nearestPolice > 600) {
        state.wanted -= 1; state.wantedTimer = 0; say('Heat cooling down…', 2);
      }
    }

    // --- mission progress ---------------------------------------------------
    const t = missionTarget();
    state.target = t;
    const pd = Math.hypot(player.x - t.x, player.y - t.y);
    if (state.missionIndex === 0) {
      if (state.missionStage === 0 && player.inCar) { state.missionStage = 1; say('Now drive to the yellow marker!', 3); }
      else if (state.missionStage === 1 && pd < 90) events |= completeMission();
    } else if (state.missionIndex === 1) {
      if (state.missionStage === 0 && pd < 70) { state.missionStage = 1; addWanted(2); say('Package grabbed! Deliver it — police are coming!', 3); }
      else if (state.missionStage === 1 && pd < 90) events |= completeMission();
    } else if (state.missionIndex === 3) {
      if (pd < 70) {
        state.stashesLeft -= 1; spawnParticles(t.x, t.y, '#f2c94c', 16, 160); events |= EVENT_PICKUP;
        if (state.stashesLeft <= 0) events |= completeMission();
        else { state.target = state.stashSpots[3 - state.stashesLeft]; say(`Stash found! ${state.stashesLeft} left.`, 3); }
      }
    } else if (state.missionIndex === 4) {
      if (pd < 110) events |= completeMission();
    }

    // --- particles ----------------------------------------------------------
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const pt = particles[i];
      pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
      if (pt.life <= 0) particles.splice(i, 1);
    }

    // --- health / wasted ----------------------------------------------------
    if (player.health <= 0 && !state.won) { respawn(HOSPITAL, 'WASTED'); events |= EVENT_WASTED; }
    if (player.inCar && player.inCar.health <= 0) { player.inCar.health = 100; spawnParticles(player.inCar.x, player.inCar.y, '#666666', 20, 200); }

    // --- camera -------------------------------------------------------------
    state.camX = clamp(player.x - 640 + (state.shake > 0 ? (random() - 0.5) * state.shake * 24 : 0), 0, WORLD.width - 1280);
    state.camY = clamp(player.y - 400 + (state.shake > 0 ? (random() - 0.5) * state.shake * 24 : 0), 0, WORLD.height - 800);
    state.sirenTimer -= dt; state.engineTimer -= dt;
    return events;
  }

  reset();
  return { state, reset, step, startMission, autopilotInput, shootAt, punch, onRoad, nearestCar, missionTarget };
}
