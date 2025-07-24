const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const adminController = require("../controllers/adminController");
const {
  createAdminValidation,
  updateAdminValidation,
} = require("../utils/validations/admin.validation");

// define routes
router.post("/", createAdminValidation, adminController.createAdmin);
router.get("/", adminController.getAllAdmins);
router.get("/:id", adminController.getAdminById);
router.put("/:id",updateAdminValidation, adminController.updateAdmin);
router.delete("/:id", adminController.deleteAdmin);
router.post("/:id/restore", adminController.restoreAdmin);

module.exports = router;
