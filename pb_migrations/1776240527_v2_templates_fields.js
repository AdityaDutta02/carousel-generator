/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_184785686") // templates

  // Add template_json field
  collection.fields.addAt(collection.fields.length, new Field({
    "hidden": false,
    "id": "json_template_json",
    "maxSize": 0,
    "name": "template_json",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  // Add is_system field
  collection.fields.addAt(collection.fields.length, new Field({
    "hidden": false,
    "id": "bool_is_system",
    "name": "is_system",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
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
  const collection = app.findCollectionByNameOrId("pbc_184785686")

  collection.fields.removeById("json_template_json")
  collection.fields.removeById("bool_is_system")

  // Restore auth rules
  unmarshal({
    "createRule": "@request.auth.id != \"\"",
    "deleteRule": "owner = @request.auth.id",
    "listRule": "scope = \"system\" || owner = @request.auth.id",
    "updateRule": "owner = @request.auth.id",
    "viewRule": "scope = \"system\" || owner = @request.auth.id"
  }, collection)

  return app.save(collection)
})
