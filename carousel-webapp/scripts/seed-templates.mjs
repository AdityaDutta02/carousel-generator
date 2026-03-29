// scripts/seed-templates.mjs
// Run: node scripts/seed-templates.mjs
// Env: NEXT_PUBLIC_POCKETBASE_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const WEBAPP_ROOT = path.resolve(__dirname, '..')
const BASE = process.env.NEXT_PUBLIC_POCKETBASE_URL ?? 'http://127.0.0.1:8090'
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD env vars')
  process.exit(1)
}

// Auth via _superusers collection (PocketBase 0.23+)
const authRes = await fetch(`${BASE}/api/collections/_superusers/auth-with-password`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
})
const authBody = await authRes.json()
const token = authBody.token
if (!token) {
  console.error('Auth failed:', JSON.stringify(authBody))
  process.exit(1)
}
console.log('Authenticated')

// Load schemas from template-schemas.json if the template conversion agent wrote it
let schemas = {}
const schemasPath = path.resolve(__dirname, 'template-schemas.json')
if (fs.existsSync(schemasPath)) {
  schemas = JSON.parse(fs.readFileSync(schemasPath, 'utf8'))
  console.log('Loaded schemas from template-schemas.json')
} else {
  console.log('template-schemas.json not found — using inline fallback schemas')
}

function resolveHtmlFile(filename) {
  const publicPath = path.resolve(WEBAPP_ROOT, 'public/templates', filename)
  const originalPath = path.resolve(ROOT, 'templates', filename)
  if (fs.existsSync(publicPath)) return publicPath
  if (fs.existsSync(originalPath)) return originalPath
  return null
}

const TEMPLATES = [
  {
    name: 'Editorial (Cream)',
    file: 'template-1-editorial.html',
    schemaKey: 'template-1-editorial',
    scope: 'system',
    canvas_width: 1080,
    canvas_height: 1350,
    slide_count_default: 8,
    platform_tags: 'linkedin,instagram',
    fallbackSchema: {
      version: 1,
      slots: [
        { id: 's1_headline', slide: 1, selector: "[data-slot='s1_headline']", type: 'text', label: 'Cover Headline', maxChars: 80 },
        { id: 'accent', slide: 'all', selector: ':root', type: 'css_var', variable: '--accent', label: 'Accent Color', default: '#E05828' },
      ],
    },
  },
  {
    name: 'Data (Dark)',
    file: 'template-2-data.html',
    schemaKey: 'template-2-data',
    scope: 'system',
    canvas_width: 1080,
    canvas_height: 1350,
    slide_count_default: 7,
    platform_tags: 'linkedin,instagram',
    fallbackSchema: {
      version: 1,
      slots: [
        { id: 's1_stat', slide: 1, selector: "[data-slot='s1_stat']", type: 'text', label: 'Big Stat', maxChars: 20 },
        { id: 'accent', slide: 'all', selector: ':root', type: 'css_var', variable: '--accent', label: 'Accent Color', default: '#E05828' },
      ],
    },
  },
  {
    name: 'Card (Orange)',
    file: 'template-3-card.html',
    schemaKey: 'template-3-card',
    scope: 'system',
    canvas_width: 1080,
    canvas_height: 1350,
    slide_count_default: 6,
    platform_tags: 'linkedin,instagram',
    fallbackSchema: {
      version: 1,
      slots: [
        { id: 's1_statement', slide: 1, selector: "[data-slot='s1_statement']", type: 'text', label: 'Statement', maxChars: 120 },
      ],
    },
  },
  {
    name: 'Notebook (Yellow)',
    file: 'template-4-notebook.html',
    schemaKey: 'template-4-notebook',
    scope: 'system',
    canvas_width: 1080,
    canvas_height: 1350,
    slide_count_default: 7,
    platform_tags: 'linkedin,instagram',
    fallbackSchema: {
      version: 1,
      slots: [
        { id: 's1_headline', slide: 1, selector: "[data-slot='s1_headline']", type: 'text', label: 'Headline', maxChars: 80 },
        { id: 'bg', slide: 'all', selector: ':root', type: 'css_var', variable: '--bg', label: 'Background', default: '#C4EA58' },
      ],
    },
  },
]

for (const t of TEMPLATES) {
  const htmlPath = resolveHtmlFile(t.file)
  if (!htmlPath) {
    console.warn(`Skipping ${t.name} — HTML file not found (checked public/templates/ and ../../templates/)`)
    continue
  }

  const schema = schemas[t.schemaKey] ?? t.fallbackSchema
  const htmlContent = fs.readFileSync(htmlPath)

  // Build multipart/form-data manually — no SDK dependency
  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
  const parts = []

  function addField(name, value) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}`
    )
  }

  addField('name', t.name)
  addField('title', t.name)
  addField('scope', t.scope)
  addField('canvas_width', String(t.canvas_width))
  addField('canvas_height', String(t.canvas_height))
  addField('slide_count_default', String(t.slide_count_default))
  addField('platform_tags', t.platform_tags)
  addField('schema_json', JSON.stringify(schema))

  const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="html_file"; filename="${t.file}"\r\nContent-Type: text/html\r\n\r\n`
  const closing = `\r\n--${boundary}--`

  const encoder = new TextEncoder()
  const headerBytes = encoder.encode(parts.join('\r\n') + '\r\n' + fileHeader)
  const closingBytes = encoder.encode(closing)
  const body = new Uint8Array(headerBytes.length + htmlContent.length + closingBytes.length)
  body.set(headerBytes, 0)
  body.set(new Uint8Array(htmlContent.buffer, htmlContent.byteOffset, htmlContent.byteLength), headerBytes.length)
  body.set(closingBytes, headerBytes.length + htmlContent.length)

  const res = await fetch(`${BASE}/api/collections/templates/records`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  })

  const data = await res.json()
  if (res.ok) {
    console.log(`Seeded: ${t.name} (id: ${data.id})`)
  } else {
    console.error(`Failed: ${t.name}:`, data.message ?? JSON.stringify(data))
  }
}

console.log('\nDone. Start the dev server and open /templates to verify.')
