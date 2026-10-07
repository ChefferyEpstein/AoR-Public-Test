// The deal: which three real catalogue products the deck shows and lands as the first three shop tiles.
// A completed shuffle deals a new hand; once the visitor starts scrolling into the shop the hand is locked,
// so the cards they saw are exactly the products they land on.
(() => {
  const AOR = (window.AOR = window.AOR || {});
  const CATALOGUE = window.AOR_CATALOGUE || [];
  const grid = document.querySelector('#products');
  if (!grid) return;
  const cards = [...grid.querySelectorAll('.product-card')].slice(0, 3);

  // Dealable = real products that have EVERY asset the hero needs (artwork + its content box, garment mockup, print
  // box). Anything missing one is left out of the pool rather than shown half-dressed. product.available === false
  // (a future stock flag) also drops a product.
  const pool = CATALOGUE.flatMap((design) => (design.artwork && design.artContent ? design.products
    .filter((p) => p.imageSource && p.print && p.available !== false)
    .map((product) => ({ design, product })) : []));
  pool.forEach(({ design }) => { new Image().src = design.artwork; }); // warm the cache so a re-dressed card never flashes

  // Selection weight. Every product is equal today (no featured / new / best-seller / collab data exists, so none is
  // invented). Hook for later: add e.g. `weight: 3` to a product or design in catalogue.js, or derive it here from
  // real flags such as product.featured, product.releasedAt, design.collab or sales data.
  const weightOf = ({ design, product }) => product.weight ?? design.weight ?? 1;

  // Weighted sample without replacement (Efraimidis-Spirakis keys), preferring one product per design.
  function pick(n, rng = Math.random) {
    const ranked = pool
      .map((item) => ({ item, key: rng() ** (1 / Math.max(weightOf(item), 1e-6)) }))
      .sort((a, b) => b.key - a.key)
      .map((r) => r.item);
    const hand = [];
    const seen = new Set();
    for (const it of ranked) if (hand.length < n && !seen.has(it.design)) { hand.push(it); seen.add(it.design); }
    for (const it of ranked) if (hand.length < n && !hand.includes(it)) hand.push(it); // fewer designs than slots
    return hand;
  }

  const GARMENT = { tee: 'Organic cotton tee', hoodie: 'Essential eco hoodie' };
  // Local mockup first, CDN until the local JPG exists. Used for the shop tile AND the deck's copy of it: an
  // onerror *property* is lost when hero.js copies the tile's innerHTML, so each image gets its own listener.
  function bindImage(img, product) {
    img.addEventListener('error', () => { if (img.src !== product.imageSource) img.src = product.imageSource; }, { once: true });
    img.src = product.image;
  }
  function render(card, { design, product }, i) {
    const name = product.title.split(' - ')[0];
    const href = `products/product.html?design=${design.slug}&garment=${product.garment}`;
    card.dataset.handle = product.handle;
    card.querySelectorAll('a[href*="product.html"]').forEach((a) => { a.href = href; });
    const img = card.querySelector('.product-media img');
    img.removeAttribute('onerror');
    bindImage(img, product);
    img.alt = `${name} ${GARMENT[product.garment].toLowerCase()} in white, front: the ${design.live} artwork printed on the chest (current live-store mockup).`;
    card.querySelector('.artwork-index').textContent = `0${i + 1} / ART = SPACE`;
    card.querySelector('h3 a').textContent = name;
    card.querySelector('.product-meta p').textContent = GARMENT[product.garment];
    card.querySelector('.product-status').textContent = `From £${product.observed.fromGBP}`; // current-store snapshot; shop.js replaces with live prices
  }

  AOR.deal = {
    pool,
    weightOf,
    pick,
    bindImage,
    // locked from the moment scrolling into the shop begins (also covers anchor jumps straight to the shop)
    locked: () => !!AOR.progress && (AOR.progress.a > 0.02 || AOR.progress.b > 0),
    // The single source of truth for card identity: hand[slot] = { design, product }. Card faces, artwork layers,
    // print boxes and shop tiles are all derived from hand[slot], never from parallel arrays or the DOM.
    hand: cards.map((c) => CATALOGUE.byHandle?.(c.dataset.handle) || null),
    current: cards.map((c) => c.dataset.handle),
    next(rng) {
      if (this.locked() || pool.length < cards.length) return false;
      let hand = pick(cards.length, rng);
      // a shuffle should look like a new deal: re-roll (a few times) if it would land the hand we already have
      for (let t = 0; t < 8 && hand.every((h, i) => h.product.handle === this.current[i]); t++) hand = pick(cards.length, rng);
      hand.forEach((item, i) => render(cards[i], item, i));
      this.hand = hand;
      this.current = hand.map((h) => h.product.handle);
      document.dispatchEvent(new CustomEvent('aor:deal', { detail: { handles: this.current } }));
      return true;
    },
  };
})();
