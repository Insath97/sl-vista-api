const express = require("express");
const router = express.Router();
const controller = require("../controllers/role.controller");
const validate = require("../utils/validations/role.validation");
const middleware = require("../middlewares/auth.middleware");
const { route } = require("./languagesRoutes");

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
router.patch("/:id/restore", validate.restore, controller.restoreRole);

// list admin roles
router.get("/list/admins", controller.listAdminRoles);

// list merchant roles
router.get("/list/merchants", controller.listMerchantRoles);

module.exports = router;
