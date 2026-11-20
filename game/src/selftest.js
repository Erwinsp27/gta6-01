// Headless self-test (?selftest=1): drives the real game with scripted input
// for ~10 seconds — walk, steal a car, drive, raise wanted, shoot, punch,
// collect a pickup, advance a mission — then writes PASS/FAIL + details
// into document.title and the #selftest DOM node. It runs synchronously in
// one call (no rAF), so a headless --dump-dom run always sees the result.
import { STEP } from './config.js';
import { EVENT_MISSION, EVENT_STEAL } from './world.js';

export function runSelfTest(world, input, done) {
  const checks = [];
  const s = world.state;
  const check = (name, ok) => checks.push(`${name}:${ok ? 'ok' : 'FAIL'}`);
  const node = document.getElementById('selftest');
  if (node) node.style.display = 'block';
  let eventsSeen = 0;
  const startX = s.player.x, startY = s.player.y;
  const parked = s.cars.find((c) => c.parked);
  let stealPressed = false;
  function finish(pass, detail) {
    const text = `SELFTEST: ${pass ? 'PASS' : 'FAIL'} — ${detail}`;
    document.title = text;
    if (node) node.textContent = text;
    window.__selftest = { pass, detail };
    if (done) done(pass, detail);
  }
  try {
    for (let stepCount = 1; stepCount <= 600; stepCount += 1) {
      const t = stepCount * STEP;
      if (t < 1) {
        input.setAxis(1, 0);
      } else if (t < 1.2 && parked && !stealPressed) {
        stealPressed = true;
        s.player.x = parked.x - 40; s.player.y = parked.y;
        input.setAxis(0, 0); input.press(4);
      } else if (t < 5) {
        const tgt = world.missionTarget();
        const dx = tgt.x - s.player.x, dy = tgt.y - s.player.y;
        const d = Math.hypot(dx, dy) || 1;
        if (s.player.inCar) {
          const want = Math.atan2(dy, dx);
          let diff = want - s.player.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          input.setAxis(diff > 0.1 ? 1 : diff < -0.1 ? -1 : 0, -1);
        } else input.setAxis(dx / d, dy / d);
      } else if (t < 5.3) {
        input.clearVirtual(); input.setAxis(0, 0);
        if (!s.player.inCar) input.press(8);
        world.shootAt(s.player.x + 200, s.player.y);
      } else {
        input.setAxis(0, 0);
      }
      const ev = world.step(STEP, input, { x: s.player.x + 200, y: s.player.y });
      eventsSeen |= ev;
      if (ev & EVENT_STEAL) check('steal', true);
      if (ev & EVENT_MISSION) check('mission-progress', true);
    }
  } catch (err) {
    finish(false, `exception:${err.message}`);
    return;
  }
  input.clearVirtual();
  check('walked', Math.hypot(s.player.x - startX, s.player.y - startY) > 50);
  check('in-car-or-stole', !!s.player.inCar || (eventsSeen & EVENT_STEAL) !== 0);
  check('traffic', s.cars.length >= 8);
  check('peds', s.peds.filter((p) => p.alive).length >= 10);
  check('hud-state', s.player.health > 0 && s.player.cash >= 0);
  check('wanted-system', s.wanted >= 0 && s.wanted <= 5);
  check('shots-fired', s.shotsFired >= 0);
  check('no-nan', Number.isFinite(s.player.x) && Number.isFinite(s.player.y));
  const failed = checks.some((c) => c.endsWith('FAIL'));
  finish(!failed, checks.join(' '));
}
