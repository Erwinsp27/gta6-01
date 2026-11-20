// Neon Bay — every tuning number, colour and place name in one place.
// The world is a fixed 3200 x 2400 city; the renderer shows a 1280 x 800
// camera window that follows the player, so no rule depends on screen size.
export const WORLD = { width: 3200, height: 2400 };
export const VIEW = { width: 1280, height: 800 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'neon-bay.save.v1';

// Road grid: vertical avenues and horizontal streets, 96 px wide.
export const ROADS_V = [320, 920, 1520, 2120, 2720];
export const ROADS_H = [320, 920, 1520, 2120];
export const ROAD_W = 96;

export const PLAYER = { radius: 13, walkSpeed: 230, punchRange: 34, punchDamage: 25, punchCooldown: 0.38 };
export const CAR = { length: 62, width: 30, accel: 420, brake: 700, maxSpeed: 560, maxReverse: 180, turn: 2.9, grip: 3.2, drag: 0.55 };
export const POLICE = { carSpeed: 520, footSpeed: 205, ramDamage: 12, brawlDamage: 8, brawlCooldown: 0.9 };

export const MISSIONS = [
  { id: 1, title: 'First Wheels', brief: 'Steal a car and drive to the yellow marker.', pay: 150 },
  { id: 2, title: 'The Pickup', brief: 'Grab the package, then deliver it while the police chase you.', pay: 300 },
  { id: 3, title: 'Lose the Heat', brief: 'You are at 3 stars. Escape — stay out of sight until the heat dies.', pay: 400 },
  { id: 4, title: 'The Setup', brief: 'Collect 3 stashes hidden across Neon Bay.', pay: 500 },
  { id: 5, title: 'The Big Score', brief: 'Final run: reach the docks and escape Neon Bay.', pay: 1000 },
];

export const DISTRICTS = [
  { name: 'PALM BEACH', x: 0, y: 0, w: 270, h: 2400, color: '#e8d29a' },
  { name: 'DOWNTOWN', x: 1220, y: 620, w: 900, h: 600, color: '#3a4a6b' },
  { name: 'MARINA PARK', x: 1220, y: 1220, w: 600, h: 600, color: '#3f7a4a' },
  { name: 'THE DOCKS', x: 2120, y: 1820, w: 1080, h: 580, color: '#5a4a3a' },
  { name: 'OLD TOWN', x: 320, y: 1820, w: 900, h: 580, color: '#6b4a5a' },
];

export const PALETTE = {
  backdrop: '#0b1220', grass: '#4d8a4f', sand: '#e8d29a', sea: '#2f7fb8',
  road: '#2b2f38', roadLine: '#d8c25a', sidewalk: '#8d8f96', block: '#3d4457',
  buildingA: '#5b6b8c', buildingB: '#7a5b6b', buildingC: '#4a6b5b', buildingD: '#8c7a4a',
  park: '#3f7a4a', dock: '#6b5a44', player: '#ffcf3f', playerCar: '#e5534b',
  traffic: ['#4fc3f7', '#f2c94c', '#9b7ede', '#e8e8e8', '#5ad08a', '#e07a4f'],
  police: '#2f6fd0', ped: ['#f28b82', '#81c995', '#a8c7fa', '#f9ab00', '#d7aefb'],
  text: '#f4f6f8', muted: '#b9c2cc', gold: '#f2c94c', red: '#e5534b', green: '#5ad08a',
  panel: 'rgba(10,16,30,0.88)', hud: 'rgba(10,16,30,0.72)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_DISPLAY = '"Arial Black", system-ui, sans-serif';
