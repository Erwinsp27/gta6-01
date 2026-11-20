// Screenshot scenes behind ?shot=drive|onfoot|wanted|start.
// Each one plays the real rules forward from a fresh world, steered by a
// simple autopilot (drive/walk toward the mission marker, steal the nearest
// car when on foot and close to one), so the frame is what real play looks
// like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function autopilotStep(world, input) {
  const s = world.state, p = s.player;
  const t = world.missionTarget();
  let dx = t.x - p.x, dy = t.y - p.y;
  const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
  if (p.inCar) {
    // Steer the car toward the target: gas + turn toward its bearing.
    const want = Math.atan2(dy, dx);
    let diff = want - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    input.setAxis(diff > 0.15 ? 1 : diff < -0.15 ? -1 : 0, -1);
  } else {
    input.setAxis(dx, dy);
    const near = world.nearestCar(p.x, p.y, 78);
    if (near) input.press(4); // E — steal
  }
}

export function stageShot(name, world, input) {
  world.reset();
  const s = world.state;
  if (name === 'start') {
    for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP, input, null);
    return { screen: SCREEN_TITLE, save: null };
  }
  if (name === 'onfoot') {
    // Walk toward the first marker for a while, on foot among pedestrians.
    for (let i = 0; i < 9 / STEP; i += 1) {
      const t = world.missionTarget();
      input.setAxis((t.x - s.player.x) / 500, (t.y - s.player.y) / 500);
      world.step(STEP, input, null);
    }
    input.clearVirtual();
    return { screen: SCREEN_PLAY, save: null };
  }
  if (name === 'wanted') {
    // Steal, then drive with 3 stars and police in pursuit.
    s.wanted = 3; s.bestWanted = 3;
    for (let i = 0; i < 16 / STEP; i += 1) { autopilotStep(world, input); world.step(STEP, input, null); }
    input.clearVirtual();
    return { screen: SCREEN_PLAY, save: null };
  }
  // drive (default): steal a car and drive across the city, police chasing.
  s.wanted = 2; s.bestWanted = 2;
  for (let i = 0; i < 14 / STEP; i += 1) { autopilotStep(world, input); world.step(STEP, input, null); }
  input.clearVirtual();
  return { screen: SCREEN_PLAY, save: null };
}
