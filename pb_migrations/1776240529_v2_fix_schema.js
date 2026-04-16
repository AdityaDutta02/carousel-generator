/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Templates: make title not required (app sends 'name' not 'title')
  const templates = app.findCollectionByNameOrId("pbc_184785686")
  const titleField = templates.fields.getByName("title")
  if (titleField) {
    titleField.required = false
  }
  app.save(templates)

  // Carousels: make owner not required (v2 has no auth)
  const carousels = app.findCollectionByNameOrId("pbc_2134441684")
  const ownerField = carousels.fields.getByName("owner")
  if (ownerField) {
    ownerField.required = false
  }
  return app.save(carousels)
}, (app) => {
  const templates = app.findCollectionByNameOrId("pbc_184785686")
  const titleField = templates.fields.getByName("title")
  if (titleField) titleField.required = true
  app.save(templates)

  const carousels = app.findCollectionByNameOrId("pbc_2134441684")
  const ownerField = carousels.fields.getByName("owner")
  if (ownerField) ownerField.required = true
  return app.save(carousels)
})
