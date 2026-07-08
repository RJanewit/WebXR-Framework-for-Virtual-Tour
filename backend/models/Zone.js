const mongoose = require("mongoose");

const zoneSchema = new mongoose.Schema(
  {
    order: { type: Number, required: true },
    name: { type: String, required: true },
    position: {
      map_x: { type: Number, required: true },
      map_y: { type: Number, required: true },
    },
    target_scene: { type: String }
  },
  { timestamps: true, versionKey: false }
);

let Zone = mongoose.model("Zone", zoneSchema);
module.exports = Zone;
