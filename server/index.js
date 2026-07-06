const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const multer = require('multer');

const PORT = process.env.PORT || 4000;
const MAX_FILE_SIZE_BYTES = 300 * 1024 * 1024; // 300 MB
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Make sure the uploads folder exists before anything tries to write to it.
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const app = express();
app.use(cors());
app.use(express.json());

// --- Multer storage: write straight to disk with a safe, unique filename ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const safeOriginalName = path
      .basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${uniqueId}-${safeOriginalName}`);
  },
});

function fileFilter(req, file, cb) {
  const isZipMime = [
    'application/zip',
    'application/x-zip-compressed',
    'multipart/x-zip',
  ].includes(file.mimetype);
  const isZipExt = path.extname(file.originalname).toLowerCase() === '.zip';

  if (isZipMime || isZipExt) {
    cb(null, true);
  } else {
    cb(new Error('Only .zip files are allowed'));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

// In-memory index of uploads. Swap for a real database in production.
const uploadsIndex = [];

app.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File exceeds the 300MB limit.' });
      }
      return res.status(400).json({ error: err.message });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file was uploaded.' });
    }

    const record = {
      id: path.parse(req.file.filename).name,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      size: req.file.size,
      uploadedAt: new Date().toISOString(),
    };
    uploadsIndex.push(record);

    return res.status(201).json({
      message: 'Upload successful.',
      file: record,
    });
  });
});

app.get('/api/uploads', (req, res) => {
  res.json({ uploads: uploadsIndex });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', maxFileSizeMB: MAX_FILE_SIZE_BYTES / (1024 * 1024) });
});

app.listen(PORT, () => {
  console.log(`Zip upload server listening on http://localhost:${PORT}`);
  console.log(`Storing files in: ${UPLOAD_DIR}`);
});
