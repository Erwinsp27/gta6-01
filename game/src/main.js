// Neon Bay — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, the renderer paints what is there, and the
// audio engine reacts to events. Screens: title, play, paused, wasted, won.
// ?seed=N fixes the city. ?shot=drive|onfoot|wanted|start stages a scene
// (see shots.js) and sets window.__shotReady. ?selftest=1 runs the scripted
// headless check (see selftest.js) and reports PASS/FAIL in the title.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_CRASH, EVENT_MISSION, EVENT_PICKUP, EVENT_SHOT, EVENT_STEAL, EVENT_WASTED, EVENT_WON } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON } from './render.js';
import { stageShot } from './shots.js';
import { runSelfTest } from './selftest.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const selftest = params.get('selftest') === '1';
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
const input = createInput(canvas);

function readSave() {
  try { return JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? 'null'); } catch { return null; }
}
function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: world.state.player.cash, missions: world.state.missionIndex,
      bestWanted: world.state.bestWanted, carsStolen: world.state.carsStolen,
    }));
  } catch { /* private windows: progress lasts this visit only */ }
}
function applySave(save) {
  if (!save) return;
  world.state.player.cash = save.cash || 50;
  world.state.bestWanted = save.bestWanted || 0;
}

function runShot(name) {
  const scene = stageShot(name, world, input);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, readSave());
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let save = readSave();
  let accumulator = 0;
  let last = performance.now();
  let saveFlash = 0;
  let sirenCd = 0;

  function announce(message) { status.textContent = message; }
  function startGame(fresh) {
    world.reset();
    if (!fresh && save) applySave(save);
    accumulator = 0; screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing Neon Bay. Steal a car and follow the yellow marker.');
  }
  function handleEvents(events) {
    if (events & EVENT_MISSION) { audio.jingle(); writeSave(); saveFlash = 2; }
    if (events & EVENT_WON) { screen = SCREEN_WON; writeSave(); announce('You won! All five missions complete.'); }
    if (events & EVENT_WASTED) { audio.wasted(); screen = SCREEN_OVER; writeSave(); }
    if (events & EVENT_BUSTED) { audio.wasted(); screen = SCREEN_OVER; writeSave(); }
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_SHOT) audio.gunshot();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_STEAL) audio.pickup();
  }
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    // Actions are handed to the world once (first fixed step of this frame);
    // taking them here AND in world.step would swallow E / punch / shoot.
    let pendingActions = actions;
    const stepInput = {
      axis: () => input.axis(),
      virtualAxis: () => input.virtualAxis(),
      takeActions: () => { const t = pendingActions; pendingActions = 0; return t; },
    };
    if (actions & ACTION_MUTE) { const m = audio.toggleMute(); announce(m ? 'Muted.' : 'Sound on.'); }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame(true);
      else if (actions & 4) startGame(false); // E = Continue with the save
      world.step(STEP, stepInput, null);
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) { screen = SCREEN_PAUSED; announce('Paused.'); }
      else {
        audio.unlock();
        const mouse = input.mouse();
        const aim = {
          x: world.state.camX + (mouse.x / (window.innerWidth || 1)) * 1280,
          y: world.state.camY + (mouse.y / (window.innerHeight || 1)) * 800,
        };
        while (accumulator >= STEP) {
          const ev = world.step(STEP, stepInput, aim);
          handleEvents(ev);
          accumulator -= STEP;
          if (screen !== SCREEN_PLAY) break;
        }
        if (world.state.wanted > 0) { sirenCd -= STEP; if (sirenCd <= 0) { sirenCd = 1.4; audio.siren(); } }
        if (world.state.player.inCar && Math.abs(world.state.player.inCar.speed) > 80) {
          if (world.state.engineTimer <= 0) { world.state.engineTimer = 0.12; audio.engine(Math.abs(world.state.player.inCar.speed) / 560); }
        }
        if (saveFlash > 0) saveFlash -= STEP;
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) { screen = SCREEN_PLAY; announce('Playing.'); }
      accumulator = 0;
    } else if (screen === SCREEN_OVER || screen === SCREEN_WON) {
      if (actions & ACTION_CONFIRM) startGame(true);
      accumulator = 0;
    }
    if (screen === SCREEN_TITLE) renderer.draw(world.state, SCREEN_TITLE, save);
    else renderer.draw(world.state, screen, saveFlash > 0 ? readSave() : null);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) screen = SCREEN_PAUSED;
  });
  canvas.addEventListener('pointerdown', () => audio.unlock());
  announce('Neon Bay. Press Space or click to start.');
  if (selftest) {
    screen = SCREEN_PLAY;
    runSelfTest(world, input, (pass) => { renderer.draw(world.state, SCREEN_PLAY, null); });
    // Keep painting while the test runs so the canvas is live.
    (function paintLoop() { renderer.draw(world.state, SCREEN_PLAY, null); if (!window.__selftest) requestAnimationFrame(paintLoop); })();
    return;
  }
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
