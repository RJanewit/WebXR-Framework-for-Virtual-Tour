const express = require("express");
const path = require("path");
const router = express.Router();
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
const fsp = require("fs").promises;
const sharp = require("sharp");

const dbPath = path.join(__dirname, "..", "database.json");

const generateId = () => Date.now().toString(16) + Math.random().toString(16).substring(2);

async function readDB() {
  try {
    const data = await fsp.readFile(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    const defaultDb = { users: [], scenes: [], hotspots: [], zones: [] };
    defaultDb.users.push({ id: generateId(), username: "admin", password: "password", role: "admin" });
    await fsp.writeFile(dbPath, JSON.stringify(defaultDb, null, 2), 'utf8');
    return defaultDb;
  }
}

async function writeDB(db) {
  await fsp.writeFile(dbPath, JSON.stringify(db, null, 2), 'utf8');
}

const checkToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, secretKey);
    const db = await readDB();
    const user = db.users.find(u => u.username === decoded.username);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: "Unauthorized" });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") next();
  else return res.status(403).json({ error: "Forbidden: Admins only" });
};

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images are allowed"), false);
  },
});

router.use("/images", express.static(path.join(__dirname, "..", "storage")));

const mediaDir = path.join(__dirname, "..", "storage", "media");
const mediaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sceneName = req.body.sceneName || 'default';
    const sanitizedScene = sceneName.trim().replace(/\s+/g, "_");
    const dynamicDir = path.join(mediaDir, sanitizedScene);
    if (!fs.existsSync(dynamicDir)) fs.mkdirSync(dynamicDir, { recursive: true });
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
    if (!req.file) return res.status(400).json({ error: "No media file uploaded" });
    const sceneName = req.body.sceneName || 'default';
    const sanitizedScene = sceneName.trim().replace(/\s+/g, "_");
    const filePath = `/api/media/${sanitizedScene}/${req.file.filename}`;
    res.status(200).json({ message: "Media uploaded successfully", filePath: filePath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// =         CRUD API For User (JSON)       =
// ==========================================
router.post("/users/insert", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const db = await readDB();
    if (db.users.find(u => u.username === username)) throw new Error("Username already exists");
    
    const newUser = { id: generateId(), _id: generateId(), username, password, role: role || "guest" };
    db.users.push(newUser);
    await writeDB(db);
    res.status(201).json({ message: "User registered successfully", id: newUser.id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put("/users/:username", async (req, res) => {
  try {
    const db = await readDB();
    const userIndex = db.users.findIndex(u => u.username === req.params.username);
    if (userIndex === -1) return res.status(404).json({ error: "User not found" });

    db.users[userIndex].username = req.body.username || db.users[userIndex].username;
    if (req.body.password) db.users[userIndex].password = req.body.password; // เปลี่ยนรหัสเฉพาะเมื่อส่งมาใหม่
    db.users[userIndex].role = req.body.role || db.users[userIndex].role;
    
    await writeDB(db);
    res.status(200).json({ message: "User updated successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const secretKey = "KTS";
router.post("/users/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const db = await readDB();
    const user = db.users.find(u => u.username === username && u.password === password);
    if (!user) throw new Error("Invalid username or password");

    const token = jwt.sign({ username: user.username, role: user.role }, secretKey, { expiresIn: "1h" });
    res.status(200).json({ message: "Login successful", token: token });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});


router.get("/users", async (req, res) => {
  try {
    const db = await readDB();
    res.status(200).json(db.users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/users/:username", async (req, res) => {
  try {
    const db = await readDB();
    const initLen = db.users.length;
    db.users = db.users.filter(u => u.username !== req.params.username);
    if (db.users.length === initLen) return res.status(404).json({ error: "User not found" });
    await writeDB(db);
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ==========================================
// =         CRUD API For Scene (JSON)      =
// ==========================================
router.post("/scenes", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image file uploaded" });
    const sceneName = req.body.name;
    const zoneName = req.body.zone || "default";
    const sanitizedZone = zoneName.trim().replace(/\s+/g, "_");
    const sanitizedScene = sceneName.trim().replace(/\s+/g, "_");

    const panoramaDir = path.join(__dirname, "..", "storage", "panorama", sanitizedZone);
    const thumbnailDir = path.join(__dirname, "..", "storage", "thumbnails", sanitizedZone);
    fs.mkdirSync(panoramaDir, { recursive: true });
    fs.mkdirSync(thumbnailDir, { recursive: true });

    const fullPanoramaPath = path.join(panoramaDir, `${sanitizedScene}.webp`);
    const thumbnailPath = path.join(thumbnailDir, `${sanitizedScene}.webp`);

    await sharp(req.file.buffer).webp({ quality: 85 }).toFile(fullPanoramaPath);
    await sharp(req.file.buffer).resize(450).webp({ quality: 75 }).toFile(thumbnailPath);

    const dbImagePath = `/api/images/panorama/${sanitizedZone}/${sanitizedScene}.webp`;
    
    const db = await readDB();
    const newScene = {
      id: generateId(), _id: generateId(),
      name: sanitizedScene, image_path: dbImagePath, image_url: dbImagePath,
      zone: zoneName, start_rotation: 0
    };
    db.scenes.push(newScene);
    await writeDB(db);

    res.status(201).json({ message: "Scene added", data: newScene });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/scenes", async (req, res) => {
  try {
    const db = await readDB();
    res.status(200).json(db.scenes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/scenes/:name", async (req, res) => {
  try {
    const db = await readDB();
    const idx = db.scenes.findIndex(s => s.name === req.params.name);
    if (idx === -1) return res.status(404).json({ message: "Scene not found" });

    db.scenes[idx] = { ...db.scenes[idx], ...req.body };
    await writeDB(db);
    res.status(200).json({ message: "Success", data: db.scenes[idx] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/scenes/:name", async (req, res) => {
  try {
    const db = await readDB();
    db.scenes = db.scenes.filter(s => s.name !== req.params.name);
    await writeDB(db);
    res.status(200).json({ message: "Deleted" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ==========================================
// =       CRUD API For Hotspot (JSON)      =
// ==========================================
router.get("/hotspots", async (req, res) => {
  const db = await readDB();
  res.status(200).json(db.hotspots);
});

router.post("/hotspots", async (req, res) => {
  const db = await readDB();
  const newHotspot = {
    id: generateId(), _id: generateId(),
    scene_id: req.body.scene_id, target_scene_id: req.body.target_scene_id,
    type: req.body.type, x: req.body.x, y: req.body.y, z: req.body.z,
    path: req.body.path || "", scale: req.body.scale || 1, angle: req.body.angle || 0,
    color: req.body.color || "#ffffff", width: req.body.width || 30, height: req.body.height || 30
  };
  db.hotspots.push(newHotspot);
  await writeDB(db);
  res.status(201).json({ message: "Hotspot added", data: newHotspot });
});

router.delete("/hotspots/:id", async (req, res) => {
  const db = await readDB();
  db.hotspots = db.hotspots.filter(h => h.id !== req.params.id && h._id !== req.params.id);
  await writeDB(db);
  res.status(200).json({ message: "Deleted" });
});

router.put("/hotspots/:id", async (req, res) => {
  const db = await readDB();
  const idx = db.hotspots.findIndex(h => h.id === req.params.id || h._id === req.params.id);
  if (idx !== -1) {
    db.hotspots[idx] = { ...db.hotspots[idx], ...req.body };
    await writeDB(db);
    res.status(200).json({ data: db.hotspots[idx] });
  } else {
    res.status(404).json({ error: "Not found" });
  }
});

// ==========================================
// =         CRUD API For Zone (JSON)       =
// ==========================================
router.put("/zones/reorder", async (req, res) => {
  const db = await readDB();
  const { orderedNames } = req.body;
  orderedNames.forEach((name, i) => {
    const z = db.zones.find(zone => zone.name === name);
    if (z) z.order = i;
  });
  await writeDB(db);
  res.status(200).json({ message: "Reordered" });
});

router.get("/zones", async (req, res) => {
  const db = await readDB();
  res.status(200).json(db.zones);
});

router.post("/zones", async (req, res) => {
  const db = await readDB();
  const newZone = { id: generateId(), _id: generateId(), order: req.body.order, name: req.body.name, position: req.body.position };
  db.zones.push(newZone);
  await writeDB(db);
  res.status(201).json({ data: newZone });
});

router.delete("/zones/:id", async (req, res) => {
  const db = await readDB();
  db.zones = db.zones.filter(z => z.id !== req.params.id && z._id !== req.params.id);
  await writeDB(db);
  res.status(200).json({ message: "Deleted" });
});

router.put("/zones/:id", async (req, res) => {
  const db = await readDB();
  const idx = db.zones.findIndex(z => z.id === req.params.id || z._id === req.params.id);
  if (idx !== -1) {
    db.zones[idx] = { ...db.zones[idx], ...req.body };
    await writeDB(db);
    res.status(200).json({ data: db.zones[idx] });
  } else {
    res.status(404).json({ error: "Not found" });
  }
});

router.put("/zones/:name/map", async (req, res) => {
  const db = await readDB();
  const idx = db.zones.findIndex(z => z.name === req.params.name);
  if (idx !== -1) {
    db.zones[idx].position = { map_x: req.body.map_x, map_y: req.body.map_y };
    await writeDB(db);
    res.status(200).json({ data: db.zones[idx] });
  } else {
    res.status(404).json({ error: "Not found" });
  }
});

module.exports = router;