const express = require("express");
const router = express.Router();
const validate = require("../../utils/validations/localArtistType.validation");
const controller = require("../../controllers/admin/localArtistsType.controller");
const middleware = require("../../middlewares/auth.middleware");

router.use(middleware.authenticate);

/* create */
router.post("/", validate.create, controller.createArtistType);

/* get all */
router.get("/", validate.list, controller.getAllArtistTypes);

/* get by id */
router.get("/:id", validate.getById, controller.getArtistTypeById);

/* update */
router.put("/:id", validate.update, controller.updateArtistType);

/* delete */
router.delete("/:id", validate.delete, controller.deleteArtistType);

/* restore */
router.patch("/restore/:id", validate.restore, controller.restoreArtistType);

/* active status */
router.patch("/status/:id", validate.toggleVisibility, controller.toggleVisibility);

module.exports = router;
