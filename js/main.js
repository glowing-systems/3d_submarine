// 📁 js/main.js 👷 W0/W6/W8 📝 Zweck: Boot, Game-State, Kamera (Ext/Brücke/Periskop/UZO), Input, Simulations-Loop
import * as THREE from 'three';
import { BOAT_TYPES, PORTS, CONVOY_ROUTES, TELEGRAPH } from './config.js';
import { SubPhysics } from './physics.js';
import { Sonar } from './sonar.js';
import { Weapons } from './weapons.js';
import { Damage } from './damage.js';
import { Crew } from './crew.js';
import { Campaign } from './campaign.js';
import { GameAudio } from './audio.js';
import { UI } from './ui.js';
import { makeOcean, makeSky, makeSub, buildStatics, weatherFor } from './world.js';

const $ = id => document.getElementById(id);

// ---------- STATE ----------
function newState() {
  return {
    pos: new THREE.Vector3(0, 0, -300), heading: 0, targetHeading: 0, speed: 0,
    depth: 0, targetDepth: 0, rudder: 0, planes: 0, verticalSpeed: 0,
    telegraph: 'stop', engine: 'diesel', silentRunning: false, submerged: false,
    time: 0, date: new Date(1939, 8, 1, 8, 0), timeCompression: 1, tcAuto: false,
    weather: { sea: 2, fog: 0.2, night: 0, hour: 8 },
    o2: 100, co2: 0, battery: 100, fuel: 100,
    damage: { hull: 120, flood: 0, systems: { bugraum: 0, zentrale: 0, maschine: 0, heck: 0 } },
    pumpOn: true, periscopeUp: false, scopeBearing: 0, scopeRange: 0, locked: null,
    hydroDial: 0, pingFlash: 0, threatNear: 1e9,
    events: [], tubes: [], torpReserve: 8, deckAmmo: 100, flakAmmo: 200,
    sunk: false, gameOver: null, boatName: 'Typ VIIB', boatCfg: BOAT_TYPES['Typ VIIB'],
    ports: PORTS, routes: CONVOY_ROUTES, camMode: 'ext',
  };
}
const S = newState();
S.audio = new GameAudio();
S.crew = new Crew(S);
S.campaign = new Campaign(S);
S.damageModel = new Damage(S);

// ---------- THREE ----------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x06141a, 0.0009);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.5, 9000);
addEventListener('resize', resize);

const ocean = makeOcean(scene);
const sky = makeSky(scene);
buildStatics(scene);
const sub = makeSub(); scene.add(sub);
const periMast = sub.getObjectByName('periscopeMast');
const snorkelMast = sub.getObjectByName('snorkelMast');

S.physics = new SubPhysics(S);
S.sonar = new Sonar(scene, S);
S.weapons = new Weapons(scene, S);
S.weaponsHostile = S.weapons;
S.weapons.initTubes(S.boatCfg.tubes);
S.campaign.scene0 = scene;
const ui = new UI(S);
S.ui = ui;

// Einfache Gischt-/Blasen-Partikel
const partPool = [];
{
  const g = new THREE.BufferGeometry();
  const N = 300, posArr = new Float32Array(N * 3);
  g.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  const m = new THREE.PointsMaterial({ color: 0xbfe8ff, size: 1.6, transparent: true, opacity: 0.7 });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts);
  S.particles = { pts, posArr, N, head: 0,
    wake(x, y, z) { const i = this.head = (this.head + 1) % this.N; this.posArr[i * 3] = x; this.posArr[i * 3 + 1] = y; this.posArr[i * 3 + 2] = z; this.pts.geometry.attributes.position.needsUpdate = true; } };
}
function log(msg, cls = '') { S.events.push({ msg, cls }); }

// ---------- KAMERA ----------
const orbit = { yaw: 0.6, pitch: 0.35, dist: 90 };
let dragging = false, lx = 0, ly = 0;
canvas.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; ly = e.clientY; S.audio.ensure(); });
addEventListener('pointerup', () => dragging = false);
addEventListener('pointermove', e => {
  if (!dragging || S.camMode === 'peri') return;
  orbit.yaw -= (e.clientX - lx) * 0.005; orbit.pitch = Math.min(1.4, Math.max(0.02, orbit.pitch + (e.clientY - ly) * 0.004));
  lx = e.clientX; ly = e.clientY;
});
canvas.addEventListener('wheel', e => { orbit.dist = Math.min(600, Math.max(15, orbit.dist + e.deltaY * 0.05)); }, { passive: true });

