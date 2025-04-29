// routes/transportRoutes.js
const express = require('express');
const router = express.Router();
const controller = require('../../controllers/admin/transport.controller');
const validate = require('../../utils/validations/transport.validation');
const authMiddleware = require("../../middlewares/authMiddleware");
// Apply authentication to all routes
router.use(authMiddleware);

// CRUD Routes
router.post(
  '/',
  validate.create,
  controller.createTransport
);

 router.get(
  '/',
  validate.list,
  controller.getAllTransports
);

/*
router.get(
  '/:id',
  validate.getById,
  controller.getTransportById
);

router.put(
  '/:id',
  validate.update,
  controller.uploadImages,
  controller.updateTransport
);

router.delete(
  '/:id',
  validate.delete,
  controller.deleteTransport
);

// Special Operations
router.patch(
  '/:id/restore',
  validate.restore,
  controller.restoreTransport
);

router.patch(
  '/:id/status',
  validate.toggleStatus,
  controller.toggleStatus
);

router.put(
  '/:id/amenities',
  validate.updateAmenities,
  controller.updateAmenities
); */

module.exports = router;