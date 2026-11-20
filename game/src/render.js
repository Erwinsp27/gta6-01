// Drawing only: world state + screen in, pixels out. Camera window 1280x800
// scaled to the browser window. Canvas shapes and text only — no images.
import { DISTRICTS, FONT, FONT_DISPLAY, PALETTE, ROADS_H, ROADS_V, ROAD_W, VIEW, WORLD } from './config.js';
import { MISSIONS } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WON = 'won';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    view.x = (canvas.width - VIEW.width * view.scale) / 2;
    view.y = (canvas.height - VIEW.height * view.scale) / 2;
  }
  const fonts = new Map();
  function text(v, x, y, size, color, align, font) {
    const key = size + (font || '');
    if (!fonts.has(key)) fonts.set(key, `${size}px ${font || FONT}`);
    ctx.font = fonts.get(key); ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(v, x, y);
  }
  function drawCar(x, y, angle, color, isPolice, w, l) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = '#111'; ctx.fillRect(-l / 2 - 3, -w / 2 - 3, l + 6, w + 6);
    ctx.fillStyle = color; ctx.fillRect(-l / 2, -w / 2, l, w);
    ctx.fillStyle = 'rgba(180,220,255,0.85)'; ctx.fillRect(l * 0.08, -w / 2 + 4, l * 0.22, w - 8);
    ctx.fillStyle = '#ffd76a'; ctx.fillRect(l / 2 - 4, -w / 2 + 3, 4, 6); ctx.fillRect(l / 2 - 4, w / 2 - 9, 4, 6);
    if (isPolice) { ctx.fillStyle = '#fff'; ctx.fillRect(-l * 0.28, -w / 2 + 3, l * 0.4, w - 6); ctx.fillStyle = '#111'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('PD', 0, 4); }
    ctx.restore();
  }
  function drawWorld(s) {
    const camX = s.camX, camY = s.camY;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, VIEW.width, VIEW.height); ctx.clip();
    ctx.translate(-camX, -camY);
    // Ground: grass base, beach + sea on the west edge, park, docks.
    ctx.fillStyle = PALETTE.grass; ctx.fillRect(camX - 10, camY - 10, VIEW.width + 20, VIEW.height + 20);
    ctx.fillStyle = PALETTE.sea; ctx.fillRect(camX - 10, camY - 10, 130, VIEW.height + 20);
    ctx.fillStyle = PALETTE.sand; ctx.fillRect(120, camY - 10, 150, VIEW.height + 20);
    ctx.fillStyle = PALETTE.park; ctx.fillRect(1250, 1250, 580, 580);
    ctx.fillStyle = PALETTE.dock; ctx.fillRect(2150, 1850, 1050, 550);
    // District labels on the ground.
    ctx.font = `bold 26px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.textAlign = 'center';
    ctx.fillText('PALM BEACH', 200, 1200); ctx.fillText('MARINA PARK', 1540, 1540); ctx.fillText('THE DOCKS', 2650, 2100);
    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const rx of ROADS_V) ctx.fillRect(rx - ROAD_W / 2, camY - 10, ROAD_W, VIEW.height + 20);
    for (const ry of ROADS_H) ctx.fillRect(camX - 10, ry - ROAD_W / 2, VIEW.width + 20, ROAD_W);
    ctx.strokeStyle = PALETTE.roadLine; ctx.lineWidth = 3; ctx.setLineDash([26, 22]);
    ctx.beginPath();
    for (const rx of ROADS_V) { ctx.moveTo(rx, camY - 10); ctx.lineTo(rx, camY + VIEW.height + 10); }
    for (const ry of ROADS_H) { ctx.moveTo(camX - 10, ry); ctx.lineTo(camX + VIEW.width + 10, ry); }
    ctx.stroke(); ctx.setLineDash([]);
    // Buildings with a simple shadow + roof detail.
    for (const b of s.buildings) {
      if (b.x + b.w < camX - 50 || b.x > camX + VIEW.width + 50 || b.y + b.h < camY - 50 || b.y > camY + VIEW.height + 50) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, 10);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      for (let wx = b.x + 14; wx < b.x + b.w - 14; wx += 26) for (let wy = b.y + 26; wy < b.y + b.h - 10; wy += 26) ctx.fillRect(wx, wy, 12, 12);
    }
    // Mission marker: pulsing yellow ring + beam.
    const t = s.target;
    if (t && !s.won) {
      const pulse = 1 + Math.sin(s.elapsed * 5) * 0.15;
      ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(t.x, t.y, 42 * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(242,201,76,0.25)'; ctx.beginPath(); ctx.arc(t.x, t.y, 42 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2c94c'; ctx.beginPath(); ctx.moveTo(t.x, t.y - 66); ctx.lineTo(t.x - 12, t.y - 34); ctx.lineTo(t.x + 12, t.y - 34); ctx.closePath(); ctx.fill();
    }
    // Pickups.
    for (const pk of s.pickups) {
      if (pk.respawn > 0) continue;
      ctx.fillStyle = pk.kind === 'health' ? '#fff' : '#ffd76a';
      ctx.beginPath(); ctx.arc(pk.x, pk.y, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pk.kind === 'health' ? '#e5534b' : '#111';
      ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(pk.kind === 'health' ? '+' : 'A', pk.x, pk.y + 6);
    }
    // Pedestrians (circles with a shirt dot) — fleeing ones lean away.
    for (const p of s.peds) {
      if (!p.alive) { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 14, 8, 0, 0, Math.PI * 2); ctx.fill(); continue; }
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(p.x, p.y - 2, 6, 0, Math.PI * 2); ctx.fill();
    }
    // Traffic + parked cars.
    for (const c of s.cars) drawCar(c.x, c.y, c.angle, c.color, false, 30, 62);
    // Police: cars with light bar, foot officers as blue circles.
    for (const pc of s.police) {
      if (pc.dead) continue;
      if (pc.foot) {
        ctx.fillStyle = '#2f6fd0'; ctx.beginPath(); ctx.arc(pc.x, pc.y, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('PD', pc.x, pc.y + 3);
      } else {
        drawCar(pc.x, pc.y, pc.angle, '#2f6fd0', true, 30, 62);
        const blink = Math.floor(s.elapsed * 6) % 2 === 0;
        ctx.fillStyle = blink ? '#ff3b30' : '#3b82ff';
        ctx.beginPath(); ctx.arc(pc.x - Math.cos(pc.angle) * 8, pc.y - Math.sin(pc.angle) * 8, 6, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Bullets.
    ctx.fillStyle = '#ffd76a';
    for (const b of s.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill(); }
    // Player: on foot a yellow figure with a gun direction line; in a car the red car.
    const pl = s.player;
    if (pl.inCar) {
      drawCar(pl.inCar.x, pl.inCar.y, pl.inCar.angle, '#e5534b', false, 30, 62);
      if (pl.inCar.health < 40) { ctx.fillStyle = 'rgba(120,120,120,0.7)'; ctx.beginPath(); ctx.arc(pl.inCar.x, pl.inCar.y - 20, 10, 0, Math.PI * 2); ctx.fill(); }
    } else {
      if (pl.invuln <= 0 || Math.floor(pl.invuln * 10) % 2 === 1) {
        ctx.fillStyle = PALETTE.player; ctx.beginPath(); ctx.arc(pl.x, pl.y, 13, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(pl.x + Math.cos(pl.angle) * 6, pl.y + Math.sin(pl.angle) * 6, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(pl.x, pl.y); ctx.lineTo(pl.x + Math.cos(pl.angle) * 24, pl.y + Math.sin(pl.angle) * 24); ctx.stroke();
      }
    }
    // Particles.
    for (const pt of s.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  function drawMinimap(s) {
    const mw = 220, mh = 165, mx = VIEW.width - mw - 16, my = 16;
    const sx = mw / WORLD.width, sy = mh / WORLD.height;
    ctx.fillStyle = 'rgba(8,12,22,0.78)'; ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
    ctx.fillStyle = '#2e5d3a'; ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#3a3f4a';
    for (const rx of ROADS_V) ctx.fillRect(mx + rx * sx - 2, my, 4, mh);
    for (const ry of ROADS_H) ctx.fillRect(mx, my + ry * sy, mw, 4);
    ctx.fillStyle = '#2f7fb8'; ctx.fillRect(mx, my, 130 * sx + 2, mh);
    if (s.target && !s.won) { ctx.fillStyle = '#f2c94c'; ctx.beginPath(); ctx.arc(mx + s.target.x * sx, my + s.target.y * sy, 5, 0, Math.PI * 2); ctx.fill(); }
    for (const c of s.cars) { ctx.fillStyle = '#9fb3c8'; ctx.fillRect(mx + c.x * sx - 1, my + c.y * sy - 1, 3, 3); }
    for (const pc of s.police) { if (!pc.dead) { ctx.fillStyle = '#3b82ff'; ctx.beginPath(); ctx.arc(mx + pc.x * sx, my + pc.y * sy, 3, 0, Math.PI * 2); ctx.fill(); } }
    ctx.fillStyle = '#ffcf3f'; ctx.beginPath(); ctx.arc(mx + s.player.x * sx, my + s.player.y * sy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(mx - 4, my - 4, mw + 8, mh + 8);
  }
  function drawHud(s, save) {
    ctx.fillStyle = PALETTE.hud; ctx.fillRect(0, 0, VIEW.width, 64);
    text('NEON BAY', 16, 30, 26, '#ffcf3f', 'left', FONT_DISPLAY);
    text(`$${s.player.cash}`, 16, 56, 20, PALETTE.text);
    // Health bar.
    ctx.fillStyle = '#333'; ctx.fillRect(170, 16, 150, 18);
    ctx.fillStyle = s.player.health > 30 ? '#5ad08a' : '#e5534b'; ctx.fillRect(170, 16, 150 * Math.max(0, s.player.health) / 100, 18);
    ctx.strokeStyle = '#fff'; ctx.strokeRect(170, 16, 150, 18);
    text(`HP ${Math.max(0, Math.ceil(s.player.health))}`, 330, 32, 16, PALETTE.text);
    // Wanted stars.
    for (let i = 0; i < 5; i += 1) {
      text('★', 420 + i * 28, 34, 24, i < s.wanted ? '#ffd76a' : 'rgba(255,255,255,0.25)', 'left', FONT_DISPLAY);
    }
    text(s.player.inCar ? 'DRIVING — E to exit' : 'ON FOOT — E near a car to steal it', 580, 32, 16, PALETTE.muted);
    text(`AMMO ${s.player.ammo}`, 580, 56, 16, PALETTE.text);
    // Objective line.
    const m = MISSIONS[s.missionIndex];
    const obj = s.won ? 'All missions complete!' : `Mission ${s.missionIndex + 1}/5: ${m.title} — ${s.target ? s.target.label : m.brief}`;
    ctx.fillStyle = 'rgba(8,12,22,0.72)'; ctx.fillRect(16, VIEW.height - 44, 760, 30);
    text('► ' + obj, 26, VIEW.height - 23, 17, '#f2c94c');
    if (s.missionIndex === 2 && s.heatLeft > 0) text(`Heat: ${Math.ceil(s.heatLeft)}s`, 800, VIEW.height - 23, 17, PALETTE.text);
    if (s.messageTimer > 0) {
      ctx.fillStyle = 'rgba(8,12,22,0.8)'; ctx.fillRect(VIEW.width / 2 - 320, 78, 640, 34);
      text(s.message, VIEW.width / 2, 102, 18, '#fff', 'center');
    }
    drawMinimap(s);
    if (save) text('Saved ✓', VIEW.width - 250, VIEW.height - 20, 14, PALETTE.muted, 'right');
  }
  function drawPanel(title, lines, prompt, accent) {
    const w = 680, h = 150 + lines.length * 34;
    const x = (VIEW.width - w) / 2, y = (VIEW.height - h) / 2;
    ctx.fillStyle = PALETTE.panel; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent || '#ffcf3f'; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h);
    text(title, VIEW.width / 2, y + 64, 46, accent || '#ffcf3f', 'center', FONT_DISPLAY);
    lines.forEach((ln, i) => text(ln, VIEW.width / 2, y + 112 + i * 34, 19, PALETTE.muted, 'center'));
    text(prompt, VIEW.width / 2, y + h - 26, 20, '#f2c94c', 'center');
  }
  function draw(state, screen, save) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawWorld(state);
    if (screen === SCREEN_TITLE) {
      drawPanel('NEON BAY', [
        'Jax Moreno, wheelman of Neon Bay, owes the wrong people money.',
        'Steal cars, outrun the police, finish five missions — and get out rich.',
        'WASD / arrows: move & drive · E: enter / steal car · Space/F: punch',
        'Mouse aim + click: shoot · P: pause · M: mute · Progress autosaves.',
        save && save.cash > 50 ? `Continue: $${save.cash}, ${save.missions} mission(s) done` : 'A brand-new open-world crime game — all original.',
      ], 'Press Space or click — New Game  ·  C to Continue', '#ffcf3f');
      return;
    }
    drawHud(state, save);
    if (screen === SCREEN_PAUSED) drawPanel('PAUSED', ['The city waits for you.', 'P / Esc to resume · M to mute sound'], 'Press P to keep playing');
    else if (screen === SCREEN_OVER) drawPanel('WASTED', ['Jax is down — but Neon Bay never sleeps.', `Cash $${state.player.cash} · Missions done ${state.missionIndex}`], 'Press Space to try again', '#e5534b');
    else if (screen === SCREEN_WON) drawPanel('THE BIG SCORE!', ['All five missions complete. Jax escapes Neon Bay rich.', `Final cash $${state.player.cash} · Best wanted ${state.bestWanted}★ · Cars stolen ${state.carsStolen}`], 'Press Space to play again', '#5ad08a');
  }
  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
