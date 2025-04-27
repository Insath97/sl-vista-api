const multer = require("multer");
const path = require("path");
const fs = require("fs");

const createUploader = (entityType) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = `public/uploads/${entityType}/${req.params.id || 'temp'}`;
      fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const filename = `${file.fieldname}-${Date.now()}${ext}`;
      cb(null, filename);
    }
  });

  const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extValid = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeValid = allowedTypes.test(file.mimetype);
    extValid && mimeValid ? cb(null, true) : cb(new Error('Only image files are allowed!'), false);
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
  });
};

exports.handleImageUpload = (entityType, fieldName = 'images', maxCount = 10) => 
  createUploader(entityType).array(fieldName, maxCount);

exports.saveImagePaths = async (modelName, entityId, files) => {
  const ModelImage = require(`../models/${modelName}Image`);
  return ModelImage.bulkCreate(
    files.map(file => ({
      [`${modelName.toLowerCase()}Id`]: entityId,
      imagePath: file.path.replace('public', ''),
      isFeatured: false
    }))
  );
};

exports.deleteImageFiles = async (modelName, entityId) => {
  const ModelImage = require(`../models/${modelName}Image`);
  const images = await ModelImage.findAll({ where: { [`${modelName.toLowerCase()}Id`]: entityId } });
  
  await Promise.all(
    images.map(img => 
      fs.promises.unlink(`public${img.imagePath}`).catch(console.error)
    )
  );
  
  return ModelImage.destroy({ where: { [`${modelName.toLowerCase()}Id`]: entityId } });
};