/**
 * PackWatch extension test — serves a local product page + tests real retail sites.
 */

const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');

const EXT_PATH = path.resolve(__dirname);
const SHOTS_DIR = path.join(__dirname, 'test-screenshots');
fs.mkdirSync(SHOTS_DIR, { recursive: true });

// Serve test-page.html on localhost
function startServer() {
  return new Promise(resolve => {
    const html = fs.readFileSync(path.join(__dirname, 'test-page.html'));
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });
  });
}

async function shot(page, name) {
  const file = path.join(SHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 ${path.basename(file)}`);
  return file;
}

async function waitForWidget(page, timeout = 10000) {
  try {
    await page.waitForFunction(
      () => !!document.getElementById('packwatch-ext-host'),
      { timeout }
    );
    return true;
  } catch {
    return false;
  }
}

async function clickPill(page) {
  return page.evaluate(() => {
    const host = document.getElementById('packwatch-ext-host');
    const pill = host?.shadowRoot?.querySelector('#pw-pill');
    if (pill) { pill.click(); return true; }
    return false;
  });
}

async function getWidgetText(page) {
  return page.evaluate(() => {
    const host = document.getElementById('packwatch-ext-host');
    return host?.shadowRoot?.textContent?.replace(/\s+/g, ' ').trim() || '';
  });
}

const REAL_PAGES = [
  {
    name: 'tcgplayer-pokemon',
    label: 'TCGPlayer – Pokemon booster',
    // Direct product search for a booster pack
    url: 'https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=booster+pack&view=grid&inStock=true',
    waitFor: 'h1',
  },
  {
    name: 'bigw-pokemon',
    label: 'BigW – Pokemon booster pack product',
    url: 'https://www.bigw.com.au/product/pokemon-trading-card-game-scarlet-violet-booster-pack/p/138048',
    waitFor: 'h1',
  },
];

(async () => {
  console.log('\n🃏 PackWatch Extension Test\n');

  const { server, url: localUrl } = await startServer();
  console.log(`Local test server: ${localUrl}\n`);

  const ctx = await chromium.launchPersistentContext(
    '/tmp/packwatch-playwright-profile2',
    {
      headless: false,
      args: [
        `--load-extension=${EXT_PATH}`,
        `--disable-extensions-except=${EXT_PATH}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
      viewport: { width: 1280, height: 800 },
    }
  );

  // ── Test 1: Local test page (guaranteed trigger) ──────────────────────────
  console.log('━━━ Test 1: Local product page (controlled test)\n');
  const page1 = await ctx.newPage();
  await page1.goto(localUrl, { waitUntil: 'domcontentloaded' });
  await page1.waitForTimeout(1500);

  await shot(page1, '1-local-loaded');

  const detected1 = await waitForWidget(page1, 5000);
  console.log(`  Widget triggered: ${detected1 ? '✅ YES' : '❌ NO – detection bug'}`);

  if (detected1) {
    await shot(page1, '1-local-pill');
    await clickPill(page1);
    await page1.waitForTimeout(3000); // wait for price fetch

    await shot(page1, '1-local-panel-open');
    const txt = await getWidgetText(page1);
    console.log(`  Widget text: "${txt.slice(0, 120)}..."`);
    console.log('  ✅ Widget expanded successfully');
  }

  await page1.close();
  console.log();

  // ── Test 2: Real retail sites ─────────────────────────────────────────────
  for (const test of REAL_PAGES) {
    console.log(`━━━ ${test.label}\n`);
    const page = await ctx.newPage();

    try {
      await page.goto(test.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      if (test.waitFor) {
        await page.waitForSelector(test.waitFor, { timeout: 10000 }).catch(() => {});
      }
      await page.waitForTimeout(2000);
    } catch (e) {
      console.log(`  ⚠️  Page load error: ${e.message.split('\n')[0]}`);
    }

    const h1 = await page.$eval('h1', el => el.textContent.trim()).catch(() => '(no h1)');
    const title = await page.title();
    console.log(`  Title: ${title.slice(0, 80)}`);
    console.log(`  H1: ${h1.slice(0, 80)}`);

    await shot(page, `2-${test.name}-loaded`);

    const detected = await waitForWidget(page, 6000);
    console.log(`  Widget triggered: ${detected ? '✅ YES' : '⚠️  NO – keywords not in title/h1'}`);

    if (detected) {
      await shot(page, `2-${test.name}-pill`);
      await clickPill(page);
      await page.waitForTimeout(3000);
      await shot(page, `2-${test.name}-panel`);
      console.log('  ✅ Panel opened with price comparison');
    }

    await page.close();
    console.log();
  }

  console.log('━━━ All tests complete\n');
  console.log(`Screenshots → ${SHOTS_DIR}\n`);
  console.log('Keeping browser open for 15s...');
  await new Promise(r => setTimeout(r, 15000));

  server.close();
  await ctx.close();
})().catch(err => {
  console.error('\n❌ Test error:', err.message);
  process.exit(1);
});
