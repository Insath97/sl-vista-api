const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure upload directory exists
const ensureUploadDir = (transportId) => {
  const dir = path.join(__dirname, `../public/uploads/transports/${transportId}`);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create dynamic folder using transport ID (temporary ID for new transports)
    const transportId = req.body.tempId || "temp";
    const uploadDir = ensureUploadDir(transportId);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
    }
    cb(null, true);
  },
});

module.exports = {
  uploadTransportImages: upload.array("images", 10), // Max 10 images
  moveTempFiles: async (tempId, transportId) => {
    const tempDir = path.join(__dirname, `../public/uploads/transports/${tempId}`);
    const targetDir = path.join(__dirname, `../public/uploads/transports/${transportId}`);

    if (fs.existsSync(tempDir)) {
      // Rename temp folder to transport ID
      fs.renameSync(tempDir, targetDir);
    }
  },
};