/* ОТЫРАРДЫ ҚОРҒА — дыбыс жүйесі (WebAudio, сыртқы файлсыз) */
'use strict';

const OtyrarAudio = (() => {
  let ctx = null;
  let enabled = true;
  try { enabled = localStorage.getItem('otyrar_sound') !== 'off'; } catch (e) { /* нет доступа */ }

  function ensure() {
    if (!enabled) return null;
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) { return null; }
  }

  function tone(freq, dur, type = 'sine', vol = 0.14, delay = 0) {
    const c = ensure();
    if (!c) return;
    try {
      const t0 = c.currentTime + delay;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(c.destination);
      osc.start(t0); osc.stop(t0 + dur + 0.05);
    } catch (e) { /* дыбыс — критикалық емес */ }
  }

  return {
    isEnabled: () => enabled,
    toggle() {
      enabled = !enabled;
      try { localStorage.setItem('otyrar_sound', enabled ? 'on' : 'off'); } catch (e) {}
      if (enabled) this.click();
      return enabled;
    },
    click()   { tone(620, 0.07, 'triangle', 0.10); },
    correct() { tone(523, 0.12, 'sine', 0.16); tone(659, 0.12, 'sine', 0.16, 0.1); tone(784, 0.2, 'sine', 0.16, 0.2); },
    wrong()   { tone(180, 0.3, 'sawtooth', 0.12); tone(140, 0.35, 'sawtooth', 0.10, 0.08); },
    alarm()   { tone(440, 0.16, 'square', 0.09); tone(330, 0.22, 'square', 0.09, 0.18); tone(440, 0.16, 'square', 0.09, 0.4); },
    heartbeat(){ tone(90, 0.18, 'sine', 0.2); tone(80, 0.2, 'sine', 0.16, 0.24); },
    fanfare() { [523,659,784,1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.16, i * 0.13)); },
    drums()   { [0, 0.3, 0.6, 0.9].forEach((d, i) => tone(70 + i * 4, 0.16, 'sine', 0.24, d)); }
  };
})();
