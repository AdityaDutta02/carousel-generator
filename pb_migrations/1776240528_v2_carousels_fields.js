/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2134441684") // carousels

  unmarshal({
    "fields": [
      {
        "hidden": false,
        "id": "json_content_json",
        "maxSize": 0,
        "name": "content_json",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "hidden": false,
        "id": "text_html_cache",
        "max": null,
        "min": null,
        "name": "html_cache",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      }
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2134441684")
  const fields = collection.fields
  for (const f of ["json_content_json", "text_html_cache"]) {
    const idx = fields.findIndex((x) => x.id === f)
    if (idx >= 0) fields.splice(idx, 1)
  }
  return app.save(collection)
})