function updateCamera() {
  const h = THREE.MathUtils.degToRad(S.heading);
  const sx = S.pos.x, sz = S.pos.z, sy = -S.depth;
  const sb = THREE.MathUtils.degToRad(S.scopeBearing);
  if (S.camMode === 'ext') {
    const cx = sx + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist;
    const cz = sz + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist;
    const cy = sy + 6 + Math.sin(orbit.pitch) * orbit.dist;
    camera.position.set(cx, cy, cz);
    camera.lookAt(sx, sy + 2, sz);
  } else if (S.camMode === 'bridge' || S.camMode === 'uzo') {
    const by = S.depth < 0.5 ? 7.5 : -S.depth + 7.5;
    camera.position.set(sx, by, sz);
    camera.lookAt(sx + Math.sin(sb) * 100, by - 2, sz - Math.cos(sb) * 100);
  } else if (S.camMode === 'peri') {
    const py = -S.depth + 9;
    camera.position.set(sx, py, sz);
    camera.lookAt(sx + Math.sin(sb) * 100, py - 1, sz - Math.cos(sb) * 100);
  }
  $('periscope-overlay').classList.toggle('hidden', S.camMode !== 'peri');
  $('btn-cam').textContent = '🎥 ' + S.camMode.toUpperCase();
}

