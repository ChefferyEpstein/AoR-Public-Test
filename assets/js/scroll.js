// Smooth scroll (Lenis) wired into GSAP's ticker so ScrollTrigger and Lenis share one clock.
window.AOR = window.AOR || {};
(() => {
  const root = document.documentElement;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  root.classList.add('aor-xp');
  if (!window.gsap || !window.ScrollTrigger || !window.Lenis) { root.classList.remove('aor-xp'); return; }

  gsap.registerPlugin(ScrollTrigger);
  const header = document.querySelector('[data-header]');
  const headerOffset = () => -(header ? header.offsetHeight : 0);

  const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, anchors: { offset: headerOffset() } });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  AOR.lenis = lenis;
})();
