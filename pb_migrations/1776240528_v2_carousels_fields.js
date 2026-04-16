/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2134441684") // carousels

  // Add name field (app uses 'name'; original collection has 'title')
  collection.fields.addAt(collection.fields.length, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text_name",
    "max": 0,
    "min": 0,
    "name": "name",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // Add content_json field
  collection.fields.addAt(collection.fields.length, new Field({
    "hidden": false,
    "id": "json_content_json",
    "maxSize": 0,
    "name": "content_json",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  // Add html_cache field
  collection.fields.addAt(collection.fields.length, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text_html_cache",
    "max": 0,
    "min": 0,
    "name": "html_cache",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // Open rules for single-user local v2 (no auth required)
  unmarshal({
    "createRule": "",
    "deleteRule": "",
    "listRule": "",
    "updateRule": "",
    "viewRule": ""
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2134441684")

  collection.fields.removeById("text_name")
  collection.fields.removeById("json_content_json")
  collection.fields.removeById("text_html_cache")

  // Restore original rules
  unmarshal({
    "createRule": "@request.auth.id != \"\"",
    "deleteRule": "owner = @request.auth.id",
    "listRule": "owner = @request.auth.id",
    "updateRule": "owner = @request.auth.id",
    "viewRule": "owner = @request.auth.id"
  }, collection)

  return app.save(collection)
})
