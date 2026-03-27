/**
 * export-slides.js
 * Exports every slide from a carousel HTML file as a full-resolution PNG.
 * Output: exports/<filename>/slide-01.png … slide-N.png at 1080×1350 px.
 *
 * Usage:
 *   node export-slides.js [carousel-file.html]
 *   node export-slides.js hdfc-bank-carousel.html
 *   node export-slides.js                          ← defaults to hdfc-bank-carousel.html
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const SLIDE_WIDTH = 1080;
const SLIDE_HEIGHT = 1350;

function resolveOutputDir(file) {
  const base = path.basename(file, path.extname(file));
  const dir = path.join(__dirname, 'exports', base);
  fs.mkdirSync(dir, { recursive: true });
  return { base, dir };
}

async function openPage(browser, absFile) {
  const page = await browser.newPage();
  await page.setViewport({ width: SLIDE_WIDTH, height: SLIDE_HEIGHT, deviceScaleFactor: 2 });
  await page.goto(`file://${absFile}`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500)); // allow Google Fonts to render
  return page;
}

async function activateSlide(page, idx) {
  await page.evaluate((i, w, h) => {
    // Kill all transitions so nothing is mid-animation during screenshot
    const style = document.createElement('style');
    style.id = '__no-transition';
    style.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
    if (!document.getElementById('__no-transition')) document.head.appendChild(style);

    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.dot');

    slides.forEach((s, j) => {
      const active = j === i;
      s.classList.toggle('active', active);
      // display:none fully removes from rendering; opacity:0 can still bleed through
      s.style.display = active ? 'block' : 'none';
      s.style.transform = 'none';
      s.style.transformOrigin = 'top left';
    });

    dots.forEach((d, j) => d.classList.toggle('active', j === i));

    const viewer = document.querySelector('.viewer');
    if (viewer) {
      viewer.style.width = `${w}px`;
      viewer.style.height = `${h}px`;
      viewer.style.borderRadius = '0';
      viewer.style.boxShadow = 'none';
      viewer.style.overflow = 'visible';
    }

    document.body.style.cssText = 'background:transparent;padding:0;margin:0;min-height:unset;display:block;';
    const nav = document.querySelector('.nav');
    if (nav) nav.style.display = 'none';
  }, idx, SLIDE_WIDTH, SLIDE_HEIGHT);

  // Brief settle so fonts/images finish painting
  await new Promise(r => setTimeout(r, 200));
}

async function main() {
  const file = process.argv[2] || 'hdfc-bank-carousel.html';
  const absFile = path.resolve(__dirname, file);

  if (!fs.existsSync(absFile)) {
    console.error(`File not found: ${absFile}`);
    process.exit(1);
  }

  const { base, dir } = resolveOutputDir(file);
  const browser = await puppeteer.launch({ headless: 'new' });

  try {
    const page = await openPage(browser, absFile);
    const slideCount = await page.evaluate(() => document.querySelectorAll('.slide').length);

    console.log(`Found ${slideCount} slides in ${file}`);
    console.log(`Exporting to: exports/${base}/\n`);

    for (let i = 0; i < slideCount; i++) {
      await activateSlide(page, i);
      const padded = String(i + 1).padStart(2, '0');
      const outFile = path.join(dir, `slide-${padded}.png`);
      const viewer = await page.$('.viewer');
      await viewer.screenshot({ path: outFile });
      console.log(`  ✓ slide-${padded}.png`);
    }

    console.log(`\nDone — ${slideCount} PNGs saved to exports/${base}/`);
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
