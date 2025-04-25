const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const Category = require("../../models/category.model");
const SubCategory = require("../../models/subCategory.model");
const slugify = require("slugify");

/* category create method */
exports.createCategory = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const categoryData = {
      ...req.body,
    };

    const category = await Category.create(categoryData);

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    console.error("Error creating category:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create category",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* get all categories with advanced filtering */
exports.getAllCategories = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }

  try {
    // Extract query parameters
    const {
      page = 1,
      limit = 10,
      sortBy = "position",
      sortOrder = "ASC",
      language_code,
      isActive,
      showInNav,
      isFixed,
      slug,
      search,
      includeSubcategories = false,
      subcategoryIsActive,
    } = req.query;

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Build where conditions
    const where = {};
    if (language_code) where.language_code = language_code;
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (showInNav !== undefined) where.showInNav = showInNav === "true";
    if (isFixed !== undefined) where.isFixed = isFixed === "true";
    if (slug) where.slug = { [Op.iLike]: `%${slug}%` };

    // Search across multiple fields
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { slug: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Include subcategories if requested
    const include = [];
    if (includeSubcategories === "true") {
      include.push({
        model: db.SubCategory,
        as: "subcategories",
        where: subcategoryIsActive === "true" ? { isActive: true } : {},
        required: false,
      });
    }

    // Fetch categories with filters
    const { count, rows } = await Category.findAndCountAll({
      where,
      include,
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset,
      paranoid: req.query.includeDeleted === "true" ? false : true,
    });

    // Calculate total pages
    const totalPages = Math.ceil(count / limit);

    // Prepare response
    return res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        totalItems: count,
        totalPages,
        currentPage: parseInt(page),
        itemsPerPage: parseInt(limit),
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* get category by id */
exports.getCategoryById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const category = await Category.findByPk(req.params.id, {
      include:
        req.query.includeSubcategories === "true"
          ? [
              {
                model: db.SubCategory,
                as: "subcategories",
                where:
                  req.query.subcategoryIsActive === "true"
                    ? { isActive: true }
                    : {},
                required: false,
              },
            ]
          : [],
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error("Error fetching category:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch category",
    });
  }
};

/* update category by id */
exports.updateCategory = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const updateData = { ...req.body };
    if (updateData.name && !updateData.slug) {
      updateData.slug = slugify(updateData.name, { lower: true, strict: true });
    }

    await category.update(updateData);

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    console.error("Error updating category:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update category",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* delete category by id */
exports.deleteCategory = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    await category.destroy();

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete category",
    });
  }
};

/* toggle category active status */
exports.toggleVisibility = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    await category.toggleVisibility();

    return res.status(200).json({
      success: true,
      message: "Category visibility toggled",
      data: category,
    });
  } catch (error) {
    console.error("Error toggling category visibility:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle category visibility",
    });
  }
};

/* toggle category nav visibility */
exports.toggleNavVisibility = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const category = await Category.scope("withInactive").findByPk(
      req.params.id
    );
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Toggle directly in controller (instead of instance method)
    category.showInNav = !category.showInNav;
    await category.save();

    return res.status(200).json({
      success: true,
      message: "Category nav visibility toggled",
      data: category,
    });
  } catch (error) {
    console.error("Error toggling category nav visibility:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle category nav visibility",
    });
  }
};

/* update category position */
exports.getNavbarCategories = async (req, res) => {
  try {
    const categories = await Category.getNavbarCategories();
    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Error fetching navbar categories:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch navbar categories",
    });
  }
};

/* update category position */
exports.getCategoriesByLanguage = async (req, res) => {
  try {
    const categories = await Category.findAll({
      where: {
        language_code: req.params.language_code,
        isActive: true,
      },
      order: [["position", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Error fetching categories by language:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch categories by language",
    });
  }
};

/* Get category with subcategories */
exports.getCategoryWithSubcategories = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const category = await Category.findByPk(req.params.id, {
      include: [
        {
          model: SubCategory,
          as: "subcategories",
          where:
            req.query.subcategoryIsActive === "true" ? { isActive: true } : {},
          required: false,
          attributes: ["id", "name", "slug", "position", "isActive"],
        },
      ],
      attributes: { exclude: ["createdAt", "updatedAt", "deletedAt"] },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error("Error fetching category with subcategories:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch category",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
