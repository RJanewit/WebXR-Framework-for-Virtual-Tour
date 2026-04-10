const express = require('express');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
//const myRouter = require('./routes/myRouter.js');
const https = require('https'); // 1. เพิ่มโมดูล https

const app = express();
app.use(express.json());


// 1. ตั้งค่าการเชื่อมต่อ MongoDB

mongoose.connect('mongodb://localhost:27017/virtual-factory-tour')
    .then(() => console.log('✅ Connected to MongoDB Successfully!'))
    .catch(err => console.error('❌ Could not connect to MongoDB:', err));

// สร้าง Schema และ Model
const Scene = mongoose.model('Scene', new mongoose.Schema({}, { strict: false, collection: 'scenes' }));
const Hotspot = mongoose.model('Hotspot', new mongoose.Schema({}, { strict: false, collection: 'hotspots' }));


// 2. ระบบ Login
// --- ใส่การตั้งค่า Certificate ตรงนี้ ---
const options = {
    key: fs.readFileSync(path.join(__dirname, 'key.pem')),   // ไฟล์ Private Key
    cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))  // ไฟล์ Certificate
};

const loadUsers = () => {
    try {
        // แก้ไข Path ให้ชี้ไปที่โฟลเดอร์ data/
        const filePath = path.join(__dirname, 'data', 'users.json');
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.log("⚠️ อ่านไฟล์ users.json ไม่ได้ กำลังใช้รหัสสำรอง");
        return [{ "username": "admin", "password": "123" }];
    }
};


// 3. เสิร์ฟไฟล์ Frontend (อนุญาตแค่โฟลเดอร์ public เท่านั้น)

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/images', express.static(path.join(__dirname, 'storage')));

// 4. API Endpoints

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const allUsers = loadUsers();
    
    const user = allUsers.find(u => 
        u.username.trim() === username.trim() && 
        u.password.toString() === password.toString()
    );

    if (user) {
        console.log(`✅ Login Success: ${username}`);
        res.status(200).json({ success: true });
    } else {
        console.log(`❌ Login Failed: ${username}`);
        res.status(401).json({ success: false });
    }
});

app.get('/api/scenes', async (req, res) => {
    try {
        const scenes = path.join(__dirname, 'data', 'scenes.json');
        const data = fs.readFileSync(scenes, 'utf8');
        const scenesData = JSON.parse(data);
        res.json(scenesData);
    } catch (error) {
        console.error("Error fetching scenes:", error);
        res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูล Scenes" });
    }
});

app.get('/api/hotspots', async (req, res) => {
    try {
        const hotspots = path.join(__dirname, 'data', 'hotspots.json');
        const data = fs.readFileSync(hotspots, 'utf8');
        const hotspotsData = JSON.parse(data);
        res.json(hotspotsData);
    } catch (error) {
        console.error("Error fetching hotspots:", error);
        res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูล Hotspots" });
    }
});

const PORT = 3443; // หรือพอร์ตที่คุณใช้อยู่
https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Secure Server is running at https://localhost:${PORT}`);
});