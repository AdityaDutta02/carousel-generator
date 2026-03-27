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

export function injectSlotValues(
  html: string,
  schema: SchemaJson,
  slides: Slide[],
  slideIndex: number
): string {
  const slide = slides[slideIndex]
  if (!slide) return html

  const slideNumber = slideIndex + 1
  const applicableSlots = [
    ...getGlobalSlots(schema),
    ...getSlideSlots(schema, slideNumber),
  ]

  let result = html
  const cssVarOverrides: string[] = []

  for (const slot of applicableSlots) {
    const value = resolveSlotValue(slot, slide)
    if (!value) continue

    if (slot.type === 'text') {
      const escapedId = slot.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      result = result.replace(
        new RegExp(`(<[^>]+data-slot="${escapedId}"[^>]*>)[^<]*(</[^>]+>)`, 'g'),
        `$1${escapeHtml(value)}$2`
      )
    } else if (slot.type === 'css_var' && slot.variable) {
      cssVarOverrides.push(`  ${slot.variable}: ${sanitizeCssVar(value)};`)
    } else if (slot.type === 'font_size') {
      const safeSize = sanitizeFontSize(value)
      result = result.replace(
        new RegExp(`(<[^>]+data-slot-size="${slot.id}"[^>]*style=")([^"]*)(")`,'g'),
        `$1$2 font-size: ${safeSize};$3`
      )
    }
  }

  if (cssVarOverrides.length > 0) {
    const styleBlock = `<style id="__slot-vars">:root {\n${cssVarOverrides.join('\n')}\n}</style>`
    result = result.replace('</head>', `${styleBlock}\n</head>`)
  }

  return result
}

export function injectBridgeScript(html: string, schema: SchemaJson): string {
  const schemaJson = JSON.stringify(schema)

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

export function buildSrcdoc(
  templateHtml: string,
  schema: SchemaJson,
  slides: Slide[],
  slideIndex: number
): string {
  const withValues = injectSlotValues(templateHtml, schema, slides, slideIndex)
  return injectBridgeScript(withValues, schema)
}
