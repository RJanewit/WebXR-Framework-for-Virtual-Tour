const mongoose = require("mongoose");

const hotspotSchema = new mongoose.Schema(
  {
    scene_id: { type: String, required: true },

    target_scene_id: { type: String },

    type: { type: String, required: true }, // ประเภท (เช่น 'door', 'ring', 'arrow', 'image', 'video', 'model', 'popup')

    // พิกัด 3D
    x: { type: Number, required: true },
    y: { type: Number, default: 0 },
    z: { type: Number, required: true },

    // การตั้งค่าเฉพาะประเภท (ไม่จำเป็นต้องมีทุกอัน)
    angle: { type: Number }, // มุมระนาบ XZ สำหรับลูกศร
    scale: { type: Number }, // สเกลขนาด
    width: { type: Number }, // ความกว้าง (รูป/วิดีโอ)
    height: { type: Number }, // ความสูง (รูป/วิดีโอ) - แก้คำผิดจาก hieght
    path: { type: String }, // ที่อยู่ไฟล์มีเดีย
    color: { type: String }, // สีของ hotspot
  },
  { timestamps: true, versionKey: false }
);

let Hotspot = mongoose.model("Hotspot", hotspotSchema);

module.exports = Hotspot;
