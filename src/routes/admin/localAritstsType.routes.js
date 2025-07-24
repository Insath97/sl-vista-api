const express = require("express");
const router = express.Router();
const validate = require("../../utils/validations/localArtistType.validation");
const artistTypeController = require("../../controllers/admin/localArtistsType.controller");
const authMiddleware = require("../../middlewares/auth.middleware");

router.use(authMiddleware.authMiddlewareWithProfile(['admin']));

// Create artist type
router.post("/", 
  /* validate.create,  */
  artistTypeController.createArtistType
);

// Get all artist types
router.get("/", 
/*   validate.list, */ 
  artistTypeController.getAllArtistTypes
);

// Get artist type by ID
router.get("/:id", 
  /* validate.getById, */ 
  artistTypeController.getArtistTypeById
);

// Update artist type
router.put("/:id", 
  /* validate.update, */ 
  artistTypeController.updateArtistType
);

// Delete artist type
router.delete("/:id", 
/*   validate.delete,  */
  artistTypeController.deleteArtistType
);

// Restore soft-deleted artist type
router.patch("/:id/restore", 
  /* validate.restore, */ 
  artistTypeController.restoreArtistType
);

// Toggle visibility status
router.patch("/:id/toggle-visibility", 
  /* validate.toggleVisibility, */ 
  artistTypeController.toggleVisibility
);



module.exports = router;