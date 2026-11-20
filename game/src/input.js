// Keyboard + mouse input. Held keys steer; one-shot presses (enter car,
// punch, pause, mute, confirm) are queued as bit flags and taken once.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_SHOOT = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0, mouseY = 0, mouseDown = false;
  window.addEventListener('keydown', (event) => {
    if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM | ACTION_PUNCH; event.preventDefault(); return; }
    if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; event.preventDefault(); return; }
    if (event.code === 'KeyE') { if (!event.repeat) actions |= ACTION_ENTER; return; }
    if (event.code === 'KeyF') { if (!event.repeat) actions |= ACTION_PUNCH; return; }
    if (event.code === 'KeyM') { if (!event.repeat) actions |= ACTION_MUTE; return; }
    keys.add(event.code);
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousemove', (event) => { const r = canvas.getBoundingClientRect(); mouseX = event.clientX - r.left; mouseY = event.clientY - r.top; });
  canvas.addEventListener('mousedown', (event) => { if (event.button === 0) { mouseDown = true; actions |= ACTION_SHOOT; } });
  window.addEventListener('mouseup', () => { mouseDown = false; });
  return {
    axis() {
      const left = [...keys].some((k) => LEFT.has(k));
      const right = [...keys].some((k) => RIGHT.has(k));
      const up = [...keys].some((k) => UP.has(k));
      const down = [...keys].some((k) => DOWN.has(k));
      return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0), up, down, left, right };
    },
    setAxis(nx, ny) { // Used by the self-test / autopilot: injects a virtual axis.
      this._vx = nx; this._vy = ny; this._virtual = true;
    },
    clearVirtual() { this._virtual = false; },
    virtualAxis() { return this._virtual ? { x: this._vx, y: this._vy } : null; },
    mouse() { return { x: mouseX, y: mouseY, down: mouseDown }; },
    takeActions() { const t = actions; actions = 0; return t; },
    press(action) { actions |= action; },
  };
}
