// 📁 js/sonar.js 👷 W2 📝 Zweck: Hydrophon, Aktiv-Sonar, Radar, Kontakt-Tracking, Gegner-KI (Geleit, Flugzeuge)
import * as THREE from 'three';
import { CONVOY_ROUTES } from './config.js';
import { makeMerchant, makeDestroyer, makeAircraft } from './world.js';

let CID = 1;
export class Sonar {
  constructor(scene, state) {
    this.scene = scene; this.s = state;
    this.contacts = [];
    this.pingCooldown = 0; this.radarCooldown = 0;
    this.lastPing = -9999; this.lastRadar = -9999;
    this.hydroRange = 2600; this.visualRange = 1300; this.radarRange = 3200;
    this.spawnTimer = 5;
  }
  log(msg, cls = '') { this.s.events.push({ msg, cls }); }
  spawnConvoy() {
    const route = CONVOY_ROUTES[Math.floor(Math.random() * CONVOY_ROUTES.length)];
    const [a, b] = [route.pts[0], route.pts[route.pts.length - 1]];
    // Startposition fern vom Spieler
    const ang = Math.random() * Math.PI * 2;
    const cx = this.s.pos.x + Math.cos(ang) * 2400, cz = this.s.pos.z + Math.sin(ang) * 2400;
    const course = Math.atan2(b[0] - a[0], -(b[1] - a[1])) * 180 / Math.PI;
    const n = 3 + Math.floor(Math.random() * 3);
    const year = this.s.date.getFullYear();
    for (let i = 0; i < n; i++) {
      const mesh = makeMerchant(); this.scene.add(mesh);
      const c = { id: CID++, type: 'merchant', name: `Frachter #${CID}`, mesh, tonnage: 3000 + Math.floor(Math.random() * 5000),
        x: cx + (Math.random() - 0.5) * 220, z: cz + (Math.random() - 0.5) * 260,
        course: course + (Math.random() - 0.5) * 8, speed: 6 + Math.random() * 3,
        alive: true, det: { hydro: false, visual: false, radar: false }, ai: 'sail' };
      this.contacts.push(c);
    }
    const nEsc = year >= 1943 ? 2 : 1;
    for (let i = 0; i < nEsc; i++) {
      const mesh = makeDestroyer(); this.scene.add(mesh);
      this.contacts.push({ id: CID++, type: 'destroyer', name: `Zerstörer #${CID}`, mesh, tonnage: 1500,
        x: cx + (Math.random() - 0.5) * 400, z: cz + (Math.random() - 0.5) * 400,
        course: course, speed: 20, alive: true, det: { hydro: false, visual: false, radar: false },
        ai: 'screen', huntT: 0, dcT: 0 });
    }
    this.log(`Konvoi gesichtet (Funkaufklärung): ${route.name} — ${n} Handelsschiffe, ${nEsc} Eskorte.`, 'warn');
    this.s.campaign.convoysFound++;
  }
  spawnAircraft() {
    const mesh = makeAircraft(); this.scene.add(mesh);
    const ang = Math.random() * Math.PI * 2;
    this.contacts.push({ id: CID++, type: 'aircraft', name: 'Flugzeug', mesh, tonnage: 0,
      x: this.s.pos.x + Math.cos(ang) * 1200, z: this.s.pos.z + Math.sin(ang) * 1200, y: 220,
      course: Math.random() * 360, speed: 90, alive: true, det: { hydro: false, visual: true, radar: false }, ai: 'patrol', bombT: 8 });
    this.log('FLUGZEUG-ALARM! Flieger in Sicht — tauchen!', 'alarm');
  }
  bearingTo(x, z) {
    const dx = x - this.s.pos.x, dz = z - this.s.pos.z;
    let b = Math.atan2(dx, -dz) * 180 / Math.PI;
    return (b + 360) % 360;
  }
  distTo(x, z) { return Math.hypot(x - this.s.pos.x, z - this.s.pos.z); }
  activePing() {
    if (this.pingCooldown > 0) return;
    this.pingCooldown = 20; this.lastPing = this.s.time; this.s.pingFlash = 1;
    this.s.audio?.ping();
    let found = 0;
    for (const c of this.contacts) {
      if (!c.alive) continue;
      const d = this.distTo(c.x, c.z);
      if (d < this.hydroRange * 1.2) { c.det.hydro = true; c.rangeKnown = d; found++; }
      if (c.type === 'destroyer') { c.ai = 'hunt'; c.huntT = 120; } // Ping verrät Position!
    }
    this.log(`AKTIV-PING: ${found} Echos. (Eskorten alarmiert!)`, 'warn');
  }
  radarSweep() {
    const year = this.s.date.getFullYear();
    if (year < 1941) { this.log('Kein Radar verfügbar (erst ab 1941).', 'warn'); return; }
    if (this.s.submerged) { this.log('Radar nur über Wasser einsetzbar.', 'warn'); return; }
    if (this.radarCooldown > 0) return;
    this.radarCooldown = 30; this.lastRadar = this.s.time;
    let found = 0;
    for (const c of this.contacts) {
      if (!c.alive || c.type === 'aircraft') continue;
      const d = this.distTo(c.x, c.z);
      if (d < this.radarRange) { c.det.radar = true; c.rangeKnown = d; found++; }
    }
    this.log(`RADAR: ${found} Kontakte. (Abstrahlung ortbar!)`, found ? '' : 'warn');
    // HF/DF-Gegenortung ab 1943
    if (year >= 1943) for (const c of this.contacts) if (c.type === 'destroyer' && c.alive && Math.random() < 0.5) { c.ai = 'hunt'; c.huntT = 90; }
  }
  update(dt, noise) {
    const s = this.s;
    this.pingCooldown = Math.max(0, this.pingCooldown - dt);
    this.radarCooldown = Math.max(0, this.radarCooldown - dt);
    this.spawnTimer -= dt;
    // Nachschub an Konvois
    const aliveMerch = this.contacts.filter(c => c.alive && c.type === 'merchant').length;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 240;
      if (aliveMerch < 4) this.spawnConvoy();
      const year = s.date.getFullYear();
      if (!s.submerged && year >= 1941 && Math.random() < 0.45 && !this.contacts.some(c => c.alive && c.type === 'aircraft')) this.spawnAircraft();
    }
    const night = s.weather.night > 0.5;
    const visRange = this.visualRange * (night ? 0.35 : 1) * (1 - s.weather.fog * 0.5) * (s.depth < 1 ? 1 : 0.75);
    let nearestThreat = 1e9;
    for (const c of this.contacts) {
      if (!c.alive) continue;
      const d = this.distTo(c.x, c.z);
      const h = THREE.MathUtils.degToRad(c.course);
      const v = c.speed * 0.514444;
      // --- Bewegung / KI ---
      if (c.type === 'merchant') {
        if (c.ai === 'flee') { /* Zickzack bei Alarm */ c.course += Math.sin(s.time * 0.3 + c.id) * 20 * dt; }
        c.x += Math.sin(THREE.MathUtils.degToRad(c.course)) * v * dt;
        c.z += -Math.cos(THREE.MathUtils.degToRad(c.course)) * v * dt;
      } else if (c.type === 'destroyer') {
        this.updateDestroyer(c, d, dt, noise, s);
      } else if (c.type === 'aircraft') {
        c.x += Math.sin(h) * v * dt; c.z += -Math.cos(h) * v * dt;
        // Auf Spieler zuhalten wenn gesichtet
        if (!s.submerged || s.depth < 14) { c.course = this.bearingTo(c.x, c.z) + 180; c.course = (this.bearingTo(s.pos.x, s.pos.z) + 360) % 360; }
        if (d < 250 && s.depth < 20) { c.bombT -= dt; if (c.bombT <= 0) { c.bombT = 25; s.events.push({ msg: 'Bomben fallen! Flieger greift an!', cls: 'alarm' }); s.weaponsHostile?.bombRun(c); } }
        if (d > 2500 || (s.depth > 30)) { /* verliert Kontakt */ if (Math.random() < dt * 0.05) { c.alive = false; this.scene.remove(c.mesh); } }
      }
      // --- Detektion ---
      if (c.type !== 'aircraft' && d < this.hydroRange && noise !== undefined) {
        const loud = c.speed * 3 + (c.type === 'destroyer' ? 12 : 6);
        if (loud > 8) c.det.hydro = true;
      }
      const canSee = (!s.submerged && d < visRange) || (s.periscopeUp && s.depth <= 14 && d < visRange * 1.2);
      if (canSee && c.type !== 'aircraft') c.det.visual = true;
      if (d < 1500 && c.alive && (c.type !== 'merchant' || true)) nearestThreat = Math.min(nearestThreat, d);
      // Mesh positionieren
      c.mesh.position.set(c.x, c.type === 'aircraft' ? 220 : 0, c.z);
      c.mesh.rotation.y = THREE.MathUtils.degToRad(-c.course + 180);
    }
    // Zeitraffer-Auto-Reduktion bei Kontakt
    s.threatNear = nearestThreat;
    if (nearestThreat < 1500 && s.timeCompression > 4) { s.timeCompression = 1; s.tcAuto = true; }
    else if (nearestThreat >= 2000) s.tcAuto = false;
    // Küstennähe: Häfen sind Orientierung, keine Kollisionswelt in v1.0 (Warnung bei Anfahrt)
    for (const c of this.contacts) {
      if (!c.alive || c.type !== 'merchant') continue;
      if (Math.abs(c.x) > 2600 || Math.abs(c.z) > 2600) { c.course = (c.course + 180) % 360; }
    }
  }
  updateDestroyer(c, d, dt, noise, s) {
    const h = THREE.MathUtils.degToRad(c.course);
    const v = c.speed * 0.514444;
    // Wahrnehmung: Lärm, Sicht, Ping, Radar
    const hears = noise > 14 && d < 2200 - (s.silentRunning ? 1200 : 0);
    const sees = (!s.submerged && d < 1400 * (s.weather.night > 0.5 ? 0.4 : 1)) || (s.periscopeUp && s.depth <= 14 && d < 700);
    const pinged = (s.time - this.lastPing) < 60 && d < 3000;
    if ((hears || sees || pinged) && c.ai !== 'attack') { if (c.ai !== 'hunt') s.events.push({ msg: `${c.name} hat uns erfasst — ANLAUF!`, cls: 'alarm' }); c.ai = 'hunt'; c.huntT = 150; }
    if (c.ai === 'screen') {
      // Begleitet Konvoi: kreist um nächsten Frachter
      const m = this.contacts.find(k => k.alive && k.type === 'merchant');
      if (m) { const b = Math.atan2(m.x - c.x, -(m.z - c.z)) * 180 / Math.PI; c.course = b + 40 * Math.sin(s.time * 0.1 + c.id); }
      c.speed = 12;
    } else if (c.ai === 'hunt') {
      c.course = this.bearingTo(c.x, c.z); // Peilung auf Spieler
      c.course = (this.bearingTo(s.pos.x, s.pos.z) + 360) % 360;
      c.speed = 24;
      c.huntT -= dt;
      if (d < 130 && s.submerged) { c.ai = 'attack'; s.events.push({ msg: `${c.name} über uns — WASSERBOMBEN!`, cls: 'alarm' }); }
      else if (c.huntT <= 0 && d > 900) { c.ai = 'screen'; }
    } else if (c.ai === 'attack') {
      c.course = (this.bearingTo(s.pos.x, s.pos.z) + 360) % 360;
      c.speed = 22;
      c.dcT -= dt;
      if (d < 160 && s.submerged && c.dcT <= 0) { c.dcT = 14; s.weaponsHostile?.depthChargeRun(c); }
      if (d > 600) { c.ai = 'hunt'; c.huntT = 120; }
      // Rammt über Wasser!
      if (!s.submerged && d < 40) { s.damage.hull -= 25; s.events.push({ msg: 'GERAMMT! Schwerer Schaden!', cls: 'alarm' }); c.ai = 'screen'; }
    }
    c.x += Math.sin(THREE.MathUtils.degToRad(c.course)) * v * dt;
    c.z += -Math.cos(THREE.MathUtils.degToRad(c.course)) * v * dt;
  }
}