// ---------- INPUT ----------
function setTelegraph(t) {
  S.telegraph = t; S.silentRunning = false; $('btn-silent').style.borderColor = '';
  document.querySelectorAll('#telegraph button').forEach(b => b.classList.toggle('sel', b.dataset.tel === t));
  if (t !== 'stop' && S.engine === 'diesel' && S.depth > 8.5) { S.engine = 'electric'; log('Diesel erstickt — E-Maschinen übernommen!', 'warn'); }
  S.audio.diesel(t !== 'stop', S.submerged);
}
function setDepth(d) {
  S.targetDepth = Math.min(260, Math.max(0, d));
  document.querySelectorAll('#depth-btns button').forEach(b => b.classList.toggle('sel', +b.dataset.depth === d));
  if (d > 0 && S.engine === 'diesel' && d > 8.5) { S.engine = 'electric'; log('Getaucht — E-Maschinen.', 'warn'); }
  if (d === 0) { S.periscopeUp = false; }
  log(d === 0 ? 'Auftauchen!' : `Neue Tiefe: ${d} m.`);
}
function cycleCam() { S.camMode = { ext: 'bridge', bridge: 'peri', peri: 'uzo', uzo: 'ext' }[S.camMode]; if (S.camMode === 'peri' && !S.periscopeUp && S.depth <= 14) S.periscopeUp = true; }
function lockTarget() {
  let best = null, bd = 6;
  for (const c of S.sonar.contacts) {
    if (!c.alive || c.type === 'aircraft') continue;
    let db = Math.abs(((S.sonar.bearingTo(c.x, c.z) - S.scopeBearing + 540) % 360) - 180);
    const d = S.sonar.distTo(c.x, c.z);
    if (db < bd && d < 2500) { bd = db; best = c; }
  }
  S.locked = best;
  if (best) { log(`${best.name} aufgeschaltet — Peilung ${Math.round(S.sonar.bearingTo(best.x, best.z))}°.`); stadi(); }
  else log('Kein Ziel in Visierlinie.', 'warn');
}
function stadi() {
  const c = S.locked;
  if (!c || !c.alive) { log('Kein Ziel aufgeschaltet.', 'warn'); return; }
  const trueD = S.sonar.distTo(c.x, c.z);
  const visOk = (!S.submerged) || (S.periscopeUp && S.depth <= 14);
  if (!visOk) { log('Kein Sichtkontakt (Periskop unten/zu tief).', 'warn'); return; }
  if (trueD > 2600) { log('Ziel zu weit für Stadimeter.', 'warn'); return; }
  const err = (1 - (S.crew.members[0].exp / 150)) * 0.12 + S.weather.sea * 0.015 + (S.weather.night > 0.5 ? 0.1 : 0);
  const meas = trueD * (1 + (Math.random() * 2 - 1) * err);
  S.scopeRange = meas; c.rangeKnown = meas;
  $('tdc-bearing').value = Math.round(S.sonar.bearingTo(c.x, c.z));
  $('tdc-range').value = Math.round(meas);
  $('tdc-course').value = Math.round(c.course);
  $('tdc-speed').value = Math.round(c.speed);
  c.det.visual = true;
  log(`Stadimeter: ${Math.round(meas)} m (Fehler ±${Math.round(err * 100)}%). In TDC übernommen.`);
}
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
  const k = e.key.toLowerCase();
  if (k === 'w') setDepth(Math.max(0, S.targetDepth - 5));
  else if (k === 's' && !e.repeat) setDepth(S.targetDepth + 5);
  else if (k === 'a') S.rudder = Math.max(-35, S.rudder - 5);
  else if (k === 'd') S.rudder = Math.min(35, S.rudder + 5);
  else if (k >= '1' && k <= '6') setTelegraph(['stop', 'slow', 'half', 'full', 'flank', 'reverse'][+k - 1]);
  else if (k === 'c') cycleCam();
  else if (k === 'p') { if (S.depth <= 14) { S.periscopeUp = !S.periscopeUp; log(S.periscopeUp ? 'Periskop oben.' : 'Periskop unten.'); if (S.periscopeUp) S.camMode = 'peri'; } else log('Zu tief für Periskop!', 'warn'); }
  else if (k === 'u') { if (!S.submerged) { S.camMode = 'uzo'; log('UZO besetzt.'); } else log('UZO nur über Wasser!', 'warn'); }
  else if (k === 'f') S.weapons.fire();
  else if (k === 'b') S.weapons.deckGun();
  else if (k === 'v') S.weapons.flak();
  else if (k === 'g') S.sonar.activePing();
  else if (k === 'r') stadi();
  else if (k === 'l') lockTarget();
  else if (k === 'q') S.scopeBearing = (S.scopeBearing - 3 + 360) % 360;
  else if (k === 'e') S.scopeBearing = (S.scopeBearing + 3) % 360;
  else if (k === 'x') toggleSilent();
  else if (k === 'h') $('help').classList.toggle('hidden');
  else if (k === 'm') toggleMute();
  else if (k === 'arrowleft') S.rudder = Math.max(-35, S.rudder - 5);
  else if (k === 'arrowright') S.rudder = Math.min(35, S.rudder + 5);
  $('rudder').value = S.rudder;
});
function toggleSilent() {
  S.silentRunning = !S.silentRunning;
  if (S.silentRunning) { S.telegraph = 'slow'; S.engine = 'electric'; log('🤫 SILENT RUNNING — alle Systeme aus, Schleichfahrt.', 'warn'); }
  else log('Silent Running beendet.');
  $('btn-silent').style.borderColor = S.silentRunning ? '#ff4d4d' : '';
}
function toggleMute() { S.audio.muted = !S.audio.muted; $('btn-mute').textContent = S.audio.muted ? '🔇' : '🔊'; if (S.audio.muted) S.audio.stopDiesel(); }

