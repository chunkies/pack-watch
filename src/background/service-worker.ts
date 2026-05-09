import type { ExtMessage, EbayResult, PriceData, Purchase, ProductType } from '../types';

chrome.runtime.onMessage.addListener(
  (message: ExtMessage, _sender, sendResponse: (r: unknown) => void) => {
    if (message.type === 'FETCH_PRICES') {
      handleFetchPrices(message.query, message.productType)
        .then(data => sendResponse({ ok: true, data }))
        .catch(err => sendResponse({ ok: false, error: (err as Error).message }));
      return true;
    }

    if (message.type === 'TRACK_PURCHASE') {
      handleTrackPurchase(message.purchase)
        .then(() => sendResponse({ ok: true }));
      return true;
    }

    if (message.type === 'GET_PURCHASES') {
      chrome.storage.local.get('purchases', ({ purchases = [] }) => {
        sendResponse({ ok: true, purchases });
      });
      return true;
    }

    if (message.type === 'CLEAR_PURCHASES') {
      chrome.storage.local.set({ purchases: [] }, () => sendResponse({ ok: true }));
      return true;
    }
  }
);

async function handleFetchPrices(query: string, productType: ProductType): Promise<PriceData> {
  const result: PriceData = { ebay: null };

  try {
    // Cards: append "near mint" for condition-comparable results
    // Graded: keep query as-is (grade is already in the product name)
    const ebayQuery = productType === 'card' ? `${query} near mint` : query;
    result.ebay = await fetchEbayAU(ebayQuery);
  } catch {
    // eBay unavailable — links-only mode
  }

  return result;
}

async function fetchEbayAU(query: string): Promise<EbayResult> {
  const url = `https://www.ebay.com.au/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_BIN=1&_sop=15&_ipg=25`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(6000),
  });

  if (!resp.ok) throw new Error(`eBay ${resp.status}`);
  const html = await resp.text();
  return parseEbayPrices(html, url);
}

function parseEbayPrices(html: string, searchUrl: string): EbayResult {
  const prices: number[] = [];

  // itemprop price content attribute (most reliable)
  const re1 = /itemprop="price"[^>]*content="([\d.]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(html)) !== null) {
    const p = parseFloat(m[1]);
    if (p > 0.5 && p < 5000) prices.push(p);
  }

  // Fallback: s-item__price span
  if (prices.length === 0) {
    const re2 = /class="s-item__price"[^>]*>\s*(?:AU\s*)?\$([\d,]+\.?\d*)/g;
    while ((m = re2.exec(html)) !== null) {
      const p = parseFloat(m[1].replace(',', ''));
      if (p > 0.5 && p < 5000) prices.push(p);
    }
  }

  if (prices.length === 0) throw new Error('No prices found');

  prices.sort((a, b) => a - b);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

  return {
    lowest: prices[0],
    average: Math.round(avg * 100) / 100,
    count: prices.length,
    currency: 'AUD',
    searchUrl,
  };
}

async function handleTrackPurchase(purchase: Omit<Purchase, 'id' | 'date'>): Promise<void> {
  const { purchases = [] } = await chrome.storage.local.get('purchases') as { purchases?: Purchase[] };
  purchases.unshift({
    ...purchase,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    date: new Date().toISOString(),
  });
  if (purchases.length > 200) purchases.splice(200);
  await chrome.storage.local.set({ purchases });
}
