// Scroll choreography: maps scroll onto two phases the deck reads every frame.
//   a: 0 -> 1 while the stage is pinned (fan, flip, burn, lights up, straighten)
//   b: 0 -> 1 as the shop grid rises to meet the cards (landing / hand-off)
(() => {
  const root = document.documentElement;
  const AOR = window.AOR;
  if (!root.classList.contains('aor-xp') || !AOR || !AOR.lenis) return;

  const hero = document.querySelector('[data-hero]');
  const grid = document.querySelector('#products');
  if (!hero || !grid) return;

  // touch gets a shorter track: same story, less thumb work
  root.style.setProperty('--aor-track', matchMedia('(hover: none)').matches ? '270vh' : '360vh');
  root.classList.add('aor-dealing');

  AOR.progress = AOR.progress || { a: 0, b: 0 };
  const top = () => `top top+=${document.querySelector('[data-header]')?.offsetHeight || 0}`;

  ScrollTrigger.create({
    trigger: hero, start: top, end: 'bottom bottom',
    onUpdate: (st) => { AOR.progress.a = st.progress; },
  });
  ScrollTrigger.create({
    // cards finish landing exactly where the #shop anchor (nav, 'Enter the shop') stops, so those links never strand them mid-air
    trigger: hero, start: 'bottom bottom', endTrigger: '#shop', end: () => `top top+=${(document.querySelector('[data-header]')?.offsetHeight || 0) + (parseFloat(getComputedStyle(document.querySelector('#shop')).scrollMarginTop) || 0) + 2}`,
    onUpdate: (st) => {
      AOR.progress.b = st.progress;
      root.classList.toggle('aor-dealing', st.progress < 1); // real tiles take over once every card has landed
    },
  });
  ScrollTrigger.refresh();
})();
