// carousel-webapp/scripts/seed-templates.mjs
// Run: node scripts/seed-templates.mjs
// Requires: NEXT_PUBLIC_POCKETBASE_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD env vars
import PocketBase from 'pocketbase'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../../')
const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL ?? 'http://127.0.0.1:8090'
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD

const TEMPLATES = [
  {
    name: 'Editorial (Cream)',
    file: 'templates/template-1-editorial.html',
    platform_tags: ['linkedin', 'instagram'],
    canvas_width: 1080,
    canvas_height: 1350,
    slide_count_default: 8,
    schema_json: {
      version: 1,
      slots: [
        { id: 's1_headline', slide: 1, selector: "[data-slot='s1_headline']", type: 'text', label: 'Cover Headline', maxChars: 80 },
        { id: 'accent', slide: 'all', selector: ':root', type: 'css_var', variable: '--accent', label: 'Accent Color', default: '#E05828' },
      ],
    },
  },
  {
    name: 'Data (Dark)',
    file: 'templates/template-2-data.html',
    platform_tags: ['linkedin', 'instagram'],
    canvas_width: 1080,
    canvas_height: 1350,
    slide_count_default: 7,
    schema_json: {
      version: 1,
      slots: [
        { id: 's1_stat', slide: 1, selector: "[data-slot='s1_stat']", type: 'text', label: 'Big Stat', maxChars: 20 },
        { id: 'accent', slide: 'all', selector: ':root', type: 'css_var', variable: '--accent', label: 'Accent Color', default: '#E05828' },
      ],
    },
  },
  {
    name: 'Card (Orange)',
    file: 'templates/template-3-card.html',
    platform_tags: ['linkedin', 'instagram'],
    canvas_width: 1080,
    canvas_height: 1350,
    slide_count_default: 6,
    schema_json: {
      version: 1,
      slots: [
        { id: 's1_statement', slide: 1, selector: "[data-slot='s1_statement']", type: 'text', label: 'Statement', maxChars: 120 },
      ],
    },
  },
  {
    name: 'Notebook (Yellow)',
    file: 'templates/template-4-notebook.html',
    platform_tags: ['linkedin', 'instagram'],
    canvas_width: 1080,
    canvas_height: 1350,
    slide_count_default: 7,
    schema_json: {
      version: 1,
      slots: [
        { id: 's1_headline', slide: 1, selector: "[data-slot='s1_headline']", type: 'text', label: 'Headline', maxChars: 80 },
        { id: 'bg', slide: 'all', selector: ':root', type: 'css_var', variable: '--bg', label: 'Background', default: '#C4EA58' },
      ],
    },
  },
]

const pb = new PocketBase(PB_URL)
await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD)

for (const t of TEMPLATES) {
  const htmlPath = path.resolve(ROOT, t.file)
  if (!fs.existsSync(htmlPath)) {
    console.warn(`Skipping ${t.name} — file not found: ${htmlPath}`)
    continue
  }

  const htmlBlob = new Blob([fs.readFileSync(htmlPath)], { type: 'text/html' })
  const form = new FormData()
  form.append('name', t.name)
  form.append('scope', 'system')
  form.append('canvas_width', String(t.canvas_width))
  form.append('canvas_height', String(t.canvas_height))
  form.append('slide_count_default', String(t.slide_count_default))
  form.append('platform_tags', t.platform_tags.join(','))
  form.append('schema_json', JSON.stringify(t.schema_json))
  form.append('html_file', htmlBlob, path.basename(t.file))

  await pb.collection('templates').create(form)
  console.log(`✓ Seeded: ${t.name}`)
}
console.log('Done.')
