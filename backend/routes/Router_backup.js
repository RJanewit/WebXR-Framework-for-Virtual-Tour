const express = require("express");
const path = require("path");
const router = express.Router();
const Scene = require("../models/Scene");
const Hotspot = require("../models/Hotspot");
const User = require("../models/User");
const Zone = require("../models/Zone");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
const sharp = require("sharp");

const secretKey = "KTS";

const checkToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, secretKey);

    const checkResult = await User.findOne({ username: decoded.username });
    if (!checkResult) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.user = checkResult;

    next();
  } catch (error) {
    console.error("Authentiation failed:", error);
    res.status(401).json({ error: "Unauthorized" });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    return res.status(403).json({ error: "Forbidden: Admins only" });
  }
};

// 🌟 1. แก้ไข Multer Config ให้เซฟไฟล์และตั้งชื่อใหม่ป้องกันชื่อซ้ำ
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed"), false);
    }
  },
});

router.use("/images", express.static(path.join(__dirname, "..", "storage")));

const mediaDir = path.join(__dirname, "..", "storage", "media");

const mediaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sceneName = req.body.sceneName || 'default';
    const sanitizedScene = sceneName.trim().replace(/\s+/g, "_");
    const dynamicDir = path.join(mediaDir, sanitizedScene);
    
    if (!fs.existsSync(dynamicDir)) {
      fs.mkdirSync(dynamicDir, { recursive: true });
    }
    
    cb(null, dynamicDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "media-" + uniqueSuffix + ext);
  },
});

const uploadMedia = multer({ storage: mediaStorage });

router.use("/media", express.static(mediaDir));

router.post("/upload", uploadMedia.single("media"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No media file uploaded" });
    }

    const sceneName = req.body.sceneName || 'default';
    const sanitizedScene = sceneName.trim().replace(/\s+/g, "_");

    // 🌟 ต่อ URL ส่งกลับให้ตรงกับโฟลเดอร์ย่อยที่เราเพิ่งสร้าง
    const filePath = `/api/media/${sanitizedScene}/${req.file.filename}`;

    res.status(200).json({
      message: "Media uploaded successfully",
      filePath: filePath,
    });
    
    console.log("Media uploaded successfully: ", filePath);
  } catch (error) {
    console.error("Error uploading media:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// =         CRUD API For User            =
// ==========================================

router.post("/users/insert", async (req, res) => {
  const { username, password, role } = req.body;
  try {
    await User.registerUser(User, username, password, role);
    res.status(201).json({ message: "User registered successfully" });
    console.log("User registered successfully: ", username);
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(400).json({ error: error.message });
  }
});

router.put("/users/:username", async (req, res) => {
  const targetUsername = req.params.username;
  const { username, password, role } = req.body;
  try {
    const user = await User.findOne({ username: targetUsername });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    // Update user information
    user.username = username || user.username;
    user.password = password || user.password;
    user.role = role || user.role;
    await user.save();
    res.status(200).json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(400).json({ error: error.message });
  }
});

router.post("/users/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }

  try {
    const user = await User.loginUser(User, username, password);
    const token = jwt.sign(
      { username: user.username, role: user.role },
      secretKey,
      { expiresIn: "1h" },
    );
    res.status(200).json({ message: "Login successful", token: token });
    console.log("User logged in successfully: ", token);
  } catch (error) {
    console.error("Error logging in user:", error);
    res.status(401).json({ error: error.message });
  }
});

router.get("/users", async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (error) {
    console.error("Authentication failed:", error);
    res.status(401).json({ error: "Unauthorized" });
  }
});

router.delete("/users/:username", async (req, res) => {
  const targetUsername = req.params.username;
  try {
    const user = await User.findOne({ username: targetUsername });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    await User.deleteOne({ username: targetUsername });
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(400).json({ error: error.message });
  }
});

// ==========================================
// =         CRUD API For Scene           =
// ==========================================

