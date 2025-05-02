// uploadMiddleware.js
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 25 * 1024 * 1024 // 5MB
  }
}).fields([{ name: 'images', maxCount: 10 }]); // Note the field name 'images'

module.exports = upload;