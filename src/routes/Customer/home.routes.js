const express = require("express");
const router = express.Router();

/* transport type */
const validateTransportType = require("../../utils/validations/transportType.validation");
const transportTypeController = require("../../controllers/admin/transporttype.controller");

/* transport */
const validateTransport = require("../../utils/validations/transport.validation");
const transportController = require("../../controllers/admin/transport.controller");

/* get all transport types */
router.get(
  "/transport-types",
  validateTransportType.list,
  transportTypeController.getAllTransportTypes
);

/* get all transport with images & amenties */
router.get(
  "/transports",
  validateTransport.list,
  transportController.getAllTransports
);

module.exports = router;
