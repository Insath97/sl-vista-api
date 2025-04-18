const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const Category = require("../models/category.model");

exports.CreateCategory = async (req, res) => {
  // check for validation errors
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const {
      language_code,
      name,
      icon,
      position,
      isActive,
      showInNav,
      description,
    } = req.body;

    const category = await Category.create({
      language_code,
      name,
      icon,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      position,
      isActive,
      showInNav,
      description,
    });

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      category,
    });
  } catch (err) {
    console.error("Category creation error:", err);

    // Handle Sequelize validation errors differently
    if (err.name === "SequelizeValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: err.errors.map((e) => ({
          field: e.path,
          message: e.message,
        })),
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Get all categories with filters, pagination, and sorting
exports.getAllCategories = async (req, res) => {
  try {
    const {
      language_code,
      isActive,
      showInNav,
      search, // Search by category name
      sortBy = "position", // Default sorting field
      sortOrder = "ASC", // Default sorting order
      page = 1, // Default page
      limit = 10, // Default limit
    } = req.query;

    // Construct filter conditions
    const whereClause = {};
    if (language_code) whereClause.language_code = language_code;
    if (isActive !== undefined) whereClause.isActive = isActive === "true";
    if (showInNav !== undefined) whereClause.showInNav = showInNav === "true";
    if (search) whereClause.name = { [Op.like]: `%${search}%` };

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Fetch categories with filters
    const { count, rows: categories } = await Category.findAndCountAll({
      where: whereClause,
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset,
    });

    res.status(200).json({
      success: true,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit),
      categories,
    });
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Get a single category by ID
exports.getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findByPk(id);

    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    res.status(200).json({ success: true, category });
  } catch (err) {
    console.error("Error fetching category:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Update category by Id
exports.updateCategoryById = async (req, res) => {
  const { id } = req.params;

  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const category = await Category.findByPk(id);

    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    const {
      language_code,
      name,
      icon,
      position,
      isActive,
      showInNav,
      description,
    } = req.body;

    // Update fields
    if (language_code !== undefined) category.language_code = language_code;
    if (name !== undefined) {
      category.name = name;
      category.slug = name.toLowerCase().replace(/\s+/g, "-");
    }
    if (icon !== undefined) category.icon = icon;
    if (position !== undefined) category.position = position;
    if (isActive !== undefined) category.isActive = isActive;
    if (showInNav !== undefined) category.showInNav = showInNav;
    if (description !== undefined) category.description = description;

    await category.save();

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      category,
    });
  } catch (err) {
    console.error("Category update error:", err);

    if (err.name === "SequelizeValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: err.errors.map((e) => ({
          field: e.path,
          message: e.message,
        })),
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Delete category by Id (soft delete)
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findByPk(id);

    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    await category.destroy(); // Soft delete (paranoid mode enabled)

    res
      .status(200)
      .json({ success: true, message: "Category deleted successfully" });
  } catch (err) {
    console.error("Category deletion error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Toggle category visibility
exports.toggleCategoryVisibility = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findByPk(id);

    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    await category.toggleVisibility();

    res.status(200).json({
      success: true,
      message: "Category visibility toggled",
      category,
    });
  } catch (err) {
    console.error("Toggle visibility error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Get categories for navbar
exports.getNavbarCategories = async (req, res) => {
  try {
    const categories = await Category.getNavbarCategories();
    res.status(200).json({ success: true, categories });
  } catch (err) {
    console.error("Error fetching navbar categories:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// get category by language code
exports.getCategoriesByLanguage = async (req, res) => {
  try {
    const { language_code } = req.params;

    // Validation: Check if language_code is provided and properly formatted
    if (!language_code || typeof language_code !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid language code. It must be a valid string.",
      });
    }

    // Fetch categories by language code
    const categories = await Category.findAll({
      where: { language_code },
      order: [["position", "ASC"]], // Sorting by position (optional)
    });

    if (categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No categories found for language code: ${language_code}`,
      });
    }

    res.status(200).json({
      success: true,
      total: categories.length,
      categories,
    });
  } catch (err) {
    console.error("Error fetching categories by language code:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
