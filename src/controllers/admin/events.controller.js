const { validationResult } = require("express-validator");
const slugify = require("slugify");
const Events = require("../../models/events.model");
const EventsImages = require("../../models/eventsImages.model");
const UploadService = require("../../helpers/upload");
const { Op } = require("sequelize");

// 🔧 Helper function to upload images
const handleEventImageUploads = async (files, eventId) => {
  if (!files || !files.images || files.images.length === 0) return [];

  const uploadPromises = files.images.map((file) =>
    UploadService.uploadFile(file, "events", eventId)
  );

  const uploadedFiles = await Promise.all(uploadPromises);

  return uploadedFiles.map((file) => ({
    eventId,
    imageUrl: file.url,
    s3Key: file.key,
    fileName: file.fileName,
    size: file.size,
    mimetype: file.mimetype,
  }));
};

// 🚀 Create Event Controller
exports.createEvent = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const { ...eventData } = req.body;

    // Generate slug if not provided
    if (!eventData.slug && eventData.name) {
      eventData.slug = slugify(eventData.name, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    // ✅ Create the Event
    const event = await Events.create(eventData);

    // 📸 Handle image uploads
    const images = await handleEventImageUploads(req.files, event.id);
    if (images.length > 0) {
      await EventsImages.bulkCreate(images);
    }

    // 📦 Fetch full event with images
    const fullEvent = await Events.findByPk(event.id, {
      include: [
        {
          model: EventsImages,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Event created successfully",
      data: fullEvent,
    });
  } catch (error) {
    console.error("Error creating event:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create event",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//Get all Events

exports.getAllEvents = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const {
      isActive,
      includeDeleted,
      includeImages,
      search,
      city,
      province,
      page = 1,
      limit = 10,
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};
    const include = [];

    if (isActive === "true") where.isActive = true;
    else if (isActive === "false") where.isActive = false;

    if (search) {
      where.title = { [Op.like]: `%${search}%` };
    }

    if (city) where.city = city;
    if (province) where.province = province;

    if (includeImages === "true") {
      include.push({
        model: EventsImages,
        as: "images",
        order: [["sortOrder", "ASC"]],
      });
    }

    const result = await Events.findAndCountAll({
      where,
      include,
      limit: parseInt(limit),
      offset: parseInt(offset),
      paranoid: includeDeleted !== "true", // include soft-deleted if true
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Events fetched successfully",
      data: result.rows,
      pagination: {
        total: result.count,
        page: parseInt(page),
        pageSize: parseInt(limit),
        totalPages: Math.ceil(result.count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch events",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//Get by id

exports.getEventById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const { includeDeleted } = req.query;

    const options = {
      where: { id: req.params.id },
      include: [
        {
          model: EventsImages,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
      ],
      paranoid: includeDeleted !== "true",
    };

    const event = await Events.findOne(options);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error("Error fetching event:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch event",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//update Events

exports.updateEvent = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const event = await Events.findByPk(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    const { images: bodyImages, ...updateData } = req.body;
    let newImages = [];

    const uploadedImages = await handleEventImageUploads(req.files, event.id);
    newImages = [...uploadedImages];

    if (bodyImages?.length) {
      newImages = [
        ...newImages,
        ...bodyImages.map((img) => ({
          ...img,
          s3Key: img.s3Key || null,
          eventId: event.id,
        })),
      ];
    }

    if (updateData.name && !updateData.slug && updateData.name !== event.name) {
      updateData.slug = slugify(updateData.name, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    await event.update(updateData);

    if (newImages.length > 0) {
      await EventsImages.destroy({
        where: { eventId: event.id },
      });
      await EventsImages.bulkCreate(newImages);
    }

    const updatedEvent = await Events.findByPk(event.id, {
      include: [
        {
          model: EventsImages,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Event updated successfully",
      data: updatedEvent,
    });
  } catch (error) {
    console.error("Error updating event:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update event",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//Delete events

exports.deleteEvent = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const event = await Events.findByPk(req.params.id, {
      include: [{ model: EventsImages, as: "images" }],
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    const s3Keys = event.images.map((img) => img.s3Key).filter(Boolean);

    if (s3Keys.length > 0) {
      if (s3Keys.length === 1) {
        await UploadService.deleteFile(s3Keys[0]);
      } else {
        await UploadService.deleteMultipleFiles(s3Keys);
      }
    }

    await event.destroy();

    return res.status(200).json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting event:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete event",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//Restore soft-delete events

exports.restoreEvent = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const event = await Events.findOne({
      where: { id: req.params.id },
      paranoid: false,
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found (including soft-deleted)",
      });
    }

    if (!event.deletedAt) {
      return res.status(400).json({
        success: false,
        message: "Event is not deleted",
      });
    }

    await event.restore();

    const restoredEvent = await Events.findByPk(req.params.id, {
      include: [
        {
          model: EventsImages,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Event restored successfully",
      data: restoredEvent,
    });
  } catch (error) {
    console.error("Error restoring event:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to restore event",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Toggle Events Active status
exports.toggleActiveStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const event = await Events.findByPk(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    const newStatus = !event.isActive;
    await event.update({ isActive: newStatus });

    return res.status(200).json({
      success: true,
      message: "Event status toggled successfully",
      data: {
        id: event.id,
        isActive: newStatus,
      },
    });
  } catch (error) {
    console.error("Error toggling event status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle event status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Verify Events
exports.verifyEvent = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const event = await Events.findByPk(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    const newVerifiedStatus =
      req.body.verified !== undefined
        ? req.body.verified
        : !event.vistaVerified;

    await event.update({ vistaVerified: newVerifiedStatus });

    return res.status(200).json({
      success: true,
      message: "Event verification status updated",
      data: {
        id: event.id,
        vistaVerified: newVerifiedStatus,
      },
    });
  } catch (error) {
    console.error("Error verifying event:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update verification status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update Event Images
exports.updateImages = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const event = await Events.findByPk(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    const images = await handleEventImageUploads(req.files, event.id);

    if (images.length > 0) {
      await EventsImages.destroy({
        where: { eventId: event.id },
      });
      await EventsImages.bulkCreate(images);
    }

    const updatedEvent = await Events.findByPk(event.id, {
      include: [
        {
          model: EventsImages,
          as: "images",
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Event images updated successfully",
      data: updatedEvent,
    });
  } catch (error) {
    console.error("Error updating event images:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update event images",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Delete Event Image
exports.deleteImage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const image = await EventsImages.findOne({
      where: {
        id: req.params.imageId,
        eventId: req.params.id,
      },
    });

    if (!image) {
      return res.status(404).json({
        success: false,
        message: "Image not found for this event",
      });
    }

    if (image.s3Key) {
      await UploadService.deleteFile(image.s3Key);
    }

    await image.destroy();

    return res.status(200).json({
      success: true,
      message: "Event image deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting event image:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete event image",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Set Featured Event Image
exports.setFeaturedImage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    // Remove existing featured image for the event
    await EventsImages.update(
      { isFeatured: false },
      {
        where: {
          eventId: req.params.id,
          isFeatured: true,
        },
      }
    );

    // Set new featured image
    const [affectedCount] = await EventsImages.update(
      { isFeatured: true },
      {
        where: {
          id: req.params.imageId,
          eventId: req.params.id,
        },
      }
    );

    if (affectedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Image not found for this event",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Featured image set successfully",
    });
  } catch (error) {
    console.error("Error setting featured image:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to set featured image",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
