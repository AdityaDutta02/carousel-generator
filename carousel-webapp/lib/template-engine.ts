import type { SchemaJson, SlotDefinition } from '@/types/template'
import type { Slide } from '@/types/carousel'

export function resolveSlotValue(slot: SlotDefinition, slide: Slide): string {
  return slide.slots[slot.id] ?? slot.default ?? ''
}


export function getGlobalSlots(schema: SchemaJson): SlotDefinition[] {
  return schema.slots.filter(s => s.slide === 'all')
}


export function getSlideSlots(schema: SchemaJson, slideNumber: number): SlotDefinition[] {
  return schema.slots.filter(s => s.slide === slideNumber)
}

function sanitizeCssVar(value: string): string {
  // Allow hex colors, named colors, rgb/hsl functions — strip control chars and injection vectors
  return value.replace(/[^a-zA-Z0-9#(),.\s%]/g, '')
}

function sanitizeFontSize(value: string): string {
  return /^\d+(\.\d+)?(px|em|rem|vh|vw|%)$/.test(value.trim()) ? value.trim() : '16px'
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Applies a single slot's value into the html string. Returns updated html. */
function applySlotToHtml(html: string, slot: SlotDefinition, value: string): string {
  if (slot.type === 'text') {
    const escapedId = slot.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return html.replace(
      new RegExp(`(<[^>]+data-slot="${escapedId}"[^>]*>)[\\s\\S]*?(</[^>]+>)`, 'g'),
      `$1${escapeHtml(value)}$2`
    )
  }
  if (slot.type === 'font_size') {
    const safeSize = sanitizeFontSize(value)
    return html.replace(
      new RegExp(`(<[^>]+data-slot-size="${slot.id}"[^>]*style=")([^"]*)(")`,'g'),
      `$1$2 font-size: ${safeSize};$3`
    )
  }
  return html
}

/** Injects a :root CSS variable block before </head> if overrides are non-empty. */
function injectCssVarBlock(html: string, overrides: string[]): string {
  if (overrides.length === 0) return html
  const styleBlock = `<style id="__slot-vars">:root {\n${overrides.join('\n')}\n}</style>`
  return html.replace('</head>', `${styleBlock}\n</head>`)
}

/**
 * Applies a list of (slot, value) pairs to html, collecting css_var overrides separately.
 * Returns the final html with the :root var block injected if needed.
 */
function processSlots(
  html: string,
  pairs: Array<{ slot: SlotDefinition; value: string }>
): string {
  let result = html
  const cssVarOverrides: string[] = []
  for (const { slot, value } of pairs) {
    if (slot.type === 'css_var' && slot.variable) {
      cssVarOverrides.push(`  ${slot.variable}: ${sanitizeCssVar(value)};`)
    } else {
      result = applySlotToHtml(result, slot, value)
    }
  }
  return injectCssVarBlock(result, cssVarOverrides)
}

export function injectSlotValues(
  html: string,
  schema: SchemaJson,
  slides: Slide[],
  slideIndex: number
): string {
  const slide = slides[slideIndex]
  if (!slide) return html

  const slideNumber = slideIndex + 1
  // For single-slide templates, fall back to slide-1 slot definitions so every
  // carousel slide gets its own content via the slide's slots map.
  const perSlideSlots = getSlideSlots(schema, slideNumber)
  const slideSlots = perSlideSlots.length > 0 ? perSlideSlots : getSlideSlots(schema, 1)
  const applicableSlots = [...getGlobalSlots(schema), ...slideSlots]

  const pairs = applicableSlots
    .map(slot => ({ slot, value: resolveSlotValue(slot, slide) }))
    .filter(({ value }) => Boolean(value))

  return processSlots(html, pairs)
}

/**
 * Injects slot values for ALL slides in a single pass.
 * Each slide's slots have unique IDs (s1_*, s2_*, etc.) so this is safe.
 */
export function injectAllSlotValues(
  html: string,
  schema: SchemaJson,
  slides: Slide[]
): string {
  const pairs: Array<{ slot: SlotDefinition; value: string }> = []

  // Global slots — read value from slide 0 (shared across all slides)
  for (const slot of getGlobalSlots(schema)) {
    const value = slides[0] ? resolveSlotValue(slot, slides[0]) : ''
    if (value) pairs.push({ slot, value })
  }

  // Per-slide slots — each slide has uniquely named slot IDs
  for (let i = 0; i < slides.length; i++) {
    const slideNumber = i + 1
    for (const slot of getSlideSlots(schema, slideNumber)) {
      const value = resolveSlotValue(slot, slides[i])
      if (value) pairs.push({ slot, value })
    }
  }

  return processSlots(html, pairs)
}

/**
 * Sets the .active class on the nth .slide element (0-indexed) in the HTML string.
 * Removes .active from all other slides. Returns html unchanged if index out of range.
 */
export function activateSlide(html: string, slideIndex: number): string {
  // Collect all class="..." attributes that contain the word 'slide'
  const slidePattern = /class="([^"]*\bslide\b[^"]*)"/g
  const matches = [...html.matchAll(slidePattern)]

  if (slideIndex >= matches.length || slideIndex < 0) return html

  let result = html
  // Process in reverse so string offsets stay valid
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i]
    const currentClasses = match[1]
    const withoutActive = currentClasses
      .split(/\s+/)
      .filter(c => c !== 'active')
      .join(' ')
      .trim()
    const newClasses = i === slideIndex ? `${withoutActive} active`.trim() : withoutActive
    const start = match.index!
    const end = start + match[0].length
    result = result.slice(0, start) + `class="${newClasses}"` + result.slice(end)
  }

  return result
}

export function injectBridgeScript(html: string, schema: SchemaJson): string {
  const schemaJson = JSON.stringify(schema).replace(/<\/script>/gi, '<\\/script>')

  // NOTE: The JS inside this template literal runs in the browser iframe, not in Node.js.
  // console.error and var declarations here are browser-side code, not production TS logging.
  const script = `
<script id="__editor-bridge">
(function() {
  var schema = ${schemaJson};

  function applyUpdate(slotId, value) {
    var slot = schema.slots.find(function(s) { return s.id === slotId; });
    if (!slot) return;
    if (slot.type === 'text') {
      var el = document.querySelector(slot.selector);
      if (el) el.textContent = value;
    } else if (slot.type === 'css_var' && slot.variable) {
      document.documentElement.style.setProperty(slot.variable, value);
    } else if (slot.type === 'font_size') {
      var els = document.querySelectorAll('[data-slot-size="' + slotId + '"]');
      els.forEach(function(el) { el.style.fontSize = value + 'px'; });
    } else if (slot.type === 'toggle') {
      var toggleEl = document.querySelector(slot.selector);
      if (toggleEl) toggleEl.style.display = value === 'true' ? '' : 'none';
    }
  }

  window.addEventListener('message', function(e) {
    if (!e.data || typeof e.data !== 'object') return;
    if (e.data.type === 'UPDATE_SLOT') {
      applyUpdate(e.data.slotId, e.data.value);
    }
    if (e.data.type === 'SWITCH_SLIDE') {
      var allSlides = document.querySelectorAll('.slide');
      allSlides.forEach(function(s, idx) {
        if (idx === e.data.index) {
          s.classList.add('active');
        } else {
          s.classList.remove('active');
        }
      });
    }
    if (e.data.type === 'CAPTURE') {
      var slideEl = document.querySelector('.slide.active') || document.querySelector('.slide');
      if (!slideEl) { window.parent.postMessage({ type: 'CAPTURE_RESULT', dataUrl: null }, '*'); return; }
      var origTransform = slideEl.style.transform;
      var origTransformOrigin = slideEl.style.transformOrigin;
      slideEl.style.transform = 'none';
      slideEl.style.transformOrigin = 'top left';
      domtoimage.toPng(slideEl, { width: slideEl.offsetWidth, height: slideEl.offsetHeight, style: { transform: 'none' } })
        .then(function(dataUrl) {
          slideEl.style.transform = origTransform;
          slideEl.style.transformOrigin = origTransformOrigin;
          window.parent.postMessage({ type: 'CAPTURE_RESULT', dataUrl: dataUrl }, '*');
        })
        .catch(function(err) {
          console.error('Capture failed', err);
          window.parent.postMessage({ type: 'CAPTURE_RESULT', dataUrl: null }, '*');
        });
    }
  });

  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('[data-slot]').forEach(function(el) {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        var slotId = el.getAttribute('data-slot');
        var rect = el.getBoundingClientRect();
        window.parent.postMessage({
          type: 'SLOT_CLICK',
          slotId: slotId,
          currentValue: el.textContent || el.getAttribute('data-value') || '',
          rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
        }, '*');
      });
    });
  });
})();
</script>`

  const domToImageScript = `<script src="https://cdn.jsdelivr.net/npm/dom-to-image-more@3/dist/dom-to-image-more.min.js"></script>`
  return html.replace('</body>', `${domToImageScript}${script}\n</body>`)
}

/**
 * Overrides the template's canvas CSS variables so the design scales to the
 * chosen canvas size instead of always rendering at the hardcoded 1080×1350.
 * Sets --scale to 1 because SlidePreview handles visual scaling via iframe transform.
 */
function injectCanvasSize(html: string, width: number, height: number): string {
  // Override canvas dimensions at the CSS cascade level. A companion <script> also forces
  // inline styles via JS, because CSS rules can't beat inline style attributes — templates
  // that hardcode `style="transform: scale(0.5)"` on .slide need the JS path to neutralise
  // that transform. The <script> defers to DOMContentLoaded so .slide elements exist first.
  // .viewer is expanded to full size because templates hardcode it at 540×675 for preview.
  const styleOverride = `<style id="__canvas-override">\n:root{--sw:${width}px;--sh:${height}px;--scale:1}\nbody{width:${width}px!important;height:${height}px!important;overflow:hidden!important}\n.viewer{width:${width}px!important;height:${height}px!important;border-radius:0!important;box-shadow:none!important}\n.slide{width:${width}px!important;height:${height}px!important;transform:none!important;transform-origin:top left!important}\n</style>`
  // NOTE: JS in this template literal runs in the browser iframe, not Node.js.
  const scriptOverride = `<script id="__canvas-override-script">document.addEventListener('DOMContentLoaded', function() {
  var w = ${width}, h = ${height};
  document.querySelectorAll('.viewer').forEach(function(el) {
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.borderRadius = '0';
    el.style.boxShadow = 'none';
  });
  document.querySelectorAll('.slide').forEach(function(el) {
    el.style.transform = 'none';
    el.style.transformOrigin = 'top left';
    el.style.width = w + 'px';
    el.style.height = h + 'px';
  });
});</script>`
  const injection = `${styleOverride}\n${scriptOverride}`
  if (html.includes('</head>')) return html.replace('</head>', `${injection}\n</head>`)
  if (html.includes('<head>')) return html.replace('<head>', `<head>${injection}`)
  return html
}

export interface BuildSrcdocOptions {
  canvasWidth?: number
  canvasHeight?: number
}

export function buildSrcdoc(
  templateHtml: string,
  schema: SchemaJson,
  slides: Slide[],
  slideIndex: number,
  options: BuildSrcdocOptions = {},
): string {
  const { canvasWidth = 1080, canvasHeight = 1350 } = options
  const sized = injectCanvasSize(templateHtml, canvasWidth, canvasHeight)
  const withAllValues = injectAllSlotValues(sized, schema, slides)
  const withActiveSlide = activateSlide(withAllValues, slideIndex)
  return injectBridgeScript(withActiveSlide, schema)
}
