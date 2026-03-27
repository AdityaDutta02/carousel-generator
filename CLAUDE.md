# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Does

A LinkedIn carousel creation and export tool. Carousels are built as self-contained HTML files (1080×1350 px slides) and exported to PNG via Puppeteer.

## Commands

```bash
# Export all slides from a carousel file as PNGs
node export-slides.js carousel.html
node export-slides.js hdfc-bank-carousel.html   # default if no arg given

# Install dependencies (Puppeteer only)
npm install

# Browse templates in browser
open templates/index.html
```

Output PNGs land in `exports/<filename-without-ext>/slide-01.png … slide-N.png` at 2160×2700 px (2× device scale factor, so 1080×1350 logical px).

## Architecture

### Carousel HTML files (root level)
Each carousel (`carousel.html`, `hdfc-bank-carousel.html`) is a **single self-contained HTML file** with:
- All slides as `.slide` divs inside a `.viewer` container
- The first slide has class `active`; others are hidden via `opacity: 0` + `pointer-events: none`
- A JavaScript navigation block at the bottom (prev/next buttons, dot indicators, keyboard/swipe support)
- Slides are drawn at **1080×1350 px** and scaled to 50% for the browser preview using CSS `transform: scale(0.5)`

### Export script (`export-slides.js`)
Puppeteer-based headless screenshot tool. For each slide index it:
1. Injects a `<style>` tag to kill all CSS transitions/animations
2. Sets all `.slide` elements to `display: none` except the target (active)
3. Resets the `.viewer` dimensions and removes border-radius/box-shadow
4. Hides the `.nav` element
5. Screenshots the `.viewer` element (not the full page)

### Templates (`templates/`)
Four reusable single-slide templates, each a standalone HTML file:
- `template-1-editorial.html` — Cream bg, large Barlow Condensed display type, hand-drawn SVG oval accent
- `template-2-data.html` — Dark bg, oversized stat number with colored unit suffix
- `template-3-card.html` — Orange bg, centered white card with statement text
- `template-4-notebook.html` — Yellow-green bg, stacked paper layers, Caveat handwritten font

`templates/index.html` is a gallery page that shows live iframe previews of all four.

All templates mark editable content with `<!-- EDIT -->` comments and expose CSS custom properties (design tokens) at the top of each file for easy retheme.

## Design System

All carousels share a consistent token set defined in `:root`:
- **Colors**: `--cream: #F0EDE5`, `--dark: #111110`, `--orange: #E05828`, `--white: #FAFAF8`
- **Fonts**: Barlow Condensed (display/headlines), DM Sans (body/UI), Lora italic (taglines/pull quotes)
- **Canvas**: `--sw: 1080px`, `--sh: 1350px`, `--scale: 0.5`
- **Slide inner padding**: 72px on all sides (`.si`)

Recurring UI components: `.tag` (pill button), `.circle-btn` (round arrow button), `.star` (✳ brand accent), `.brand` (uppercase label), `.source` (attribution line).

## Adding a New Carousel

1. Copy an existing carousel HTML file and rename it
2. Find/replace content — every editable section follows the same structure: `.top`, middle content, `.bottom`
3. Slide IDs follow `#s1`, `#s2`, … `#sN` convention
4. The JS navigation block auto-discovers slides via `document.querySelectorAll('.slide')` — no manual count needed
5. Run `node export-slides.js your-new-file.html` to export

## Notes

- **Font rendering**: Google Fonts load at runtime. If fonts appear as system fallbacks in exports, increase the 1500 ms delay at `export-slides.js:30`. There's also a 200 ms settle after each slide activation (`export-slides.js:71`).
- **Export debugging**: Change `headless: 'new'` → `headless: false` at `export-slides.js:84` to watch Puppeteer render slides live.
- **Slide visibility model**: Browser preview uses `opacity: 0` + `pointer-events: none` to hide inactive slides (CSS-driven, allows transitions). The export script overrides this with `display: none` to prevent bleed-through in screenshots.
- **`exports/` is not gitignored** — PNG output should not be committed. Add `exports/` to `.gitignore`.
- Puppeteer is the only dependency (`devDependencies`). Project uses CommonJS (`"type": "commonjs"` in package.json).
