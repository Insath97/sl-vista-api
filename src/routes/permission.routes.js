const express = require("express");
const router = express.Router();
const controller = require("../controllers/permission.controller");
const validate = require("../utils/validations/permission.validation");
const middleware = require("../middlewares/auth.middleware");

router.use(middleware.authMiddlewareWithProfile(["admin"]));

/* create permission */
router.post("/", validate.create, controller.createPermission);

/* get all permissions */
router.get("/", validate.list, controller.getAllPermissions);

/* get by id */
router.get("/:id", validate.getById, controller.getPermissionById);

/* update */
router.put("/:id", validate.update, controller.updatePermission);

/* delete */
router.delete("/:id", validate.delete, controller.deletePermission);

/* restore */
router.patch("/:id/restore", controller.restorePermission);

module.exports = router;
