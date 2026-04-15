/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_184785686") // templates

  unmarshal({
    "fields": [
      {
        "hidden": false,
        "id": "json_template_json",
        "maxSize": 0,
        "name": "template_json",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "hidden": false,
        "id": "file_thumbnail",
        "maxSelect": 1,
        "maxSize": 5242880,
        "mimeTypes": ["image/png", "image/jpeg", "image/webp"],
        "name": "thumbnail",
        "presentable": false,
        "protected": false,
        "required": false,
        "system": false,
        "thumbs": ["300x300t"],
        "type": "file"
      },
      {
        "hidden": false,
        "id": "bool_is_system",
        "name": "is_system",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      }
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_184785686")
  const fields = collection.fields
  for (const f of ["json_template_json", "file_thumbnail", "bool_is_system"]) {
    const idx = fields.findIndex((x) => x.id === f)
    if (idx >= 0) fields.splice(idx, 1)
  }
  return app.save(collection)
})
