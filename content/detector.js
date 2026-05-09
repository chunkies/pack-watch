(function () {
  'use strict';

  if (window.__packWatchActive) return;
  window.__packWatchActive = true;

  // ── Keywords ─────────────────────────────────────────────────────────────

  const GAMES = [
    'pokemon', 'pokémon',
    'one piece',
    'magic the gathering', 'magic: the gathering', 'mtg',
    'yu-gi-oh', 'yugioh', 'yu gi oh',
    'digimon',
    'dragon ball super', 'dragon ball',
    'flesh and blood',
    'lorcana', 'disney lorcana',
    'star wars unlimited',
    'grand archive',
    'cardfight vanguard',
    'weiss schwarz', 'weiß schwarz',
    'metazoo',
    'union arena',
    'final fantasy tcg',
  ];

  const PACK_TYPES = [
    'booster pack', 'booster box', 'booster bundle', 'booster display',
    'sealed pack', 'sealed product',
    'elite trainer box',
    'collection box', 'collection chest',
    'theme deck', 'starter deck',
    'blister pack', 'blister',
    'display box',
    'etb',
    '36 pack', '24 pack', '18 pack', '12 pack',
    'booster',
    'tin',
  ];

  // ── Price extraction ──────────────────────────────────────────────────────

  const SITE_SELECTORS = {
    'tcgplayer.com':  ['.spotlight__price', '[data-testid="listing-price"]'],
    'ebay.com':       ['.x-price-primary .ux-textspans', '#prcIsum'],
    'ebay.com.au':    ['.x-price-primary .ux-textspans', '#prcIsum'],
    'amazon.com':     ['.a-price .a-offscreen', '#priceblock_ourprice'],
    'amazon.com.au':  ['.a-price .a-offscreen', '#priceblock_ourprice'],
    'bigw.com.au':    ['[data-testid="price-formatted"]', '.Price'],
    'target.com.au':  ['[data-testid="price"]', '.Price'],
    'kmart.com.au':   ['.ProductDetails-price', '[data-testid="product-price"]'],
    'cardmarket.com': ['.price-container .font-bold', '.article-price'],
  };

  function extractPrice() {
    // schema.org markup first (most reliable)
    const schema = document.querySelector('[itemprop="price"]');
    if (schema) {
      const p = parsePrice(schema.getAttribute('content') || schema.textContent);
      if (p) return p;
    }

    const host = location.hostname.replace(/^www\./, '');
    const siteKey = Object.keys(SITE_SELECTORS).find(k => host.includes(k));
    const selectors = siteKey ? SITE_SELECTORS[siteKey] : [];

    // Generic fallbacks
    const all = [
      ...selectors,
      '[class*="price"] [class*="value"]',
      '[data-price]',
      '[class*="ProductPrice"]',
      '[class*="product-price"]',
    ];

    for (const sel of all) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const p = parsePrice(el.getAttribute('content') || el.getAttribute('data-price') || el.textContent);
          if (p) return p;
        }
      } catch { /* bad selector */ }
    }

    return null;
  }

  function parsePrice(text) {
    if (!text) return null;
    const m = text.match(/[\d,]+\.?\d*/);
    if (!m) return null;
    const p = parseFloat(m[0].replace(/,/g, ''));
    return p > 0.5 && p < 5000 ? p : null;
  }

  // ── Detection ─────────────────────────────────────────────────────────────

  function detectProduct() {
    const h1 = (document.querySelector('h1')?.textContent || '').trim();
    const title = document.title;
    const text = `${h1} ${title}`.toLowerCase();

    const game = GAMES.find(g => text.includes(g));
    if (!game) return null;

    const packType = PACK_TYPES.find(t => text.includes(t));
    if (!packType) return null;

    const productName = h1 || title.split(/\s*[-|–]\s*/)[0].trim();
    const site = location.hostname.replace(/^www\./, '');

    return {
      productName,
      currentPrice: extractPrice(),
      game,
      packType,
      site,
      url: location.href,
    };
  }

  // ── Widget CSS (injected into Shadow DOM) ─────────────────────────────────

  const CSS = `
    .pw-root {
      width: 320px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #e2e8f0;
    }

    /* Pill */
    .pw-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      background: #1e1b4b;
      border: 1px solid #4c3ed9;
      border-radius: 999px;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,0,0,0.45);
      transition: transform 0.15s, box-shadow 0.15s;
      user-select: none;
    }
    .pw-pill:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 24px rgba(0,0,0,0.55);
    }
    .pw-pill-icon { font-size: 16px; }
    .pw-pill-text { color: #c4b5fd; font-weight: 500; white-space: nowrap; font-size: 13px; }
    .pw-pill-arrow { color: #7c3aed; font-size: 11px; margin-left: auto; }

    /* Panel */
    .pw-panel {
      background: #0f0e1a;
      border: 1px solid #312e81;
      border-radius: 12px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(124,58,237,0.08);
      overflow: hidden;
    }

    /* Header */
    .pw-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: #13122a;
      border-bottom: 1px solid #1e1b4b;
    }
    .pw-logo { font-weight: 700; font-size: 13px; color: #a78bfa; letter-spacing: 0.3px; }
    .pw-header-btns { display: flex; gap: 2px; }
    .pw-btn {
      width: 24px; height: 24px;
      border: none; background: transparent;
      color: #6b7280; cursor: pointer;
      border-radius: 4px;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; line-height: 1;
      transition: background 0.1s, color 0.1s;
    }
    .pw-btn:hover { background: #1f1d35; color: #e2e8f0; }

    /* Product */
    .pw-product {
      padding: 11px 12px;
      border-bottom: 1px solid #1e1b4b;
    }
    .pw-product-name {
      font-size: 13px; font-weight: 600; color: #e2e8f0;
      margin-bottom: 6px; line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .pw-price-row { display: flex; align-items: baseline; gap: 8px; }
    .pw-price-label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .pw-current-price { font-size: 22px; font-weight: 700; color: #f1f5f9; }
    .pw-site-tag { font-size: 10px; color: #4b5563; margin-left: auto; }

    /* Prices */
    .pw-prices {
      padding: 10px 12px;
      border-bottom: 1px solid #1e1b4b;
      min-height: 44px;
    }
    .pw-loading { display: flex; align-items: center; gap: 8px; color: #4b5563; font-size: 12px; }
    .pw-spinner {
      width: 13px; height: 13px;
      border: 2px solid #312e81;
      border-top-color: #7c3aed;
      border-radius: 50%;
      animation: pw-spin 0.7s linear infinite;
      flex-shrink: 0;
    }
    @keyframes pw-spin { to { transform: rotate(360deg); } }

    .pw-ebay-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
    .pw-ebay-label { font-size: 11px; color: #6b7280; min-width: 56px; }
    .pw-ebay-low { font-size: 16px; font-weight: 700; color: #34d399; }
    .pw-ebay-avg { font-size: 12px; color: #9ca3af; }
    .pw-ebay-count { font-size: 10px; color: #374151; }

    .pw-badge {
      display: inline-flex; align-items: center; gap: 3px;
      padding: 2px 8px; border-radius: 999px;
      font-size: 11px; font-weight: 600;
    }
    .pw-badge-over  { background: rgba(239,68,68,0.15); color: #f87171; }
    .pw-badge-good  { background: rgba(52,211,153,0.15); color: #34d399; }
    .pw-badge-fair  { background: rgba(250,204,21,0.15);  color: #fbbf24; }

    .pw-no-data { font-size: 12px; color: #4b5563; }

    /* Links */
    .pw-compare { padding: 9px 12px; border-bottom: 1px solid #1e1b4b; }
    .pw-compare-title {
      font-size: 10px; color: #374151;
      text-transform: uppercase; letter-spacing: 0.6px;
      margin-bottom: 7px;
    }
    .pw-links { display: flex; flex-wrap: wrap; gap: 5px; }
    .pw-link {
      display: inline-block;
      padding: 4px 9px;
      background: #1e1b4b; border: 1px solid #312e81;
      border-radius: 6px; color: #a78bfa;
      font-size: 11px; font-weight: 500;
      text-decoration: none; cursor: pointer;
      transition: background 0.1s, border-color 0.1s;
    }
    .pw-link:hover { background: #2d2973; border-color: #4c3ed9; color: #c4b5fd; }

    /* Track button */
    .pw-actions { padding: 10px 12px; }
    .pw-track {
      width: 100%; padding: 8px;
      background: #4c3ed9; border: none; border-radius: 8px;
      color: #fff; font-size: 13px; font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    .pw-track:hover:not(:disabled) { background: #6d59f0; }
    .pw-track:disabled { background: #1e1b4b; color: #4b5563; cursor: default; }
    .pw-track.pw-tracked { background: #059669; }
    .pw-track.pw-tracked:hover { background: #047857; }

    .pw-hidden { display: none !important; }
  `;

  // ── Widget ────────────────────────────────────────────────────────────────

  let host = null;
  let shadow = null;
  let priceFetched = false;

  function injectWidget(product) {
    host = document.createElement('div');
    host.id = 'packwatch-ext-host';
    Object.assign(host.style, {
      all: 'initial',
      display: 'block',
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: '2147483647',
    });
    document.body.appendChild(host);

    shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = CSS;
    shadow.appendChild(style);

    const root = document.createElement('div');
    root.className = 'pw-root';
    root.innerHTML = buildHTML(product);
    shadow.appendChild(root);

    wireEvents(root, product);
  }

  function gameName(g) {
    return g.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  }

  function esc(str) {
    return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function buildHTML(product) {
    const priceText = product.currentPrice ? `AU$${product.currentPrice.toFixed(2)}` : '—';
    const siteShort = product.site.replace('.com.au', '').replace('.com', '');
    const q = encodeURIComponent(product.productName);

    const links = [
      { label: 'eBay AU',       url: `https://www.ebay.com.au/sch/i.html?_nkw=${q}&_sop=15` },
      { label: 'eBay US',       url: `https://www.ebay.com/sch/i.html?_nkw=${q}&_sop=15` },
      { label: 'TCGPlayer',     url: `https://www.tcgplayer.com/search/all/product?q=${q}` },
      { label: 'CardMarket',    url: `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${q}` },
      { label: 'Amazon AU',     url: `https://www.amazon.com.au/s?k=${q}` },
      { label: 'Google Shop',   url: `https://www.google.com/search?q=${q}+buy&tbm=shop` },
    ].map(l => `<a class="pw-link" href="${l.url}" target="_blank" rel="noopener noreferrer">${l.label}</a>`).join('');

    return `
      <div class="pw-pill" id="pw-pill">
        <span class="pw-pill-icon">🃏</span>
        <span class="pw-pill-text">${gameName(product.game)} pack found</span>
        <span class="pw-pill-arrow">▸</span>
      </div>

      <div class="pw-panel pw-hidden" id="pw-panel">
        <div class="pw-header">
          <span class="pw-logo">🃏 PackWatch</span>
          <div class="pw-header-btns">
            <button class="pw-btn" id="pw-min" title="Minimise">−</button>
            <button class="pw-btn" id="pw-close" title="Dismiss">×</button>
          </div>
        </div>

        <div class="pw-product">
          <div class="pw-product-name" title="${esc(product.productName)}">${esc(product.productName)}</div>
          <div class="pw-price-row">
            <span class="pw-price-label">Here</span>
            <span class="pw-current-price">${priceText}</span>
            <span class="pw-site-tag">${esc(siteShort)}</span>
          </div>
        </div>

        <div class="pw-prices" id="pw-prices">
          <div class="pw-loading"><div class="pw-spinner"></div>Checking prices…</div>
        </div>

        <div class="pw-compare">
          <div class="pw-compare-title">Compare on</div>
          <div class="pw-links">${links}</div>
        </div>

        <div class="pw-actions">
          <button class="pw-track" id="pw-track">+ Track this purchase</button>
        </div>
      </div>
    `;
  }

  function wireEvents(root, product) {
    const pill  = root.querySelector('#pw-pill');
    const panel = root.querySelector('#pw-panel');

    pill.addEventListener('click', () => {
      pill.classList.add('pw-hidden');
      panel.classList.remove('pw-hidden');
      if (!priceFetched) { priceFetched = true; loadPrices(product); }
    });

    root.querySelector('#pw-min').addEventListener('click', () => {
      panel.classList.add('pw-hidden');
      pill.classList.remove('pw-hidden');
    });

    root.querySelector('#pw-close').addEventListener('click', () => {
      host?.remove();
      host = null; shadow = null;
    });

    root.querySelector('#pw-track').addEventListener('click', function () {
      if (this.disabled) return;
      chrome.runtime.sendMessage({
        type: 'TRACK_PURCHASE',
        purchase: {
          productName: product.productName,
          game: product.game,
          packType: product.packType,
          price: product.currentPrice,
          site: product.site,
          url: product.url,
        },
      }, res => {
        if (res?.ok) {
          this.textContent = '✓ Tracked!';
          this.classList.add('pw-tracked');
          this.disabled = true;
        }
      });
    });
  }

  function loadPrices(product) {
    const query = product.productName
      .replace(/\|.*/,  '')
      .replace(/\s*[-–].*(?:ebay|amazon|tcg|shop|store|buy).*/i, '')
      .trim()
      .slice(0, 100);

    chrome.runtime.sendMessage({ type: 'FETCH_PRICES', query }, res => {
      if (!shadow) return;
      const el = shadow.getElementById('pw-prices');
      if (!el) return;

      if (res?.ok && res.data) {
        renderPrices(el, res.data, product.currentPrice);
      } else {
        el.innerHTML = '<div class="pw-no-data">Live prices unavailable · use links below</div>';
      }
    });
  }

  function renderPrices(el, data, currentPrice) {
    const { ebay } = data;

    if (!ebay) {
      el.innerHTML = '<div class="pw-no-data">Live prices unavailable · use links below</div>';
      return;
    }

    let badge = '';
    if (currentPrice && ebay.lowest) {
      const pct = ((currentPrice - ebay.lowest) / ebay.lowest) * 100;
      if (pct > 15)      badge = `<span class="pw-badge pw-badge-over">⚠ ${pct.toFixed(0)}% above eBay low</span>`;
      else if (pct < -5) badge = `<span class="pw-badge pw-badge-good">✓ Below eBay average</span>`;
      else               badge = `<span class="pw-badge pw-badge-fair">~ Fair price</span>`;
    }

    el.innerHTML = `
      <div class="pw-ebay-row">
        <span class="pw-ebay-label">eBay AU</span>
        <span class="pw-ebay-low">from AU$${ebay.lowest.toFixed(2)}</span>
        <span class="pw-ebay-avg">avg AU$${ebay.average.toFixed(2)}</span>
        <span class="pw-ebay-count">${ebay.count} listings</span>
      </div>
      ${badge}
    `;
  }

  // ── Init + SPA navigation ─────────────────────────────────────────────────

  function init() {
    if (document.getElementById('packwatch-ext-host')) return;
    const product = detectProduct();
    if (product) injectWidget(product);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    setTimeout(() => {
      document.getElementById('packwatch-ext-host')?.remove();
      host = null; shadow = null; priceFetched = false;
      init();
    }, 900);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
