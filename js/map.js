/* ОТЫРАРДЫ ҚОРҒА — интерактивті SVG карта (zoom, pan, анимация, интерактивті нүктелер) */
'use strict';

const OTYRAR_MAP = (() => {
  let box = null, svg = null, world = null, roadPath = null, armyPath = null, armyEl = null, caravanEl = null;
  let zoom = 1, panX = 0, panY = 0;
  let caravanRaf = null, caravanT = 0;
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $id = id => document.getElementById(id);

  function applyTransform() {
    world.setAttribute('transform', `translate(${panX} ${panY}) scale(${zoom})`);
  }
  function setZoom(z, cx = 500, cy = 320) {
    const nz = Math.min(3, Math.max(1, z));
    if (nz === zoom) return;
    const k = nz / zoom;
    panX = cx - k * (cx - panX);
    panY = cy - k * (cy - panY);
    zoom = nz;
    if (zoom === 1) { panX = 0; panY = 0; }
    applyTransform();
  }

  function buildSVG() {
    return `
<svg viewBox="0 0 1000 640" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Отырар қаласы мен маңы: Сырдария, керуен жолы, моңғол ордасы">
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
    <radialGradient id="dune" cx=".5" cy=".5" r=".6">
      <stop offset="0" stop-color="#a89253"/><stop offset="1" stop-color="#a89253" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <g id="world">
    <!-- дала -->
    <rect x="-400" y="-260" width="1800" height="1160" fill="url(#grass)"/>
    <ellipse cx="220" cy="560" rx="260" ry="90" fill="url(#dune)"/>
    <ellipse cx="760" cy="540" rx="300" ry="100" fill="url(#dune)"/>
    <ellipse cx="520" cy="90" rx="280" ry="80" fill="url(#dune)"/>
    <g id="tufts" stroke="#6f6338" stroke-width="2" fill="none" opacity=".7">
      <path d="M120 200 l4 -12 M126 200 l0 -14 M132 200 l-4 -12"/>
      <path d="M300 520 l4 -12 M306 520 l0 -14 M312 520 l-4 -12"/>
      <path d="M700 480 l4 -12 M706 480 l0 -14 M712 480 l-4 -12"/>
      <path d="M880 400 l4 -12 M886 400 l0 -14 M892 400 l-4 -12"/>
      <path d="M180 380 l4 -12 M186 380 l0 -14 M192 380 l-4 -12"/>
      <path d="M620 560 l4 -12 M626 560 l0 -14 M632 560 l-4 -12"/>
    </g>

    <!-- Сырдария (шығыс жақта) -->
    <path d="M870 -20 C 830 140, 850 300, 800 420 C 780 480, 770 560, 790 660" fill="none" stroke="url(#water)" stroke-width="34" stroke-linecap="round"/>
    <path d="M870 -20 C 830 140, 850 300, 800 420 C 780 480, 770 560, 790 660" fill="none" stroke="#7fb3c4" stroke-width="8" stroke-linecap="round" opacity=".55"/>
    <text class="marker-label" x="928" y="330" transform="rotate(83 928 330)">Сырдария</text>

    <!-- Арыс (батыстан құятын кіші өзен) -->
    <path d="M60 150 C 200 200, 330 230, 452 252" fill="none" stroke="url(#water)" stroke-width="14" stroke-linecap="round" opacity=".9"/>
    <text class="marker-label small" x="180" y="185">Арыс</text>

    <!-- Керуен жолы -->
    <path id="road" d="M-20 470 C 200 450, 340 430, 480 400 C 600 372, 700 340, 806 300 C 890 270, 950 255, 1020 240"
      fill="none" stroke="#e7d3a6" stroke-width="7" stroke-dasharray="14 10" opacity=".8"/>
    <text class="marker-label small" x="240" y="440">Керуен жолы (Ұлы Жібек жолы)</text>

    <!-- өткел -->
    <g id="ford"><rect x="786" y="270" width="44" height="58" rx="8" fill="#c9b072" opacity=".55"/></g>

    <!-- Отырар қаласы -->
    <g id="city">
      <rect x="322" y="222" width="316" height="186" rx="18" fill="#8d7040" opacity=".25"/>
      <path id="wallPath" d="M330 230 h300 a8 8 0 0 1 8 8 v164 a8 8 0 0 1 -8 8 h-300 a8 8 0 0 1 -8 -8 v-164 a8 8 0 0 1 8 -8 z"
        fill="url(#wallg)" stroke="#7e5a1a" stroke-width="4"/>
      <g fill="#a5813f" stroke="#6e4c12" stroke-width="2.5">
        <circle cx="332" cy="232" r="11"/><circle cx="628" cy="232" r="11"/>
        <circle cx="332" cy="398" r="11"/><circle cx="628" cy="398" r="11"/>
        <circle cx="480" cy="228" r="13"/><circle cx="480" cy="402" r="13"/>
        <circle cx="326" cy="315" r="11"/><circle cx="634" cy="315" r="11"/>
      </g>
      <g fill="#5d3f16">
        <rect x="463" y="222" width="34" height="17" rx="3"/>
        <rect x="463" y="391" width="34" height="17" rx="3"/>
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

    <!-- моңғол ордасы -->
    <g id="camp">
      <circle cx="912" cy="110" r="26" fill="#c8b088" stroke="#5d3f16" stroke-width="3"/>
      <circle cx="872" cy="146" r="18" fill="#bfa67c" stroke="#5d3f16" stroke-width="2.5"/>
      <circle cx="948" cy="150" r="18" fill="#bfa67c" stroke="#5d3f16" stroke-width="2.5"/>
      <path d="M912 84 v-34" stroke="#3a2708" stroke-width="4"/>
      <polygon class="flag-wave" points="914,50 952,58 914,68" fill="#8f2d2d"/>
      <text class="marker-label small" x="838" y="196">Моңғол ордасы</text>
    </g>

    <!-- қозғалмалы маркерлер -->
    <g id="caravan" opacity="0">
      <circle r="7" fill="#e7d3a6" stroke="#5d3f16" stroke-width="2"/>
      <path d="M-9 4 q9 -12 18 0" fill="none" stroke="#5d3f16" stroke-width="2"/>
    </g>
    <g id="army">
      <g>
        <circle r="17" fill="rgba(140,30,30,.35)" stroke="#8f2d2d" stroke-width="2"/>
        <polygon points="-8,7 0,-11 8,7" fill="#7e1f14" stroke="#3a0d06" stroke-width="1.5"/>
        <line x1="0" y1="-11" x2="0" y2="-20" stroke="#3a2708" stroke-width="2"/>
        <polygon class="flag-wave" points="0,-20 13,-16 0,-13" fill="#8f2d2d"/>
      </g>
    </g>

    <!-- интерактивті қабаттар -->
    <g id="dirLayer"></g>
    <g id="zoneLayer"></g>
    <g id="markLayer"></g>
  </g>
</svg>`;
  }

  /* ---------- маркер қозғалысы ---------- */
  function pointOnPath(path, t) {
    try {
      const len = path.getTotalLength();
      return path.getPointAtLength(Math.max(0, Math.min(1, t)) * len);
    } catch (e) {
      return { x: 500, y: 320 }; /* getTotalLength жоқ орталар үшін (тесттер) */
    }
  }
  function setArmyProgress(p) {
    if (!svg) return;
    if (p >= 1) { armyEl.setAttribute('opacity', '0'); return; }
    armyEl.setAttribute('opacity', '1');
    const pt = pointOnPath(armyPath, p);
    armyEl.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
  }

  /* ---------- керуен анимациясы ---------- */
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

  /* ---------- интерактивті элемент жасау ---------- */
  function makeInteractive(g, label, onClick) {
    g.classList.add('map-obj');
    g.setAttribute('role', 'button');
    g.setAttribute('tabindex', '0');
    g.setAttribute('aria-label', label);
    const fire = e => { e.preventDefault(); e.stopPropagation(); onClick && onClick(); };
    g.addEventListener('click', fire);
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fire(e); });
  }

  /* ---------- Кезең 2: барлау бағыттары ---------- */
  const DIR_POS = { north: [480, 74], east: [812, 299], south: [480, 560], west: [150, 330] };
  let dirCb = null;
  function showDirections(onPick) {
    dirCb = onPick;
    const layer = $id('dirLayer');
    layer.innerHTML = OTYRAR_DATA.directions.map(d => {
      const [x, y] = DIR_POS[d.id];
      return `<g class="dir-hot" data-dir="${d.id}">
        <circle cx="${x}" cy="${y}" r="30" fill="rgba(240,192,90,.16)" stroke="#f0c05a" stroke-width="2.5" class="hotspot"/>
        <circle cx="${x}" cy="${y}" r="7" fill="#f0c05a"/>
        <text class="marker-label small" x="${x}" y="${y - 40}" text-anchor="middle">${d.label}</text>
      </g>`;
    }).join('');
    layer.querySelectorAll('.dir-hot').forEach(g => {
      const id = g.dataset.dir;
      const d = OTYRAR_DATA.directions.find(x => x.id === id);
      makeInteractive(g, d.label, () => dirCb && dirCb(id));
    });
  }
  function hideDirections() { $id('dirLayer').innerHTML = ''; dirCb = null; }

  /* ---------- Кезең 3: қабырға аймақтары ---------- */
  const ZONE_RECT = {
    north: [334, 224, 292, 22],
    east:  [612, 244, 22, 152],
    west:  [326, 244, 22, 152],
    south: [334, 384, 292, 22]
  };
  let zoneCb = null;
  function showWallZones(onPick) {
    zoneCb = onPick;
    const layer = $id('zoneLayer');
    layer.innerHTML = OTYRAR_DATA.wallZones.map(z => {
      const [x, y, w, h] = ZONE_RECT[z.id];
      const lx = x + w / 2, ly = y + h / 2 + 5;
      const anchor = (z.id === 'east') ? 'start' : (z.id === 'west') ? 'end' : 'middle';
      const tx = (z.id === 'east') ? x + w + 6 : (z.id === 'west') ? x - 6 : lx;
      const ty = (z.id === 'east' || z.id === 'west') ? ly : y - 8;
      return `<g class="wall-zone" data-zone="${z.id}">
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="rgba(240,192,90,.22)" stroke="#f0c05a" stroke-width="2.5" class="hotspot"/>
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

  /* ---------- Кезең 7: әлсіз нүкте маркерлері ---------- */
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
    document.getElementById('zoomIn').addEventListener('click', () => { setZoom(zoom * 1.35); });
    document.getElementById('zoomOut').addEventListener('click', () => { setZoom(zoom / 1.35); });
    document.getElementById('zoomReset').addEventListener('click', () => { zoom = 1; panX = 0; panY = 0; applyTransform(); });

    svg.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const cx = (e.clientX - rect.left) / rect.width * 1000;
      const cy = (e.clientY - rect.top) / rect.height * 640;
      setZoom(e.deltaY < 0 ? zoom * 1.15 : zoom / 1.15, cx, cy);
    }, { passive: false });

    let dragging = false, sx = 0, sy = 0, px0 = 0, py0 = 0;
    svg.addEventListener('pointerdown', e => {
      if (zoom === 1) return;
      dragging = true; sx = e.clientX; sy = e.clientY; px0 = panX; py0 = panY;
      svg.classList.add('panning');
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', e => {
      if (!dragging) return;
      const rect = svg.getBoundingClientRect();
      panX = px0 + (e.clientX - sx) / rect.width * 1000;
      panY = py0 + (e.clientY - sy) / rect.height * 640;
      applyTransform();
    });
    ['pointerup', 'pointercancel'].forEach(ev => svg.addEventListener(ev, () => {
      dragging = false; svg.classList.remove('panning');
    }));
    svg.addEventListener('dblclick', e => {
      e.preventDefault();
      setZoom(zoom === 1 ? 1.8 : 1, (e.offsetX / svg.clientWidth) * 1000, (e.offsetY / svg.clientHeight) * 640);
    });
  }

  /* ---------- init ---------- */
  function init(container) {
    box = container;
    box.innerHTML = buildSVG();
    svg = box.querySelector('svg');
    world = $id('world');
    roadPath = $id('road');
    armyPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    armyPath.setAttribute('d', 'M905 118 C 850 190, 818 250, 812 299 C 770 330, 660 322, 580 300');
    armyPath.setAttribute('fill', 'none');
    svg.appendChild(armyPath);
    armyPath.style.visibility = 'hidden';

    armyEl = $id('army');
    caravanEl = $id('caravan');
    setArmyProgress(0.04);
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

  return { init, setArmyProgress, caravanEnabled, showDirections, hideDirections, showWallZones, hideWallZones, showWeakPoints, clearMarks,
    isReducedMotion: () => !!reduced };
})();