router.post("/scenes", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file uploaded" });
    }

    const sceneName = req.body.name;
    const zoneName = req.body.zone || "default";

    // 🌟 2. ทำความสะอาดชื่อโซนและชื่อซีน (ตัดช่องว่าง เปลี่ยนช่องว่างเป็นตัวขีดล่าง เพื่อป้องกัน URL พัง)
    const sanitizedZone = zoneName.trim().replace(/\s+/g, "_");
    const sanitizedScene = sceneName.trim().replace(/\s+/g, "_");

    // กำหนดโครงสร้างโฟลเดอร์ทางกายภาพ (Absolute Path สำหรับสร้างไฟล์)
    const panoramaDir = path.join(
      __dirname,
      "..",
      "storage",
      "panorama",
      sanitizedZone,
    );
    const thumbnailDir = path.join(
      __dirname,
      "..",
      "storage",
      "thumbnails",
      sanitizedZone,
    );

    // 🌟 3. ตรวจสอบและสร้างโฟลเดอร์ปลายทางอัติโนมัติ (ถ้ายังไม่มี ระบบจะสร้างให้เองแบบทับซ้อน recursive)
    fs.mkdirSync(panoramaDir, { recursive: true });
    fs.mkdirSync(thumbnailDir, { recursive: true });

    // กำหนด Path เต็มสำหรับการบันทึกไฟล์ .webp
    const fullPanoramaPath = path.join(panoramaDir, `${sanitizedScene}.webp`);
    const thumbnailPath = path.join(thumbnailDir, `${sanitizedScene}.webp`);

    // 🌟 4. ประมวลผลรูปที่ 1: แปลงเป็น .webp (รูปขนาดจริง Panorama) กำหนดคุณภาพภาพ 85%
    await sharp(req.file.buffer).webp({ quality: 85 }).toFile(fullPanoramaPath);

    // 🌟 5. ประมวลผลรูปที่ 2: ย่อขนาดความกว้าง (เหลือ 450px กำลังสวยสำหรับการ์ด UI) และแปลงเป็น .webp คุณภาพ 75%
    await sharp(req.file.buffer)
      .resize(450) // ย่อขนาดความกว้าง ส่วนความสูงจะสเกลตามสัดส่วนออโต้ (Aspect Ratio คงเดิม)
      .webp({ quality: 75 })
      .toFile(thumbnailPath);

    // กำหนด URL Path สำหรับเก็บบันทึกลงฐานข้อมูล (เพื่อให้เข้าเงื่อนไข static route /api/images)
    const dbImagePath = `/api/images/panorama/${sanitizedZone}/${sanitizedScene}.webp`;

    // 🌟 6. บันทึกข้อมูลลงฐานข้อมูล
    const newScene = new Scene({
      name: sanitizedScene,
      image_path: dbImagePath, // เก็บ path รูปใหญ่ (ฝั่ง frontend จะใช้ .replace() แปลงไปหา thumbnail เองตามโค้ดที่คุณเขียนไว้)
      image_url: dbImagePath, // ใส่คู่ไว้เผื่อ schema เรียกชื่อฟิลด์ต่างกัน
      zone: zoneName,
      start_rotation: 0,
    });

    await newScene.save();
    res.status(201).json({
      message: "Scene added and images processed successfully",
      data: newScene,
    });
    console.log(
      "Scene added & images converted to webp successfully:",
      sanitizedScene,
    );
  } catch (error) {
    console.error("Error processing scene images:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/scenes", async (req, res) => {
  try {
    const scenes = await Scene.find();
    res.status(200).json(scenes);
  } catch (err) {
    console.error("Error fetching scenes:", err);
    res.status(500).json({ error: err.message });
  }
});

router.put("/scenes/:name", async (req, res) => {
  try {
    const targetName = req.params.name;
    const updateData = req.body;

    const updatedScene = await Scene.findOneAndUpdate(
      { name: targetName },
      updateData,
      { new: true },
    );

    if (!updatedScene) {
      return res
        .status(404)
        .json({ message: `ไม่พบข้อมูล Scene ที่ชื่อ: ${targetName}` });
    }

    console.log("Scene updated successfully:", updatedScene);
    res.status(200).json({ message: "แก้ไขข้อมูลสำเร็จ!", data: updatedScene });
  } catch (err) {
    console.error("Error updating scene:", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/scenes/:name", async (req, res) => {
  const targetName = req.params.name;
  try {
    const scene = await Scene.findOne({ name: targetName });
    if (!scene) {
      return res.status(404).json({ error: "Scene not found" });
    }
    await Scene.deleteOne({ name: targetName });
    res.status(200).json({ message: "Scene deleted successfully" });
  } catch (error) {
    console.error("Error deleting scene:", error);
    res.status(400).json({ error: error.message });
  }
});

// ==========================================
// =         CRUD API For Hotspot         =
// ==========================================

router.get("/hotspots", async (req, res) => {
  try {
    const hotspots = await Hotspot.find();
    res.status(200).json(hotspots);
  } catch (err) {
    console.error("Error fetching hotspots:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/hotspots", async (req, res) => {
  const newHotspot = new Hotspot({
    scene_id: req.body.scene_id,
    target_scene_id: req.body.target_scene_id,
    type: req.body.type,
    x: req.body.x,
    y: req.body.y,
    z: req.body.z,
    path: req.body.path || "",
    scale: req.body.scale || 1,
    angle: req.body.angle || 0,
    color: req.body.color || "#ffffff",
    width: req.body.width || 30,
    height: req.body.height || 30,
  });
  await newHotspot.save();
  res
    .status(201)
    .json({ message: "Hotspot added successfully", data: newHotspot });
  console.log("Hotspot added successfully data: ", newHotspot);
});

router.delete("/hotspots/:id", async (req, res) => {
  const hotspotId = req.params.id;
  try {
    const hotspot = await Hotspot.findById(hotspotId);
    if (!hotspot) {
      return res.status(404).json({ error: "Hotspot not found" });
    }
    await Hotspot.deleteOne({ _id: hotspotId });
    res.status(200).json({ message: "Hotspot deleted successfully: " });
  } catch (error) {
    console.error("Error deleting hotspot:", error);
    res.status(400).json({ error: error.message });
  }
});

router.put("/hotspots/:id", async (req, res) => {
  const hotspotId = req.params.id;
  const updateData = req.body;
  try {
    const updatedHotspot = await Hotspot.findByIdAndUpdate(
      hotspotId,
      updateData,
      { new: true },
    );
    if (!updatedHotspot) {
      return res.status(404).json({ error: "Hotspot not found" });
    }
    res
      .status(200)
      .json({ message: "Hotspot updated successfully", data: updatedHotspot });
  } catch (error) {
    console.error("Error updating hotspot:", error);
    res.status(400).json({ error: error.message });
  }
});

// ==========================================
// =           CRUD API For Zone            =
// ==========================================
router.put("/zones/reorder", async (req, res) => {
  const { orderedNames } = req.body;
  try {
    console.log("Reordering zones with new order:", orderedNames);
    for (let i = 0; i < orderedNames.length; i++) {
      const name = orderedNames[i];
      await Zone.findOneAndUpdate({ name: name }, { order: i });
    }
  } catch (error) {
    console.error("Error reordering zones:", error);
    return res.status(400).json({ error: error.message });
  }
  res.status(200).json({ message: "Zones reordered successfully" });
});

router.get("/zones", async (req, res) => {
  try {
    const zones = await Zone.find();
    res.status(200).json(zones);
  } catch (err) {
    console.error("Error fetching zones:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/zones", async (req, res) => {
  const newZone = new Zone({
    order: req.body.order,
    name: req.body.name,
    position: req.body.position
  });
  try {
    await newZone.save();
    res.status(201).json({ message: "Zone added successfully", data: newZone });
  } catch (error) {
    console.error("Error adding zone:", error);
    res.status(400).json({ error: error.message });
  }
});

router.delete("/zones/:id", async (req, res) => {
  const zoneId = req.params.id;
  try {
    const zone = await Zone.findById(zoneId);
    if (!zone) {
      return res.status(404).json({ error: "Zone not found" });
    }
    await Zone.deleteOne({ _id: zoneId });
    res.status(200).json({ message: "Zone deleted successfully" });
  } catch (error) {
    console.error("Error deleting zone:", error);
    res.status(400).json({ error: error.message });
  }
});

router.put("/zones/:id", async (req, res) => {
  const zoneId = req.params.id;
  const updateData = req.body;
  try {
    const updatedZone = await Zone.findByIdAndUpdate(zoneId, updateData, {
      new: true,
    });
    if (!updatedZone) {
      return res.status(404).json({ error: "Zone not found" });
    }
    res
      .status(200)
      .json({ message: "Zone updated successfully", data: updatedZone });
  } catch (error) {
    console.error("Error updating zone:", error);
    res.status(400).json({ error: error.message });
  }
});


router.put("/zones/:name/map", async (req, res) => {
  const zoneName = req.params.name;
  const { map_x, map_y } = req.body;
  try {
    const updatedZone = await Zone.findOneAndUpdate(
      { name: zoneName },
      { $set: { "position.map_x": map_x, "position.map_y": map_y } },
      { new: true }
    );
    if (!updatedZone) {
      return res.status(404).json({ error: "Zone not found" });
    }
    res.status(200).json({ message: "Zone map position updated successfully", data: updatedZone });
  } catch (error) {
    console.error("Error updating zone map position:", error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
