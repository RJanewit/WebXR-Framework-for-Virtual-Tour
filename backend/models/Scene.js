const mongoose = require("mongoose");

const sceneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // ชื่อฉาก (รหัสฉากใน JSON เดิมของคุณ)
    zone: { type: String, required: true }, // ชื่อโซนกลุ่ม
    image_url: { type: String, required: true }, // ที่อยู่ไฟล์รูปภาพ 360
    start_rotation: { type: Number, default: 0 }, // มุมกล้องเริ่มต้น (แก้คำผิดจาก start_rotatin)
  },
  { timestamps: true, versionKey: false }
); // เพิ่ม timestamps ให้รู้ว่าสร้าง/แก้เมื่อไหร่ (option เสริมที่ดี)

let Scene = mongoose.model("scenes", sceneSchema);
module.exports = Scene;

module.exports.addScene = async function (model, document) {
  try {
    await model.save(document);
  } catch (err) {
    console.error("Error adding scene:", err);
  }
};

module.exports.editScene = async function (model, id, updateData) {
  try {
    await model.findByIdAndUpdate(id, updateData, { new: true });
  } catch (err) {
    console.error("Error editing scene:", err);
  }
};

module.exports.findScene = async function (model, id) {
  try {
    await model.findById(id);
  } catch (err) {
    console.error("Scene not found:", err);
  }
};
