const express = require('express');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const router = require('./routes/Router.js');
const https = require('https');

const PORT = 3443;
const dbUrl = 'mongodb://localhost:27017/virtual-factory-tour';

const app = express();
app.use(express.json());
app.use("/api", router);

const options = {
    key: fs.readFileSync(path.join(__dirname, 'key.pem')),   // ไฟล์ Private Key
    cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))  // ไฟล์ Certificate
};

mongoose.connect(dbUrl)
    .then(() => console.log('Connected to MongoDB Successfully'))
    .catch(err => console.error('Could not connect to MongoDB:', err)
);

app.use(express.static(path.join(__dirname, '../frontend')));

https.createServer(options, app).listen(PORT, () => {
    console.log(`Server is running at https://localhost:${PORT}/index.html`);
});