// 📁 js/campaign.js 👷 W7 📝 Zweck: Karriere 1939–45, Beförderungen, Orden, Bootstypen, historische Events
import { RANKS, MEDALS, HISTORICAL_EVENTS, BOAT_TYPES } from './config.js';
export class Campaign {
  constructor(state) {
    this.s = state;
    this.tonnage = 0; this.kills = 0; this.shotsFired = 0; this.hits = 0;
    this.patrols = 1; this.convoysFound = 0;
    this.seenEvents = new Set();
    this.rank = RANKS[0].rank; this.medals = [];
  }
  update() {
    const s = this.s;
    const dstr = s.date.toISOString().slice(0, 10);
    for (const e of HISTORICAL_EVENTS) {
      if (dstr >= e.date && !this.seenEvents.has(e.date)) {
        this.seenEvents.add(e.date);
        s.events.push({ msg: `LAGEBERICHT ${e.date}: ${e.text}`, cls: 'warn' });
      }
    }
    for (const r of RANKS) if (this.tonnage >= r.tonnage) this.rank = r.rank;
    for (const m of MEDALS) if (this.tonnage >= m.tonnage && !this.medals.includes(m.medal)) {
      this.medals.push(m.medal);
      s.events.push({ msg: `AUSZEICHNUNG: ${m.medal} verliehen!`, cls: '' });
    }
    // Kriegsende
    if (s.date.getFullYear() >= 1945 && s.date.getMonth() >= 4) s.gameOver = 'Kriegsende Mai 1945. Du hast überlebt — deine Tonnage: ' + this.tonnage + ' BRT.';
  }
  availableBoats() { return Object.keys(BOAT_TYPES).filter(b => this.tonnage >= BOAT_TYPES[b].unlockTonnage); }
  nextPatrol() {
    const s = this.s;
    this.patrols++;
    // Datum +2 Wochen, Ressourcen voll, neue Konvois
    s.date = new Date(s.date.getTime() + 14 * 864e5);
    s.o2 = 100; s.co2 = 0; s.battery = 100; s.fuel = 100;
    s.damage.hull = s.boatCfg.hull; s.damage.flood = 0;
    s.damage.systems = { bugraum: 0, zentrale: 0, maschine: 0, heck: 0 };
    s.deckAmmo = 100; s.flakAmmo = 200; s.torpReserve = s.boatCfg.reserve;
    s.weapons.initTubes(s.boatCfg.tubes); s.sunk = false;
    s.sonar.contacts.forEach(c => this.scene0?.remove(c.mesh)); s.sonar.contacts.length = 0;
    s.sonar.spawnTimer = 2;
    s.events.push({ msg: `Patrouille Nr. ${this.patrols} — Auslaufen! Datum: ${s.date.toLocaleDateString('de-DE')}`, cls: '' });
  }
}
