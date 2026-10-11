// 📁 js/world.js 👷 W4 📝 Zweck: 3D-Welt — Ozean-Shader, Himmel, U-Boot/Schiff-Modelle, Wetter, Häfen
import * as THREE from 'three';
import { PORTS, CONVOY_ROUTES } from './config.js';

export function makeOcean(scene) {
  const geo = new THREE.PlaneGeometry(4000, 4000, 128, 128);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uNight: { value: 0 }, uSea: { value: 2 } },
    vertexShader: `
      uniform float uTime; uniform float uSea;
      varying vec3 vPos; varying float vH;
      void main(){
        vec3 p = position;
        float w = sin(p.x*0.02+uTime*1.2)*0.5 + sin(p.z*0.03-uTime*0.9)*0.4 + sin((p.x+p.z)*0.008+uTime*0.5)*0.8;
        p.y += w * (0.3 + uSea*0.35);
        vH = w; vPos = p;
        gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0);
      }`,
    fragmentShader: `
      uniform float uNight; varying float vH; varying vec3 vPos;
      void main(){
        vec3 deep = mix(vec3(0.01,0.12,0.16), vec3(0.0,0.02,0.05), uNight);
        vec3 crest = mix(vec3(0.1,0.35,0.38), vec3(0.02,0.08,0.12), uNight);
        vec3 c = mix(deep, crest, smoothstep(-1.2,1.4,vH));
        float foam = smoothstep(1.0,1.5,vH)*0.35*(1.0-uNight);
        gl_FragColor = vec4(c+foam, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}

export function makeSky(scene) {
  const geo = new THREE.SphereGeometry(3500, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uNight: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform float uNight; varying vec3 vP;
      void main(){
        float h = normalize(vP).y;
        vec3 day = mix(vec3(0.55,0.6,0.62), vec3(0.15,0.35,0.55), smoothstep(0.0,0.7,h));
        vec3 night = mix(vec3(0.0,0.01,0.03), vec3(0.02,0.04,0.09), smoothstep(0.0,0.7,h));
        gl_FragColor = vec4(mix(day,night,uNight),1.0);
      }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  scene.add(sky);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(400, 600, 200); scene.add(sun);
  const amb = new THREE.AmbientLight(0x334455, 1.2); scene.add(amb);
  const moon = new THREE.DirectionalLight(0x8899ff, 0.0); moon.position.set(-400, 500, -200); scene.add(moon);
  // Sterne
  const sg = new THREE.BufferGeometry(); const sp = [];
  for (let i = 0; i < 700; i++) { const t = Math.random() * Math.PI * 2, p = Math.random() * Math.PI * 0.45 + 0.05; sp.push(Math.cos(t) * Math.cos(p) * 3300, Math.sin(p) * 3300, Math.sin(t) * Math.cos(p) * 3300); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.5, sizeAttenuation: false, transparent: true, opacity: 0 }));
  scene.add(stars);
  return { sky, sun, amb, moon, stars };
}

function hullMaterial() { return new THREE.MeshStandardMaterial({ color: 0x2b3136, roughness: 0.6, metalness: 0.5 }); }

export function makeSub() {
  const g = new THREE.Group();
  const hullMat = hullMaterial();
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 46, 18), hullMat);
  hull.rotation.z = Math.PI / 2; g.add(hull);
  for (const e of [-23, 23]) { const cap = new THREE.Mesh(new THREE.SphereGeometry(3, 14, 10), hullMat); cap.position.x = e; g.add(cap); }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(38, 0.7, 3.4), new THREE.MeshStandardMaterial({ color: 0x3d4438, roughness: 0.9 }));
  deck.position.y = 2.9; g.add(deck);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(8, 3.4, 3), hullMat); tower.position.set(-2, 4.6, 0); g.add(tower);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 2.6), new THREE.MeshStandardMaterial({ color: 0x222222 })); bridge.position.set(-2, 6.4, 0); g.add(bridge);
  const peri = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 7, 8), new THREE.MeshStandardMaterial({ color: 0x555c60, metalness: 0.8, roughness: 0.3 }));
  peri.position.set(-2, 8, 0); peri.name = 'periscopeMast'; g.add(peri);
  const snorkel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 6, 8), hullMat); snorkel.position.set(1, 7.5, 0); snorkel.name = 'snorkelMast'; g.add(snorkel);
  const gun = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6, 8), new THREE.MeshStandardMaterial({ color: 0x1c1f22 })); barrel.rotation.z = Math.PI / 2; barrel.position.x = -3; gun.add(barrel);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.8, 10), hullMat); gun.add(base);
  gun.position.set(-12, 3.6, 0); gun.name = 'deckGun'; g.add(gun);
  const flak = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.6, 8), hullMat); flak.position.set(3.5, 4.2, 0); flak.name = 'flak'; g.add(flak);
  const planesF = new THREE.Mesh(new THREE.BoxGeometry(3, 0.25, 7), hullMat); planesF.position.set(-21, 0, 0); g.add(planesF);
  const planesA = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 6), hullMat); planesA.position.set(21, 0, 0); g.add(planesA);
  const rudder = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 0.3), hullMat); rudder.position.set(23.5, 0, 0); rudder.name = 'rudder'; g.add(rudder);
  const prop1 = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.3, 3), new THREE.MeshStandardMaterial({ color: 0x8a7a3a, metalness: 0.9, roughness: 0.3 }));
  prop1.rotation.x = Math.PI / 2; prop1.position.set(24.2, 0, 1.5); prop1.name = 'prop'; g.add(prop1);
  const prop2 = prop1.clone(); prop2.position.z = -1.5; g.add(prop2);
  // Bug-Rohre markieren
  for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.CircleGeometry(0.5, 10), new THREE.MeshBasicMaterial({ color: 0x000000 })); t.position.set(-26.05, [-1.1, -0.35, 0.35, 1.1][i], 0); t.rotation.y = -Math.PI / 2; g.add(t); }
  g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  return g;
}

export function makeMerchant() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(70, 7, 10), new THREE.MeshStandardMaterial({ color: 0x4a3b2c, roughness: 0.85 }));
  hull.position.y = 1; g.add(hull);
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 7, 3, 1), hull.material); bow.rotation.y = Math.PI; bow.position.set(-40, 1, 0); bow.scale.z = 1; g.add(bow);
  const castle = new THREE.Mesh(new THREE.BoxGeometry(10, 8, 8), new THREE.MeshStandardMaterial({ color: 0x6b655a })); castle.position.set(12, 8, 0); g.add(castle);
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 6, 10), new THREE.MeshStandardMaterial({ color: 0x883333 })); funnel.position.set(16, 13, 0); g.add(funnel);
  for (const mx of [-15, 0]) { const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 16, 6), new THREE.MeshStandardMaterial({ color: 0x33291f })); mast.position.set(mx, 10, 0); g.add(mast); }
  g.userData.length = 80;
  return g;
}
export function makeDestroyer() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x3d4a52, roughness: 0.7, metalness: 0.3 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(85, 5, 8), mat); hull.position.y = 1.2; g.add(hull);
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 5, 3, 1), mat); bow.rotation.y = Math.PI; bow.position.set(-46, 1.2, 0); g.add(bow);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(8, 7, 6), mat); bridge.position.set(-10, 6, 0); g.add(bridge);
  for (const fx of [8, 14]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 5, 8), mat); f.position.set(fx, 7, 0); g.add(f); }
  for (const gx of [-30, 30]) { const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 5, 6), new THREE.MeshStandardMaterial({ color: 0x222 })); gun.rotation.z = Math.PI / 2; gun.position.set(gx, 5, 0); g.add(gun); }
  g.userData.length = 95;
  return g;
}
export function makeAircraft() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x2e3b2e });
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.4, 14, 8), mat); fus.rotation.z = Math.PI / 2; g.add(fus);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 22), mat); g.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3, 0.3), mat); tail.position.x = 7; g.add(tail);
  return g;
}
export function makeTorpedoMesh() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 7, 8), new THREE.MeshStandardMaterial({ color: 0x707880, metalness: 0.7, roughness: 0.35 }));
  b.rotation.z = Math.PI / 2; g.add(b);
  return g;
}
export function makeExplosion(scene, pos) {
  const geo = new THREE.SphereGeometry(1, 12, 10);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 1 });
  const m = new THREE.Mesh(geo, mat); m.position.copy(pos); scene.add(m);
  const light = new THREE.PointLight(0xff7733, 60, 300); light.position.copy(pos); scene.add(light);
  return { mesh: m, light, t: 0 };
}
export function buildStatics(scene) {
  // Häfen als Leuchtmarken + Küstenlinie (stilisiert)
  const grp = new THREE.Group();
  for (const p of PORTS) {
    // Hafen-Silhouette knapp über Wasser: Mole + zwei Kai-Blöcke + Leuchtfeuer
    const mole = new THREE.Mesh(new THREE.BoxGeometry(70, 4, 14), new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.9 }));
    mole.position.set(p.x, 1, p.z); grp.add(mole);
    for (const off of [-22, 22]) {
      const kai = new THREE.Mesh(new THREE.BoxGeometry(16, 10, 12), new THREE.MeshStandardMaterial({ color: 0x46403a, roughness: 0.9 }));
      kai.position.set(p.x + off, 4, p.z); grp.add(kai);
    }
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(2.5, 8, 8), new THREE.MeshBasicMaterial({ color: 0x39ff6a }));
    beacon.position.set(p.x, 14, p.z); grp.add(beacon);
  }
  // Konvoirouten als Linien
  for (const r of CONVOY_ROUTES) {
    const pts = r.pts.map(([x, z]) => new THREE.Vector3(x, 2, z));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x8a7a2a }));
    grp.add(line);
  }
  scene.add(grp);
  return grp;
}
// Wetter aus Datum + Zufall: { sea (0-5), fog (0-1), clouds, night (0-1) }
export function weatherFor(date, seedT) {
  const t = seedT * 0.0001;
  const sea = Math.max(0, Math.min(5, 2 + Math.sin(t * 3.1) * 1.6 + Math.sin(t * 7.7) * 0.7));
  const hour = date.getHours() + date.getMinutes() / 60;
  const night = (hour < 6 || hour > 20) ? 1 : (hour < 8 || hour > 18 ? 0.5 : 0);
  return { sea, fog: 0.2 + Math.max(0, Math.sin(t * 5.3)) * 0.5, night, hour };
}
