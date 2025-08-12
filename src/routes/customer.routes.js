const express = require("express");
const router = express.Router();
const middleware = require("../middlewares/auth.middleware");
const controller = require("../controllers/customer.controller");
const validate = require("../utils/validations/customer.validations");

router.post("/register", validate.register, controller.registerCustomer);

router.use(middleware.authenticate);

/* get all */
router.get("/", validate.list, controller.getAllCustomers);

/* get by id */
router.get("/:id", validate.getById, controller.getCustomerById);

/* update - customer */
/* router.put("/:id", validate.update, controller.updateCustomer); */

/* change customer status - admin only */
router.patch(
  "/status/:id",
  validate.deactivate,
  controller.changeCustomerStatus
);

module.exports = router;
