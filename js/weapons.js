// 📁 js/weapons.js 👷 W3 📝 Zweck: TDC-Feuerleitung, Torpedo-Physik, Deckgeschütz, Flak, feindliche Wasserbomben/Bomben
import * as THREE from 'three';
import { TORPEDO } from './config.js';
import { makeTorpedoMesh, makeExplosion } from './world.js';

export class Weapons {
  constructor(scene, state) {
    this.scene = scene; this.s = state;
    this.torps = [];   // eigene Torpedos {mesh,x,z,course,speed,depth,fuze,age,targetId}
    this.charges = []; // feindliche Wasserbomben {mesh,x,z,y,vz,t}
    this.effects = [];
    this.selTube = 0;
  }
  initTubes(n) {
    this.s.tubes = [];
    for (let i = 0; i < n; i++) this.s.tubes.push({ name: i < 4 ? ['I', 'II', 'III', 'IV'][i] : ['V', 'VI'][i - 4], bow: i < 4, loaded: true, reload: 0 });
    this.s.torpReserve = this.s.boatCfg.reserve;
  }
  // TDC: Vorhaltwinkel aus Zielkurs/-tempo, Peilung, Entfernung, eigenem Kurs/Tempo
  solveTDC(bearing, range, targetCourse, targetSpeedKn, torpSpeedKn) {
    const s = this.s;
    const tb = THREE.MathUtils.degToRad(bearing), tc = THREE.MathUtils.degToRad(targetCourse);
    const vt = targetSpeedKn * 0.514444, vw = torpSpeedKn * 0.514444;
    // Relativbewegung: Zielgeschwindigkeitskomponente quer zur Schusslinie
    const angleOnBow = tc - tb - Math.PI; // grob: Kurswinkel
    const cross = vt * Math.sin(tc - tb);
    let lead = Math.asin(THREE.MathUtils.clamp(cross / vw, -1, 1));
    const torpCourse = (bearing + THREE.MathUtils.radToDeg(lead) + 360) % 360;
    const closing = vw - vt * Math.cos(tc - tb);
    const runTime = closing > 1 ? range / closing : range / vw;
    // Trefferchance: Entfernung, Winkel, Erfahrung
    let q = 100 - range / 120 - Math.abs(THREE.MathUtils.radToDeg(lead)) * 1.2;
    q += (s.crew.members[4]?.exp || 50) * 0.1;
    q = Math.max(5, Math.min(98, q));
    return { lead: THREE.MathUtils.radToDeg(lead), torpCourse, runTime, quality: Math.round(q) };
  }
  fire() {
    const s = this.s;
    const tube = s.tubes[this.selTube];
    if (!tube) return;
    if (!tube.loaded) { this.push('Rohr ' + tube.name + ' lädt noch!'); return; }
    if (s.depth > 25) { this.push('Zu tief für Torpedoabschuss (max 25 m)!', 'warn'); return; }
    const b = parseFloat(document.getElementById('tdc-bearing').value) || 0;
    const sol = this.currentSolution();
    const mesh = makeTorpedoMesh(); this.scene.add(mesh);
    const h = THREE.MathUtils.degToRad(s.heading);
    const startDist = 30;
    this.torps.push({ mesh, x: s.pos.x + Math.sin(h) * startDist, z: s.pos.z - Math.cos(h) * startDist,
      course: sol.torpCourse, speed: parseFloat(document.getElementById('tdc-torp-speed').value) || 40,
      depth: parseFloat(document.getElementById('torp-depth').value) || 3,
      fuze: document.getElementById('torp-fuze').value, age: 0, maxRange: TORPEDO.speeds[String(parseFloat(document.getElementById('tdc-torp-speed').value) || 40)]?.range || 7500,
      targetBearing: b });
    tube.loaded = false;
    tube.reload = TORPEDO.reloadTime * (tube.bow ? 1 : 1.4) * (1.3 - (s.crew.members[4]?.exp || 50) / 150);
    if (s.torpReserve > 0) s.torpReserve--;
    s.audio?.torpLaunch();
    this.push(`LOS! Rohr ${tube.name} — Kurs ${sol.torpCourse.toFixed(0)}°, Vorhalt ${sol.lead.toFixed(1)}°`, 'warn');
    s.campaign.shotsFired++;
  }
  currentSolution() {
    const b = parseFloat(document.getElementById('tdc-bearing').value) || 0;
    const r = parseFloat(document.getElementById('tdc-range').value) || 1000;
    const c = parseFloat(document.getElementById('tdc-course').value) || 90;
    const v = parseFloat(document.getElementById('tdc-speed').value) || 8;
    const ts = parseFloat(document.getElementById('tdc-torp-speed').value) || 40;
    return this.solveTDC(b, r, c, v, ts);
  }
  deckGun() {
    const s = this.s;
    if (s.submerged) { this.push('Deckgeschütz nur über Wasser!', 'warn'); return; }
    if (s.deckAmmo <= 0) { this.push('Keine 8,8-cm-Munition mehr!', 'warn'); return; }
    const tgt = this.nearestTarget(1500);
    s.deckAmmo--;
    s.audio?.gunfire();
    if (tgt && Math.random() < 0.35 + (s.crew.members[4]?.exp || 50) / 400) {
      tgt.hp = (tgt.hp || 2) - 1;
      this.explode(tgt.x, 4, tgt.z, 6);
      this.push(`Treffer auf ${tgt.name}!`, '');
      if (tgt.hp <= 0) this.sinkShip(tgt, 'Deckgeschütz');
    } else this.push(`Schuss Deckgeschütz — daneben. (${s.deckAmmo} übrig)`);
  }
  flak() {
    const s = this.s;
    if (s.flakAmmo <= 0) { this.push('Keine Flak-Munition mehr!', 'warn'); return; }
    const air = this.s.sonar.contacts.find(c => c.alive && c.type === 'aircraft' && this.s.sonar.distTo(c.x, c.z) < 1200);
    s.flakAmmo--; s.audio?.gunfire();
    if (s.submerged) { this.push('Flak nur über Wasser!', 'warn'); return; }
    if (air && Math.random() < 0.3) { air.alive = false; this.scene.remove(air.mesh); this.explode(air.x, 220, air.z, 10); this.push('Flugzeug abgeschossen!', ''); }
    else this.push(`Flakfeuer … (${s.flakAmmo} übrig)`);
  }
  nearestTarget(maxD) {
    let best = null, bd = maxD;
    for (const c of this.s.sonar.contacts) {
      if (!c.alive || c.type === 'aircraft') continue;
      const d = this.s.sonar.distTo(c.x, c.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  // --- Feindliche Angriffe (von Sonar-KI aufgerufen) ---
  depthChargeRun(ship) {
    const s = this.s;
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0x222222 }));
      this.scene.add(mesh);
      this.charges.push({ mesh, x: ship.x + (Math.random() - 0.5) * 60, z: ship.z + (Math.random() - 0.5) * 60, y: 0, vy: -6 - Math.random() * 3, t: 0 });
    }
    s.audio?.splash();
    this.push('Wasserbomben im Wasser — AUSWEICHEN!', 'alarm');
  }
  bombRun(plane) {
    const s = this.s;
    const dx = s.pos.x - plane.x, dz = s.pos.z - plane.z;
    const miss = Math.hypot(dx, dz) * (0.3 + Math.random() * 0.7) + (s.speed * 4);
    const bx = plane.x + dx * Math.random(), bz = plane.z + dz * Math.random();
    this.explode(bx, 2, bz, 12);
    const d = Math.hypot(s.pos.x - bx, s.pos.z - bz);
    if (d < 40 + miss * 0.1) { const dmg = Math.max(4, 30 - d); s.damage.hull -= dmg; s.damage.flood = Math.min(100, s.damage.flood + dmg * 0.3); this.push(`Bombentreffer! Schaden ${dmg.toFixed(0)}`, 'alarm'); s.audio?.explosion(); }
    else { this.push('Bomben daneben — Glück gehabt.', 'warn'); s.audio?.explosion(); }
  }
  explode(x, y, z, size) {
    const e = makeExplosion(this.scene, new THREE.Vector3(x, y, z));
    e.size = size; this.effects.push(e);
    this.s.audio?.explosion();
  }
  sinkShip(c, how) {
    c.alive = false;
    this.explode(c.x, 4, c.z, 18);
    this.scene.remove(c.mesh);
    this.push(`${c.name} versenkt (${c.tonnage} BRT) — ${how}!`, '');
    const s = this.s;
    s.campaign.tonnage += c.tonnage; s.campaign.kills++;
    s.crew.moraleBoost(6);
    if (c.type === 'merchant') { const m = this.s.sonar.contacts.filter(k => k.alive && k.type === 'merchant'); if (m.length) for (const o of m) o.ai = 'flee'; }
  }
  push(msg, cls = '') { this.s.events.push({ msg, cls }); }
  update(dt) {
    const s = this.s;
    // Eigene Torpedos
    for (let i = this.torps.length - 1; i >= 0; i--) {
      const t = this.torps[i];
      t.age += dt;
      const v = t.speed * 0.514444;
      t.x += Math.sin(THREE.MathUtils.degToRad(t.course)) * v * dt;
      t.z += -Math.cos(THREE.MathUtils.degToRad(t.course)) * v * dt;
      const run = v * t.age;
      t.mesh.position.set(t.x, -t.depth, t.z);
      t.mesh.rotation.y = THREE.MathUtils.degToRad(-t.course + 90);
      // Blasenspur
      if (Math.random() < dt * 8) s.particles?.wake(t.x, -0.5, t.z);
      // Trefferprüfung
      let hit = false;
      for (const c of s.sonar.contacts) {
        if (!c.alive || c.type === 'aircraft') continue;
        const d = Math.hypot(c.x - t.x, c.z - t.z);
        const halfLen = (c.mesh.userData.length || 70) / 2;
        if (d < halfLen + 2) {
          // Zünderlogik
          let boom = false;
          if (t.fuze === 'impact') boom = true;
          else boom = Math.random() < 0.7; // MZ: auch Nahtreffer, aber 30% Versager/Frühzündung (historisch!)
          if (boom) { c.hp = (c.hp || (c.type === 'destroyer' ? 2 : 1)) - 1; this.explode(t.x, 1, t.z, 16);
            if (c.hp <= 0) this.sinkShip(c, `Torpedo Rohr`);
            else this.push(`Torpedotreffer auf ${c.name} — läuft weiter!`, 'warn');
            s.campaign.hits++;
          } else this.push('Torpedoversager (MZ-Frühzündung)!', 'warn');
          hit = true; break;
        }
      }
      if (hit || run > t.maxRange || t.age > 600) { this.scene.remove(t.mesh); this.torps.splice(i, 1); }
    }
    // Rohre nachladen
    const repairMod = 1.2 - (s.crew.members[4]?.exp || 50) / 200;
    for (const tube of s.tubes) {
      if (!tube.loaded) { tube.reload -= dt; if (tube.reload <= 0 && s.torpReserve > 0) { tube.loaded = true; this.push(`Rohr ${tube.name} nachgeladen.`); } }
    }
    void repairMod;
    // Wasserbomben sinken & detonieren in Solltiefe (Spieler-Tiefe ± Streuung)
    for (let i = this.charges.length - 1; i >= 0; i--) {
      const ch = this.charges[i];
      ch.t += dt; ch.y += ch.vy * dt;
      ch.mesh.position.set(ch.x, ch.y, ch.z);
      const targetY = -s.depth + (Math.random() - 0.5) * 4;
      if (ch.y <= targetY || ch.t > 60) {
        this.explode(ch.x, ch.y, ch.z, 10);
        const d = Math.hypot(s.pos.x - ch.x, s.pos.z - ch.z);
        const dy = Math.abs(ch.y + s.depth);
        const dist = Math.hypot(d, dy);
        if (dist < 60) {
          const dmg = (60 - dist) * 0.55 * (s.silentRunning ? 0.9 : 1);
          s.damage.hull -= dmg;
          s.damage.flood = Math.min(100, s.damage.flood + dmg * 0.25);
          // Leck-Schaden an Systemen
          const sys = ['bugraum', 'zentrale', 'maschine', 'heck'][Math.floor(Math.random() * 4)];
          s.damage.systems[sys] = Math.min(100, (s.damage.systems[sys] || 0) + dmg * 0.5);
          this.push(`WASSERBOMBE — ${dmg.toFixed(0)} Schaden! (${sys})`, 'alarm');
          s.crew.moraleHit(8);
        } else this.push('Wasserbombe detoniert — zu weit.', '');
        this.scene.remove(ch.mesh); this.charges.splice(i, 1);
      }
    }
    // Effekte altern
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i]; e.t += dt;
      const k = Math.min(1, e.t / 2.5);
      e.mesh.scale.setScalar(1 + k * (e.size || 10));
      e.mesh.material.opacity = 1 - k;
      e.light.intensity = 60 * (1 - k);
      if (k >= 1) { this.scene.remove(e.mesh); this.scene.remove(e.light); this.effects.splice(i, 1); }
    }
  }
}
