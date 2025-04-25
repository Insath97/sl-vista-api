const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const slugify = require("slugify");
const Category = require("../../models/category.model");
const SubCategory = require("../../models/subCategory.model");

/* SubCategory create method */
exports.createSubCategory = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const subCategoryData = {
      ...req.body,
      categoryId: req.body.categoryId,
    };

    const subCategory = await SubCategory.create(subCategoryData);

    return res.status(201).json({
      success: true,
      message: "SubCategory created successfully",
      data: subCategory,
    });
  } catch (error) {
    console.error("Error creating subcategory:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create subcategory",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Get all subcategories with advanced filtering */
exports.getAllSubCategories = async (req, res) => {
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
      categoryId,
      isActive,
      slug,
      search,
      includeCategory = false,
    } = req.query;

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Build where conditions
    const where = {};
    if (categoryId) where.categoryId = categoryId;
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (slug) where.slug = { [Op.iLike]: `%${slug}%` };

    // Search across multiple fields
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { slug: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Include category if requested
    const include = [];
    if (includeCategory === "true") {
      include.push({
        model: Category,
        as: "category",
        attributes: ["id", "name", "slug", "isActive"],
        required: false,
      });
    }

    // Fetch subcategories with filters
    const { count, rows } = await SubCategory.findAndCountAll({
      where,
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["id", "name", "slug", "isActive"],
        },
      ],
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset,
      paranoid: req.query.includeDeleted === "true" ? false : true,
    });

    // Calculate total pages
    const totalPages = Math.ceil(count / limit);

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
    console.error("Error fetching subcategories:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subcategories",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Get subcategory by id */
exports.getSubCategoryById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const subCategory = await SubCategory.findByPk(req.params.id, {
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["id", "name", "slug", "isActive"],
        },
      ],
    });

    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "SubCategory not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: subCategory,
    });
  } catch (error) {
    console.error("Error fetching subcategory:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subcategory",
    });
  }
};

/* Update subcategory by id */
exports.updateSubCategory = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const subCategory = await SubCategory.findByPk(req.params.id);
    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "SubCategory not found",
      });
    }

    const updateData = { ...req.body };
    if (updateData.name && !updateData.slug) {
      updateData.slug = slugify(updateData.name, { lower: true, strict: true });
    }

    await subCategory.update(updateData);

    return res.status(200).json({
      success: true,
      message: "SubCategory updated successfully",
      data: subCategory,
    });
  } catch (error) {
    console.error("Error updating subcategory:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update subcategory",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* Delete subcategory by id */
exports.deleteSubCategory = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const subCategory = await SubCategory.findByPk(req.params.id);
    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "SubCategory not found",
      });
    }

    await subCategory.destroy();

    return res.status(200).json({
      success: true,
      message: "SubCategory deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting subcategory:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete subcategory",
    });
  }
};

/* Toggle subcategory active status */
exports.toggleVisibility = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const subCategory = await SubCategory.findByPk(req.params.id);
    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "SubCategory not found",
      });
    }

    await subCategory.toggleVisibility();

    return res.status(200).json({
      success: true,
      message: "SubCategory visibility toggled",
      data: subCategory,
    });
  } catch (error) {
    console.error("Error toggling subcategory visibility:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle subcategory visibility",
    });
  }
};

/* Get subcategories by category */
exports.getByCategory = async (req, res) => {
  try {
    const subCategories = await SubCategory.findAll({
      where: {
        categoryId: req.params.categoryId,
        ...(req.query.isActive === "true" && { isActive: true }),
      },
      include:
        req.query.includeCategory === "true"
          ? [
              {
                model: Category,
                as: "category",
                attributes: ["id", "name", "slug"],
              },
            ]
          : [],
      order: [["position", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      data: subCategories,
    });
  } catch (error) {
    console.error("Error fetching subcategories by category:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subcategories",
    });
  }
};
