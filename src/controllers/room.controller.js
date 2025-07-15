const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const Property = require("../models/property.model");
const MerchantProfile = require("../models/merchantProfile.model");

