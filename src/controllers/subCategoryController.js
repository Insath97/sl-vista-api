const { validationResult } = require("express-validator");
const SubCategory = require("../models/subCategory.model");

exports.CreateSubCategory = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const {
      categoryId,
      language_code,
      name,
      icon,
      position,
      isActive,
      showInNav,
    } = req.body;

    const subcategory = await SubCategory.create({
      categoryId,
      language_code,
      name,
      icon,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      position,
      isActive,
      showInNav,
    });

    res.status(201).json({
      success: true,
      message: "Subcategory created successfully",
      subcategory,
    });
  } catch (err) {
    console.error("Sub Category creation error:", err);

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

// get all sub categories
exports.getAllSubcategories = async (req, res) => {
  try {
    const {
      language_code,
      isActive,
      showInNav,
      categoryId,
      search,
      sortBy = "position",
      sortOrder = "ASC",
      page = 1,
      limit = 10,
    } = req.query;

    const where = {};
    if (language_code) where.language_code = language_code;
    if (categoryId) where.categoryId = categoryId;
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (showInNav !== undefined) where.showInNav = showInNav === "true";
    if (search) where.name = { [Op.like]: `%${search}%` };

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await SubCategory.findAndCountAll({
      where,
      include: [
        { model: Category, as: "category", attributes: ["id", "name"] },
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      offset,
      limit: parseInt(limit),
    });

    res.status(200).json({
      success: true,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit),
      subCategories: rows,
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

// Get single SubCategory by ID
exports.getSubCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const subCategory = await SubCategory.findByPk(id, {
      include: [
        { model: Category, as: "category", attributes: ["id", "name"] },
      ],
    });

    if (!subCategory) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    res.status(200).json({ success: true, subCategory });
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Update SubCategory by ID
exports.updateSubCategoryById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { id } = req.params;
    const subCategory = await SubCategory.findByPk(id);

    if (!subCategory) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    const {
      categoryId,
      language_code,
      name,
      icon,
      position,
      isActive,
      showInNav,
      description,
    } = req.body;

    if (categoryId !== undefined) subCategory.categoryId = categoryId;
    if (language_code !== undefined) subCategory.language_code = language_code;
    if (name !== undefined) {
      subCategory.name = name;
      subCategory.slug = name.toLowerCase().replace(/\s+/g, "-");
    }
    if (icon !== undefined) subCategory.icon = icon;
    if (position !== undefined) subCategory.position = position;
    if (isActive !== undefined) subCategory.isActive = isActive;
    if (showInNav !== undefined) subCategory.showInNav = showInNav;
    if (description !== undefined) subCategory.description = description;

    await subCategory.save();

    res.status(200).json({
      success: true,
      message: "Updated successfully",
      subCategory,
    });
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Soft delete
exports.deleteSubCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const subCategory = await SubCategory.findByPk(id);

    if (!subCategory) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    await subCategory.destroy(); // Soft delete
    res.status(200).json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Toggle visibility
exports.toggleSubCategoryVisibility = async (req, res) => {
  try {
    const { id } = req.params;
    const subCategory = await SubCategory.findByPk(id);

    if (!subCategory) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    await subCategory.toggleVisibility();
    res.status(200).json({
      success: true,
      message: "Visibility toggled",
      subCategory,
    });
  } catch (err) {
    console.error("Toggle visibility error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Get subcategories shown in nav
exports.getNavbarSubCategories = async (req, res) => {
  try {
    const subCategories = await SubCategory.getNavbarSubCategories();
    res.status(200).json({ success: true, subCategories });
  } catch (err) {
    console.error("Navbar fetch error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
