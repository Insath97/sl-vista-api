// validations/transportValidation.js
const { body, param, query } = require("express-validator");
const { Op } = require("sequelize");
const Transport = require("../../models/transport.model");
const TransportType = require("../../models/transportType.model");

const idParam = param('id')
  .isInt()
  .withMessage('Invalid ID format')
  .custom(async (value, { req }) => {
    const transport = await Transport.findOne({
      where: { id: value },
      paranoid: req.method === 'GET' && req.query.includeDeleted === 'true' ? false : true
    });
    if (!transport) throw new Error('Transport not found');
    req.transport = transport;
  });

const transportTypeExists = body('transportTypeId')
  .isInt()
  .withMessage('Invalid transport type ID')
  .custom(async value => {
    const exists = await TransportType.findByPk(value);
    if (!exists) throw new Error('Transport type not found');
  });

const uniqueTitle = body('title')
  .trim()
  .isLength({ min: 2, max: 100 })
  .withMessage('Title must be 2-100 characters')
  .custom(async (value, { req }) => {
    const where = {
      title: value,
      transportTypeId: req.body.transportTypeId || req.transport?.transportTypeId,
      [Op.not]: { id: req.params?.id ? [req.params.id] : [] }
    };
    const exists = await Transport.findOne({ where });
    if (exists) throw new Error('Title already exists for this transport type');
  });

const basicValidations = [
  body('operatorName')
    .trim()
    .notEmpty()
    .withMessage('Operator name is required')
    .isLength({ max: 100 }),
    
  body('pricePerKmUSD')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
    
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone is required')
    .isLength({ max: 20 }),
    
  body('email')
    .optional()
    .trim()
    .isEmail(),
    
  body('departureCity')
    .trim()
    .notEmpty()
    .withMessage('Departure city is required'),
    
  body('arrivalCity')
    .trim()
    .notEmpty()
    .withMessage('Arrival city is required'),
    
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
    
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude')
];

const amenityValidations = [
  body('amenities')
    .isArray({ min: 1 })
    .withMessage('At least one amenity is required'),
    
  body('amenities.*.id')
    .isInt()
    .withMessage('Invalid amenity ID'),
    
  body('amenities.*.isAvailable')
    .optional()
    .isBoolean(),
    
  body('amenities.*.notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
];

module.exports = {
  create: [
    transportTypeExists,
    uniqueTitle,
    ...basicValidations
  ],
  
  update: [
    idParam,
    transportTypeExists.optional(),
    uniqueTitle.optional(),
    ...basicValidations.map(validation => validation.optional())
  ],
  
  getById: [idParam],
  
  delete: [idParam],
  
  restore: [idParam],
  
  toggleStatus: [idParam],
  
  updateAmenities: [
    idParam,
    ...amenityValidations
  ],
  
  list: [
    query('includeInactive')
      .optional()
      .isBoolean(),
      
    query('transportType')
      .optional()
      .isInt(),
      
    query('search')
      .optional()
      .trim()
      .isLength({ max: 100 }),
      
    query('includeDeleted')
      .optional()
      .isBoolean()
  ]
};