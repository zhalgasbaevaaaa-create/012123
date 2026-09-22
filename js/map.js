/* ОТЫРАРДЫ ҚОРҒА — интерактивті SVG карта
   Жер бедері: батыста — Сырдария, солтүстікте — Қаратау жоталары,
   шығыста — ашық далалық жазық, оңтүстікте — тар алқап (тау бөктері + өзен иіні).
   Барлау кезеңінде (2-кезең) моңғол ордасы мен әскер маркері ЖАСЫРЫЛАДЫ —
   тек Отырардың төрт қақпасы мен жер бедері көрсетіледі. */
'use strict';

const OTYRAR_MAP = (() => {
  let box = null, svg = null, world = null, roadPath = null, armyPath = null, armyEl = null, caravanEl = null, campEl = null;
  let zoom = 1, panX = 0, panY = 0;
  let caravanRaf = null, caravanT = 0;
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $id = id => document.getElementById(id);

  function applyTransform() { world.setAttribute('transform', `translate(${panX} ${panY}) scale(${zoom})`); }
  function setZoom(z, cx = 500, cy = 320) {
    const nz = Math.min(3, Math.max(1, z));
    if (nz === zoom) return;
    const k = nz / zoom;
    panX = cx - k * (cx - panX); panY = cy - k * (cy - panY);
    zoom = nz;
    if (zoom === 1) { panX = 0; panY = 0; }
    applyTransform();
  }

  function buildSVG() {
    return `
<svg viewBox="0 0 1000 640" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Отырар қаласы, төрт қақпа және қоршаған жер бедері">
  <defs>
    <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8a7a45"/><stop offset=".5" stop-color="#9c8a4e"/><stop offset="1" stop-color="#7d6e3e"/>
    </linearGradient>
    <linearGradient id="water" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#3e6b7a"/><stop offset=".5" stop-color="#4d8296"/><stop offset="1" stop-color="#3e6b7a"/>
    </linearGradient>
    <linearGradient id="wallg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#d9c08a"/><stop offset="1" stop-color="#b5945c"/>
    </linearGradient>
    <linearGradient id="mount" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6e5a3a"/><stop offset="1" stop-color="#8a744d"/>
    </linearGradient>
    <radialGradient id="dune" cx=".5" cy=".5" r=".6">
      <stop offset="0" stop-color="#a89253"/><stop offset="1" stop-color="#a89253" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <g id="world">
    <!-- дала -->
    <rect x="-400" y="-260" width="1800" height="1160" fill="url(#grass)"/>
    <ellipse cx="760" cy="180" rx="300" ry="110" fill="url(#dune)"/>
    <ellipse cx="820" cy="420" rx="280" ry="100" fill="url(#dune)"/>
    <ellipse cx="700" cy="560" rx="260" ry="90" fill="url(#dune)"/>
    <g stroke="#6f6338" stroke-width="2" fill="none" opacity=".65">
      <path d="M760 240 l4 -12 M766 240 l0 -14 M772 240 l-4 -12"/>
      <path d="M860 360 l4 -12 M866 360 l0 -14 M872 360 l-4 -12"/>
      <path d="M700 480 l4 -12 M706 480 l0 -14 M712 480 l-4 -12"/>
      <path d="M920 260 l4 -12 M926 260 l0 -14 M932 260 l-4 -12"/>
      <path d="M180 480 l4 -12 M186 480 l0 -14 M192 480 l-4 -12"/>
      <path d="M280 540 l4 -12 M286 540 l0 -14 M292 540 l-4 -12"/>
    </g>

    <!-- ===== ҚАРАТАУ ЖОТАЛАРЫ (солтүстік, қақпаның екі жағы) ===== -->
    <g id="mountains" fill="url(#mount)" stroke="#5a4930" stroke-width="2">
      <path d="M60 118 L170 46 L250 100 L330 38 L420 96 L446 112 L446 150 L60 150 Z" opacity=".95"/>
      <path d="M514 112 L600 42 L690 102 L780 30 L940 108 L940 150 L514 150 Z" opacity=".95"/>
      <g stroke="#5a4930" stroke-width="1.4" opacity=".7">
        <path d="M170 46 l0 -16 M250 100 l0 -14 M330 38 l0 -16"/>
        <path d="M600 42 l0 -16 M690 102 l0 -14 M780 30 l0 -16"/>
      </g>
    </g>
    <text class="marker-label small" x="150" y="136">Қаратау жотасы</text>
    <text class="marker-label small" x="812" y="136">Қаратау жотасы</text>

    <!-- ===== СЫРДАРИА (батыс) ===== -->
    <path d="M112 -20 C 96 140, 120 300, 96 430 C 84 520, 96 600, 88 660" fill="none" stroke="url(#water)" stroke-width="36" stroke-linecap="round"/>
    <path d="M112 -20 C 96 140, 120 300, 96 430 C 84 520, 96 600, 88 660" fill="none" stroke="#7fb3c4" stroke-width="8" stroke-linecap="round" opacity=".55"/>
    <text class="marker-label" x="40" y="330" transform="rotate(85 40 330)">Сырдария</text>
    <!-- батпақты жаға белгілері (батыс қақпа алды) -->
    <g fill="#5f7d6b" opacity=".8">
      <ellipse cx="200" cy="300" rx="34" ry="10"/><ellipse cx="214" cy="322" rx="26" ry="8"/><ellipse cx="196" cy="342" rx="30" ry="8"/>
    </g>
    <text class="marker-label small" x="176" y="368">Батпақты жаға</text>

    <!-- ===== АРЫС ӨЗЕНІ (солтүстіктен құяды) ===== -->
    <path d="M352 -20 C 300 60, 220 130, 132 176" fill="none" stroke="url(#water)" stroke-width="15" stroke-linecap="round" opacity=".9"/>
    <text class="marker-label small" x="236" y="88">Арыс</text>

    <!-- ===== ОҢТҮСТІК: тар алқап (тау бөктері + өзен иіні) ===== -->
    <g fill="url(#mount)" stroke="#5a4930" stroke-width="2" opacity=".9">
      <path d="M120 560 L210 508 L300 552 L386 512 L452 548 L452 586 L120 586 Z"/>
    </g>
    <path d="M540 528 C 620 552, 700 540, 780 570" fill="none" stroke="url(#water)" stroke-width="16" stroke-linecap="round" opacity=".85"/>
    <text class="marker-label small" x="252" y="540">Тау бөктері</text>
    <text class="marker-label small" x="600" y="604">Өзен иіні</text>

    <!-- ===== ШЫҒЫС: ашық далалық жазық + керуен жолы ===== -->
    <path id="road" d="M1030 300 C 920 302, 820 306, 730 310 C 690 312, 668 314, 640 317"
      fill="none" stroke="#e7d3a6" stroke-width="7" stroke-dasharray="14 10" opacity=".85"/>
    <text class="marker-label small" x="742" y="292">Дала жолы (Жетісу-Иртыш бағыты)</text>

    <!-- ===== ОТЫРАР ҚАЛАСЫ ===== -->
    <g id="city">
      <rect x="322" y="222" width="316" height="186" rx="18" fill="#8d7040" opacity=".25"/>
      <path d="M330 230 h300 a8 8 0 0 1 8 8 v164 a8 8 0 0 1 -8 8 h-300 a8 8 0 0 1 -8 -8 v-164 a8 8 0 0 1 8 -8 z"
        fill="url(#wallg)" stroke="#7e5a1a" stroke-width="4"/>
      <g fill="#a5813f" stroke="#6e4c12" stroke-width="2.5">
        <circle cx="332" cy="232" r="11"/><circle cx="628" cy="232" r="11"/>
        <circle cx="332" cy="398" r="11"/><circle cx="628" cy="398" r="11"/>
        <circle cx="404" cy="229" r="10"/><circle cx="556" cy="229" r="10"/>
        <circle cx="404" cy="401" r="10"/><circle cx="556" cy="401" r="10"/>
        <circle cx="326" cy="315" r="11"/><circle cx="634" cy="315" r="11"/>
      </g>
      <!-- төрт қақпа -->
      <g fill="#5d3f16">
        <rect id="gateN" x="463" y="222" width="34" height="17" rx="3"/>
        <rect id="gateS" x="463" y="391" width="34" height="17" rx="3"/>
        <rect id="gateE" x="613" y="300" width="17" height="34" rx="3"/>
        <rect id="gateW" x="330" y="300" width="17" height="34" rx="3"/>
      </g>
      <g fill="#b5945c" stroke="#7e5a1a" stroke-width="2">
        <rect x="360" y="300" width="46" height="34" rx="4"/><circle cx="383" cy="300" r="10" fill="#9d7434"/>
        <rect x="552" y="296" width="42" height="38" rx="4"/><circle cx="573" cy="296" r="9" fill="#9d7434"/>
        <rect x="500" y="340" width="38" height="30" rx="4"/>
      </g>
      <rect x="452" y="262" width="96" height="66" rx="8" fill="#8f6a2e" stroke="#5d3f16" stroke-width="3"/>
      <circle cx="500" cy="262" r="12" fill="#9d7434" stroke="#5d3f16" stroke-width="2"/>
      <text class="marker-label small" x="468" y="300">Ішкі қамал</text>
      <text class="marker-label" x="432" y="216" font-weight="700">ОТЫРАР</text>
    </g>

    <!-- моңғол ордасы (2-кезеңде жасырылады) -->
    <g id="camp" opacity="0">
      <circle cx="942" cy="200" r="24" fill="#c8b088" stroke="#5d3f16" stroke-width="3"/>
      <circle cx="906" cy="232" r="16" fill="#bfa67c" stroke="#5d3f16" stroke-width="2.5"/>
      <circle cx="974" cy="234" r="16" fill="#bfa67c" stroke="#5d3f16" stroke-width="2.5"/>
      <path d="M942 176 v-30" stroke="#3a2708" stroke-width="4"/>
      <polygon class="flag-wave" points="944,146 980,154 944,164" fill="#8f2d2d"/>
      <text class="marker-label small" x="884" y="268">Моңғол ордасы</text>
    </g>

    <!-- қозғалмалы маркерлер -->
    <g id="caravan" opacity="0">
      <circle r="7" fill="#e7d3a6" stroke="#5d3f16" stroke-width="2"/>
      <path d="M-9 4 q9 -12 18 0" fill="none" stroke="#5d3f16" stroke-width="2"/>
    </g>
    <g id="army" opacity="0">
      <g>
        <circle r="17" fill="rgba(140,30,30,.35)" stroke="#8f2d2d" stroke-width="2"/>
        <polygon points="-8,7 0,-11 8,7" fill="#7e1f14" stroke="#3a0d06" stroke-width="1.5"/>
        <line x1="0" y1="-11" x2="0" y2="-20" stroke="#3a2708" stroke-width="2"/>
        <polygon class="flag-wave" points="0,-20 13,-16 0,-13" fill="#8f2d2d"/>
      </g>
    </g>

    <g id="gateLayer"></g>
    <g id="zoneLayer"></g>
    <g id="markLayer"></g>
  </g>
</svg>`;
  }

  /* ---------- нүктелік көмекшілер ---------- */
  function pointOnPath(path, t) {
    try {
      const len = path.getTotalLength();
      return path.getPointAtLength(Math.max(0, Math.min(1, t)) * len);
    } catch (e) { return { x: 500, y: 320 }; }
  }
  function setArmyProgress(p) {
    if (!svg || !armyPath) return;
    if (p >= 1) { armyEl.setAttribute('opacity', '0'); return; }
    const pt = pointOnPath(armyPath, p);
    armyEl.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
  }
  function setArmyVisible(v) { if (armyEl) armyEl.setAttribute('opacity', v ? '1' : '0'); }
  function setCampVisible(v) { if (campEl) campEl.setAttribute('opacity', v ? '1' : '0'); }

  function caravanLoop() {
    if (!roadPath) return;
    caravanT = (caravanT + 0.0012) % 1;
    const pt = pointOnPath(roadPath, caravanT);
    caravanEl.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
    caravanRaf = requestAnimationFrame(caravanLoop);
  }
  function caravanEnabled(on) {
    caravanEl.setAttribute('opacity', on ? '1' : '0');
    if (on && !reduced && !caravanRaf) caravanRaf = requestAnimationFrame(caravanLoop);
    if (!on && caravanRaf) { cancelAnimationFrame(caravanRaf); caravanRaf = null; }
  }

  function makeInteractive(g, label, onClick) {
    g.classList.add('map-obj');
    g.setAttribute('role', 'button');
    g.setAttribute('tabindex', '0');
    g.setAttribute('aria-label', label);
    const fire = e => { e.preventDefault(); e.stopPropagation(); onClick && onClick(); };
    g.addEventListener('click', fire);
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fire(e); });
  }

  /* ---------- 2-кезең: төрт қақпа ---------- */
  const GATE_POS = { north: [480, 178], east: [676, 317], south: [480, 448], west: [288, 317] };
  let gateCb = null;
  function showGates(onPick) {
    gateCb = onPick;
    const layer = $id('gateLayer');
    layer.innerHTML = OTYRAR_DATA.gates.map(g => {
      const [x, y] = GATE_POS[g.id];
      const anchor = g.id === 'east' ? 'start' : g.id === 'west' ? 'end' : 'middle';
      const tx = g.id === 'east' ? x + 36 : g.id === 'west' ? x - 36 : x;
      const ty = g.id === 'north' ? y - 30 : g.id === 'south' ? y + 52 : y - 44;
      return `<g class="gate-hot" data-gate="${g.id}">
        <circle cx="${x}" cy="${y}" r="32" fill="rgba(240,192,90,.16)" stroke="#f0c05a" stroke-width="2.5" class="hotspot"/>
        <text class="marker-label" x="${x}" y="${y + 7}" text-anchor="middle">⌂</text>
        <text class="marker-label small" x="${tx}" y="${ty}" text-anchor="${anchor}">${g.label}</text>
      </g>`;
    }).join('');
    layer.querySelectorAll('.gate-hot').forEach(g => {
      const id = g.dataset.gate;
      const d = OTYRAR_DATA.gates.find(x => x.id === id);
      makeInteractive(g, d.label + ': ' + d.terrain, () => gateCb && gateCb(id));
    });
  }
  function hideGates() { $id('gateLayer').innerHTML = ''; gateCb = null; }

  /* ---------- 3-кезең: әскер бөлу аймақтары (қақпалар) ---------- */
  const ZONE_RECT = {
    north: [452, 212, 56, 34],
    east:  [610, 292, 36, 50],
    west:  [314, 292, 36, 50],
    south: [452, 384, 56, 34]
  };
  let zoneCb = null;
  function showWallZones(onPick) {
    zoneCb = onPick;
    const layer = $id('zoneLayer');
    layer.innerHTML = OTYRAR_DATA.wallZones.map(z => {
      const [x, y, w, h] = ZONE_RECT[z.id];
      const anchor = z.id === 'east' ? 'start' : z.id === 'west' ? 'end' : 'middle';
      const tx = z.id === 'east' ? x + w + 8 : z.id === 'west' ? x - 8 : x + w / 2;
      const ty = (z.id === 'east' || z.id === 'west') ? y + h / 2 + 5 : y - 8;
      return `<g class="wall-zone" data-zone="${z.id}">
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="rgba(240,192,90,.22)" stroke="#f0c05a" stroke-width="2.5" class="hotspot"/>
        <text class="marker-label small" x="${tx}" y="${ty}" text-anchor="${anchor}">${z.label}</text>
      </g>`;
    }).join('');
    layer.querySelectorAll('.wall-zone').forEach(g => {
      const id = g.dataset.zone;
      const z = OTYRAR_DATA.wallZones.find(x => x.id === id);
      makeInteractive(g, z.label + ' — 10 жауынгер орналастыру', () => zoneCb && zoneCb(id));
    });
  }
  function hideWallZones() { $id('zoneLayer').innerHTML = ''; zoneCb = null; }

  /* ---------- 7-кезең: әлсіз нүкте ---------- */
  let markCb = null;
  function showWeakPoints(points, onPick) {
    markCb = onPick;
    const layer = $id('markLayer');
    layer.innerHTML = points.map(p => `
      <g class="wp-hot" data-wp="${p.id}">
        <circle cx="${p.x}" cy="${p.y}" r="26" fill="rgba(240,192,90,.18)" stroke="#f0c05a" stroke-width="2.5" class="hotspot"/>
        <text class="marker-label" x="${p.x}" y="${p.y + 6}" text-anchor="middle">${p.id}</text>
        <text class="marker-label small" x="${p.x}" y="${p.y - 34}" text-anchor="middle">${p.label}</text>
      </g>`).join('');
    layer.querySelectorAll('.wp-hot').forEach(g => {
      const id = g.dataset.wp;
      const p = points.find(x => x.id === id);
      makeInteractive(g, p.label, () => markCb && markCb(id));
    });
  }
  function clearMarks() { $id('markLayer').innerHTML = ''; markCb = null; }

  /* ---------- zoom / pan ---------- */
  function bindControls() {
    document.getElementById('zoomIn').addEventListener('click', () => setZoom(zoom * 1.35));
    document.getElementById('zoomOut').addEventListener('click', () => setZoom(zoom / 1.35));
    document.getElementById('zoomReset').addEventListener('click', () => { zoom = 1; panX = 0; panY = 0; applyTransform(); });

    svg.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      setZoom(e.deltaY < 0 ? zoom * 1.15 : zoom / 1.15,
        (e.clientX - rect.left) / rect.width * 1000,
        (e.clientY - rect.top) / rect.height * 640);
    }, { passive: false });

    let dragging = false, sx = 0, sy = 0, px0 = 0, py0 = 0;
    svg.addEventListener('pointerdown', e => {
      if (zoom === 1) return;
      dragging = true; sx = e.clientX; sy = e.clientY; px0 = panX; py0 = panY;
      svg.classList.add('panning');
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* eski brauzer */ }
    });
    svg.addEventListener('pointermove', e => {
      if (!dragging) return;
      const rect = svg.getBoundingClientRect();
      panX = px0 + (e.clientX - sx) / rect.width * 1000;
      panY = py0 + (e.clientY - sy) / rect.height * 640;
      applyTransform();
    });
    ['pointerup', 'pointercancel'].forEach(ev => svg.addEventListener(ev, () => { dragging = false; svg.classList.remove('panning'); }));
    svg.addEventListener('dblclick', e => {
      e.preventDefault();
      setZoom(zoom === 1 ? 1.8 : 1, (e.offsetX / svg.clientWidth) * 1000, (e.offsetY / svg.clientHeight) * 640);
    });
  }

  function init(container) {
    box = container;
    box.innerHTML = buildSVG();
    svg = box.querySelector('svg');
    world = $id('world');
    roadPath = $id('road');
    armyPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    armyPath.setAttribute('d', 'M1005 300 C 900 305, 800 310, 700 313 C 680 314, 672 316, 660 317');
    armyPath.setAttribute('fill', 'none');
    armyPath.style.visibility = 'hidden';
    svg.appendChild(armyPath);

    armyEl = $id('army');
    caravanEl = $id('caravan');
    campEl = $id('camp');
    setArmyVisible(false);
    caravanEnabled(true);
    bindControls();

    document.addEventListener('visibilitychange', () => {
      const visible = caravanEl.getAttribute('opacity') === '1';
      if (document.hidden) {
        if (caravanRaf) { cancelAnimationFrame(caravanRaf); caravanRaf = null; }
      } else if (visible && !reduced && !caravanRaf) {
        caravanRaf = requestAnimationFrame(caravanLoop);
      }
    });
  }

  return {
    init, setArmyProgress, setArmyVisible, setCampVisible, caravanEnabled,
    showGates, hideGates, showWallZones, hideWallZones, showWeakPoints, clearMarks,
    isReducedMotion: () => !!reduced
  };
})();
