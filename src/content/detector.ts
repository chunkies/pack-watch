import type { Product, PriceData } from '../types';

(function () {
  'use strict';

  if ((window as Window & { __packWatchActive?: boolean }).__packWatchActive) return;
  (window as Window & { __packWatchActive?: boolean }).__packWatchActive = true;

  // ── Keywords ──────────────────────────────────────────────────────────────

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
    'elite trainer box', 'etb',
    'collection box', 'collection chest',
    'theme deck', 'starter deck',
    'blister pack', 'blister',
    'display box',
    '36 pack', '24 pack', '18 pack', '12 pack',
    'booster',
    'tin',
  ];

  // Card-type indicators — only checked when no pack keyword matches
  const CARD_INDICATORS = [
    // Rarity / treatment
    'holo', 'holofoil', 'holographic',
    'full art', 'full-art',
    'secret rare', 'ultra rare', 'illustration rare', 'special illustration',
    'rainbow rare', 'hyper rare', 'gold rare',
    'foil card', 'etched foil', 'borderless', 'showcase', 'alternate art',
    // Condition
    'near mint', 'lightly played', 'moderately played', 'heavily played',
    'mint condition',
    // Graded slabs
    'psa 10', 'psa 9', 'psa 8', 'psa 7',
    'bgs 10', 'bgs 9.5', 'bgs 9', 'bgs 8',
    'cgc 10', 'cgc 9.5', 'cgc 9',
    'pca 10', 'ace 10',
    'graded card', 'graded pokemon', 'graded mtg',
    'psa graded', 'bgs graded', 'cgc graded',
    // Singles
    'single card', 'singles',
    // Lots
    'card lot', 'lot of cards', 'bulk cards',
  ];

  // Graded card grading companies — triggers card detection even without other indicators
  const GRADING_COMPANIES = ['psa', 'bgs', 'cgc', 'pca', 'ace grading', 'beckett'];

  // Known single-card marketplace URL patterns

  const CARD_URL_PATTERNS: RegExp[] = [
    /tcgplayer\.com\/product\//,
    /cardmarket\.com\/.+\/Singles\//,
    /pkmncards\.com\/cards\//,
    /trollandtoad\.com\/.+\.html/,
    /coolstuffinc\.com\/p\//,
  ];

  // ── Price extraction ───────────────────────────────────────────────────────

  const SITE_SELECTORS: Record<string, string[]> = {
    'tcgplayer.com':  ['.spotlight__price', '[data-testid="listing-price"]', '.product-page__market-price--value'],
    'ebay.com':       ['.x-price-primary .ux-textspans', '#prcIsum'],
    'ebay.com.au':    ['.x-price-primary .ux-textspans', '#prcIsum'],
    'amazon.com':     ['.a-price .a-offscreen', '#priceblock_ourprice'],
    'amazon.com.au':  ['.a-price .a-offscreen', '#priceblock_ourprice'],
    'bigw.com.au':    ['[data-testid="price-formatted"]', '.Price'],
    'target.com.au':  ['[data-testid="price"]', '.Price'],
    'kmart.com.au':   ['.ProductDetails-price', '[data-testid="product-price"]'],
    'cardmarket.com': ['.price-container .font-bold', '.article-price'],
  };

  function extractPrice(): number | null {
    const schema = document.querySelector('[itemprop="price"]');
    if (schema) {
      const p = parsePrice(schema.getAttribute('content') ?? schema.textContent ?? '');
      if (p) return p;
    }

    const host = location.hostname.replace(/^www\./, '');
    const siteKey = Object.keys(SITE_SELECTORS).find(k => host.includes(k));
    const selectors = siteKey ? SITE_SELECTORS[siteKey] : [];

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
          const p = parsePrice(
            el.getAttribute('content') ?? el.getAttribute('data-price') ?? el.textContent ?? ''
          );
          if (p) return p;
        }
      } catch { /* bad selector */ }
    }

    return null;
  }

  function parsePrice(text: string): number | null {
    const m = text.match(/[\d,]+\.?\d*/);
    if (!m) return null;
    const p = parseFloat(m[0].replace(/,/g, ''));
    return p > 0.5 && p < 5000 ? p : null;
  }

  // ── Detection ──────────────────────────────────────────────────────────────

  function detectProduct(): Product | null {
    const h1 = (document.querySelector('h1')?.textContent ?? '').trim();
    const title = document.title;
    const text = `${h1} ${title}`.toLowerCase();
    const url = location.href;

    const game = GAMES.find(g => text.includes(g));
    if (!game) return null;

    const productName = h1 || title.split(/\s*[-|–]\s*/)[0].trim();
    const site = location.hostname.replace(/^www\./, '');
    const base = { productName, currentPrice: extractPrice(), game, site, url };

    // Pack wins if any pack keyword matches
    const packType = PACK_TYPES.find(t => text.includes(t));
    if (packType) return { ...base, productType: 'pack', subType: packType };

    // Single card: URL pattern
    if (CARD_URL_PATTERNS.some(re => re.test(url))) {
      return { ...base, productType: 'card', subType: 'single card' };
    }

    // Single card: card number pattern e.g. "025/196"
    if (/\b\d{1,3}\/\d{2,3}\b/.test(text)) {
      return { ...base, productType: 'card', subType: 'single card' };
    }

    // Graded slab: grading company keyword + game keyword
    const gradingCo = GRADING_COMPANIES.find(g => text.includes(g));
    if (gradingCo) {
      // Extract grade if present (e.g. "PSA 10", "BGS 9.5")
      const gradeMatch = text.match(/\b(psa|bgs|cgc|pca|ace)\s*(10|9\.5|9|8\.5|8|7\.5|7)\b/i);
      const subType = gradeMatch ? gradeMatch[0].toUpperCase() : `${gradingCo.toUpperCase()} graded`;
      return { ...base, productType: 'graded', subType };
    }

    // Single card: text indicators
    const cardIndicator = CARD_INDICATORS.find(t => text.includes(t));
    if (cardIndicator) return { ...base, productType: 'card', subType: cardIndicator };

    // eBay single-item listing with a game keyword
    if (/ebay\.(com|com\.au)\/itm\//.test(url)) {
      return { ...base, productType: 'card', subType: 'single card' };
    }

    return null;
  }

  // ── Widget CSS ─────────────────────────────────────────────────────────────

  const CSS = `
    .pw-root {
      width: 320px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #e2e8f0;
    }
    .pw-pill {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 14px;
      background: #1e1b4b; border: 1px solid #4c3ed9;
      border-radius: 999px; cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,0,0,0.45);
      transition: transform 0.15s, box-shadow 0.15s;
      user-select: none;
    }
    .pw-pill:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(0,0,0,0.55); }
    .pw-pill-icon { font-size: 16px; }
    .pw-pill-text { color: #c4b5fd; font-weight: 500; white-space: nowrap; font-size: 13px; }
    .pw-pill-arrow { color: #7c3aed; font-size: 11px; margin-left: auto; }

    .pw-panel {
      background: #0f0e1a; border: 1px solid #312e81;
      border-radius: 12px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(124,58,237,0.08);
      overflow: hidden;
    }
    .pw-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 12px; background: #13122a; border-bottom: 1px solid #1e1b4b;
    }
    .pw-logo { font-weight: 700; font-size: 13px; color: #a78bfa; letter-spacing: 0.3px; }
    .pw-header-btns { display: flex; gap: 2px; }
    .pw-btn {
      width: 24px; height: 24px; border: none; background: transparent;
      color: #6b7280; cursor: pointer; border-radius: 4px;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; line-height: 1; transition: background 0.1s, color 0.1s;
    }
    .pw-btn:hover { background: #1f1d35; color: #e2e8f0; }

    .pw-product { padding: 11px 12px; border-bottom: 1px solid #1e1b4b; }
    .pw-type-tag {
      display: inline-block; padding: 1px 7px; border-radius: 999px;
      font-size: 10px; font-weight: 600; letter-spacing: 0.4px; margin-bottom: 5px;
      text-transform: uppercase;
    }
    .pw-type-pack   { background: rgba(124,58,237,0.18); color: #a78bfa; }
    .pw-type-card   { background: rgba(245,158,11,0.18); color: #fbbf24; }
    .pw-type-graded { background: rgba(234,179,8,0.22);  color: #fde047; border: 1px solid rgba(234,179,8,0.3); }
    .pw-product-name {
      font-size: 13px; font-weight: 600; color: #e2e8f0;
      margin-bottom: 6px; line-height: 1.35;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .pw-price-row { display: flex; align-items: baseline; gap: 8px; }
    .pw-price-label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .pw-current-price { font-size: 22px; font-weight: 700; color: #f1f5f9; }
    .pw-site-tag { font-size: 10px; color: #4b5563; margin-left: auto; }

    .pw-prices { padding: 10px 12px; border-bottom: 1px solid #1e1b4b; min-height: 44px; }
    .pw-loading { display: flex; align-items: center; gap: 8px; color: #4b5563; font-size: 12px; }
    .pw-spinner {
      width: 13px; height: 13px; border: 2px solid #312e81;
      border-top-color: #7c3aed; border-radius: 50%;
      animation: pw-spin 0.7s linear infinite; flex-shrink: 0;
    }
    @keyframes pw-spin { to { transform: rotate(360deg); } }

    .pw-market-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
    .pw-market-label { font-size: 11px; color: #6b7280; min-width: 56px; }
    .pw-market-low { font-size: 16px; font-weight: 700; color: #34d399; }
    .pw-market-avg { font-size: 12px; color: #9ca3af; }
    .pw-market-count { font-size: 10px; color: #374151; }

    .pw-badge {
      display: inline-flex; align-items: center; gap: 3px;
      padding: 2px 8px; border-radius: 999px;
      font-size: 11px; font-weight: 600;
    }
    .pw-badge-over  { background: rgba(239,68,68,0.15); color: #f87171; }
    .pw-badge-good  { background: rgba(52,211,153,0.15); color: #34d399; }
    .pw-badge-fair  { background: rgba(250,204,21,0.15); color: #fbbf24; }
    .pw-no-data { font-size: 12px; color: #4b5563; }

    .pw-compare { padding: 9px 12px; border-bottom: 1px solid #1e1b4b; }
    .pw-compare-title {
      font-size: 10px; color: #374151; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 7px;
    }
    .pw-links { display: flex; flex-wrap: wrap; gap: 5px; }
    .pw-link {
      display: inline-block; padding: 4px 9px;
      background: #1e1b4b; border: 1px solid #312e81;
      border-radius: 6px; color: #a78bfa; font-size: 11px; font-weight: 500;
      text-decoration: none; cursor: pointer; transition: background 0.1s, border-color 0.1s;
    }
    .pw-link:hover { background: #2d2973; border-color: #4c3ed9; color: #c4b5fd; }

    .pw-actions { padding: 10px 12px; }
    .pw-track {
      width: 100%; padding: 8px; background: #4c3ed9; border: none;
      border-radius: 8px; color: #fff; font-size: 13px; font-weight: 600;
      cursor: pointer; transition: background 0.15s;
    }
    .pw-track:hover:not(:disabled) { background: #6d59f0; }
    .pw-track:disabled { background: #1e1b4b; color: #4b5563; cursor: default; }
    .pw-track.pw-tracked { background: #059669; }
    .pw-track.pw-tracked:hover { background: #047857; }
    .pw-hidden { display: none !important; }
  `;

  // ── Widget ─────────────────────────────────────────────────────────────────

  let hostEl: HTMLDivElement | null = null;
  let shadowRoot: ShadowRoot | null = null;
  let priceFetched = false;

  function esc(str: string): string {
    return str.replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c)
    );
  }

  function titleCase(str: string): string {
    return str.split(' ').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');
  }

  function buildCompareLinks(product: Product): string {
    const q = encodeURIComponent(product.productName);

    const packLinks = [
      { label: 'eBay AU',     url: `https://www.ebay.com.au/sch/i.html?_nkw=${q}&_sop=15` },
      { label: 'eBay US',     url: `https://www.ebay.com/sch/i.html?_nkw=${q}&_sop=15` },
      { label: 'TCGPlayer',   url: `https://www.tcgplayer.com/search/all/product?q=${q}` },
      { label: 'CardMarket',  url: `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${q}` },
      { label: 'Amazon AU',   url: `https://www.amazon.com.au/s?k=${q}` },
      { label: 'Google Shop', url: `https://www.google.com/search?q=${q}+buy&tbm=shop` },
    ];

    const cardLinks = [
      { label: 'TCGPlayer',   url: `https://www.tcgplayer.com/search/all/product?q=${q}` },
      { label: 'CardMarket',  url: `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${q}` },
      { label: 'eBay AU',     url: `https://www.ebay.com.au/sch/i.html?_nkw=${q}&LH_BIN=1&_sop=15` },
      { label: 'eBay US',     url: `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_BIN=1&_sop=15` },
      { label: 'Google Shop', url: `https://www.google.com/search?q=${q}+card+price&tbm=shop` },
    ];

    const links = product.productType === 'card' ? cardLinks : packLinks;
    return links.map(l =>
      `<a class="pw-link" href="${l.url}" target="_blank" rel="noopener noreferrer">${l.label}</a>`
    ).join('');
  }

  function buildHTML(product: Product): string {
    const priceText = product.currentPrice ? `AU$${product.currentPrice.toFixed(2)}` : '—';
    const siteShort = product.site.replace('.com.au', '').replace('.com', '');
    const { productType } = product;
    const typeLabel = productType === 'graded' ? `Graded · ${product.subType}`
      : productType === 'card' ? 'Single Card'
      : 'Sealed Pack';
    const typeClass = productType === 'graded' ? 'pw-type-graded'
      : productType === 'card' ? 'pw-type-card'
      : 'pw-type-pack';
    const pillLabel = productType === 'graded'
      ? `${titleCase(product.game)} graded slab`
      : productType === 'card'
      ? `${titleCase(product.game)} card found`
      : `${titleCase(product.game)} pack found`;

    return `
      <div class="pw-pill" id="pw-pill">
        <span class="pw-pill-icon">🃏</span>
        <span class="pw-pill-text">${pillLabel}</span>
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
          <span class="pw-type-tag ${typeClass}">${typeLabel}</span>
          <div class="pw-product-name" title="${esc(product.productName)}">${esc(product.productName)}</div>
          <div class="pw-price-row">
            <span class="pw-price-label">Here</span>
            <span class="pw-current-price">${priceText}</span>
            <span class="pw-site-tag">${esc(siteShort)}</span>
          </div>
        </div>

        <div class="pw-prices" id="pw-prices">
          <div class="pw-loading"><div class="pw-spinner"></div>Checking market price…</div>
        </div>

        <div class="pw-compare">
          <div class="pw-compare-title">Compare on</div>
          <div class="pw-links">${buildCompareLinks(product)}</div>
        </div>

        <div class="pw-actions">
          <button class="pw-track" id="pw-track">+ Track this ${productType === 'graded' ? 'slab' : productType === 'card' ? 'card' : 'purchase'}</button>
        </div>
      </div>
    `;
  }

  function wireEvents(root: HTMLElement, product: Product): void {
    const pill  = root.querySelector<HTMLElement>('#pw-pill')!;
    const panel = root.querySelector<HTMLElement>('#pw-panel')!;

    pill.addEventListener('click', () => {
      pill.classList.add('pw-hidden');
      panel.classList.remove('pw-hidden');
      if (!priceFetched) { priceFetched = true; loadPrices(product); }
    });

    root.querySelector('#pw-min')!.addEventListener('click', () => {
      panel.classList.add('pw-hidden');
      pill.classList.remove('pw-hidden');
    });

    root.querySelector('#pw-close')!.addEventListener('click', () => {
      hostEl?.remove();
      hostEl = null; shadowRoot = null;
    });

    const trackBtn = root.querySelector<HTMLButtonElement>('#pw-track')!;
    trackBtn.addEventListener('click', function () {
      if (this.disabled) return;
      chrome.runtime.sendMessage({
        type: 'TRACK_PURCHASE',
        purchase: {
          productName: product.productName,
          game: product.game,
          productType: product.productType,
          subType: product.subType,
          price: product.currentPrice,
          site: product.site,
          url: product.url,
        },
      }, (res: { ok: boolean } | undefined) => {
        if (res?.ok) {
          this.textContent = '✓ Tracked!';
          this.classList.add('pw-tracked');
          this.disabled = true;
        }
      });
    });
  }

  function loadPrices(product: Product): void {
    const query = product.productName
      .replace(/\|.*/, '')
      .replace(/\s*[-–].*(?:ebay|amazon|tcg|shop|store|buy).*/i, '')
      .trim()
      .slice(0, 100);

    chrome.runtime.sendMessage(
      { type: 'FETCH_PRICES', query, productType: product.productType },
      (res: { ok: boolean; data?: PriceData } | undefined) => {
        if (!shadowRoot) return;
        const el = shadowRoot.getElementById('pw-prices');
        if (!el) return;

        if (res?.ok && res.data) {
          renderPrices(el, res.data, product.currentPrice);
        } else {
          el.innerHTML = '<div class="pw-no-data">Live prices unavailable · use links below</div>';
        }
      }
    );
  }

  function renderPrices(el: HTMLElement, data: PriceData, currentPrice: number | null): void {
    const { ebay } = data;

    if (!ebay) {
      el.innerHTML = '<div class="pw-no-data">Live prices unavailable · use links below</div>';
      return;
    }

    let badge = '';
    if (currentPrice && ebay.lowest) {
      const pct = ((currentPrice - ebay.lowest) / ebay.lowest) * 100;
      if (pct > 15)      badge = `<span class="pw-badge pw-badge-over">⚠ ${pct.toFixed(0)}% above market low</span>`;
      else if (pct < -5) badge = `<span class="pw-badge pw-badge-good">✓ Below market average</span>`;
      else               badge = `<span class="pw-badge pw-badge-fair">~ Fair market price</span>`;
    }

    el.innerHTML = `
      <div class="pw-market-row">
        <span class="pw-market-label">eBay AU</span>
        <span class="pw-market-low">from AU$${ebay.lowest.toFixed(2)}</span>
        <span class="pw-market-avg">avg AU$${ebay.average.toFixed(2)}</span>
        <span class="pw-market-count">${ebay.count} listings</span>
      </div>
      ${badge}
    `;
  }

  function injectWidget(product: Product): void {
    hostEl = document.createElement('div');
    hostEl.id = 'packwatch-ext-host';
    Object.assign(hostEl.style, {
      all: 'initial', display: 'block', position: 'fixed',
      bottom: '20px', right: '20px', zIndex: '2147483647',
    });
    document.body.appendChild(hostEl);

    shadowRoot = hostEl.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = CSS;
    shadowRoot.appendChild(style);

    const root = document.createElement('div');
    root.className = 'pw-root';
    root.innerHTML = buildHTML(product);
    shadowRoot.appendChild(root);

    wireEvents(root, product);
  }

  // ── Init + SPA navigation ──────────────────────────────────────────────────

  function init(): void {
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
      hostEl = null; shadowRoot = null; priceFetched = false;
      init();
    }, 900);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
