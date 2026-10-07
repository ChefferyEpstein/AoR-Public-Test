// "The Deal": the AoR ident draws the ace, the house lights drop, and the video hands over to a live DOM deck.
// Every frame the deck pose is a pure function of scroll progress (AOR.progress, set in transitions.js),
// pointer/tilt, scroll velocity and time, so scrolling back up simply plays it in reverse.
(() => {
  const root = document.documentElement;
  const AOR = window.AOR;
  if (!root.classList.contains('aor-xp') || !AOR || !AOR.lenis) return;

  const stage = document.querySelector('[data-stage]');
  const header = document.querySelector('[data-header]');
  const video = stage.querySelector('[data-intro]');
  const strobe = stage.querySelector('[data-strobe]');
  const indices = stage.querySelectorAll('.aor-index');
  const copy = stage.querySelectorAll('.hero-copy, .aor-hint, .scroll-cue');
  const slots = [...document.querySelectorAll('#products .product-media')];
  const touch = matchMedia('(hover: none)').matches;
  const { clamp, interpolate } = gsap.utils;
  const lerp = (a, b, t) => a + (b - a) * t;
  const win = (x, a, b) => clamp(0, 1, (x - a) / (b - a));
  const inOut = gsap.parseEase('power2.inOut');
  const accel = gsap.parseEase('power2.in');
  const RATIO = 1537 / 972;          // AoR card proportions, measured from the MP4
  const VID = { w: 1344, cardW: 972, cx: 636, cy: 863.5 }; // front-card centre inside the video frame
  const STACK = [ // idle offsets echo the stacked cards in the ident
    { x: 0, y: 0, r: 0 }, { x: -0.035, y: 0.012, r: -7 }, { x: 0.04, y: -0.014, r: 5.5 },
    { x: -0.018, y: 0.022, r: -3 }, { x: 0.024, y: -0.006, r: 9 },
  ];

  AOR.progress = AOR.progress || { a: 0, b: 0 };
  const intro = { light: 1, spread: 1, done: false };

  // ---------- build the deck: one card per product slot, plus burn cards between them ----------
  const deck = document.createElement('div');
  deck.className = 'aor-deck';
  deck.setAttribute('aria-hidden', 'true');
  document.body.append(deck);

  const layout = [];
  slots.forEach((slot, i) => {
    layout.push({ kind: 'p', slot: i });
    if (i < slots.length - 1 && layout.filter((c) => c.kind === 'b').length < 2) layout.push({ kind: 'b', slot: -1 });
  });
  const n = layout.length;
  const mid = (n - 1) / 2;
  const byCentre = layout.map((_, i) => i).sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid) || p - q);
  let burnCount = 0;

  const cards = layout.map((c, fi) => {
    const el = document.createElement('div');
    el.className = 'aor-card';
    el.innerHTML = '<div class="aor-card__inner"><div class="aor-card__ace"><i class="aor-card__foil"></i></div><div class="aor-card__face"></div></div>';
    const face = el.querySelector('.aor-card__face');
    if (c.kind === 'p') {
      const tile = document.createElement('div');
      tile.className = slots[c.slot].className; // same look as the grid tile it lands on
      tile.innerHTML = slots[c.slot].innerHTML;
      face.append(tile);
      c.tile = tile;
      // the collection artwork rides on its own layer so it can stay anchored while the garment appears around it
      // identity comes from the deal (AOR.deal.hand[slot]), the one object every state of this card is derived from
      const bound = AOR.deal?.hand?.[c.slot];
      if (bound?.design.artwork && bound.design.artContent && bound.product.print) {
        const art = new Image();
        art.className = 'aor-card__art';
        art.alt = '';
        art.decoding = 'async';
        art.src = bound.design.artwork;
        // the artwork is shown as a solid, rectangular printed piece: cropped by its frame, never keyed or cut out
        const frame = document.createElement('div');
        frame.className = 'aor-card__print';
        frame.append(art);
        face.append(frame);
        Object.assign(c, { art, frame });
      }
    } else {
      face.classList.add('aor-card__face--burn');
      face.textContent = 'BURN';
    }
    deck.append(el);
    return { ...c, el, fi, stack: byCentre.indexOf(fi), burn: c.kind === 'b' ? burnCount++ : -1, off: { x: 0, y: 0, r: 0 } };
  });

  // A card is bound to hand[slot] = { design, product }. Its artwork layer, print box and garment tile are ALL
  // dressed from that one object in one pass, so the artwork a card shows is always the garment it becomes.
  // deal.js only changes the hand before scrolling starts, so a bound card never changes identity mid-transition.
  function syncFaces() {
    cards.forEach((c) => {
      if (c.kind !== 'p') return;
      const bound = AOR.deal?.hand?.[c.slot];
      if (!bound) return;
      const slot = slots[c.slot];
      c.tile.className = slot.className;
      c.tile.innerHTML = slot.innerHTML;
      const tileImg = c.tile.querySelector('img');
      if (tileImg) AOR.deal.bindImage(tileImg, bound.product);
      c.bound = bound;
      if (!c.art) return;
      c.art.src = bound.design.artwork;
      Object.assign(c, { artContent: bound.design.artContent, print: bound.product.print });
    });
  }
  syncFaces();
  document.addEventListener('aor:deal', syncFaces);

  // ---------- geometry ----------
  const g = {};
  function measure() {
    g.vw = innerWidth; g.vh = innerHeight;
    g.top = header ? header.offsetHeight : 0;
    g.stageH = g.vh - g.top;
    g.narrow = g.vw <= 900;
    g.cx = g.vw * (g.narrow ? 0.5 : 0.66);
    g.cy = g.top + g.stageH * (g.narrow ? 0.4 : 0.46);
    g.h0 = Math.min(g.stageH * (g.narrow ? 0.5 : 0.6), g.vw * 0.62 * RATIO);
    g.w0 = g.h0 / RATIO;
    const k = g.w0 / VID.cardW; // place the video so its front card sits exactly where the live top card will be
    Object.assign(video.style, {
      width: `${VID.w * k}px`,
      left: `${g.cx - VID.cx * k}px`,
      top: `${g.cy - g.top - VID.cy * k}px`,
    });
    const r0 = slots[0] && slots[0].getBoundingClientRect();
    if (r0) { g.sw = r0.width; g.sh = r0.height; cards.forEach((c) => c.tile && Object.assign(c.tile.style, { width: `${g.sw}px`, height: `${g.sh}px` })); }
    root.style.setProperty('--aor-top', `${g.top}px`);
    haze && haze.resize();
  }

  // ---------- input ----------
  const ptr = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    ptr.x = (e.clientX / g.vw) * 2 - 1;
    ptr.y = (e.clientY / g.vh) * 2 - 1;
  }, { passive: true });
  const onTilt = (e) => {
    if (e.gamma == null) return;
    ptr.x = clamp(-1, 1, e.gamma / 25);
    ptr.y = clamp(-1, 1, (e.beta - 50) / 25);
  };
  let tiltAsked = false;
  function enableTilt() { // iOS needs a user gesture to grant motion access; Android just works
    if (tiltAsked || !touch || !window.DeviceOrientationEvent) return;
    tiltAsked = true;
    const ask = DeviceOrientationEvent.requestPermission;
    if (typeof ask === 'function') ask().then((s) => s === 'granted' && addEventListener('deviceorientation', onTilt)).catch(() => {});
    else addEventListener('deviceorientation', onTilt);
  }

  // ---------- shuffle: riffle cut + a single strobe hit ----------
  let busy = false, stackShift = 0, shuffleTl = null;
  let paused = false;
  // Scrolling into the shop commits the hand. If a riffle is still in flight, drop it (its pending deal never fires)
  // and ease the cards home, so a shuffle can't shove cards around or re-deal behind the visitor mid-transition.
  function settleShuffle() {
    shuffleTl?.kill();
    shuffleTl = null;
    gsap.to(cards.map((c) => c.off), { x: 0, y: 0, r: 0, duration: 0.25, ease: 'power2.out', overwrite: true, onComplete: () => { busy = false; } });
  }
  const motionButton = stage.querySelector('[data-motion]');
  motionButton?.addEventListener('click', () => {
    paused = !paused;
    lightsDown();
    motionButton.setAttribute('aria-pressed', String(paused));
    motionButton.textContent = paused ? 'Resume motion' : 'Pause motion';
  });
  function shuffle() {
    enableTilt();
    // a shuffle deals a new hand, so it is off once scrolling into the shop has begun (the hand is locked)
    if (paused || busy || !intro.done || AOR.deal?.locked() || AOR.progress.a > 0.5) return;
    busy = true;
    gsap.fromTo(strobe, { opacity: 0.5 }, { opacity: 0, duration: 0.35, ease: 'power2.out' });
    const tl = (shuffleTl = gsap.timeline({ onComplete: () => { busy = false; shuffleTl = null; } }));
    cards.forEach((c, i) => {
      const dir = i % 2 ? 1 : -1;
      tl.to(c.off, { x: dir * g.w0 * 0.78, y: -g.h0 * 0.05, r: dir * 16, duration: 0.22, ease: 'power3.out' }, i * 0.03)
        .to(c.off, { x: 0, y: 0, r: 0, duration: 0.5, ease: 'back.out(1.7)' }, 0.3 + i * 0.05);
    });
    // at the apex of the riffle (cards apart, backs up) the shuffle commits its new deal
    tl.call(() => { stackShift = (stackShift + 1) % n; AOR.deal?.next(); }, null, 0.3);
  }
  stage.addEventListener('click', (e) => {
    if (e.target.closest('a, button:not([data-shuffle])')) return;
    shuffle();
  });

  // ---------- intro: ident draws the ace, then lights down ----------
  function lightsDown() {
    if (intro.done) return;
    intro.done = true;
    deck.classList.add('is-live');
    stage.dataset.phase = 'live';
    gsap.timeline()
      .to(video, { opacity: 0, duration: 0.12 }, 0)
      .to(intro, { light: 0, duration: 0.08, ease: 'none' }, 0)
      .fromTo(strobe, { opacity: 0.85 }, { opacity: 0, duration: 0.4, ease: 'power2.out' }, 0.1)
      .fromTo(intro, { spread: 0 }, { spread: 1, duration: 1.1, ease: 'elastic.out(1, 0.45)' }, 0.12)
      .from(copy, { opacity: 0, y: 18, stagger: 0.08, duration: 0.6, ease: 'power3.out', clearProps: 'transform' }, 0.35)
      .call(() => video.pause());
  }
  stage.dataset.phase = 'intro';
  if (scrollY > 8) lightsDown();
  else {
    // Let the complete six-second ident play; scrolling can skip directly into the deck.
    ['ended', 'error'].forEach((ev) => video.addEventListener(ev, lightsDown));
    video.play().catch(lightsDown);
    setTimeout(lightsDown, 7000);
    AOR.lenis.on('scroll', ({ scroll }) => scroll > 8 && lightsDown());
  }

  // ---------- haze: small WebGL pass, the ShaderGradient palette as stage light through smoke ----------
  const haze = (() => {
    const canvas = stage.querySelector('[data-haze]');
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return null;
    const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const fs = `precision mediump float;uniform vec2 r,m;uniform float t,k;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p*=2.03;a*=.5;}return v;}
void main(){vec2 p=(gl_FragCoord.xy-.5*r)/r.y;
vec2 q=vec2(fbm(p*1.2+t*.05),fbm(p*1.2-t*.04+4.));
float f=fbm(p*1.5+q*2.4+vec2(t*.03,0.)+m*.12);
float b=0.;for(int i=0;i<3;i++){float fi=float(i);vec2 d=p-vec2(-.75+fi*.75,.62);
float a=atan(d.x,-d.y)-sin(t*.32+fi*2.1)*.5;b+=smoothstep(.1,0.,abs(a))*smoothstep(1.7,0.,length(d));}
vec3 col=mix(vec3(1.,.314,.02),vec3(.859,.729,.584),smoothstep(.3,.75,f));
col=mix(col,vec3(.816,.737,.882),smoothstep(.55,.85,q.x));
vec3 o=vec3(.039)+col*(pow(f,2.4)*.5+b*(.25+.6*f))*k;
o+=(h(gl_FragCoord.xy+fract(t*7.)*91.)-.5)*.1*k;gl_FragColor=vec4(o,1.);}`;
    const prog = gl.createProgram();
    [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].forEach(([type, src]) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); gl.attachShader(prog, s);
    });
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const u = Object.fromEntries(['r', 'm', 't', 'k'].map((x) => [x, gl.getUniformLocation(prog, x)]));
    const scale = touch ? 0.35 : 0.5; // ponytail: fixed render scale, add adaptive scaling if low-end devices drop frames
    return {
      resize() {
        canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
        canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
        gl.viewport(0, 0, canvas.width, canvas.height);
      },
      render(t, k) {
        gl.uniform2f(u.r, canvas.width, canvas.height);
        gl.uniform2f(u.m, ptr.sx, -ptr.sy);
        gl.uniform1f(u.t, t);
        gl.uniform1f(u.k, 1);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        canvas.style.opacity = k;
      },
      hide() { canvas.style.opacity = 0; },
    };
  })();

  // ---------- artwork -> garment ----------
  // The artwork's printed area (artContent) is mapped from "centred on the card" to "the print box on the garment
  // mockup" (print), in face coordinates. The garment tile fades in around it; the artwork fades last, once it
  // sits exactly on the mockup's own print. Never warped: uniform scale, width-matched (aspects agree within ~6%).
  // The frame clips the artwork to its content box (plus a hairline of breathing room, CROP < 0), so no blank canvas shows around it.
  const CROP = -0.01; // negative = a 1% margin so faint edge pixels (left edge, bottom lettering) are never clipped
  const smooth = (t) => t * t * (3 - 2 * t);
  function dress(c, w, h, s, m) {
    const nw = c.art.naturalWidth || 306, nh = c.art.naturalHeight || 394;
    const [bx0, by0, bx1, by1] = c.artContent;
    const ix = (bx1 - bx0) * CROP, iy = (by1 - by0) * CROP;
    const [cx0, cy0, cx1, cy1] = [bx0 + ix, by0 + iy, bx1 - ix, by1 - iy];
    const aspect = ((cx1 - cx0) * nw) / ((cy1 - cy0) * nh);
    const w0 = Math.min(w * 0.84, h * 0.84 * aspect), h0 = w0 / aspect;
    const L = Math.min(g.sw, g.sh); // square mockup, object-fit: contain inside the tile
    const map = (fx, fy) => [w / 2 + ((g.sw - L) / 2 + fx * L - g.sw / 2) * s, h / 2 + ((g.sh - L) / 2 + fy * L - g.sh / 2) * s];
    const [px0, py0] = map(c.print[0], c.print[1]);
    const [px1, py1] = map(c.print[2], c.print[3]);
    const tw = lerp(w0, px1 - px0, m);
    const tx = lerp((w - w0) / 2, px0, m);
    const tcy = lerp(h / 2, (py0 + py1) / 2, m);
    const k = tw / ((cx1 - cx0) * nw);
    const th = (cy1 - cy0) * nh * k;
    // frame = the cropped print; image offset inside it so only the content box shows
    c.frame.style.width = `${tw}px`;
    c.frame.style.height = `${th}px`;
    c.art.style.width = `${nw * k}px`;
    c.art.style.height = `${nh * k}px`;
    c.art.style.transform = `translate3d(${-cx0 * nw * k}px,${-cy0 * nh * k}px,0)`;
    // resolve: on the print, the artwork eases back a touch and crossfades into the garment's own print below it
    const r = smooth(win(m, 0.7, 1));
    c.frame.style.transform = `translate3d(${tx}px,${tcy - th / 2}px,0) scale(${1 - 0.03 * r})`;
    c.frame.style.opacity = 1 - r;
    c.tile.style.opacity = smooth(win(m, 0.12, 0.6));
  }

  // ---------- frame ----------
  let vel = 0, hazeT = 0, motionTime = 0, landed = false, hdrLights = -1;
  measure();
  addEventListener('resize', measure);
  new ResizeObserver(() => { measure(); ScrollTrigger.refresh(); }).observe(header);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => location.reload());

  gsap.ticker.add((time, dt) => {
    if (document.hidden) return;
    if (shuffleTl && AOR.deal?.locked()) settleShuffle();
    if (!paused) motionTime += Math.min(dt, 64) / 1000;
    const { a, b } = AOR.progress;
    ptr.sx += ((paused ? 0 : ptr.x) - ptr.sx) * 0.08;
    ptr.sy += ((paused ? 0 : ptr.y) - ptr.sy) * 0.08;
    vel += (clamp(-60, 60, AOR.lenis.velocity || 0) - vel) * 0.1;

    const fan = inOut(win(a, 0.02, 0.3));
    const calm = inOut(win(a, 0.62, 0.98));
    const lights = (1 - intro.light) * (1 - calm);

    // stage lighting: white ident -> black room -> paper shop
    const bg = interpolate(interpolate('#0a0a0a', '#f4f4f0', calm), '#ffffff', intro.light);
    stage.style.setProperty('--aor-bg', bg);
    stage.style.setProperty('--aor-ink', interpolate('#f4f4f0', '#0a0a0a', Math.max(calm, intro.light)));
    // The header bar is part of the same light state: its colours are mixed from `lights`, the dark share of the very same
    // mix that produced `bg` above (dark weight = (1-intro.light)*(1-calm)), every frame. One progress value, no CSS timer.
    if (lights !== hdrLights) { hdrLights = lights;
      const mixRGBA = (x, y) => x.map((v, i) => v + (y[i] - v) * lights).join(',');
      root.style.setProperty('--aor-hdr-bg', `rgba(${mixRGBA([244, 244, 240, 0.94], [10, 10, 10, 0.82])})`);
      root.style.setProperty('--aor-hdr-ink', `rgb(${mixRGBA([10, 10, 10], [244, 244, 240])})`);
      root.style.setProperty('--aor-hdr-line', `rgb(${mixRGBA([216, 216, 208], [29, 29, 29])})`); }
    indices.forEach((el) => { el.style.opacity = 0.85 * lights; });
    if (intro.done) copy.forEach((el) => { el.style.opacity = 1 - win(a, 0.45, 0.62); });

    if (haze) {
      if (!paused) hazeT += (Math.min(dt, 64) / 1000) * (1 + Math.abs(vel) * 0.04);
      if (lights > 0.01 && b < 1) haze.render(hazeT, lights * lights); else haze.hide(); // squared so the room clears ahead of the paper
    }

    if (b >= 1) { if (!landed) { landed = true; deck.style.visibility = 'hidden'; } return; }
    if (landed) { landed = false; deck.style.visibility = ''; }

    const rects = calm > 0 ? slots.map((s) => s.getBoundingClientRect()) : null;
    const spreadDeg = (g.narrow ? 8 : 12) + clamp(-8, 8, vel * 0.25);
    const R = g.h0 * (g.narrow ? 1.05 : 1.15);
    const t = motionTime;
    const tiltX = -ptr.sy * 12 * (1 - calm);
    const tiltY = ptr.sx * 18 * (1 - calm);

    cards.forEach((c) => {
      const s = (c.stack + stackShift) % n;
      const st = STACK[s % STACK.length];
      const sp = intro.spread;
      const bob = Math.sin(t * 0.9 + s * 1.7) * g.h0 * 0.012 * (1 - calm);
      const sway = Math.sin(t * 0.7 + s) * 1.2 * (1 - calm);

      // idle stack pose (pointer parallax pushes deeper cards further)
      const sx = g.cx + st.x * g.w0 * sp + ptr.sx * s * 6;
      const sy = g.cy + st.y * g.h0 * sp + ptr.sy * s * 4;
      // fanned hand pose, splayed further by scroll velocity
      const th = ((c.fi - mid) * spreadDeg * Math.PI) / 180;
      const fx = g.cx + Math.sin(th) * R;
      const fy = g.cy + R - Math.cos(th) * R;

      let x = lerp(sx, fx, fan) + c.off.x;
      let y = lerp(sy, fy, fan) + c.off.y + bob;
      let rot = lerp(st.r * sp, (th * 180) / Math.PI, fan) + c.off.r + sway;
      let w = g.w0, h = g.h0, flip = 0, z = lerp(-s * 14 * sp, 0, fan);

      if (c.kind === 'b') { // burn cards get flicked off the table
        const k = accel(win(a, 0.4 + c.burn * 0.06, 0.58 + c.burn * 0.06));
        const dir = c.burn % 2 ? 1 : -1;
        x += dir * g.vw * (g.narrow ? 0.7 : 0.4) * k;
        y -= g.vh * 1.15 * k;
        rot += dir * 55 * k;
      } else {
        flip = inOut(win(a, 0.3 + c.slot * 0.07, 0.42 + c.slot * 0.07)) * 180;
        if (rects) { // straighten into the grid's columns, sized like the tiles they become
          const r = rects[c.slot];
          // held small in a row (a cascade on one-column mobile) so the shop heading can pass, then grow onto the tile
          const land = inOut(b);
          const size = lerp(g.narrow ? 0.5 : 0.58, 1, land);
          const off = c.slot - (slots.length - 1) / 2;
          const rowX = r.left + r.width / 2 + (g.narrow ? off * r.width * 0.16 : 0);
          const rowY = g.cy + (g.narrow ? off * 26 : 0);
          x = lerp(x, lerp(rowX, r.left + r.width / 2, land), calm);
          y = lerp(y, lerp(rowY, r.top + r.height / 2, land), calm);
          rot = lerp(rot, g.narrow ? off * 4 * (1 - land) : 0, calm);
          w = lerp(w, r.width * size, calm);
          h = lerp(h, r.height * size, calm);
        }
      }

      const el = c.el;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      // Stack depth belongs to the card instance, not to the scroll phase: s is this card's place in the deck, so
      // front stays front and back stays back through fan, flip, artwork -> garment and landing. It only changes on
      // an intentional shuffle (the riffle visibly moves the cards), never as a side effect of scrolling.
      el.style.zIndex = n - s;
      el.style.transform = `translate3d(${x - w / 2}px,${y - h / 2}px,${z}px) rotateZ(${rot}deg) rotateX(${tiltX}deg) rotateY(${tiltY + flip}deg)`;
      const cover = Math.max(w / g.sw, h / g.sh);
      if (c.tile) c.tile.style.transform = `translate(-50%,-50%) scale(${cover})`; // tile kept at true size, scaled to cover: no reflow, no jump on hand-off
      if (c.art) dress(c, w, h, cover, inOut(win(a, 0.6, 0.92)));
      el.style.setProperty('--w', `${w}px`);
      el.style.setProperty('--r', `${lerp(w * 0.045, 0, calm)}px`);
      el.style.setProperty('--foil', ((0.2 + 0.7 * Math.hypot(ptr.sx, ptr.sy)) * (1 - fan)).toFixed(3));
      el.style.setProperty('--fx', `${50 + ptr.sx * 45}%`);
      el.style.setProperty('--fy', `${40 + ptr.sy * 45}%`);
      el.style.setProperty('--fa', `${(t * 25) % 360}deg`);
    });
  });
})();
