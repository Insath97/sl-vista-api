const express = require("express");
const router = express.Router();

/* transport type */
const validateTransportType = require("../../utils/validations/transportType.validation");
const transportTypeController = require("../../controllers/admin/transporttype.controller");

/* transport */
const validateTransportAgency = require("../../utils/validations/transportAgency.validation");
const transportAgencyController = require("../../controllers/admin/transportAgency.controller");

/* properties */
const validateProperty = require("../../utils/validations/property.validation");
const propertyController = require("../../controllers/Merchant/property.controller");

/* homestays */
const validateHomeStay = require("../../utils/validations/homestay.validations");
const homeStayController = require("../../controllers/Merchant/homestay.controller");

/* get all transport types */
router.get(
  "/transport-types",
  validateTransportType.list,
  transportTypeController.getAllTransportTypes
);

/* get all transport with images & amenties */
router.get(
  "/transport-agencies",
/*   validateTransportAgency.list, */
  transportAgencyController.getAllTransportAgencies
);

/* get transport agency by id */
router.get(
  "/transport-agency/:id",
  validateTransportAgency.getById,
  transportAgencyController.getTransportAgencyById
);

// Get all approved properties
router.get(
  "/properties",
  validateProperty.list,
  propertyController.getAllApprovedProperties
);

/* Get Properties By ID */
router.get(
  "/property/:id",
  validateProperty.getApprovedPropertyById,
  propertyController.getApprovedPropertyById
);

/* Get all homestays */
router.get(
  "/homestays",
  validateHomeStay.list,
  homeStayController.getAllHomeStaysForListing
);

/* Get Homestays By ID */
router.get(
  "/homestay/:id",
  homeStayController.getHomeStayDetails
);

module.exports = router;
