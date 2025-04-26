const multer = require("multer");
const path = require("path");
const fs = require("fs");

const createStorage = (subfolder) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = `public/uploads/${subfolder}/${
        req.params.id || "temp"
      }`;
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, file.fieldname + "-" + uniqueSuffix + ext);
    },
  });
};

const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|gif/;
  const mimetype = filetypes.test(file.mimetype);
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error("Only image files are allowed!"));
};

const createUploader = (subfolder) => {
  return multer({
    storage: createStorage(subfolder),
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  });
};

const handleImageUpload = (fieldName, subfolder = "transport") => {
  const upload = createUploader(subfolder);
  return upload.array(fieldName, 10); // Allow up to 10 files
};

const saveImagePaths = async (model, id, files) => {
  const imageRecords = files.map((file) => ({
    [model.toLowerCase() + "Id"]: id, // creates transportId, productId, etc.
    imagePath: file.path.replace("public", ""),
    isFeatured: false,
  }));

  const modelImage = require(`../models/${model}Image`);
  return await modelImage.bulkCreate(imageRecords);
};

module.exports = {
  handleImageUpload,
  saveImagePaths,
};
