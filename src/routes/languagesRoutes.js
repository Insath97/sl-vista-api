const express = require('express');
const router = express.Router();
const languageController = require('../controllers/languageController');

// GET /api/languages - Get all languages
router.get('/', languageController.getAllLanguages);

// GET /api/languages/:code - Get specific language
router.get('/:code', languageController.getLanguageByCode);

module.exports = router;