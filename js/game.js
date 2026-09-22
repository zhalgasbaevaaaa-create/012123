/* ОТЫРАРДЫ ҚОРҒА — ойын логикасы: game-state, 10 кезең, таймерлер, save/resume */
'use strict';

(() => {
  const D = OTYRAR_DATA;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const STAGE_TOTAL = 10;
  const STAGE_FNS = [null, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10]; // function-декларациялар hoist
  const SAVE_KEY = 'otyrar_save_v1';
  const TITLES = ['Қауіп хабары', 'Барлау', 'Қорғанысты ұйымдастыру', 'Азық қоры', 'Тарихи санақ',
    'Қоршау', 'Отырар қақпасы', 'Құпия хабар', 'Соңғы қорғаныс', 'Финал'];

  let S = null;                 // game state
  let quizQueue = [];           // сұрақтар реті (қайталанбау үшін)
  let stageTimers = [];         // барлық таймерлер (тазарту үшін)
  let busy = false;             // қос клик қорғанысы
  let over = false;
  let mapReady = false;
  let mapZoneClickBound = false;
  let s3ctx = null;             // кезең 3 күйі (карта нүктелері)

  /* ================= Құралдар ================= */
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; };
  const clamp100 = v => Math.max(0, Math.min(100, Math.round(v)));

  function later(fn, ms) { const t = setTimeout(fn, ms); stageTimers.push({ t, iv: false }); return t; }
  function every(fn, ms) { const t = setInterval(fn, ms); stageTimers.push({ t, iv: true }); return t; }
  function clearStageTimers() { stageTimers.forEach(x => x.iv ? clearInterval(x.t) : clearTimeout(x.t)); stageTimers = []; }

  function story(html) { $('stage-story').innerHTML = html; }
  function taskPanel(html) { $('task-panel').innerHTML = html; }
  function fb(type, html) { $('feedback').innerHTML = `<div class="fb ${type}">${html}</div>`; }
  function noFb() { $('feedback').innerHTML = ''; }

  function lock() { busy = true; later(() => { busy = false; }, 350); }

  /* ================= Ресурстар / HUD ================= */
  function change(key, delta) {
    if (over) return false;
    if (key === 'lives') S.lives = Math.max(0, S.lives + delta);
    else if (key === 'score') S.score = Math.max(0, S.score + delta); /* ұпай — шексіз */
    else S[key] = clamp100(S[key] + delta);
    updateHUD(key, delta);
    if (delta !== 0) {
      if (delta > 0) OtyrarAudio.click(); else OtyrarAudio.wrong();
      if (key === 'lives' && delta < 0) OtyrarAudio.heartbeat();
    }
    if (S.lives <= 0) { gameOver(); return false; }
    return true;
  }
  function applyEffects(list) { for (const [k, d] of list) { if (!change(k, d)) return false; } return true; }

  function updateHUD(changedKey, delta) {
    if (!S) return;
    const vals = { lives: `❤️ ${S.lives}`, defense: `🛡️ ${S.defense}`, food: `🍞 ${S.food}`, army: `⚔️ ${S.army}`, treasury: `💰 ${S.treasury}`, score: `⭐ ${S.score}` };
    for (const k of Object.keys(vals)) {
      const el = $('hud-' + k);
      if (!el) continue;
      el.textContent = vals[k];
      if (k === changedKey) {
        el.classList.remove('pop', 'hurt'); void el.offsetWidth;
        el.classList.add(delta < 0 ? 'hurt' : 'pop');
      }
    }
    for (const k of ['defense', 'food', 'army', 'treasury']) {
      const bar = $('bar-' + k);
      if (bar) { bar.style.width = S[k] + '%'; bar.classList.toggle('low', S[k] < 35); }
    }
    if (changedKey && delta) {
      const pill = $('hud-' + changedKey);
      const rect = pill.getBoundingClientRect();
      const f = document.createElement('span');
      f.className = 'float-pts ' + (delta > 0 ? 'plus' : 'minus');
      f.textContent = (delta > 0 ? '+' : '') + delta;
      f.style.left = (rect.left + rect.width / 2) + 'px';
      f.style.top = (rect.top - 8) + 'px';
      document.body.appendChild(f);
      setTimeout(() => f.remove(), 1200);
    }
  }

  /* ================= Тапсырма таймері ================= */
  function startTaskTimer(sec, onTimeout, barId, secId) {
    barId = barId || 'tbar'; secId = secId || 'tsec';
    const hudTime = $('hud-time'), bar = $(barId), secEl = $(secId);
    let left = sec;
    hudTime.textContent = `⏳ ${left} сек`;
    if (secEl) secEl.textContent = `${left} сек`;
    if (bar) { bar.style.transition = 'none'; bar.style.width = '100%'; void bar.offsetWidth; later(() => { bar.style.transition = `width ${sec}s linear`; bar.style.width = '0%'; }, 30); }
    const iv = every(() => {
      left--;
      if (secEl) secEl.textContent = `${left} сек`;
      hudTime.textContent = `⏳ ${Math.max(0, left)} сек`;
      if (left <= 0) { stop(); onTimeout(); }
    }, 1000);
    function stop() { const i = stageTimers.findIndex(x => x.t === iv); if (i > -1) stageTimers.splice(i, 1); clearInterval(iv); }
    return stop;
  }

  /* ================= Экрандар / навигация ================= */
  function showScreen(name) {
    $('screen-intro').hidden = name !== 'intro';
    $('screen-game').hidden = name !== 'game';
    $('screen-gameover').hidden = name !== 'gameover';
    $('screen-final').hidden = name !== 'final';
    window.scrollTo(0, 0);
  }

  function nextBtn(label, fn) {
    const wrap = document.createElement('div');
    wrap.className = 'row fade-in';
    const b = document.createElement('button');
    b.className = 'btn btn-gold btn-lg';
    b.textContent = label || 'Әрі қарай ▶';
    b.addEventListener('click', () => { if (busy) return; lock(); OtyrarAudio.click(); fn(); });
    wrap.appendChild(b);
    $('task-panel').appendChild(wrap);
  }

  /* ================= Сұрақтар кезегі ================= */
  function buildQuizQueue() { quizQueue = shuffle(D.questions.map((_, i) => i)); S.qi = 0; }
  function nextQuestion() {
    const q = D.questions[quizQueue[S.qi % quizQueue.length]];
    S.qi++;
    return q;
  }

  /* ================= СSau / Resume ================= */
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ S, quizQueue })); } catch (e) { /* ignore */ } }
  function loadSave() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (d && d.S && d.S.stage >= 1 && d.S.stage <= STAGE_TOTAL && Array.isArray(d.quizQueue)) return d;
    } catch (e) { /* ignore */ }
    return null;
  }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }

  /* ================= Кезеңдер ================= */
  function runStage(n) {
    clearStageTimers(); noFb();
    S.stage = n; save();
    busy = false;
    $('hud-stage').textContent = `Кезең ${n}/${STAGE_TOTAL}`;
    $('stage-title').textContent = `Кезең ${n} — ${TITLES[n - 1]}`;
    $('map-panel').hidden = ![2, 3, 7].includes(n);
    if (!mapReady) { OTYRAR_MAP.init($('map-box')); mapReady = true; }
    OTYRAR_MAP.setArmyProgress(Math.min(0.97, (n - 1) / STAGE_TOTAL + 0.04));
    STAGE_FNS[n]();
  }

  /* ---- Кезең 1: ҚАУІП ---- */
  function s1() {
    story('Хабаршы жүгіріп келді: «Моңғол әскері Сырдариядан өтіп, Отырарға жақындады! Қолбасшы, қаланың қорғанысын ұйымдастырыңыз!»');
    taskPanel('');
    stepA();
    function stepA() {
      renderTask('Қақпаны қалай күшейтесіз?', 'Дұрыс шешім — қорғанысты нығайтады.',
        ['Тасблок пен кірпішпен қақпаны бекіту, алдына жер үйіндісін төгу',
         'Ағаш қалқандармен ғана жабу',
         'Ештеңе істемеу — қабырға бұрыннан берік деп сену'],
        i => {
          if (i === 0) { applyEffects([['score', 10], ['defense', 10], ['treasury', -10]]); fb('ok', '✅ Қақпа нығайтылды! (+10 ⭐, 🛡️ +10, 💰 −10)'); }
          else if (i === 1) { applyEffects([['score', 3], ['defense', 4], ['treasury', -3]]); fb('info', '⚠️ Ағаш қалқан — уақытша ғана көмек. (+3 ⭐, 🛡️ +4)'); }
          else { if (!change('lives', -1)) return; applyEffects([['defense', -5]]); fb('bad', '❌ Қате шешім! Қақпа әлсіз қалды. (−1 ❤️, 🛡️ −5)'); }
          later(stepB, 1400);
        });
    }
    function stepB() {
      noFb(); taskPanel('');
      renderTask('Күзетшілерді қалай орналастырасыз?', 'Қоршау кезінде бақылау — өмір мен өлім мәселесі.',
        ['Тәулік бойы ауысыммен күзет, мұнараларда бақылаушылар',
         'Тек түн күзеті жеткілікті',
         'Барлық әскерді тынығуға қалдыру'],
        i => {
          if (i === 0) { applyEffects([['score', 10], ['defense', 5]]); fb('ok', '✅ Күзет үздіксіз жүргізілді! (+10 ⭐, 🛡️ +5)'); }
          else { if (!change('lives', -1)) return; fb('bad', i === 1 ? '❌ Түнде ғана күзет — таңертең жау қабырға басында… (−1 ❤️)' : '❌ Әскер демалыста қалды — қала қорғансыз! (−1 ❤️)'); }
          later(stepC, 1400);
        });
    }
    function stepC() {
      noFb(); taskPanel('');
      renderTask('Азық қорын есептеңіз.', 'Логикалық тапсырма: қала қанша астық жинайды?',
        ['40 000 келі', '80 000 келі', '160 000 келі', '20 000 келі'],
        i => {
          if (i === 1) { applyEffects([['score', 10], ['food', 5]]); fb('ok', '✅ Дұрыс: 8 000 × 0,5 кг × 20 күн = 80 000 келі! (+10 ⭐, 🍞 +5)'); }
          else { if (!change('lives', -1)) return; fb('bad', '❌ Қате есеп: 8 000 адам × 0,5 келі × 20 күн = 80 000 келі керек. (−1 ❤️)'); }
          later(() => runStage(2), 2200);
        });
    }
  }

  /* ---- Кезең 2: БАРЛАУ (карта) ---- */
  function s2() {
    story('Барлаушылар аттанды. Картамен жұмыс: моңғол әскері қай бағыттан келеді? Карта бетіндегі жанданған нүктелердің бірін таңдаңыз.');
    taskPanel('<div class="task-card fade-in"><h3>Картамен жұмыс</h3><p class="task-hint">Жау әскерінің жолын анықтаңыз. Картаны үлкейтуге болады (＋ / −).</p></div>');
    OTYRAR_MAP.showDirections(dirId => {
      if (busy) return; lock();
      const d = D.directions.find(x => x.id === dirId);
      OTYRAR_MAP.hideDirections();
      if (d.correct) {
        applyEffects([['score', 10]]);
        OTYRAR_MAP.setArmyProgress(0.55);
        fb('ok', `✅ Дұрыс! ${esc(d.tip)} (+10 ⭐)`);
      } else {
        if (!change('lives', -1)) return;
        applyEffects([['defense', -5]]);
        OTYRAR_MAP.setArmyProgress(0.8);
        fb('bad', `❌ Қате бағыт! ${esc(d.tip)} (−1 ❤️, 🛡️ −5)`);
      }
      nextBtn('Қорғанысты ұйымдастыруға өту ▶', () => runStage(3));
    });
  }

  /* ---- Кезең 3: ҚОРҒАНЫС (drag & drop) ---- */
  function s3() {
    story('100 жауынгерді 4 қорғаныс нүктесіне бөліңіз. Білесіз бе: жау керуен жолымен келеді — басым соққы қай жаққа түсерін барлаушылар айтқан.');
    OTYRAR_MAP.showWallZones(zoneId => { if (!busy) addToZone(zoneId, 10); });
    const counts = { north: 0, east: 0, west: 0, south: 0 };
    let pool = 100;

    taskPanel(`
      <div class="task-card fade-in">
        <h3>Әскерді бөлу</h3>
        <p class="task-hint">Токенді сүйреңіз (drag & drop) немесе басып, нүктені таңдаңыз. Телефонда − / + батырмаларын қолдануға болады.</p>
        <div class="pool">
          <span>Қалды:</span><span class="zcount" id="poolNum">100</span>
          <div class="token" id="dragToken" role="button" tabindex="0" aria-label="Жауынгерлер тобын сүйреу (10 адам)" title="Сүйріңіз немесе басып таңдаңыз">⚔️</div>
          <span class="muted small">— 1 токен = 10 жауынгер</span>
        </div>
        <div class="alloc" id="allocGrid">
          ${D.wallZones.map(z => `
            <div class="zone" data-zone="${z.id}" id="zone-${z.id}">
              <h4>${z.label}</h4>
              <div class="zcount" id="cnt-${z.id}">0</div>
              <div class="zbtns">
                <button class="btn btn-sm" data-act="sub" data-zone="${z.id}" aria-label="${z.label}: 10 жауынгерді алу">− 10</button>
                <button class="btn btn-sm" data-act="add" data-zone="${z.id}" aria-label="${z.label}: 10 жауынгер қосу">+ 10</button>
              </div>
            </div>`).join('')}
        </div>
        <div class="row"><button id="confirmAlloc" class="btn btn-gold btn-lg" disabled>Орналастыру ✔</button></div>
      </div>`);

    const confirmBtn = $('confirmAlloc');
    function refresh() {
      $('poolNum').textContent = pool;
      for (const z of Object.keys(counts)) $('cnt-' + z).textContent = counts[z];
      confirmBtn.disabled = pool !== 0;
    }
    function addToZone(z, n) {
      if (n > 0 && pool <= 0) return;
      if (n < 0 && counts[z] <= 0) return;
      const step = Math.min(Math.abs(n), n > 0 ? pool : counts[z]) * Math.sign(n);
      counts[z] += step; pool -= step;
      OtyrarAudio.click(); refresh();
    }
    $('allocGrid').addEventListener('click', e => {
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      addToZone(b.dataset.zone, b.dataset.act === 'add' ? 10 : -10);
    });
    /* drag & drop (pointer events — desktop + touch) */
    const token = $('dragToken');
    let armed = false, ghost = null;
    token.addEventListener('pointerdown', e => {
      e.preventDefault();
      try { token.setPointerCapture(e.pointerId); } catch (err) { /* eski brauzer */ }
      ghost = token.cloneNode(true);
      ghost.style.cssText = 'position:fixed;z-index:200;pointer-events:none;opacity:.85;left:' + (e.clientX - 27) + 'px;top:' + (e.clientY - 27) + 'px';
      document.body.appendChild(ghost);
    });
    token.addEventListener('pointermove', e => { if (ghost) { ghost.style.left = (e.clientX - 27) + 'px'; ghost.style.top = (e.clientY - 27) + 'px'; } });
    token.addEventListener('pointerup', e => {
      if (ghost) { ghost.remove(); ghost = null; }
      let z = null;
      try {
        const el = document.elementFromPoint ? document.elementFromPoint(e.clientX, e.clientY) : null;
        z = el && el.closest ? el.closest('[data-zone]') : null;
      } catch (err) { /* ignore */ }
      if (z && pool > 0) { addToZone(z.dataset.zone, 10); armed = false; }
      else armed = pool > 0; /* басу → келесі нүктені таңдау */
    });
    token.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); armed = true; token.style.boxShadow = '0 0 0 4px rgba(240,192,90,.8)'; } });
    if (!mapZoneClickBound) {
      mapZoneClickBound = true;
      document.getElementById('map-box').addEventListener('click', e => {
        if (!s3ctx || !s3ctx.armed) return;
        const g = e.target.closest ? e.target.closest('[data-zone]') : null;
        if (g) s3ctx.place(g.dataset.zone);
      });
    }
    s3ctx = {
      get armed() { return armed; },
      set armed(v) { armed = v; },
      place(id) { if (pool > 0) { addToZone(id, 10); armed = false; token.style.boxShadow = ''; } }
    };

    confirmBtn.addEventListener('click', () => {
      if (busy) return; lock();
      OTYRAR_MAP.hideWallZones();
      const { north, east, west, south } = counts;
      if (north >= 30 && east >= 30 && west >= 10 && south >= 10) {
        applyEffects([['score', 10], ['defense', 10]]);
        fb('ok', '✅ Өте ұтымды бөлу! Басым бағыттар мықты қорғалды. (+10 ⭐, 🛡️ +10)');
      } else if (north >= 30 && east >= 30) {
        applyEffects([['score', 5], ['defense', 5]]);
        fb('info', '⚠️ Негізгі бағыттар қорғалды, бірақ басқа қабырғалар жалаңаш қалды. (+5 ⭐, 🛡️ +5)');
      } else {
        if (!change('lives', -1)) return;
        applyEffects([['defense', -10]]);
        fb('bad', '❌ Әскер дұрыс бөлінбеді: жау басым соққысын солтүстік қақпа мен шығыс мұнарасына түсірді. (−1 ❤️, 🛡️ −10)');
      }
      nextBtn('Азық қорына өту ▶', () => runStage(4));
    });
    refresh();
  }

  /* ---- Кезең 4: АЗЫҚ ҚОРЫ ---- */
  function s4() {
    story('Қоршау ұзаққа созылуы мүмкін. Азықты қалай бөлесіз? Әр шешімнің бағасы бар.');
    renderTask('Азық қорын басқару', 'Шешіміңіз ресурстарға әсер етеді.',
      ['Рационды бақылаумен үнемдеу: тәуліктік үлесті қысқартып, малды қалада ұстау',
       'Қазынаға көрші елдерден астық сатып алу',
       'Азық іздеу үшін жеке отрядты далаға шығару'],
      i => {
        if (i === 0) { applyEffects([['score', 10], ['food', -10], ['defense', 5]]); fb('ok', '✅ Дана шешім! Рацион үнемделіп, рух нығайды. (+10 ⭐, 🍞 −10, 🛡️ +5)'); }
        else if (i === 1) { applyEffects([['score', 5], ['treasury', -40], ['food', 20]]); fb('info', '💰 Астық жетілді, бірақ қазына босады. (+5 ⭐, 💰 −40, 🍞 +20)'); }
        else { applyEffects([['army', -12], ['food', 8], ['defense', -5]]); fb('bad', '⚔️ Отряд малмен қайтты, бірақ жолда шайқаста жауынгерлерден айырылдыңыз. (⚔️ −12, 🍞 +8, 🛡️ −5)'); }
        nextBtn('Тарихи санаққа өту ▶', () => runStage(5));
      });
  }

  /* ---- Кезең 5: ТАРИХИ СҰРАҚ (20 сек) ---- */
  function s5() {
    story('Мұғалім мен көне жылнамашы сарайында: тарихын білген қолбасшы — жеңімпаз. 5 сұрақ, әрқайсысына 20 секунд.');
    let done = 0;
    askNext();
    function askNext() {
      if (done >= 5) { runStage(6); return; }
      done++;
      const q = nextQuestion();
      askQuestion(q, 20, () => later(askNext, 900));
    }
  }

  /* ---- Кезең 6: ҚОРШАУ (синематик + жоспар) ---- */
  function s6() {
    story('Төбеден шаң бағанасы көрінді… Моңғол әскері қабырға алдында тізілді. Тулар желбіреді, жер дірілдейді.');
    OTYRAR_MAP.setArmyProgress(0.97);
    OtyrarAudio.drums();
    taskPanel(`<div class="task-card fade-in" style="text-align:center">
      <div style="font-size:54px" aria-hidden="true">🏹🐎🐎🐎</div>
      <h3 style="letter-spacing:.2em">ҚОРШАУ БАСТАЛДЫ</h3>
      <p class="muted">Моңғол шебі қаланы қыспаққа алды…</p>
    </div>`);
    later(showPlans, OTYRAR_MAP.isReducedMotion() ? 900 : 3400);
    function showPlans() {
      noFb();
      renderTask('Қорғаныс жоспарын таңдаңыз', 'Тарихи жағдайға сүйеніп шешім қабылдаңыз.',
        ['Қабырғада, мұнараларда және қақпа басында қорғану',
         'Ашық далаға шығып, жалпы шайқасқа кіру',
         'Қаланы тастап, түнде Отырардан кету'],
        i => {
          if (i === 0) { applyEffects([['score', 10], ['defense', 10]]); fb('ok', '✅ Дұрыс стратегия! Тарихта Отырар дәл осындай қорғаныспен 5 ай тойтарыс берді. (+10 ⭐, 🛡️ +10)'); }
          else if (i === 1) { if (!change('lives', -1)) return; applyEffects([['army', -15]]); fb('bad', '❌ Ашық далада моңғол атты әскерінен мықтысы жоқ еді… (−1 ❤️, ⚔️ −15)'); }
          else { if (!change('lives', -1)) return; applyEffects([['food', -10], ['defense', -15]]); fb('bad', '❌ Қаланы тастау — халықты қорғансыз қалдыру. (−1 ❤️, 🍞 −10, 🛡️ −15)'); }
          nextBtn('Қақпа шайқасына өту ▶', () => runStage(7));
        });
    }
  }

  /* ---- Кезең 7: ОТЫРАР ҚАҚПАСЫ (жылдам тапсырмалар) ---- */
  function s7() {
    story('Қақпаға шабуыл басталды! Әр шешімге — 15 секунд. Жылдам болыңыз, қолбасшы!');
    OTYRAR_MAP.setArmyProgress(0.97);
    q1();
    function q1() {
      renderTaskTimed('Моңғолдар қабырғаға жылжытқыш мұнара алып келді. Не тиімді?', 'Тапсырма 1/3 — 15 секунд!',
        ['Мұнараға тас атушы машиналар мен отты жебелер',
         'Қылыш пен найзамены жаяу шығу',
         'Қақпаны ашып, жалпы шабуылға көшу',
         'Жебені үнемдеп, күтіп тұру'],
        15, i => {
          if (i === 0) { applyEffects([['score', 10], ['defense', 5]]); fb('ok', '✅ Мұнара жойылды! (+10 ⭐, 🛡️ +5)'); }
          else { if (!change('lives', -1)) return; applyEffects([['army', -8]]); fb('bad', '❌ Мұнара қабырғаға жақындады… (−1 ❤️, ⚔️ −8)'); }
          later(q2, 1600);
        }, 0);
    }
    function q2() {
      noFb(); taskPanel('');
      renderTask('Әлсіз нүктені табыңыз', 'Тапсырма 2/3: моңғол мұнарасы мен қоршау машиналары бір тұсқа жинақталды. Картадан қай нүктені нығайту керек?', null, null, 15, null);
      const pts = [
        { id: 'А', x: 470, y: 210, label: 'Солтүстік қақпа' },
        { id: 'Ә', x: 640, y: 315, label: 'Шығыс мұнарасы' },
        { id: 'Б', x: 340, y: 400, label: 'Батыс қабырға' }
      ];
      OTYRAR_MAP.showWeakPoints(pts, id => {
        if (busy) return; lock();
        OTYRAR_MAP.clearMarks();
        if (id === 'Ә') { applyEffects([['score', 10]]); fb('ok', '✅ Дұрыс! Шабуылдың бағыты — шығыс мұнарасы. (+10 ⭐)'); }
        else { if (!change('lives', -1)) return; fb('bad', '❌ Қате нүкте! Негізгі соққы шығыстан түсті. (−1 ❤️)'); }
        later(q3, 1600);
      });
    }
    function q3() {
      noFb(); taskPanel('');
      const q = nextQuestion();
      askQuestion(q, 15, () => later(runStage.bind(null, 8), 900), 'Тапсырма 3/3');
    }
  }

  /* ---- Кезең 8: ҚҰПИЯ ХАБАР ---- */
  function s8() {
    story('Керуен сарайынан құпия хабар табылды. Деректі мұқият оқып, тапсырмаларды орындаңыз.');
    taskPanel(`
      <div class="task-card fade-in">
        <div class="doc">
          <div class="doc-head">${esc(D.document.head)}</div>
          ${esc(D.document.text)}
        </div>
        <div id="docQ"></div>
      </div>`);
    let dqIdx = 0;
    askDocQ();
    function askDocQ() {
      const q = D.documentQuestions[dqIdx];
      const zone = $('docQ');
      zone.innerHTML = `<h3>${esc(q.q)}</h3><div class="opts">${q.o.map((o, i) => `<button class="opt" data-i="${i}"><span class="opt-key">${'АБВГ'[i]}.</span> ${esc(o)}</button>`).join('')}</div>`;
      zone.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => {
        if (busy) return; lock();
        const i = +b.dataset.i;
        zone.querySelectorAll('.opt').forEach(x => x.disabled = true);
        if (i === q.c) { b.classList.add('correct'); applyEffects([['score', 10]]); fb('ok', '✅ Дұрыс! (+10 ⭐) ' + esc(q.e)); }
        else { b.classList.add('wrong'); if (!change('lives', -1)) return; fb('bad', '❌ Қате жауап. (−1 ❤️)'); }
        later(() => { noFb(); dqIdx++; if (dqIdx < D.documentQuestions.length) askDocQ(); else startMatching(); }, 1900);
      }));
    }
    function startMatching() {
      noFb();
      const roles = shuffle(D.matching.map((m, i) => ({ text: m.b, i })));
      let selA = null, pairs = 0, mistakes = 0;
      taskPanel(`
        <div class="task-card fade-in">
          <h3>Сәйкестендіру: тұлға ↔ рөл</h3>
          <p class="task-hint">Сол жақтан тұлғаны, оң жақтан рөлін таңдаңыз.</p>
          <div class="match">
            <div class="col-a">${D.matching.map((m, i) => `<button class="opt" data-a="${i}">${esc(m.a)}</button>`).join('')}</div>
            <div class="col-b">${roles.map(r => `<button class="opt" data-b="${r.i}">${esc(r.text)}</button>`).join('')}</div>
          </div>
        </div>`);
      const aBtns = [...taskPanelEl().querySelectorAll('[data-a]')];
      const bBtns = [...taskPanelEl().querySelectorAll('[data-b]')];
      aBtns.forEach(b => b.addEventListener('click', () => {
        if (busy || b.classList.contains('mdone')) return;
        aBtns.forEach(x => x.classList.remove('msel'));
        b.classList.add('msel'); selA = +b.dataset.a; OtyrarAudio.click();
      }));
      bBtns.forEach(b => b.addEventListener('click', () => {
        if (busy || b.classList.contains('mdone') || selA === null) return;
        lock();
        if (+b.dataset.b === selA) {
          b.classList.add('mdone'); aBtns[selA].classList.add('mdone'); aBtns[selA].classList.remove('msel');
          selA = null; pairs++; OtyrarAudio.correct();
          if (pairs === D.matching.length) {
            if (mistakes <= 1) { applyEffects([['score', 10]]); fb('ok', `✅ Барлық сәйкестік дұрыс! (${mistakes} қате) (+10 ⭐)`); }
            else { if (!change('lives', -1)) return; fb('bad', `❌ Көп қате: ${mistakes}. (−1 ❤️)`); }
            nextBtn('Соңғы қорғанысқа өту ▶', () => runStage(9));
          }
        } else {
          mistakes++; b.classList.add('wrong'); OtyrarAudio.wrong();
          later(() => b.classList.remove('wrong'), 500);
          if (mistakes > 2) fb('info', '💡 Кеңес: Шыңғыс хан — жаулаушы, Қайыр хан — Отырар билеушісі.');
        }
      }));
    }
  }

  /* ---- Кезең 9: СОҢҒЫ ҚОРҒАНЫС ---- */
  function s9() {
    story('Шешуші шабуыл! Ресурстарыңыз есептеледі. Қабырға бұзылып жатыр — жөндеушілерді жіберіңіз, содан кейін хронологияны дәл айтпасаңыз, жоспар құлауы мүмкін.');
    breachGame(() => later(chronologyStep, 1200));

    function breachGame(onDone) {
      const dur = 20;
      taskPanel(`
        <div class="task-card fade-in">
          <h3>Қабырғаны жөндеу</h3>
          <p class="task-hint">20 секунд ішінде пайда болған бұзылыстарды басып жабыңыз!</p>
          <div class="timerline"><i id="tbar"></i></div><div class="tsec" id="tsec">${dur} сек</div>
          <div class="breach-zone" id="breachZone">
            <img src="assets/siege.jpg" alt="Қабырғадағы шайқас көрінісі" />
            <p class="center-note" id="breachScore">Жөнделді: 0</p>
          </div>
        </div>`);
      let spawned = 0, repaired = 0;
      const zone = $('breachZone');
      const spawner = every(() => {
        if (zone.querySelectorAll('.breach-target').length >= 5) return;
        const b = document.createElement('button');
        b.className = 'breach-target';
        b.style.left = (8 + Math.random() * 78) + '%';
        b.style.top = (12 + Math.random() * 55) + '%';
        b.setAttribute('aria-label', 'Бұзылысты жөндеу');
        b.textContent = '🔥';
        b.addEventListener('click', () => {
          b.remove(); repaired++;
          $('breachScore').textContent = `Жөнделді: ${repaired}`;
          OtyrarAudio.click();
        });
        zone.appendChild(b);
        spawned++;
      }, 2100);
      const stopT = startTaskTimer(dur, finish);
      function finish() {
        clearInterval(spawner);
        const i = stageTimers.findIndex(x => x.t === spawner); if (i > -1) stageTimers.splice(i, 1);
        zone.querySelectorAll('.breach-target').forEach(x => x.remove());
        const need = Math.ceil(spawned * 0.7);
        if (spawned > 0 && repaired >= need) { applyEffects([['score', 10], ['defense', 5]]); fb('ok', `✅ Қабырға ұсталды: ${repaired}/${spawned} жөнделді! (+10 ⭐, 🛡️ +5)`); }
        else if (spawned === 0) { fb('info', '🛡️ Бұзылыс болмады — қабырға мықты тұрды.'); }
        else { if (!change('lives', -1)) return; applyEffects([['defense', -10]]); fb('bad', `❌ Тым көп бұзылыс қалды (${repaired}/${spawned}). (−1 ❤️, 🛡️ −10)`); }
        later(onDone, 2000);
      }
    }

    function chronologyStep() {
      noFb(); taskPanel('');
      const order = shuffle(D.chronology.map((c, i) => ({ ...c, i })));
      let expected = 0, mistakes = 0;
      renderTask('Хронологияны қалпына келтіріңіз', 'Оқиғаларды дұрыс ретпен (ескіден жаңаға) басыңыз.',
        null, null, null, null);
      taskPanelEl().querySelector('.task-card').insertAdjacentHTML('beforeend',
        `<div class="chrono">${order.map(o => `<button class="opt" data-i="${o.i}"><span class="ch-num">?</span> ${esc(o.y ? o.t : o.t)}</button>`).join('')}</div>`);
      const btns = [...taskPanelEl().querySelectorAll('.chrono .opt')];
      btns.forEach(b => b.addEventListener('click', () => {
        if (busy || b.disabled) return; lock();
        const i = +b.dataset.i;
        if (i === expected) {
          b.disabled = true;
          b.querySelector('.ch-num').textContent = D.chronology[i].y;
          expected++; OtyrarAudio.correct();
          if (expected === D.chronology.length) {
            if (mistakes === 0) { applyEffects([['score', 10]]); fb('ok', '✅ Хронология мінсіз! (+10 ⭐)'); }
            else { fb('info', `📜 Хронология жиналды, бірақ ${mistakes} қате болды.`); }
            later(finalStep, 1800);
          }
        } else {
          mistakes++; b.classList.add('wrong');
          later(() => b.classList.remove('wrong'), 500);
          if (!change('lives', -1)) return;
          fb('bad', '❌ Қате рет! (−1 ❤️)');
        }
      }));
    }

    function finalStep() {
      noFb(); taskPanel('');
      if (S.defense >= 40 && S.food >= 30 && S.army >= 30) {
        applyEffects([['score', 10]]);
        fb('ok', `🏆 Соңғы қорғаныс тойтарылды! Ресурстар жеткілікті: 🛡️${S.defense} 🍞${S.food} ⚔️${S.army}. (+10 ⭐)`);
      } else {
        if (!change('lives', -1)) return;
        fb('bad', `❌ Ресурстар таусылып, қорғаныс жұқарады: 🛡️${S.defense} 🍞${S.food} ⚔️${S.army}. (−1 ❤️)`);
      }
      later(() => runStage(10), 2200);
    }
  }

  /* ---- Кезең 10: ФИНАЛ ---- */
  function s10() {
    OtyrarAudio.fanfare();
    const total = S.score;
    let medal, rank, rankText;
    if (S.lives >= 4 && total >= 100) { medal = '🏆'; rank = 'Отырардың ұлы қолбасшысы'; rankText = 'Сіздің стратегияңыз мен тарихи біліміңіз — үлгілі!'; }
    else if (S.lives >= 3 && total >= 70) { medal = '🛡️'; rank = 'Қаланың сенімді қорғаушысы'; rankText = 'Қала сіздің қолыңызда сенімді тұрды!'; }
    else if (total >= 50) { medal = '⚔️'; rank = 'Қорғанысты толық меңгерген стратег'; rankText = 'Тәжірибе жинақталды — келесі жолы нәтиже жоғары болады!'; }
    else { medal = '📜'; rank = 'Тарихтың зерек зерттеушісі'; rankText = 'Тарихи деректерді меңгеру — жеңіске бірінші қадам.'; }
    clearSave();

    $('screen-final').innerHTML = `
      <div class="final-card">
        <p class="final-medal">${medal}</p>
        <p class="stage-tag">Ойын аяқталды · 10/10 кезең</p>
        <div class="final-rank">«${rank}»</div>
        <p class="muted">${rankText}</p>
        <div class="final-stats">
          <div class="fstat"><b>${S.score}</b>⭐ ұпай</div>
          <div class="fstat"><b>${S.lives}</b>❤️ өмір</div>
          <div class="fstat"><b>${S.defense}</b>🛡️ қорғаныс</div>
          <div class="fstat"><b>${S.food}</b>🍞 азық</div>
          <div class="fstat"><b>${S.army}</b>⚔️ әскер</div>
          <div class="fstat"><b>${S.treasury}</b>💰 қазына</div>
        </div>
        <div class="epilogue">
          <b>Тарихи эпилог:</b> Нақты тарихта Отырар 1219 жылдың қыркүйегінен 1220 жылдың ақпанына дейін — шамамен 5 ай қорғалды.
          Қаланы Қайыр хан (Иналшық) қорғады; сыртқы қала құлағаннан кейін ол ішкі қамалда тағы бір айға жуық тұрды.
          Қала құлаған соң моңғол әскері Мауараннахрға бет алды (Бұқара, Самарқан), ал Отырар қорғанысы батыл қарсылықтың үлгісі ретінде тарихта қалды.
        </div>
        <div class="row">
          <button id="btnRestartFinal" class="btn btn-gold btn-lg">ҚАЙТА ОЙНАУ</button>
          <button id="btnPrintFinal" class="btn btn-lg">🖨 Сертификатты басып шығару</button>
        </div>
      </div>`;
    showScreen('final');
    $('btnRestartFinal').addEventListener('click', startNew);
    $('btnPrintFinal').addEventListener('click', () => window.print());
  }

  /* ================= Game Over ================= */
  function gameOver() {
    if (over) return;
    over = true;
    clearStageTimers();
    OtyrarAudio.alarm();
    $('over-stats').textContent = `Қол жеткізген ұпай: ${S.score} · Кезең: ${S.stage}/${STAGE_TOTAL}`;
    showScreen('gameover');
  }

  /* ================= Жалпы тапсырма рендерлері ================= */
  function taskPanelEl() { return $('task-panel'); }

  function renderTask(title, hint, options, onPick) {
    taskPanel(`
      <div class="task-card fade-in">
        <h3>${esc(title)}</h3>
        ${hint ? `<p class="task-hint">${esc(hint)}</p>` : ''}
        ${options ? `<div class="opts">${options.map((o, i) => `<button class="opt" data-i="${i}"><span class="opt-key">${'АБВГ'[i]}.</span> ${esc(o)}</button>`).join('')}</div>` : ''}
      </div>`);
    if (options && onPick) {
      taskPanelEl().querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => {
        if (busy) return; lock();
        onPick(+b.dataset.i, b);
      }));
    }
  }

  function renderTaskTimed(title, hint, options, sec, onPick, correctIndex) {
    taskPanel(`
      <div class="task-card fade-in">
        <div class="timerline"><i id="tbar"></i></div><div class="tsec" id="tsec">${sec} сек</div>
        <h3>${esc(title)}</h3>
        ${hint ? `<p class="task-hint">${esc(hint)}</p>` : ''}
        <div class="opts">${options.map((o, i) => `<button class="opt" data-i="${i}"><span class="opt-key">${'АБВГ'[i]}.</span> ${esc(o)}</button>`).join('')}</div>
      </div>`);
    const stop = startTaskTimer(sec, () => answer(-1, null));
    taskPanelEl().querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => {
      if (busy) return; lock(); stop();
      answer(+b.dataset.i, b);
    }));
    function answer(i, btn) {
      taskPanelEl().querySelectorAll('.opt').forEach(x => x.disabled = true);
      if (i >= 0) btn = taskPanelEl().querySelector(`.opt[data-i="${i}"]`);
      if (i === correctIndex) { if (btn) btn.classList.add('correct'); }
      else { if (btn) btn.classList.add('wrong'); }
      onPick(i, btn);
    }
  }

  function askQuestion(q, sec, onDone, tag) {
    noFb(); taskPanel('');
    renderTaskTimed((tag ? tag + '. ' : '') + q.q, 'Бір дұрыс жауапты таңдаңыз. Қате жауап — −1 өмір.', q.o, sec, i => {
      if (i === q.c) {
        applyEffects([['score', 10]]);
        fb('ok', `✅ Дұрыс! +10 ⭐<span class="expl">${esc(q.e)}</span>`);
        OtyrarAudio.correct();
      } else {
        if (!change('lives', -1)) return;
        fb('bad', '❌ Қате жауап. (−1 ❤️)');
      }
      later(onDone, 1600);
    }, q.c);
  }

  /* ================= Бастау / қайта бастау ================= */
  function startNew() {
    over = false;
    S = { lives: 5, defense: 100, food: 100, army: 100, treasury: 100, score: 0, stage: 1, qi: 0 };
    buildQuizQueue();
    clearSave();
    $('intro-role').hidden = false;
    showScreen('game');
    updateHUD();
    runStage(1);
  }
  function resume() {
    const d = loadSave();
    if (!d) return startNew();
    over = false;
    S = d.S; quizQueue = d.quizQueue;
    showScreen('game');
    updateHUD();
    runStage(S.stage);
  }

  /* ================= Дыбыс батырмалары ================= */
  function syncSound() {
    const on = OtyrarAudio.isEnabled();
    const icon = on ? '🔊' : '🔇';
    $('btnSound').textContent = icon;
    $('btnSound2').textContent = icon;
    $('btnSound').setAttribute('aria-pressed', String(on));
    $('btnSound2').setAttribute('aria-pressed', String(on));
  }
  function toggleSound() { OtyrarAudio.toggle(); syncSound(); }

  /* ================= Ивенттер ================= */
  $('btnStart').addEventListener('click', () => { OtyrarAudio.click(); startNew(); });
  $('btnRules').addEventListener('click', () => { OtyrarAudio.click(); $('modal-rules').hidden = false; $('btnRulesClose').focus(); });
  $('btnRulesClose').addEventListener('click', () => { $('modal-rules').hidden = true; $('btnRules').focus(); });
  $('modal-rules').addEventListener('click', e => { if (e.target === $('modal-rules')) $('modal-rules').hidden = true; });
  $('btnSound').addEventListener('click', toggleSound);
  $('btnSound2').addEventListener('click', toggleSound);
  $('btnRestart1').addEventListener('click', () => { OtyrarAudio.click(); startNew(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('modal-rules').hidden) { $('modal-rules').hidden = true; $('btnRules').focus(); } });

  /* сақталған ойын бар-жоғы */
  (function initIntro() {
    syncSound();
    if (loadSave()) $('btnResume').hidden = false;
    $('btnResume').addEventListener('click', () => { OtyrarAudio.click(); resume(); });
  })();

  /* ================= Тест үшін хук (өндіріске зиянсыз) ================= */
  window.OtyrarTest = {
    state: () => S,
    isBusy: () => busy,
    startNew,
    runStage: n => runStage(n),
    correctOf: id => { const q = D.questions.find(x => x.id === id); return q ? q.c : -1; },
    data: D
  };
})();
