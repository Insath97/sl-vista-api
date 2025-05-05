const express = require("express");
const router = express.Router();

/* transport type */
const validateTransportType = require("../../utils/validations/transportType.validation");
const transportTypeController = require("../../controllers/admin/transporttype.controller");

/* transport */
const validateTransportAgency = require("../../utils/validations/transportAgency.validation");
const transportAgencyController = require("../../controllers/admin/transportAgency.controller");

/* activity */

/* get all transport types */
router.get(
  "/transport-types",
  validateTransportType.list,
  transportTypeController.getAllTransportTypes
);

/* get all transport with images & amenties */
router.get(
  "/transport-agencies",
  validateTransportAgency.list,
  transportAgencyController.getAllTransportAgencies
);

module.exports = router;
