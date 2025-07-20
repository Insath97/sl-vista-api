const express = require("express");
const router = express.Router();
const controller = require("../controllers/role.controller");
const validate = require("../utils/validations/role.validation");
const middleware = require("../middlewares/authMiddleware");

router.use(middleware.authMiddlewareWithProfile(["admin"]));

// create role
router.post("/", validate.create, controller.createRole);

// get all
router.get("/", validate.list, controller.getAllRoles);

// get by id
router.get("/:id", validate.getById, controller.getRoleById);

// update
router.put("/:id", validate.update, controller.updateRole);

// delete
router.delete("/:id", validate.delete, controller.deleteRole);

// restore
router.patch("/:id/restore",validate.restore, controller.restoreRole);

module.exports = router;
