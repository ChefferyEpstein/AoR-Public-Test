// Product page: one design per URL (?design=<slug>&garment=tee|hoodie), filled from the verified catalogue.
(() => {
  const params = new URLSearchParams(location.search);
  const designs = (window.AOR_CATALOGUE || []).filter((d) => d.slug && d.artwork);
  const design = designs.find((d) => d.slug === params.get('design')) || designs[0];
  if (!design) return;
  const product = design.products.find((p) => p.garment === params.get('garment')) || design.products[0];
  const $ = (s) => document.querySelector(s);
  const garmentName = product.title.split(' - ').slice(1).join(' - ');
  const name = product.title.split(' - ')[0];

  $('[data-product-title]').textContent = name;
  $('[data-garment-label]').textContent = garmentName;
  document.title = `${name} ${product.garment} · Ace of Raves`;

  const garment = $('[data-garment]');
  garment.onerror = () => { garment.onerror = null; garment.src = product.imageSource; }; // CDN until the local JPG exists
  garment.src = product.image;
  garment.alt = `${name} ${garmentName.toLowerCase()} in white, front: the ${design.live} artwork on the chest (current live-store mockup).`;
  const art = $('[data-artwork]');
  if (art.getAttribute('src') !== design.artwork) { art.src = design.artwork; art.alt = `${design.live} artwork.`; }

  // observed snapshot of the current store (see catalogue.js); shop.js replaces it with live data when configured
  const o = product.observed;
  $('[data-fact-price]').textContent = `From £${o.fromGBP}`;
  $('[data-fact-sizes]').textContent = o.sizes.replace('-', ' to ');
  $('[data-fact-colours]').textContent = String(o.colours);
  $('[data-live-link]').href = product.url;

  document.querySelectorAll('[data-garment-options] a').forEach((a) => {
    a.href = `?design=${design.slug}&garment=${a.dataset.garment}`;
    a.toggleAttribute('aria-current', a.dataset.garment === product.garment);
    if (a.hasAttribute('aria-current')) a.setAttribute('aria-current', 'page');
  });
  document.querySelectorAll('[data-design]').forEach((a) => {
    a.href = `?design=${a.dataset.design}&garment=${product.garment}`;
    if (a.dataset.design === design.slug) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
})();
