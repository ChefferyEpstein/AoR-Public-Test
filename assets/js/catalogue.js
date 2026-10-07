// Verified catalogue mapping (M03). Source of truth for live identity: https://aceofraves.co.uk/products.json,
// read 6 Oct 2026 and visually matched against the live white-front mockups. Local slugs are kept as URL ids
// (products/product.html?design=<slug>); live names/handles come from the store and must not be renamed here.
// NOTE (M05D): the live Shopify catalogue is TEMPORARILY NON-CANONICAL (Printful sync / repricing in progress).
// Do not infer final mappings from live handles until the offering audit. This file is the ONE place handles, product
// ids, images, prices and print boxes live: the hero (hero.js), the deal (deal.js), the grid, the PDP (product.js)
// and shop.js all read it, so replacing entries here needs no change to hero choreography or PDP logic.
// A product only enters the hero deal if it has every asset it needs (see deal.js pool); optional per-product /
// per-design flags the deal understands: weight, available (false = excluded).
// Prices and colour counts are an OBSERVED snapshot of the current store, not future-supplier pricing.
// Garment images: live-store mockups (Shopify CDN, white front, 1200px). Print boxes are measured from those
// mockups as [left, top, right, bottom] fractions and are provisional: the new supplier's print size is unconfirmed.
// artContent = non-white bounding box of the Canva artwork PNG (same fraction format); its aspect matches the
// live print box within ~1% for Starry Set and Creation of Bang, ~6% for Mona Liza.
(() => {
  const root = new URL('../../', document.currentScript.src).href;
  const CDN = 'https://cdn.shopify.com/s/files/1/0974/8666/8125/files/';
  const product = (garment, title, handle, id, cdnFile, print, from) => ({
    garment, title, handle, productId: id,
    url: `https://aceofraves.co.uk/products/${handle}`,
    // `image` is what the pages request. Until the garment JPGs are saved into assets/images/garments/ it is the CDN
    // mockup itself (no failing local request); switch to `${root}assets/images/garments/<design>-<garment>.jpg` then.
    image: `${CDN}${cdnFile}&width=1200`,
    imageSource: `${CDN}${cdnFile}&width=1200`,
    print,
    observed: { date: '2026-10-06', fromGBP: from, sizes: 'S-2XL', colours: garment === 'tee' ? 15 : 4 },
  });

  window.AOR_CATALOGUE = [
    { slug: 'starry-night', live: 'Starry Set', artwork: `${root}assets/images/art-space/starry-night.png`, canvaPage: 6, artContent: [0.0131, 0.0508, 0.9477, 0.6142],
      products: [
        product('tee', 'Starry Set - Unisex organic cotton t-shirt', 'starry-set-unisex-organic-cotton-t-shirt', 15539907297629,
          'unisex-organic-cotton-t-shirt-white-front-68954af289658.jpg?v=1754614620', [0.345, 0.2767, 0.64, 0.5067], 27),
        product('hoodie', 'Starry Set - Unisex essential eco hoodie - Premium', 'starry-set-unisex-essential-eco-hoodie-premium', 15539902316893,
          'unisex-essential-eco-hoodie-white-front-68954ae06a32d.jpg?v=1754614519', [0.35, 0.2867, 0.6367, 0.51], 56),
      ] },
    { slug: 'gun-fingers', live: 'The Creation of Bang', artwork: `${root}assets/images/art-space/gun-fingers.png`, canvaPage: 11, artContent: [0.0392, 0.1954, 0.9118, 0.7411],
      products: [
        product('tee', 'The Creation of Bang - Unisex organic cotton t-shirt', 'the-creation-of-bang-unisex-organic-cotton-t-shirt', 15539908182365,
          'unisex-organic-cotton-t-shirt-white-front-68954af2df3f7.jpg?v=1754614637', [0.34, 0.2783, 0.6283, 0.51], 27),
        product('hoodie', 'Creation of Bang - Unisex essential eco hoodie - Premium', 'creation-of-bang-unisex-essential-eco-hoodie-premium', 15539904446813,
          'unisex-essential-eco-hoodie-white-front-68954ae0c4ae4.jpg?v=1754614559', [0.35, 0.275, 0.6333, 0.5033], 56),
      ] },
    { slug: 'masked-mona', live: 'Mona Liza', artwork: `${root}assets/images/art-space/masked-mona.png`, canvaPage: 18, artContent: [0.1209, 0.0381, 0.8333, 0.835],
      products: [
        product('tee', 'Mona Liza - Unisex organic cotton t-shirt', 'mona-liza-unisex-organic-cotton-t-shirt', 15539906347357,
          'unisex-organic-cotton-t-shirt-white-front-68954af2469e7.jpg?v=1754614600', [0.3867, 0.2617, 0.5933, 0.5783], 27),
        // live handle is the generic one; do not rename it on the store
        product('hoodie', 'Mona Liza - Unisex essential eco hoodie - Premium', 'unisex-essential-eco-hoodie', 15539921224029,
          'unisex-essential-eco-hoodie-white-front-68954c5940cf3.jpg?v=1754614886', [0.4217, 0.31, 0.5717, 0.6283], 56),
      ] },
    // Live but has no local Canva artwork yet, so it is not in the deck or the local grid.
    { slug: null, live: 'Gurnica', artwork: null, canvaPage: null,
      products: [
        { garment: 'tee', title: 'Gurnica - Unisex organic cotton t-shirt', handle: 'gurnica-unisex-organic-cotton-t-shirt', productId: 15539905200477, url: 'https://aceofraves.co.uk/products/gurnica-unisex-organic-cotton-t-shirt' },
        { garment: 'hoodie', title: 'Gurnica - Unisex essential eco hoodie - Premium', handle: 'gurnica-unisex-essential-eco-hoodie-premium', productId: 15539903758685, url: 'https://aceofraves.co.uk/products/gurnica-unisex-essential-eco-hoodie-premium' },
      ] },
  ];
  window.AOR_CATALOGUE.bySlug = (slug) => window.AOR_CATALOGUE.find((a) => a.slug === slug);
  window.AOR_CATALOGUE.byHandle = (handle) => {
    for (const design of window.AOR_CATALOGUE) {
      const product = design.products.find((p) => p.handle === handle);
      if (product) return { design, product };
    }
    return null;
  };
})();