// Buttons verdrahten
document.querySelectorAll('#telegraph button').forEach(b => b.onclick = () => setTelegraph(b.dataset.tel));
document.querySelectorAll('#depth-btns button').forEach(b => b.onclick = () => setDepth(+b.dataset.depth));
document.querySelectorAll('#time-btns .tc').forEach(b => b.onclick = () => { S.timeCompression = +b.dataset.tc; S.tcAuto = false; });
$('rudder').oninput = e => S.rudder = +e.target.value;
$('planes').oninput = e => S.planes = +e.target.value;
$('hydro-dial').oninput = e => { S.hydroDial = +e.target.value; $('hydro-manual').textContent = String(S.hydroDial).padStart(3, '0') + '°'; };
$('btn-cam').onclick = cycleCam;
$('btn-help').onclick = () => $('help').classList.toggle('hidden');
$('btn-help-close').onclick = () => $('help').classList.add('hidden');
$('btn-mute').onclick = toggleMute;
$('btn-silent').onclick = toggleSilent;
$('btn-engine').onclick = () => {
  if (S.engine === 'diesel') { S.engine = 'electric'; log('E-Maschinen übernommen. (Leise, langsam)'); }
  else { if (S.depth > 8.5) { log('Diesel unter Wasser unmöglich — erst schnorcheln!', 'warn'); return; } S.engine = 'diesel'; log('Diesel übernommen. (Schnell, laut)'); }
  S.audio.diesel(S.telegraph !== 'stop', S.submerged);
};
$('btn-peri-up').onclick = () => { if (S.depth <= 14) { S.periscopeUp = !S.periscopeUp; S.camMode = S.periscopeUp ? 'peri' : 'ext'; } else log('Zu tief!', 'warn'); };
$('btn-uzo').onclick = () => { if (!S.submerged) S.camMode = 'uzo'; else log('UZO nur über Wasser!', 'warn'); };
$('btn-lock').onclick = lockTarget;
$('btn-stadi').onclick = stadi;
$('btn-ping').onclick = () => S.sonar.activePing();
$('btn-radar').onclick = () => S.sonar.radarSweep();
$('btn-fire').onclick = () => S.weapons.fire();
$('btn-deck').onclick = () => S.weapons.deckGun();
$('btn-flak').onclick = () => S.weapons.flak();
$('turn-port').onclick = () => { S.targetHeading = (S.heading - 10 + 360) % 360; S.rudder = -20; $('rudder').value = -20; };
$('turn-stbd').onclick = () => { S.targetHeading = (S.heading + 10) % 360; S.rudder = 20; $('rudder').value = 20; };
$('btn-pump').onclick = () => { S.pumpOn = !S.pumpOn; log('Lenzpumpen ' + (S.pumpOn ? 'an.' : 'aus.')); };
$('btn-rest').onclick = () => log(S.crew.rest());
$('btn-tdc-fill').onclick = () => { if (S.locked) stadi(); else lockTarget(); };
$('btn-next-patrol').onclick = () => S.campaign.nextPatrol();
$('btn-refit').onclick = () => {
  const avail = S.campaign.availableBoats();
  const i = avail.indexOf(S.boatName);
  const next = avail[(i + 1) % avail.length];
  if (next === S.boatName) { log('Keine weiteren Bootstypen freigeschaltet (Tonnage: ' + S.campaign.tonnage + ' BRT).'); return; }
  S.boatName = next; S.boatCfg = BOAT_TYPES[next];
  S.damage.hull = S.boatCfg.hull; S.weapons.initTubes(S.boatCfg.tubes); S.torpReserve = S.boatCfg.reserve;
  $('hud-boat').textContent = 'U-552 · ' + next;
  log(`Neues Boot übernommen: ${next}!`, '');
};
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('#tabs button').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  b.classList.add('active'); $('tab-' + b.dataset.tab).classList.add('active');
});

// ---------- LOOP ----------
let last = performance.now(), uiTick = 0;
log('U-552 ausgelaufen — Patrouille im Atlantik. Viel Glück, Herr Kaleu!');
S.sonar.spawnConvoy();

