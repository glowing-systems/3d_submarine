// 📁 js/crew.js 👷 W5 📝 Zweck: Rollen, Moral, Fatigue, Erfahrung, Befehle
const ROLES = ['Kapitän', 'LI', 'Sonar', 'Funker', 'Torpedo', 'Maschine'];
export class Crew {
  constructor(state) {
    this.s = state;
    this.members = ROLES.map((r, i) => ({ role: r, exp: 40 + Math.floor(Math.random() * 30), fatigue: 10 + i * 3 }));
    this.morale = 75; this.fatigueAvg = 15;
  }
  moraleHit(x) { this.morale = Math.max(0, this.morale - x); }
  moraleBoost(x) { this.morale = Math.min(100, this.morale + x); }
  rest() {
    for (const m of this.members) m.fatigue = Math.max(0, m.fatigue - 30);
    this.moraleBoost(4);
    return 'Wache gewechselt — Männer ruhen sich aus.';
  }
  update(dt) {
    const s = this.s;
    // Fatigue wächst im Einsatz, schneller bei Alarm/Silent/Wasserbomben
    let rate = 0.05;
    if (s.silentRunning) rate += 0.05;
    if (s.threatNear < 800) rate += 0.15;
    if (!s.submerged) rate *= 0.7;
    for (const m of this.members) m.fatigue = Math.min(100, m.fatigue + rate * dt);
    this.fatigueAvg = this.members.reduce((a, m) => a + m.fatigue, 0) / this.members.length;
    // Moral: sinkt bei Fatigue, Schaden, Tiefe; steigt bei Versenkungen
    if (this.fatigueAvg > 60) this.morale = Math.max(0, this.morale - dt * 0.05);
    if (s.depth > 150) this.morale = Math.max(0, this.morale - dt * 0.03);
    // Erfahrung: wächst langsam mit Zeit + stark bei Treffern
    for (const m of this.members) m.exp = Math.min(100, m.exp + dt * 0.002);
  }
  awardExp(role, x) { const m = this.members.find(m => m.role === role); if (m) m.exp = Math.min(100, m.exp + x); }
}
