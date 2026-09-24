/* Osso Solar Energy. Vanilla JS, no build step, no dependencies. */
(() => {
  'use strict';

  const doc = document, root = doc.documentElement;
  const $ = (s, r = doc) => r.querySelector(s);
  const $$ = (s, r = doc) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smoothstep = (p, e0, e1) => { const t = clamp((p - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const rng = seed => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };

  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const BG = '#0E2236';

  /* The mounting rails (Unterkonstruktion). Layout taken from the rail photo, mapped onto the roof
     plane of the clean roof image with a perspective transform. Coordinates are 0..1 of that image. */
  const RAILS = [
    [[.2714, .1808], [.4667, .1896]], [[.2577, .2535], [.4572, .2642]], [[.4603, .2656], [.5833, .2664]],
    [[.4921, .1977], [.7768, .2078]], [[.5943, .2738], [.7814, .2839]], [[.4537, .336], [.7863, .366]],
    [[.4106, .3746], [.5364, .3838]], [[.4005, .4631], [.4992, .4742]], [[.5704, .4517], [.795, .4826]],
    [[.3935, .534], [.8037, .593]], [[.383, .642], [.8096, .7161]]
  ];

  /* ------------------------------------------------------------------
     The light layer. One class draws the hero and the hold moment:
     the clean roof in dawn tones, optional rails that lay themselves,
     and a second photo (the finished roof) revealed by a soft light
     front that spreads from the sun, plus bloom, rays and dust.
     ------------------------------------------------------------------ */
  class LightReveal {
    constructor(canvas, cfg) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.off = doc.createElement('canvas');
      this.octx = this.off.getContext('2d');
      this.cfg = Object.assign({
        sun: [.86, .1], reveal: [.22, .8], rails: null, railsRange: [.2, .45],
        sunUp: [0, .32], sunDown: [.7, 1], focus: [.5, .55], zoom: .05, dust: 34, seed: 7, banner: false
      }, cfg);
      this.before = null; this.after = null;
      this.w = 0; this.h = 0; this.dpr = 1;
      this.rect = { x: 0, y: 0, w: 0, h: 0, banner: false };
      const r = rng(this.cfg.seed);
      this.parts = Array.from({ length: this.cfg.dust }, () => ({
        x: r(), y: r(), v: .05 + r() * .28, ph: r() * 6.28, s: .8 + r() * 1.5, a: .2 + r() * .3
      }));
    }
    setImages(before, after) { this.before = before; this.after = after; }
    resize() {
      const r = this.c.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
      const banner = this.cfg.banner && w / h < 1.25;
      /* on a tall screen the wide picture sits as a band under the menu; on a wide screen it fills the stage */
      const rect = banner
        ? { x: 0, y: Math.round(96 * dpr), w, h: Math.round(Math.min(h * .44, 380 * dpr)), banner: true }
        : { x: 0, y: 0, w, h, banner: false };
      const changed = w !== this.w || h !== this.h || banner !== this.rect.banner;
      this.w = this.c.width = this.off.width = w;
      this.h = this.c.height = this.off.height = h;
      this.dpr = dpr;
      this.rect = rect;
      return changed;
    }
    drawRails(q) {
      if (!this.cfg.rails || q <= 0) return;
      const { ctx, tf, rect: R } = this;
      const lw = 3.4 * (tf.iw / 1536) * tf.s;
      const X = nx => R.x + (nx * tf.iw - tf.sx) * tf.s, Y = ny => R.y + (ny * tf.ih - tf.sy) * tf.s;
      const rails = this.cfg.rails, n = rails.length;
      ctx.lineCap = 'round';
      rails.forEach(([a, b], i) => {
        const start = ((n - 1 - i) / n) * .55;            /* laid from the eave upward, like on a real roof */
        const t = clamp((q - start) / .45, 0, 1);
        if (t <= 0) return;
        const e = easeOut(t);
        const x0 = X(a[0]), y0 = Y(a[1]), x1 = X(b[0]), y1 = Y(b[1]);
        const xe = x0 + (x1 - x0) * e, ye = y0 + (y1 - y0) * e;
        ctx.strokeStyle = 'rgba(20,14,10,.4)'; ctx.lineWidth = lw * 1.5;
        ctx.beginPath(); ctx.moveTo(x0, y0 + lw * .8); ctx.lineTo(xe, ye + lw * .8); ctx.stroke();
        ctx.strokeStyle = 'rgba(208,218,226,.97)'; ctx.lineWidth = lw;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(xe, ye); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.88)'; ctx.lineWidth = lw * .34;
        ctx.beginPath(); ctx.moveTo(x0, y0 - lw * .22); ctx.lineTo(xe, ye - lw * .22); ctx.stroke();
        const cnt = Math.max(3, Math.round(Math.hypot(x1 - x0, y1 - y0) / (lw * 13)));
        ctx.strokeStyle = 'rgba(70,82,94,.92)'; ctx.lineWidth = lw * .7;
        for (let k = 0; k <= cnt; k++) {
          const f = k / cnt; if (f > e) break;
          const bx = x0 + (x1 - x0) * f, by = y0 + (y1 - y0) * f;
          ctx.beginPath(); ctx.moveTo(bx, by - lw * .9); ctx.lineTo(bx, by + lw * 1.2); ctx.stroke();
        }
        if (t < 1) {
          const g = ctx.createRadialGradient(xe, ye, 0, xe, ye, lw * 5);
          g.addColorStop(0, 'rgba(255,240,210,.95)'); g.addColorStop(1, 'rgba(255,200,120,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(xe, ye, lw * 5, 0, 6.2832); ctx.fill();
        }
      });
    }
    paint(p) {
      const { ctx, octx, w, h, cfg, rect: R } = this;
      if (!this.before || !this.after || !w) return;
      p = clamp(p, 0, 1);
      const zoom = 1 + cfg.zoom * (1 - easeOut(p));
      const fx = R.banner ? .53 : cfg.focus[0], fy = R.banner ? .5 : cfg.focus[1];
      const cover = (g, img, keep) => {
        const iw = img.naturalWidth, ih = img.naturalHeight;
        const s = Math.max(R.w / iw, R.h / ih) * zoom;
        const sw = R.w / s, sh = R.h / s, sx = (iw - sw) * fx, sy = (ih - sh) * fy;
        g.drawImage(img, sx, sy, sw, sh, R.x, R.y, R.w, R.h);
        if (keep) this.tf = { sx, sy, sw, sh, iw, ih, s };
      };

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      if (R.banner) { ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h); }
      ctx.save();
      ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();

      /* the roof in the dawn: cool and dim until the light arrives */
      cover(ctx, this.before, true);
      this.drawRails(smoothstep(p, cfg.railsRange[0], cfg.railsRange[1]));
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(40,62,96,' + (0.5 - 0.1 * easeOut(p)).toFixed(3) + ')';
      ctx.fillRect(R.x, R.y, R.w, R.h);
      ctx.globalCompositeOperation = 'source-over';

      /* the light front, spreading from the sun */
      const sx = R.x + cfg.sun[0] * R.w, sy = R.y + cfg.sun[1] * R.h;
      const rmax = Math.max(Math.hypot(sx - R.x, sy - R.y), Math.hypot(R.x + R.w - sx, sy - R.y), Math.hypot(sx - R.x, R.y + R.h - sy), Math.hypot(R.x + R.w - sx, R.y + R.h - sy));
      const feather = rmax * .2;
      const rp = smoothstep(p, cfg.reveal[0], cfg.reveal[1]);
      const r = rp * (rmax + feather);

      if (r > 1) {
        octx.globalCompositeOperation = 'source-over';
        octx.clearRect(0, 0, w, h);
        cover(octx, this.after, false);
        octx.globalCompositeOperation = 'destination-in';
        const g = octx.createRadialGradient(sx, sy, 0, sx, sy, r);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(Math.max(0, (r - feather) / r), 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        octx.fillStyle = g;
        octx.fillRect(0, 0, w, h);
        ctx.drawImage(this.off, 0, 0);
      }

      ctx.globalCompositeOperation = 'screen';

      /* a warm ring rides the edge of the light */
      const ringA = smoothstep(rp, .02, .12) * (1 - smoothstep(rp, .82, 1));
      if (ringA > .004) {
        const r0 = Math.max(0, r - feather * 1.1), r1 = r + feather * .18;
        const g = ctx.createRadialGradient(sx, sy, r0, sx, sy, r1);
        g.addColorStop(0, 'rgba(255,170,70,0)');
        g.addColorStop(.62, 'rgba(255,178,84,' + (.34 * ringA).toFixed(3) + ')');
        g.addColorStop(.86, 'rgba(255,224,160,' + (.5 * ringA).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(255,214,140,0)');
        ctx.fillStyle = g;
        ctx.fillRect(R.x, R.y, R.w, R.h);
      }

      /* sun: bloom and rays, brightest while the light is spreading */
      const base = Math.min(R.w, R.h);
      const sunI = .5 + .5 * smoothstep(p, cfg.sunUp[0], cfg.sunUp[1]) - .72 * smoothstep(p, cfg.sunDown[0], cfg.sunDown[1]);
      const bloom = base * (.55 + .25 * sunI);
      let g = ctx.createRadialGradient(sx, sy, 0, sx, sy, bloom);
      g.addColorStop(0, 'rgba(255,236,190,' + (.9 * sunI).toFixed(3) + ')');
      g.addColorStop(.12, 'rgba(255,190,90,' + (.55 * sunI).toFixed(3) + ')');
      g.addColorStop(.45, 'rgba(247,148,29,' + (.16 * sunI).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(247,148,29,0)');
      ctx.fillStyle = g;
      ctx.fillRect(R.x, R.y, R.w, R.h);

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(p * .9 + .2);
      const n = 26;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const len = base * (.34 + .22 * ((i * 7) % 5) / 5);
        const wd = .018 + ((i * 3) % 4) * .004;
        const ex = Math.cos(a) * len, ey = Math.sin(a) * len;
        const rg = ctx.createLinearGradient(0, 0, ex, ey);
        rg.addColorStop(0, 'rgba(255,226,160,' + (.32 * sunI).toFixed(3) + ')');
        rg.addColorStop(1, 'rgba(255,226,160,0)');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a - wd) * len, Math.sin(a - wd) * len);
        ctx.lineTo(Math.cos(a + wd) * len, Math.sin(a + wd) * len);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      /* dust, only where the light already is; drifts with the scroll, so it rests when you rest */
      for (const q of this.parts) {
        const y = (((q.y + p * q.v) % 1) + 1) % 1;
        const x = q.x + Math.sin(p * 5 + q.ph) * .012;
        const px = R.x + x * R.w, py = R.y + y * R.h;
        const lit = clamp((r - Math.hypot(px - sx, py - sy)) / feather, 0, 1);
        if (lit < .01) continue;
        ctx.fillStyle = 'rgba(255,232,180,' + (q.a * lit).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(px, py, q.s * this.dpr, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();

      /* on a tall screen the band melts into the page instead of ending in a hard edge */
      if (R.banner) {
        const fade = (y0, y1, a0, a1) => {
          const gg = ctx.createLinearGradient(0, y0, 0, y1);
          gg.addColorStop(0, 'rgba(14,34,54,' + a0 + ')'); gg.addColorStop(1, 'rgba(14,34,54,' + a1 + ')');
          ctx.fillStyle = gg; ctx.fillRect(0, Math.min(y0, y1), w, Math.abs(y1 - y0));
        };
        fade(R.y + R.h * .74, R.y + R.h, 0, 1);
        fade(R.y, R.y + R.h * .14, 1, 0);
      }
    }
  }

  const loadImg = src => new Promise((res, rej) => {
    const i = new Image();
    i.decoding = 'async';
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });

  /* ------------------------------------------------------------------
     Text splitting, done once at load. Seeded, so the "random" is the
     same on every visit. Screen readers get the plain sentence.
     ------------------------------------------------------------------ */
  function splitText() {
    $$('[data-split]').forEach((el, idx) => {
      const mode = el.dataset.split;
      const text = el.textContent.trim();
      const r = rng(31 + idx * 17);
      el.textContent = '';
      const sr = doc.createElement('span');
      sr.className = 'sr';
      sr.textContent = text;
      el.appendChild(sr);

      if (mode === 'blur') {
        ['sharp', 'soft'].forEach(cls => {
          const s = doc.createElement('span');
          s.className = 'vis ' + cls;
          s.setAttribute('aria-hidden', 'true');
          s.textContent = text;
          el.appendChild(s);
        });
        return;
      }

      const vis = doc.createElement('span');
      vis.className = 'vis';
      vis.setAttribute('aria-hidden', 'true');
      const words = text.split(/\s+/);
      const total = mode === 'chars' ? text.replace(/\s+/g, '').length : words.length;
      let ci = 0;
      words.forEach((word, wi) => {
        const w = doc.createElement('span');
        w.className = 'w';
        if (mode === 'words') {
          w.textContent = word;
          w.style.setProperty('--th', (wi / Math.max(1, words.length) * .5).toFixed(3));
        } else {
          Array.from(word).forEach(ch => {
            const c = doc.createElement('span');
            c.className = 'c';
            c.textContent = ch;
            const mid = (total - 1) / 2;
            c.style.setProperty('--th', (Math.abs(ci - mid) / Math.max(1, total / 2) * .5 + r() * .05).toFixed(3));
            w.appendChild(c);
            ci++;
          });
        }
        vis.appendChild(w);
        if (wi < words.length - 1) vis.appendChild(doc.createTextNode(' '));
      });
      el.appendChild(vis);
    });
  }

  /* ------------------------------------------------------------------
     The hero journey: clean roof, then the rails, then the modules.
     ------------------------------------------------------------------ */
  const hero = $('#hero');
  const stage = $('.stage', hero);
  const fxCanvas = $('#fx');
  const heroFx = new LightReveal(fxCanvas, {
    sun: [.86, .12], reveal: [.5, .76], rails: RAILS, railsRange: [.23, .47],
    sunUp: [.3, .6], sunDown: [.88, 1], zoom: .04, dust: 30, seed: 7, banner: true
  });

  const bands = $$('.band', hero).map(el => ({
    el,
    a: +el.dataset.a, b: +el.dataset.b,
    first: el.hasAttribute('data-first'), last: el.hasAttribute('data-last'),
    dataRamp: +el.dataset.ramp || 0, ramp: .05, fade: .05,
    op: -1, k: -1, vis: null
  }));

  let scrubOn = false;
  let ready = false;
  let target = 0, shown = 0, painted = -1, dirty = true;
  let rafId = null, lastTick = 0;
  let heroOnScreen = true;
  let loadStart = 0;
  let range = 1;

  /* caption timing is measured in screen heights of scroll, not in seconds: a scroll site is read in flicks */
  function layout() {
    const vh = stage.offsetHeight;
    range = Math.max(1, hero.offsetHeight - vh);
    bands.forEach(b => { b.fade = .18 * vh / range; b.ramp = b.dataRamp || .19 * vh / range; });
  }

  function heroProgress() {
    const r = hero.getBoundingClientRect();
    return range > 1 ? clamp(-r.top / range, 0, 1) : 0;
  }

  function loadK(now) { return loadStart ? clamp((now - loadStart) / 1200, 0, 1) : 0; }

  /* captions: every write is delta-gated, so a resting page costs nothing */
  function updateBands(p, now) {
    const lk = loadK(now);
    for (const b of bands) {
      const len = b.b - b.a;
      const f = Math.min(b.fade, len / 3);
      let op = 1;
      if (!b.first) op *= smoothstep(p, b.a, b.a + f);
      if (!b.last) op *= 1 - smoothstep(p, b.b - f, b.b);
      let k = clamp((p - b.a) / b.ramp, 0, 1);
      if (b.first) k = Math.max(k, lk);
      if (!ready) { op = 0; k = 0; }

      if (Math.abs(op - b.op) > .004 || (op === 0) !== (b.op === 0)) {
        b.op = op;
        b.el.style.opacity = op.toFixed(3);
      }
      const vis = op > .01 ? 'visible' : 'hidden';
      if (vis !== b.vis) { b.vis = vis; b.el.style.visibility = vis; }
      if (Math.abs(k - b.k) > .008 || (k === 0) !== (b.k === 0) || (k === 1) !== (b.k === 1)) {
        b.k = k;
        b.el.style.setProperty('--k', k.toFixed(3));
      }
    }
  }

  function render(now) {
    if (dirty || Math.abs(shown - painted) > .00025) {
      heroFx.paint(shown);
      painted = shown;
      dirty = false;
    }
    updateBands(shown, now);
  }

  /* the loop eases toward the scroll position, then rests */
  function tick(now) {
    const dt = Math.min(100, now - (lastTick || now));
    lastTick = now;
    const k = .14;
    shown += (target - shown) * (1 - Math.pow(1 - k, dt / 16.667));
    const converged = Math.abs(target - shown) < .0004;
    if (converged) shown = target;
    render(now);
    if (converged && loadK(now) >= 1) { rafId = null; lastTick = 0; }
    else rafId = requestAnimationFrame(tick);
  }
  function kick() { if (scrubOn && rafId === null && heroOnScreen) rafId = requestAnimationFrame(tick); }

  function onScroll() { target = heroProgress(); kick(); }

  new IntersectionObserver(es => {
    heroOnScreen = es[0].isIntersecting;
    if (heroOnScreen) { target = heroProgress(); kick(); }
  }, { rootMargin: '200px 0px' }).observe(hero);

  let imagesLoaded = false;
  async function loadHeroImages() {
    if (imagesLoaded) return true;
    try {
      const [a, c] = await Promise.all([loadImg('assets/hero-a.webp'), loadImg('assets/hero-c.webp')]);
      heroFx.setImages(a, c);
      imagesLoaded = true;
      return true;
    } catch (e) { return false; }
  }

  async function enableScrub() {
    if (scrubOn) return;
    scrubOn = true;
    root.classList.add('scrub');
    const ok = await loadHeroImages();
    if (!scrubOn) return;
    if (!ok) { disableScrub(); return; }   /* the page stays complete: the still photo carries it */
    layout();
    heroFx.resize();
    dirty = true;
    ready = true;
    loadStart = performance.now();
    root.classList.add('fx-ready');
    bands.forEach(b => { b.op = -1; b.k = -1; b.vis = null; });
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    kick();
  }
  function disableScrub() {
    if (!scrubOn) return;
    scrubOn = false;
    ready = false;
    removeEventListener('scroll', onScroll);
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    root.classList.remove('scrub', 'fx-ready');
    /* hand every caption back to the static layout */
    bands.forEach(b => { b.el.style.opacity = ''; b.el.style.visibility = ''; b.el.style.removeProperty('--k'); });
  }

  function applyMode() {
    if (RM.matches) disableScrub(); else enableScrub();
  }

  new ResizeObserver(() => {
    if (!(scrubOn && ready)) return;
    layout();
    if (heroFx.resize()) { dirty = true; kick(); if (rafId === null) render(performance.now()); }
    onScroll();
  }).observe(stage);

  /* ------------------------------------------------------------------
     Reveal on scroll, self-drawing cable, live sections.
     ------------------------------------------------------------------ */
  function setupReveal() {
    $$('[data-stagger]').forEach(parent => {
      $$(':scope > [data-reveal]', parent).forEach((el, i) => el.style.setProperty('--i', i));
    });
    const io = new IntersectionObserver(es => {
      es.forEach(e => {
        if (!e.isIntersecting) return;
        const el = e.target;
        el.classList.add('in');
        io.unobserve(el);
        setTimeout(() => el.classList.add('done'), 1900);
      });
    }, { threshold: .18, rootMargin: '0px 0px -6% 0px' });
    $$('[data-reveal]').forEach(el => io.observe(el));

    /* benefits belong to the hold moment, they light up with it */
    $$('.benefits .benefit').forEach((el, i) => el.style.setProperty('--i', i));

    const live = new IntersectionObserver(es => {
      es.forEach(e => e.target.classList.toggle('live', e.isIntersecting));
    }, { rootMargin: '80px 0px' });
    $$('main > section, .foot').forEach(el => live.observe(el));

    doc.addEventListener('visibilitychange', () => doc.body.classList.toggle('paused', doc.hidden));
  }

  /* the cable between the four steps draws itself as you scroll */
  function setupCable() {
    const grid = $('.steps-grid');
    if (!grid) return;
    const cables = $$('.cable-path', grid);
    let last = -1, ticking = false;
    const update = () => {
      ticking = false;
      const r = grid.getBoundingClientRect();
      const vh = innerHeight;
      const d = RM.matches ? 1 : clamp((vh * .82 - r.top) / (Math.min(r.height, vh * .9)), 0, 1);
      if (Math.abs(d - last) < .006) return;
      last = d;
      cables.forEach(c => c.style.setProperty('--d', d.toFixed(3)));
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener('resize', update);
    RM.addEventListener('change', update);
    update();
  }

  function buildRays() {
    const g = $('#rays');
    if (!g) return;
    const ns = 'http://www.w3.org/2000/svg';
    for (let i = 0; i < 28; i++) {
      const l = doc.createElementNS(ns, 'line');
      const long = i % 3 === 0;
      l.setAttribute('x1', '0'); l.setAttribute('y1', long ? -70 : -84);
      l.setAttribute('x2', '0'); l.setAttribute('y2', long ? -196 : -150);
      l.setAttribute('transform', 'rotate(' + (i * 360 / 28) + ')');
      g.appendChild(l);
    }
  }

  /* ------------------------------------------------------------------
     The one moment you perform: hold to switch the light on.
     Progress builds while you hold. Let go early and it eases back,
     never snaps. Finishing lights the three benefits, one by one.
     ------------------------------------------------------------------ */
  function setupHold() {
    const section = $('#licht');
    const btn = $('#hold');
    const label = $('#hold-label');
    const cv = $('#fx2');
    if (!section || !btn || !cv) return;

    const fx = new LightReveal(cv, { sun: [.86, .06], reveal: [.02, .96], focus: [.5, .5], zoom: .03, dust: 24, seed: 19 });
    const H = { p: 0, active: false, done: false, raf: null, last: 0, painted: -1, lbl: '' };
    let imagesReady = false, wanted = false;

    const setLabel = t => { if (t !== H.lbl) { H.lbl = t; label.textContent = t; } };

    function finish() {
      H.done = true; H.p = 1; H.active = false;
      section.classList.add('lit');
      btn.classList.add('done');
      btn.setAttribute('aria-pressed', 'true');
      setLabel('Licht ist an.');
      btn.style.setProperty('--hp', 1);
      if (imagesReady) fx.paint(1);
    }

    function step(now) {
      const dt = Math.min(64, now - (H.last || now));
      H.last = now;
      if (!H.done) {
        if (H.active) H.p = Math.min(1, H.p + dt / 2400);
        else H.p = Math.max(0, H.p - (dt / 1300) * (.35 + H.p));
        if (H.p >= 1) finish();
      }
      if (Math.abs(H.p - H.painted) > .0004) {
        H.painted = H.p;
        if (imagesReady) fx.paint(H.p);
        btn.style.setProperty('--hp', H.p.toFixed(3));
      }
      if (!H.done) setLabel(H.active ? 'Weiter halten' : (H.p > .02 ? 'Wieder halten' : 'Gedrückt halten: Licht an'));
      if (H.done || (!H.active && H.p <= 0)) { H.raf = null; H.last = 0; }
      else H.raf = requestAnimationFrame(step);
    }
    const go = () => { if (H.raf === null && !H.done) H.raf = requestAnimationFrame(step); };
    const press = () => { if (H.done) return; H.active = true; go(); };
    const release = () => { H.active = false; go(); };

    btn.addEventListener('pointerdown', e => { e.preventDefault(); try { btn.setPointerCapture(e.pointerId); } catch (_) { /* older browsers */ } press(); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => btn.addEventListener(t, release));
    btn.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); press(); } });
    btn.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') release(); });
    btn.addEventListener('blur', release);
    btn.addEventListener('contextmenu', e => e.preventDefault());

    async function prepare() {
      try {
        const [b, a] = await Promise.all([loadImg('assets/light-before.webp'), loadImg('assets/light-after.webp')]);
        fx.setImages(b, a);
        fx.resize();
        imagesReady = true;
        fx.paint(H.p);
      } catch (e) {
        root.classList.remove('hold-on');   /* the still photo and lit benefits take over */
      }
    }
    /* fetch the two photos when the section is near, not before */
    new IntersectionObserver((es, io) => {
      if (es[0].isIntersecting && !wanted) { wanted = true; io.disconnect(); if (!RM.matches) prepare(); }
    }, { rootMargin: '600px 0px' }).observe(section);
    new ResizeObserver(() => { if (imagesReady && fx.resize()) { H.painted = -1; fx.paint(H.p); } }).observe(cv);

    /* reduced motion: no hold needed, the finished state right away, in both directions */
    function applyRM() {
      if (RM.matches) { finish(); btn.disabled = false; }
    }
    RM.addEventListener('change', applyRM);
    applyRM();
  }

  /* the contact form posts to FormSubmit and comes back with ?formular=erfolgreich;
     show the thank-you message in its place and drop the marker from the address bar */
  function setupContactForm() {
    if (location.search.indexOf('formular=erfolgreich') === -1) return;
    const box = $('#formSuccess');
    if (box) box.classList.add('show');
    if (history.replaceState) history.replaceState(null, '', location.pathname + '#kontakt');
  }

  /* ------------------------------------------------------------------ */
  function init() {
    splitText();
    setupReveal();
    setupCable();
    buildRays();
    setupHold();
    setupContactForm();
    layout();
    RM.addEventListener('change', applyMode);
    window.__ossoReady = true;
    applyMode();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