function frame(now) {
  requestAnimationFrame(frame);
  let realDt = Math.min(0.05, (now - last) / 1000); last = now;
  if (S.gameOver || S.sunk) { showEnd(); return; }
  // Simulationszeit in Unter-Schritten (Stabilität bei Zeitraffer)
  let simDt = realDt * S.timeCompression;
  const steps = Math.max(1, Math.ceil(simDt / 0.25));
  const h = simDt / steps;
  for (let i = 0; i < steps; i++) {
    S.time += h;
    S.date = new Date(S.date.getTime() + h * 1000);
    S.weather = weatherFor(S.date, S.time);
    // Ruder folgt Sollkurs
    if (S.targetHeading != null && Math.abs(S.rudder) > 1) {
      let diff = ((S.targetHeading - S.heading + 540) % 360) - 180;
      if (Math.abs(diff) < 2) { S.rudder *= 0.9; }
    }
    S.physics.step(h);
    if (S.depth > 16 && S.periscopeUp) { S.periscopeUp = false; if (S.camMode === 'peri') S.camMode = 'ext'; log('Periskop eingefahren (Tiefe).', 'warn'); }
    S.sonar.update(h, S.physics.noiseLevel());
    S.weapons.update(h);
    S.damageModel.update(h);
    S.crew.update(h);
    S.campaign.update();
    if (S.engine === 'diesel' && S.depth > 8.5) { S.engine = 'electric'; }
  }
  // Scope folgt ggf. aufgeschaltetem Ziel
  if (S.locked && S.locked.alive && $('tdc-auto').checked) {
    const b = S.sonar.bearingTo(S.locked.x, S.locked.z);
    S.scopeBearing = b;
    $('tdc-bearing').value = Math.round(b);
    $('tdc-course').value = Math.round(S.locked.course);
    $('tdc-speed').value = Math.round(S.locked.speed);
    if (S.locked.rangeKnown) $('tdc-range').value = Math.round(S.locked.rangeKnown);
  }
  updateVisuals(realDt);
  updateCamera();
  renderer.render(scene, camera);
  uiTick += realDt;
  if (uiTick > 0.15) { uiTick = 0; ui.renderTop(); ui.drawDepthGauge(); ui.drawCompass(); ui.drawSonar(); ui.drawMap(); ui.renderLists(); ui.renderLog(); }
  // Periskop-Wasser auf Linse
  $('peri-water').style.opacity = S.camMode === 'peri' && S.depth > 10 ? 0.7 : 0;
}
function updateVisuals(realDt) {
  // U-Boot-Mesh
  const bob = S.depth < 8 ? Math.sin(S.time * 1.1) * S.weather.sea * 0.25 : 0;
  sub.position.set(S.pos.x, -S.depth + bob, S.pos.z);
  sub.rotation.y = THREE.MathUtils.degToRad(-S.heading + 180);
  sub.rotation.z = THREE.MathUtils.degToRad(S.rudder * -0.15);
  sub.rotation.x = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(S.verticalSpeed * 4, -8, 8));
  const prop = sub.getObjectByName('prop');
  if (prop) prop.rotation.y += realDt * Math.abs(S.speed) * 3;
  periMast.visible = S.periscopeUp && S.depth <= 16;
  snorkelMast.visible = S.depth > 0.5 && S.depth <= 10;
  sub.visible = S.depth < 60 || S.camMode === 'ext';
  // Ozean/Himmel
  ocean.position.set(S.pos.x, 0, S.pos.z);
  sky.sky.position.set(S.pos.x, 0, S.pos.z);
  sky.stars.position.copy(sky.sky.position);
  ocean.material.uniforms.uTime.value = S.time;
  ocean.material.uniforms.uSea.value = S.weather.sea;
  ocean.material.uniforms.uNight.value = S.weather.night;
  sky.sky.material.uniforms.uNight.value = S.weather.night;
  sky.sun.intensity = 2.2 * (1 - S.weather.night) * (1 - S.weather.fog * 0.5);
  sky.moon.intensity = 0.6 * S.weather.night;
  sky.amb.intensity = 1.2 - S.weather.night * 0.8;
  sky.stars.material.opacity = S.weather.night * 0.9;
  scene.fog.density = 0.0009 + S.weather.fog * 0.002;
  // Schiffe treiben
  for (const c of S.sonar.contacts) {
    if (!c.alive || c.type === 'aircraft') continue;
    c.mesh.position.y = Math.sin(S.time * 1.3 + c.id) * S.weather.sea * 0.3;
    c.mesh.rotation.z = Math.sin(S.time + c.id) * 0.02 * S.weather.sea;
  }
}
let endShown = false;
function showEnd() {
  if (endShown) return; endShown = true;
  const msg = S.sunk ? 'BOOT VERLOREN — Die See behält euch. Tonnage: ' + S.campaign.tonnage + ' BRT.' : S.gameOver;
  document.body.insertAdjacentHTML('beforeend', `<div id="help"><div class="help-card"><h2>${S.sunk ? '☠ ' : ''}PATROUILLE BEENDET</h2><p>${msg}</p><button onclick="location.reload()">Neustart</button></div></div>`);
  S.audio.stopDiesel();
}
resize();
setTelegraph('half');
S.targetDepth = 0;
window.S = S; // Debug-/Test-Hook (Cheats: S.pos, S.campaign.tonnage, …)
requestAnimationFrame(frame);
$('boot').classList.add('hidden');
