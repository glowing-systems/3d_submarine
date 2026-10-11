// 📁 js/physics.js 👷 W1 📝 Zweck: U-Boot-Dynamik — Auftrieb, Trägheit, Tiefenruder, Widerstand, Seegang
import * as THREE from 'three';
import { TELEGRAPH } from './config.js';

export class SubPhysics {
  constructor(state) {
    this.s = state; // Referenz auf Game-State
  }
  // Zielgeschwindigkeit aus Telegraph + Antrieb + Zustand
  targetSpeed() {
    const s = this.s;
    if (s.silentRunning) return s.submerged ? 2 : 2;
    const frac = TELEGRAPH[s.telegraph] ?? 0;
    const cfg = s.boatCfg;
    const maxKn = s.submerged ? cfg.submKn : cfg.surfKn;
    let kn = frac * maxKn;
    if (s.engine === 'electric' && !s.submerged && frac > 0) kn *= 0.6; // E-Maschine über Wasser schwach
    if (s.damage.flood > 30) kn *= 0.6;
    if (s.crew.fatigueAvg > 70) kn *= 0.9;
    return kn;
  }
  step(dt) {
    const s = this.s;
    // --- Längsdynamik: große Masse => langsame Annäherung (Trägheit) ---
    const target = this.targetSpeed();
    const accel = (target - s.speed) * (1 - Math.exp(-dt / 12)); // Zeitkonstante ~12 s
    s.speed += accel;
    if (Math.abs(s.speed) < 0.05 && target === 0) s.speed = 0;
    // --- Ruder: Wenderate ∝ Fahrt, verlangsamt in Tiefe ---
    const rud = s.rudder / 35;
    const turnRate = rud * (2.2 + Math.abs(s.speed) * 0.55) * s.boatCfg.turn; // °/s
    s.heading = (s.heading + turnRate * dt * Math.sign(s.speed || 1)) % 360;
    if (s.heading < 0) s.heading += 360;
    // --- Vertikaldynamik: Ballast-Ziel + Tiefenruder ---
    // Tiefenruder erzeugt fahrtabhängige Vertikalkraft
    const planesLift = (s.planes / 30) * Math.min(Math.abs(s.speed), 10) * 0.55; // m/s
    // Ballast zieht auf Solltiefe
    const depthErr = s.targetDepth - s.depth;
    const ballastRate = THREE.MathUtils.clamp(depthErr * 0.25, -3.5, s.submerged || s.targetDepth > 0 ? 2.5 : 4);
    let vspeed = ballastRate + (s.depth > 0.5 ? -planesLift * 0.4 : 0);
    // Seegang drückt an Oberfläche
    if (s.depth < 8) vspeed += Math.sin(s.time * 0.9) * s.weather.sea * 0.15;
    // Leckage: Boot wird schwer
    vspeed -= s.damage.flood * 0.004;
    s.depth = Math.max(0, s.depth + vspeed * dt);
    if (s.depth < 0.2 && s.targetDepth === 0) { s.depth = 0; }
    s.submerged = s.depth > 0.5;
    s.verticalSpeed = vspeed;
    // --- Position ---
    const kn2ms = 0.514444;
    const v = s.speed * kn2ms;
    const h = THREE.MathUtils.degToRad(s.heading);
    s.pos.x += Math.sin(h) * v * dt;
    s.pos.z += -Math.cos(h) * v * dt; // Norden = -Z
    // --- Ressourcen ---
    if (s.submerged && s.depth > 8) {
      s.o2 = Math.max(0, s.o2 - dt * 0.02 * (s.silentRunning ? 0.5 : 1));
      s.co2 = Math.min(5, s.co2 + dt * 0.004 * (s.silentRunning ? 0.6 : 1));
    } else if (s.depth < 8.5) { // Schnorchel/Oberfläche regeneriert
      s.o2 = Math.min(100, s.o2 + dt * 1.2);
      s.co2 = Math.max(0, s.co2 - dt * 0.2);
    }
    if (s.engine === 'electric' && (s.submerged || s.telegraph !== 'stop')) s.battery = Math.max(0, s.battery - dt * 0.03 * Math.abs(TELEGRAPH[s.telegraph]) * 4);
    if (!s.submerged && s.engine === 'diesel') s.battery = Math.min(100, s.battery + dt * 0.4);
    if (!s.submerged && s.telegraph !== 'stop') s.fuel = Math.max(0, s.fuel - dt * 0.004);
    // CO2-Wirkung: Fatigue steigt
    if (s.co2 > 2) s.crew.fatigueAvg = Math.min(100, s.crew.fatigueAvg + dt * 0.05);
    // Druckkörper jenseits Einsatztiefe
    if (s.depth > s.boatCfg.maxDepth) {
      const over = s.depth - s.boatCfg.maxDepth;
      s.damage.hull -= dt * over * 0.05;
      if (Math.random() < dt * 0.1) s.damage.flood = Math.min(100, s.damage.flood + 2);
    }
    if (s.depth > s.boatCfg.crushDepth) s.damage.hull -= dt * 20; // Bersttiefe = Tod
    if (s.damage.hull <= 0) s.sunk = true;
  }
  // Lautstärke-Signatur (für Gegner-KI): Diesel laut, E-Maschine leise, Silent fast null
  noiseLevel() {
    const s = this.s;
    if (s.silentRunning) return Math.abs(s.speed) * 0.4 + 1;
    const base = s.engine === 'diesel' && !s.submerged ? 30 : 8;
    return base + Math.abs(s.speed) * (s.engine === 'diesel' ? 3.2 : 1.6);
  }
}
