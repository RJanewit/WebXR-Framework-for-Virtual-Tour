const express = require("express");
const router = express.Router();
const Scene = require("../models/Scene");
const Hotspot = require("../models/Hotspots");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const Data = require("../models/Data");

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
      return res.status(401).json({ error: "Unauthorized"});
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
    return res.status(403).json({ error: "Forbidden: Admins only"})
  }
}

router.post("/scenes", (req, res) => {
  const newScene = new Scene({
    name: req.body.name,
    image_url: req.body.image_url,
    zone: req.body.zone || "default", // กำหนดโซนเริ่มต้นเป็น 'default'
    start_rotation: req.body.start_rotation || 0, // กำหนดมุมกล้องเริ่มต้นเป็น 0
  });
  Scene.addScene(newScene);
  res.status(201).json({ message: "Scene added successfully", data: newScene });
  console.log("Scene added successfully data: ", newScene);
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

router.patch("/scenes/:id", async (req, res) => {
  const sceneId = req.params.id;
  const updateData = req.body;

  try {
    const updatedScene = await Scene.editScene(Scene, sceneId, updateData);
    if (updatedScene) {
      res
        .status(200)
        .json({ message: "Scene updated successfully", data: updatedScene });
    } else {
      res.status(404).json({ message: "Scene not found" });
    }
  } catch (err) {
    console.error("Error updating scene:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// [PUT] แก้ไขข้อมูล Scene ด้วยชื่อฉาก (name) แทน ID
// ==========================================
router.put("/scenes/:name", async (req, res) => {
  try {
    // 1. รับ "ชื่อฉาก" ที่ต้องการแก้ จาก URL (เช่น breakroom1)
    const targetName = req.params.name;
    const updateData = req.body;

    // 2. สั่ง Mongoose ให้ค้นหาตามฟิลด์ { name: targetName }
    // และเอา updateData ไปอัปเดตทับข้อมูลเดิม
    const updatedScene = await Scene.findOneAndUpdate(
      { name: targetName }, // <--- ค้นหาด้วยชื่อตรงนี้!
      updateData,
      { new: true },
    );

    if (!updatedScene) {
      return res
        .status(404)
        .json({ message: `ไม่พบข้อมูล Scene ที่ชื่อ: ${targetName}` });
    }

    console.log("✅ Scene updated successfully:", updatedScene);
    res.status(200).json({ message: "แก้ไขข้อมูลสำเร็จ!", data: updatedScene });
  } catch (err) {
    console.error("❌ Error updating scene:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/users/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    await User.registerUser(User, username, password);
    res.status(201).json({ message: "User registered successfully" });
    console.log("User registered successfully: ", username);
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(400).json({ error: error.message });
  }
});

router.post("/users/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
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

router.get("/datas", async (req, res) => {
  try {
    const datas = await Data.find();
    res.status(200).json(datas); // ส่ง JSON กลับไป
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/users/all", checkToken, isAdmin, async (req, res) => {
  try {

    const users = await User.find();
    res.status(200).json(users);
  } catch (error) {
    console.error("Authentication failed:", error);
    res.status(401).json({ error: "Unauthorized" });
  }
});

module.exports = router;
