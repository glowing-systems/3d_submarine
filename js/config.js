// 📁 js/config.js 👷 W7 📝 Zweck: Bootstypen, Tiefenstufen, Torpedo- & Kampagnen-Konstanten
export const BOAT_TYPES = {
  'Typ IIA':  { tubes: 3, reserve: 5,  maxDepth: 120, crushDepth: 150, surfKn: 13, submKn: 7,  turn: 1.0, hull: 100, unlockTonnage: 0 },
  'Typ VIIB': { tubes: 5, reserve: 8,  maxDepth: 200, crushDepth: 250, surfKn: 17, submKn: 8,  turn: 1.0, hull: 120, unlockTonnage: 0 },
  'Typ IXC':  { tubes: 6, reserve: 12, maxDepth: 200, crushDepth: 250, surfKn: 18, submKn: 7.5,turn: 0.85,hull: 140, unlockTonnage: 30000 },
  'Typ XXI':  { tubes: 6, reserve: 14, maxDepth: 280, crushDepth: 330, surfKn: 16, submKn: 17, turn: 1.1, hull: 160, unlockTonnage: 100000 },
};
export const DEPTH_STAGES = [
  { name: 'surface', depth: 0 }, { name: 'schnorchel', depth: 7.5 },
  { name: 'periskop', depth: 12 }, { name: 'tief', depth: 60 },
];
export const TORPEDO = {
  speeds: { '30': { kn: 30, range: 12000 }, '40': { kn: 40, range: 7500 }, '44': { kn: 44, range: 5000 } },
  reloadTime: 240, // s Spielzeit für Bugrohre (Heck länger)
  runDepthDefault: 3,
};
export const TELEGRAPH = { stop: 0, slow: 0.25, half: 0.5, full: 0.8, flank: 1.0, reverse: -0.3 };
export const RANKS = [
  { tonnage: 0, rank: 'Oberleutnant z.S.' }, { tonnage: 15000, rank: 'Kapitänleutnant' },
  { tonnage: 50000, rank: 'Korvettenkapitän' }, { tonnage: 100000, rank: 'Fregattenkapitän' },
  { tonnage: 200000, rank: 'Kapitän z.S.' },
];
export const MEDALS = [
  { tonnage: 10000, medal: 'EK II' }, { tonnage: 40000, medal: 'EK I' },
  { tonnage: 100000, medal: 'Ritterkreuz' }, { tonnage: 200000, medal: 'Eichenlaub' },
];
export const HISTORICAL_EVENTS = [
  { date: '1939-09-01', text: 'Kriegsbeginn. Prisenordnung beachten.' },
  { date: '1940-04-09', text: 'Unternehmen Weserübung: Norwegen-Operation.' },
  { date: '1940-06-01', text: 'Stützpunkt Lorient verfügbar — kürzere Anmarschwege.' },
  { date: '1941-05-27', text: 'Bismarck gesunken. Vorsicht vor Trägerflugzeugen.' },
  { date: '1942-01-13', text: 'Operation Paukenschlag: US-Ostküste voller Ziele!' },
  { date: '1943-05-01', text: 'Schwarzer Mai: Starke Eskorten, Radar, HF/DF. Tieftauchen!' },
  { date: '1944-06-06', text: 'Invasion in der Normandie. Kanal stark bewacht.' },
];
export const PORTS = [
  { name: 'Kiel', x: 60, z: -420 }, { name: 'Wilhelmshaven', x: -40, z: -400 },
  { name: 'Lorient', x: -260, z: -180 }, { name: 'St. Nazaire', x: -280, z: -140 },
];
export const CONVOY_ROUTES = [
  { name: 'HX (Halifax–UK)', pts: [[-900, -100], [-500, -150], [-200, -220]] },
  { name: 'SC (Sydney–UK)', pts: [[-800, 100], [-450, 0], [-200, -180]] },
  { name: 'OG (UK–Gibraltar)', pts: [[-250, -200], [-300, 100], [-250, 350]] },
];
