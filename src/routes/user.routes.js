const express = require("express");
const router = express.Router();
const middleware = require("../middlewares/authMiddleware");
const controller = require("../controllers/user.controller");
const validate = require("../utils/validations/user.validation");

router.use(middleware.authenticate);

// create
router.post("/", validate.create, controller.createUser);

// get all
router.get("/", validate.list,middleware.authorize(['users.create']), controller.getAllAdminUsers);

// get by id
router.get("/:id", validate.getById, controller.getAdminUserById);

// update
router.put("/:id", validate.update, controller.updateAdminUser);

// delete
router.delete("/:id", validate.delete, controller.deleteAdminUser);

// restore
router.patch("/:id/restore", controller.restoreAdminUser);

module.exports = router;
