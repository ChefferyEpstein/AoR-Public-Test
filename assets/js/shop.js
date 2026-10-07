// Shopify Storefront cart (Printful fulfils via Shopify). Dormant until shop-config.js has a domain + token,
// so the site keeps working in preview mode. Reuses the existing Bag drawer markup from app.js.
(() => {
  const cfg = window.AOR_SHOP || {};
  if (!cfg.domain || !cfg.token) return;
  document.querySelector('[data-cart-note]')?.setAttribute('hidden', ''); // the bag checks out itself once configured

  const API = `https://${cfg.domain}/api/2026-10/graphql.json`;
  const KEY = 'aor-cart-id';
  const $ = (s, r = document) => r.querySelector(s);
  const money = (m) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: m.currencyCode }).format(m.amount);
  const saved = { get() { try { return localStorage.getItem(KEY); } catch { return null; } },
    set(v) { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch {} } };

  async function gql(query, variables) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': cfg.token },
      body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    if (!res.ok || json.errors) throw new Error(json.errors?.[0]?.message || `Shop error ${res.status}`);
    return json.data;
  }

  const CART = 'id checkoutUrl totalQuantity cost{totalAmount{amount currencyCode}} lines(first:50){nodes{id quantity cost{totalAmount{amount currencyCode}} merchandise{...on ProductVariant{title image{url altText} product{title}}}}}';
  const PRODUCT = 'query($h:String!){product(handle:$h){title variants(first:50){nodes{id title availableForSale price{amount currencyCode}}}}}';
  const products = {};
  // local design slug (+ garment) -> verified live Shopify handle, see catalogue.js; the tee is the default garment
  const handleFor = (slug, garment) => {
    const design = window.AOR_CATALOGUE?.bySlug(slug);
    return (design?.products.find((p) => p.garment === garment) || design?.products[0])?.handle || slug;
  };
  const getProduct = (handle) => (products[handle] ||= gql(PRODUCT, { h: handle }).then((d) => d.product));

  // ---------- bag ----------
  let cart = null;
  const checkout = $('.cart-footer .button');

  function render() {
    const items = $('[data-cart-items]');
    if (!items) return;
    items.querySelectorAll('.cart-line').forEach((n) => n.remove());
    const lines = cart ? cart.lines.nodes : [];
    const empty = $('[data-cart-empty]');
    if (empty) empty.hidden = lines.length > 0;
    lines.forEach((l) => {
      const row = document.createElement('div');
      row.className = 'cart-line';
      const name = document.createElement('span');
      const variant = l.merchandise.title === 'Default Title' ? '' : ` / ${l.merchandise.title}`;
      name.textContent = `${l.merchandise.product.title}${variant}${l.quantity > 1 ? ` × ${l.quantity}` : ''}`;
      const img = l.merchandise.image;
      if (img) row.append(Object.assign(document.createElement('img'), { src: `${img.url}${img.url.includes('?') ? '&' : '?'}width=120`, alt: '', className: 'cart-thumb', width: 56, height: 56 }));
      const price = document.createElement('strong');
      price.textContent = money(l.cost.totalAmount);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'cart-remove';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${name.textContent}`);
      remove.addEventListener('click', () => removeLine(l.id, remove));
      row.append(name, price, remove);
      items.append(row);
    });
    document.querySelectorAll('[data-cart-count]').forEach((n) => { n.textContent = String(cart ? cart.totalQuantity : 0); });
    const total = $('[data-cart-total]');
    if (total) total.textContent = cart ? Number(cart.cost.totalAmount.amount).toFixed(2) : '0.00';
    if (checkout) { checkout.disabled = !lines.length; checkout.textContent = 'Checkout'; }
  }

  async function add(merchandiseId) {
    await ready; // never create a second cart while the saved one is still loading
    const lines = [{ merchandiseId, quantity: 1 }];
    const d = cart
      ? await gql(`mutation($c:ID!,$l:[CartLineInput!]!){cartLinesAdd(cartId:$c,lines:$l){cart{${CART}} userErrors{message}}}`, { c: cart.id, l: lines })
      : await gql(`mutation($l:[CartLineInput!]!){cartCreate(input:{lines:$l}){cart{${CART}} userErrors{message}}}`, { l: lines });
    const r = d.cartLinesAdd || d.cartCreate;
    if (r.userErrors.length || !r.cart) throw new Error(r.userErrors[0]?.message || 'Could not add to bag');
    cart = r.cart;
    saved.set(cart.id);
    render();
  }

  checkout?.addEventListener('click', () => { if (cart) location.href = cart.checkoutUrl; });

  async function removeLine(lineId, button) {
    button.disabled = true;
    try {
      const d = await gql(`mutation($c:ID!,$l:[ID!]!){cartLinesRemove(cartId:$c,lineIds:$l){cart{${CART}} userErrors{message}}}`, { c: cart.id, l: [lineId] });
      if (d.cartLinesRemove.userErrors.length) throw new Error(d.cartLinesRemove.userErrors[0].message);
      cart = d.cartLinesRemove.cart;
      render();
      $('[data-cart-close]')?.focus();
    } catch { button.disabled = false; button.textContent = 'Try again'; }
  }

  const id = saved.get();
  const ready = id
    ? gql(`query($id:ID!){cart(id:$id){${CART}}}`, { id })
      .then((d) => { cart = d.cart; if (!cart) saved.set(null); render(); })
      .catch(() => {})
    : Promise.resolve();

  // ---------- grid: real prices replace "Preview" ----------
  const priceGrid = () => document.querySelectorAll('#products .product-card').forEach((card) => {
    const status = card.querySelector('.product-status');
    const handle = card.dataset.handle;
    if (!handle || !status) return;
    getProduct(handle).then((p) => {
      if (!p || card.dataset.handle !== handle) return; // a newer deal replaced this card meanwhile
      const live = p.variants.nodes.filter((v) => v.availableForSale);
      if (!live.length) { status.textContent = 'Sold out'; return; }
      const from = live.reduce((a, v) => (Number(v.price.amount) < Number(a.price.amount) ? v : a));
      status.textContent = money(from.price);
    }).catch(() => {});
  });
  priceGrid();
  document.addEventListener('aor:deal', priceGrid); // a shuffle deals new products into the grid

  // ---------- product page: size picker + add to bag ----------
  const slug = $('[data-design][aria-current]')?.dataset.design;
  const copy = $('.product-detail-copy');
  if (!slug || !copy) return;
  getProduct(handleFor(slug, new URLSearchParams(location.search).get('garment'))).then((p) => {
    if (!p) return;
    const variants = p.variants.nodes;
    const form = document.createElement('form');
    form.className = 'buy-form';
    const label = document.createElement('label');
    label.textContent = 'Size';
    const select = document.createElement('select');
    variants.forEach((v) => select.add(new Option(`${v.title}${v.availableForSale ? '' : ' (sold out)'}`, v.id, false, false)));
    variants.forEach((v, i) => { select.options[i].disabled = !v.availableForSale; });
    const firstLive = variants.findIndex((v) => v.availableForSale);
    if (firstLive >= 0) select.selectedIndex = firstLive;
    label.append(select);
    if (variants.length === 1) label.hidden = true; // single-variant product: nothing to choose
    const button = document.createElement('button');
    button.className = 'button button--primary';
    button.type = 'submit';
    const sync = () => {
      const v = variants[select.selectedIndex];
      button.disabled = !v || !v.availableForSale;
      button.textContent = button.disabled ? 'Sold out' : `Add to bag / ${money(v.price)}`;
    };
    select.addEventListener('change', sync);
    sync();
    form.append(label, button);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      button.disabled = true;
      button.textContent = 'Adding…';
      try { await add(select.value); sync(); $('[data-cart-open]')?.click(); }
      catch { button.disabled = false; button.textContent = "Couldn't add. Try again"; }
    });
    copy.querySelector('.product-facts')?.after(form);
    const price = $('[data-fact-price]');
    if (price) price.textContent = firstLive >= 0 ? `From ${money(variants[firstLive].price)}` : 'Sold out';
    $('[data-live-link]')?.setAttribute('hidden', ''); // buying happens here now
    $('[data-cart-note]')?.setAttribute('hidden', '');
  }).catch(() => {});
})();
