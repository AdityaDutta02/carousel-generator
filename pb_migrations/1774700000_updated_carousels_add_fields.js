/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2134441684")

  // add field
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "number_canvas_width",
    "max": null,
    "min": null,
    "name": "canvas_width",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "hidden": false,
    "id": "number_canvas_height",
    "max": null,
    "min": null,
    "name": "canvas_height",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(7, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text_platform",
    "max": 0,
    "min": 0,
    "name": "platform",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text_status",
    "max": 0,
    "min": 0,
    "name": "status",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2134441684")

  collection.fields.removeById("number_canvas_width")
  collection.fields.removeById("number_canvas_height")
  collection.fields.removeById("text_platform")
  collection.fields.removeById("text_status")

  return app.save(collection)
})
