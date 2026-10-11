// 📁 js/ui.js 👷 W6 📝 Zweck: Instrumente (Tiefenmesser fein/grob, Kompass), Sonar-Wasserfall, Karte, Listen, Log
export class UI {
  constructor(state) { this.s = state; this.waterfall = []; this.$ = id => document.getElementById(id); }
  fmtDate() { const d = this.s.date; return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
  drawDepthGauge() {
    const c = this.$('gauge-depth'), ctx = c.getContext('2d'), s = this.s;
    const W = c.width, H = c.height, cx = W / 2, cy = H / 2, R = 66;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#020a06'; ctx.fillRect(0, 0, W, H);
    // Zonen: grün 0-100, gelb 100-maxDepth, rot darüber
    const max = 260, a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    const zone = (d0, d1, col) => { ctx.beginPath(); ctx.strokeStyle = col; ctx.lineWidth = 7;
      ctx.arc(cx, cy, R, a0 + (d0 / max) * (a1 - a0), a0 + (d1 / max) * (a1 - a0)); ctx.stroke(); };
    zone(0, 100, '#1d5c2e'); zone(100, s.boatCfg.maxDepth, '#8a7a2a'); zone(s.boatCfg.maxDepth, max, '#8a2a2a');
    ctx.fillStyle = '#7fa88c'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
    for (let d = 0; d <= max; d += 20) { const a = a0 + (d / max) * (a1 - a0);
      ctx.fillText(String(d), cx + Math.cos(a) * (R - 14), cy + Math.sin(a) * (R - 14) + 3); }
    // Grobe Nadel (Tiefe) + feine Nadel (Meter-Anteil)
    const needle = (val, len, col, w) => { const a = a0 + (Math.min(val, max) / max) * (a1 - a0);
      ctx.beginPath(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); ctx.stroke(); };
    needle(s.depth, R - 4, '#39ff6a', 3);
    needle((s.depth % 20) * (max / 20), R - 22, '#ffb347', 1.5);
    ctx.fillStyle = '#39ff6a'; ctx.font = 'bold 13px monospace';
    ctx.fillText(s.depth.toFixed(1) + ' m', cx, cy + 30);
    const w = this.$('depth-warn');
    w.className = s.depth <= 100 ? 'ok' : s.depth <= s.boatCfg.maxDepth ? 'warn' : 'danger';
  }
  drawCompass() {
    const c = this.$('gauge-compass'), ctx = c.getContext('2d'), s = this.s;
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#020a06'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#39ff6a'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
    for (let d = -60; d <= 60; d += 15) {
      const h = Math.round((s.heading + d + 360) % 360);
      const x = W / 2 + d * 1.1;
      const label = h === 0 ? 'N' : h === 90 ? 'O' : h === 180 ? 'S' : h === 270 ? 'W' : String(h);
      ctx.fillText(label, x, d % 45 === 0 ? 20 : 32);
      ctx.fillRect(x, 40, 1, 8);
    }
    ctx.fillStyle = '#ffb347'; ctx.fillRect(W / 2 - 1, 8, 2, 44);
    ctx.fillStyle = '#7fa88c'; ctx.font = '10px monospace';
    ctx.fillText(`SOLL ${String(Math.round(s.targetHeading ?? s.heading)).padStart(3, '0')}°`, W / 2, H - 8);
  }
  drawSonar() {
    const c = this.$('sonar-display'), ctx = c.getContext('2d'), s = this.s;
    const W = c.width, H = c.height;
    // Wasserfall: neue Zeile oben
    const row = new Array(W).fill(0);
    for (const ct of s.sonar.contacts) {
      if (!ct.alive || ct.type === 'aircraft') continue;
      const b = s.sonar.bearingTo(ct.x, ct.z);
      const d = s.sonar.distTo(ct.x, ct.z);
      if (d > s.sonar.hydroRange) continue;
      const x = Math.floor((b / 360) * W);
      const strength = Math.max(0, 1 - d / s.sonar.hydroRange) * (ct.type === 'destroyer' ? 1 : 0.7);
      for (let k = -2; k <= 2; k++) row[(x + k + W) % W] = Math.min(1, row[(x + k + W) % W] + strength * (k === 0 ? 1 : 0.4));
    }
    this.waterfall.unshift(row); if (this.waterfall.length > H) this.waterfall.pop();
    ctx.fillStyle = '#020a06'; ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < this.waterfall.length; y++) {
      const r = this.waterfall[y];
      for (let x = 0; x < W; x += 2) if (r[x] > 0.08) {
        ctx.fillStyle = r[x] > 0.6 ? '#39ff6a' : r[x] > 0.3 ? '#1d8c3e' : '#0d4420';
        ctx.fillRect(x, y, 2, 1);
      }
    }
    // manuelle Hydrophon-Linie
    const hx = Math.floor((s.hydroDial / 360) * W);
    ctx.fillStyle = '#ffb347'; ctx.fillRect(hx, 0, 1, H);
    if (s.pingFlash > 0) { ctx.fillStyle = `rgba(57,255,106,${s.pingFlash * 0.5})`; ctx.fillRect(0, 0, W, H); s.pingFlash -= 0.05; }
    ctx.fillStyle = '#7fa88c'; ctx.font = '9px monospace'; ctx.textAlign = 'left';
    ctx.fillText('000', 2, H - 4); ctx.fillText('090', W / 4 - 8, H - 4); ctx.fillText('180', W / 2 - 8, H - 4); ctx.fillText('270', (3 * W) / 4 - 8, H - 4);
    // Kontaktliste
    const list = this.$('contact-list'); list.innerHTML = '';
    const known = s.sonar.contacts.filter(c => c.alive && (c.det.hydro || c.det.visual || c.det.radar));
    if (!known.length) list.innerHTML = '<div class="contact">— keine Kontakte —</div>';
    for (const ct of known.slice(0, 8)) {
      const b = s.sonar.bearingTo(ct.x, ct.z).toFixed(0);
      const d = s.sonar.distTo(ct.x, ct.z);
      const el = document.createElement('div');
      el.className = 'contact' + (ct.type === 'destroyer' ? ' warship' : '');
      el.textContent = `${ct.type === 'merchant' ? '🚢' : ct.type === 'destroyer' ? '⚔' : '✈'} ${ct.name} · ${String(b).padStart(3, '0')}° · ${ct.rangeKnown && (ct.det.radar || Date.now() - 0 < 1e18) ? Math.round(ct.rangeKnown ?? d) + 'm' : Math.round(d) + 'm (geschätzt)'}`;
      el.onclick = () => { s.locked = ct; this.$('tdc-bearing').value = b; this.$('tdc-range').value = Math.round(ct.rangeKnown ?? d); this.$('tdc-course').value = Math.round(ct.course); this.$('tdc-speed').value = Math.round(ct.speed); s.events.push({ msg: `${ct.name} in TDC übernommen.`, cls: '' }); };
      list.appendChild(el);
    }
  }
  drawMap() {
    const c = this.$('map-display'), ctx = c.getContext('2d'), s = this.s;
    const W = c.width, H = c.height, R = 2200; // sichtbarer Radius in Welt-Einheiten
    ctx.fillStyle = '#03140c'; ctx.fillRect(0, 0, W, H);
    const px = (x) => W / 2 + ((x - s.pos.x) / R) * (W / 2);
    const pz = (z) => H / 2 + ((z - s.pos.z) / R) * (H / 2);
    // Konvoirouten
    ctx.strokeStyle = 'rgba(255,179,71,.5)'; ctx.lineWidth = 1;
    for (const r of s.routes) { ctx.beginPath(); r.pts.forEach(([x, z], i) => i ? ctx.lineTo(px(x), pz(z)) : ctx.moveTo(px(x), pz(z))); ctx.stroke(); }
    // Häfen
    ctx.fillStyle = '#39ff6a'; ctx.font = '8px monospace';
    for (const p of s.ports) { ctx.fillRect(px(p.x) - 2, pz(p.z) - 2, 4, 4); ctx.fillText(p.name, px(p.x) + 4, pz(p.z)); }
    // Kontakte
    for (const ct of s.sonar.contacts) {
      if (!ct.alive) continue;
      const seen = ct.det.hydro || ct.det.visual || ct.det.radar;
      ctx.fillStyle = ct.type === 'destroyer' ? '#ff4d4d' : ct.type === 'aircraft' ? '#ffb347' : seen ? '#ff6a6a' : 'rgba(255,106,106,.25)';
      const X = px(ct.x), Y = pz(ct.z);
      if (X < 0 || X > W || Y < 0 || Y > H) continue;
      ctx.fillRect(X - 2, Y - 2, 4, 4);
      if (seen && ct === s.locked) { ctx.strokeStyle = '#fff'; ctx.strokeRect(X - 4, Y - 4, 8, 8); }
    }
    // Eigenes Boot + Sehkreis
    ctx.strokeStyle = 'rgba(57,255,106,.4)'; ctx.beginPath(); ctx.arc(W / 2, H / 2, (1500 / R) * (W / 2), 0, 7); ctx.stroke();
    ctx.fillStyle = '#fff';
    const h = (s.heading * Math.PI) / 180;
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(h);
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(4, 5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill(); ctx.restore();
    // Patrouillenquadrat aus Position
    const gx = String.fromCharCode(65 + Math.abs(Math.floor(s.pos.x / 400)) % 26), gz = Math.abs(Math.floor(s.pos.z / 400)) % 30;
    this.$('map-grid').textContent = `${gx}${gz}-${Math.abs(Math.floor(s.pos.x / 100)) % 10}${Math.abs(Math.floor(s.pos.z / 100)) % 10}`;
  }
  renderLists() {
    const s = this.s;
    // Rohre
    const tw = this.$('tubes'); tw.innerHTML = '';
    s.tubes.forEach((t, i) => {
      const el = document.createElement('div');
      el.className = 'tube' + (i === s.weapons.selTube ? ' sel' : '') + (!t.loaded ? ' reloading' : '');
      el.innerHTML = `<span>Rohr ${t.name} ${t.bow ? 'BUG' : 'HECK'}</span><span>${t.loaded ? 'BEREIT' : 'lädt ' + Math.ceil(t.reload) + 's'}</span>`;
      el.onclick = () => { s.weapons.selTube = i; this.$('fire-tube').textContent = t.name; this.renderLists(); };
      tw.appendChild(el);
    });
    // Schaden
    const dl = this.$('damage-list'); dl.innerHTML = '';
    const sysN = { bugraum: 'Bugraum', zentrale: 'Zentrale', maschine: 'Maschine', heck: 'Heck' };
    for (const k of Object.keys(s.damage.systems)) {
      const v = s.damage.systems[k];
      dl.innerHTML += `<div class="dmg">${sysN[k]} — ${v.toFixed(0)}% Schaden<div class="bar"><i style="width:${100 - v}%;background:${v > 50 ? '#ff4d4d' : '#39ff6a'}"></i></div></div>`;
    }
    this.$('dmg-flood').textContent = s.damage.flood.toFixed(0) + '%';
    // Crew
    const cl = this.$('crew-list'); cl.innerHTML = '';
    for (const m of s.crew.members) {
      cl.innerHTML += `<div class="crew">${m.role} · Exp ${m.exp.toFixed(0)} · Müde ${m.fatigue.toFixed(0)}<div class="bar"><i style="width:${100 - m.fatigue}%"></i></div></div>`;
    }
    // Karriere
    this.$('car-rank').textContent = s.campaign.rank;
    this.$('car-tonnage').textContent = s.campaign.tonnage.toLocaleString('de-DE') + ' BRT';
    this.$('car-medals').textContent = s.campaign.medals.join(', ') || '—';
    this.$('car-boat').textContent = s.boatName;
    this.$('map-kills').textContent = String(s.campaign.kills);
    this.$('torp-reserve').textContent = String(s.torpReserve);
    this.$('deck-ammo').textContent = String(s.deckAmmo);
    this.$('flak-ammo').textContent = String(s.flakAmmo);
    // TDC-Lösung
    try {
      const sol = s.weapons.currentSolution();
      this.$('tdc-lead').textContent = sol.lead.toFixed(1) + '°';
      this.$('tdc-course-out').textContent = String(Math.round(sol.torpCourse)).padStart(3, '0') + '°';
      this.$('tdc-timing').textContent = sol.runTime.toFixed(0) + ' s';
      this.$('tdc-quality').textContent = sol.quality + '%';
    } catch {}
  }
  renderTop() {
    const s = this.s;
    this.$('hud-date').textContent = this.fmtDate();
    const w = s.weather;
    this.$('hud-weather').textContent = `🌊 ${w.sea.toFixed(0)} · ${w.fog > 0.5 ? 'Nebel' : 'klar'} · ${w.night > 0.5 ? '🌙 Nacht' : w.night > 0 ? '🌆 Dämmer' : '☀ Tag'}`;
    this.$('hud-depth').textContent = s.depth.toFixed(1) + ' m';
    this.$('hud-knots').textContent = Math.abs(s.speed).toFixed(1) + ' kn' + (s.speed < -0.05 ? ' (zurück)' : '');
    this.$('hud-heading').textContent = String(Math.round(s.heading)).padStart(3, '0') + '°';
    this.$('hud-rudder').textContent = 'Ruder ' + Math.round(s.rudder) + '°';
    this.$('hud-trim').textContent = 'Trim ' + (s.verticalSpeed >= 0 ? '+' : '') + s.verticalSpeed.toFixed(1);
    this.$('hud-prop').textContent = s.silentRunning ? '🤫 Silent' : s.engine === 'diesel' ? '⚙ Diesel' : '🔋 E-Maschine';
    this.$('hud-o2').textContent = s.o2.toFixed(0) + '%';
    this.$('hud-co2').textContent = s.co2.toFixed(1) + '%';
    this.$('hud-batt').textContent = s.battery.toFixed(0) + '%';
    this.$('hud-fuel').textContent = s.fuel.toFixed(0) + '%';
    const hf = this.$('hull-fill'), pct = Math.max(0, (s.damage.hull / s.boatCfg.hull) * 100);
    hf.style.width = pct + '%';
    hf.style.background = pct > 66 ? 'linear-gradient(90deg,#0a0,#3f6)' : pct > 33 ? 'linear-gradient(90deg,#880,#fb3)' : 'linear-gradient(90deg,#800,#f33)';
    document.querySelectorAll('#time-btns .tc').forEach(b => b.classList.toggle('active', +b.dataset.tc === s.timeCompression));
    this.$('tc-auto').classList.toggle('hidden', !s.tcAuto);
    // Periskopdaten
    this.$('peri-bearing').textContent = String(Math.round(s.scopeBearing)).padStart(3, '0') + '°';
    this.$('peri-range').textContent = s.scopeRange ? Math.round(s.scopeRange) + ' m' : '— m';
    this.$('peri-head').textContent = s.periscopeUp ? '▲ PERISKOP OBEN' : '▼ ' + s.depth.toFixed(0) + ' m';
    this.$('scope-bearing').textContent = String(Math.round(s.scopeBearing)).padStart(3, '0') + '°';
    this.$('scope-range').textContent = s.scopeRange ? Math.round(s.scopeRange) + ' m' : '—';
  }
  renderLog() {
    const el = this.$('log');
    const evts = this.s.events.slice(-8).reverse();
    el.innerHTML = '';
    for (const e of evts) { const d = document.createElement('div'); if (e.cls) d.className = e.cls; d.textContent = e.msg; el.appendChild(d); }
  }
}
