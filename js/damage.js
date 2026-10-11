// 📁 js/damage.js 👷 W5B 📝 Zweck: Leckagen, Reparaturen, Druckkörper, O2/CO2, Pumpen, Silent Running
export class Damage {
  constructor(state) { this.s = state; }
  update(dt) {
    const s = this.s;
    // Leckage wächst ohne Reparatur, Pumpen halten sie klein
    const sys = s.damage.systems;
    const worstSys = Math.max(sys.bugraum, sys.zentrale, sys.maschine, sys.heck);
    if (s.damage.flood > 0) {
      const pumpRate = s.pumpOn ? 0.5 : 0;
      const crewRate = this.repairPower() * 0.06;
      const inflow = worstSys > 40 ? 0.12 : 0.0;
      s.damage.flood = Math.max(0, Math.min(100, s.damage.flood + (inflow - pumpRate - crewRate) * dt));
      if (s.damage.flood >= 100) s.sunk = true;
    }
    // Systemreparatur durch LI + Crew
    for (const k of Object.keys(sys)) {
      if (sys[k] > 0) sys[k] = Math.max(0, sys[k] - this.repairPower() * 0.25 * dt);
    }
    // CO2-Vergiftung / O2-Mangel: Leistung runter, Moral runter
    if (s.o2 < 20 || s.co2 > 2.5) s.crew.moraleHit(dt * 0.2);
    if (s.o2 <= 0) { s.damage.hull -= dt * 0.5; } // Ersticken = Spielende droht
    // Tiefe + Schaden: jenseits maxDepth knackt es
  }
  repairPower() {
    const s = this.s;
    const li = s.crew.members[1]; // LI
    const base = 1 + (li.exp / 100);
    const morale = 0.6 + (s.crew.morale / 100) * 0.6;
    const fatigue = 1 - (s.crew.fatigueAvg / 200);
    const silent = s.silentRunning ? 0.5 : 1;
    return base * morale * fatigue * silent;
  }
  statusColor() {
    const h = this.s.damage.hull, max = this.s.boatCfg.hull;
    const f = h / max;
    return f > 0.66 ? '#39ff6a' : f > 0.33 ? '#ffb347' : '#ff4d4d';
  }
}
