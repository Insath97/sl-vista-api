const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const HomeStay = require("../models/homeStay.model");
const Booking = require("../models/booking.model");
const CustomerProfile = require("../models/customerProfile.model");
const MerchantProfile = require("../models/merchantProfile.model");

// Helper to check date availability
async function isHomestayAvailable(homestayId, checkInDate, checkOutDate) {
  const conflictingBookings = await Booking.count({
    where: {
      homestayId,
      [Op.or]: [
        {
          checkInDate: { [Op.lte]: checkOutDate },
          checkOutDate: { [Op.gte]: checkInDate },
        },
      ],
      bookingStatus: {
        [Op.notIn]: ["cancelled", "failed"],
      },
    },
  });

  return conflictingBookings === 0;
}

// Create booking
exports.createBooking = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { homestayId, checkInDate, checkOutDate } = req.body;

    const userId = req.user.id;

    const customer = await CustomerProfile.findOne({
      where: { userId },
    });

    if (!customer) {
      return res.status(401).json({
        success: false,
        message: "Customer profile not found for this user",
      });
    }

    const customerId = customer.id;

    console.log("Creating booking for customer:", customerId);

    // Check if homestay exists and is available
    const homestay = await HomeStay.findByPk(homestayId);
    if (!homestay) {
      return res.status(404).json({
        success: false,
        message: "Homestay not found",
      });
    }

    if (homestay.availabilityStatus !== "available") {
      return res.status(400).json({
        success: false,
        message: "Homestay is not available for booking",
      });
    }

    // Check date availability
    const available = await isHomestayAvailable(
      homestayId,
      checkInDate,
      checkOutDate
    );
    if (!available) {
      return res.status(400).json({
        success: false,
        message: "Homestay is already booked for the selected dates",
      });
    }

    // Calculate total amount (simplified - you'd want to add proper pricing logic)
    const days =
      (new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24);
    const totalAmount = days * homestay.basePrice + homestay.cleaningFee;

    // Create booking
    const booking = await Booking.create({
      homestayId,
      customerId,
      checkInDate,
      checkOutDate,
      totalAmount,
      bookingStatus: "confirmed",
      paymentStatus: "paid", // Assuming immediate payment for simplicity
    });

    // The afterCreate hook will automatically update homestay status

    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create booking",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* list all booking */
exports.getAllBookings = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    // Base query conditions
    const where = {};
    const include = [
      {
        model: HomeStay,
        as: "homestay",
        attributes: ["id", "name", "merchantId"],
        include: [], // Initialize empty include for homestay
      },
      {
        model: CustomerProfile,
        as: "customer",
        attributes: ["id", "firstName", "lastName"],
      },
    ];

    // Role-based filtering
    if (req.user.accountType === "merchant") {
      // For merchants, only include bookings for their homestays
      include[0].include.push({
        model: MerchantProfile,
        as: "merchant",
        where: { id: req.user.merchantProfile.id },
        attributes: [],
      });
    } else if (req.user.accountType === "customer") {
      // For customers, only show their own bookings
      where.customerId = req.user.customerProfile.id;
    }

    // Status filter (optional)
    if (status) {
      where.bookingStatus = status;
    }

    const { count, rows: bookings } = await Booking.findAndCountAll({
      where,
      include,
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true, // Important for correct count with includes
    });

    return res.status(200).json({
      success: true,
      data: bookings,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
