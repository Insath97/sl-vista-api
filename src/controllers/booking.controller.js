const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const { sequelize } = require("../config/database");
const Booking = require("../models/booking.model");
const Room = require("../models/room.model");
const HomeStay = require("../models/homeStay.model");
const CustomerProfile = require("../models/customerProfile.model");
const MerchantProfile = require("../models/merchantProfile.model");

// Helper function to check availability
async function checkAvailability(items, checkInDate, checkOutDate, itemType) {
  const availabilityChecks = items.map(async (item) => {
    const conflictingBookings = await Booking.count({
      include: [
        {
          model: itemType === "room" ? Room : HomeStay,
          as: itemType === "room" ? "rooms" : "homestays",
          where: { id: item.id },
          through: {
            where: {
              bookingId: { [Op.not]: null },
            },
          },
        },
      ],
      where: {
        [Op.or]: [
          {
            checkInDate: { [Op.lt]: checkOutDate },
            checkOutDate: { [Op.gt]: checkInDate },
          },
        ],
        bookingStatus: {
          [Op.notIn]: ["cancelled", "failed"],
        },
      },
    });

    return conflictingBookings === 0;
  });

  const results = await Promise.all(availabilityChecks);
  return results.every((isAvailable) => isAvailable);
}

// Create booking
exports.createBooking = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      rooms = [],
      homestays = [],
      checkInDate,
      checkOutDate,
      specialRequests,
      paymentMethod,
    } = req.body;

    const userId = req.user.id;

    // Validate dates
    if (new Date(checkInDate) < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Cannot book for past dates",
      });
    }

    if (new Date(checkOutDate) <= new Date(checkInDate)) {
      return res.status(400).json({
        success: false,
        message: "Check-out date must be after check-in date",
      });
    }

    // Get customer profile
    const customer = await CustomerProfile.findOne({ where: { userId } });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found",
      });
    }

    // Check if at least one room or homestay is selected
    if (rooms.length === 0 && homestays.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one room or homestay must be selected",
      });
    }

    // Check availability for all items
    let allAvailable = true;
    let availabilityMessage = "";

    if (rooms.length > 0) {
      const roomsAvailable = await checkAvailability(
        rooms,
        checkInDate,
        checkOutDate,
        "room"
      );
      if (!roomsAvailable) {
        allAvailable = false;
        availabilityMessage =
          "One or more rooms are not available for the selected dates";
      }
    }

    if (homestays.length > 0 && allAvailable) {
      const homestaysAvailable = await checkAvailability(
        homestays,
        checkInDate,
        checkOutDate,
        "homestay"
      );
      if (!homestaysAvailable) {
        allAvailable = false;
        availabilityMessage =
          "One or more homestays are not available for the selected dates";
      }
    }

    if (!allAvailable) {
      return res.status(400).json({
        success: false,
        message: availabilityMessage,
      });
    }

    // Calculate total amount
    let totalAmount = 0;
    const days =
      (new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24);

    // Calculate room prices
    if (rooms.length > 0) {
      const roomPrices = await Promise.all(
        rooms.map(async (room) => {
          const roomData = await Room.findByPk(room.id);
          return days * roomData.pricePerNight;
        })
      );
      totalAmount += roomPrices.reduce((sum, price) => sum + price, 0);
    }

    // Calculate homestay prices
    if (homestays.length > 0) {
      const homestayPrices = await Promise.all(
        homestays.map(async (homestay) => {
          const homestayData = await HomeStay.findByPk(homestay.id);
          return days * homestayData.basePrice + homestayData.cleaningFee;
        })
      );
      totalAmount += homestayPrices.reduce((sum, price) => sum + price, 0);
    }

    // Create transaction for atomic operations
    const transaction = await sequelize.transaction();

    try {
      // Create booking
      const booking = await Booking.create(
        {
          customerId: customer.id,
          checkInDate,
          checkOutDate,
          totalAmount,
          bookingStatus: "pending",
          paymentStatus: "pending",
          paymentMethod,
          specialRequests,
          numberOfGuests: req.body.numberOfGuests || 1,
          numberOfChildren: req.body.numberOfChildren || 0,
          numberOfInfants: req.body.numberOfInfants || 0,
        },
        { transaction }
      );

      // Associate rooms if any
      if (rooms.length > 0) {
        await Promise.all(
          rooms.map(async (room) => {
            await BookingRoom.create(
              {
                bookingId: booking.id,
                roomId: room.id,
                specialRequests: room.specialRequests || null,
              },
              { transaction }
            );
          })
        );
      }

      // Associate homestays if any
      if (homestays.length > 0) {
        await Promise.all(
          homestays.map(async (homestay) => {
            await BookingHomeStay.create(
              {
                bookingId: booking.id,
                homestayId: homestay.id,
                specialRequests: homestay.specialRequests || null,
              },
              { transaction }
            );
          })
        );
      }

      // Commit transaction
      await transaction.commit();

      // Get full booking details to return
      const fullBooking = await Booking.findByPk(booking.id, {
        include: [
          { model: CustomerProfile, as: "customer" },
          { model: Room, as: "rooms", through: { attributes: [] } },
          { model: HomeStay, as: "homestays", through: { attributes: [] } },
        ],
      });

      return res.status(201).json({
        success: true,
        message: "Booking created successfully",
        data: fullBooking,
      });
    } catch (error) {
      // Rollback transaction if any error occurs
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error creating booking:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create booking",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get all bookings (with filters for admin/merchant/customer)
exports.getAllBookings = async (req, res) => {
  try {
    const {
      status,
      fromDate,
      toDate,
      page = 1,
      limit = 10,
      includeCancelled = false,
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};
    const include = [
      {
        model: CustomerProfile,
        as: "customer",
        attributes: ["id", "firstName", "lastName", "email"],
      },
      { model: Room, as: "rooms", through: { attributes: [] } },
      { model: HomeStay, as: "homestays", through: { attributes: [] } },
    ];

    // Date filtering
    if (fromDate && toDate) {
      where[Op.or] = [
        {
          checkInDate: { [Op.between]: [new Date(fromDate), new Date(toDate)] },
        },
        {
          checkOutDate: {
            [Op.between]: [new Date(fromDate), new Date(toDate)],
          },
        },
      ];
    }

    // Status filtering
    if (status) {
      where.bookingStatus = status;
    } else if (!includeCancelled) {
      where.bookingStatus = { [Op.notIn]: ["cancelled", "failed"] };
    }

    // Role-based filtering
    if (req.user.accountType === "customer") {
      const customer = await CustomerProfile.findOne({
        where: { userId: req.user.id },
      });
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Customer profile not found",
        });
      }
      where.customerId = customer.id;
    } else if (req.user.accountType === "merchant") {
      const merchant = await MerchantProfile.findOne({
        where: { userId: req.user.id },
      });
      if (!merchant) {
        return res.status(404).json({
          success: false,
          message: "Merchant profile not found",
        });
      }

      // Include bookings that have rooms/homestays belonging to this merchant
      include.push({
        model: Room,
        as: "rooms",
        through: { attributes: [] },
        where: { merchantId: merchant.id },
        required: false,
      });

      include.push({
        model: HomeStay,
        as: "homestays",
        through: { attributes: [] },
        where: { merchantId: merchant.id },
        required: false,
      });

      // Only show bookings that have at least one room or homestay from this merchant
      where[Op.or] = [
        { "$rooms.id$": { [Op.not]: null } },
        { "$homestays.id$": { [Op.not]: null } },
      ];
    }

    const { count, rows: bookings } = await Booking.findAndCountAll({
      where,
      include,
      distinct: true,
      offset,
      limit: parseInt(limit),
      order: [["createdAt", "DESC"]],
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

// Get booking by ID
exports.getBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    const include = [
      {
        model: CustomerProfile,
        as: "customer",
        attributes: ["id", "firstName", "lastName", "email"],
      },
      { model: Room, as: "rooms", through: { attributes: [] } },
      { model: HomeStay, as: "homestays", through: { attributes: [] } },
    ];

    const where = { id };

    // Role-based access control
    if (req.user.accountType === "customer") {
      const customer = await CustomerProfile.findOne({
        where: { userId: req.user.id },
      });
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Customer profile not found",
        });
      }
      where.customerId = customer.id;
    } else if (req.user.accountType === "merchant") {
      const merchant = await MerchantProfile.findOne({
        where: { userId: req.user.id },
      });
      if (!merchant) {
        return res.status(404).json({
          success: false,
          message: "Merchant profile not found",
        });
      }

      // Include merchant's rooms/homestays in the query
      include.push({
        model: Room,
        as: "rooms",
        through: { attributes: [] },
        where: { merchantId: merchant.id },
        required: false,
      });

      include.push({
        model: HomeStay,
        as: "homestays",
        through: { attributes: [] },
        where: { merchantId: merchant.id },
        required: false,
      });

      // Only show if booking has at least one room or homestay from this merchant
      where[Op.or] = [
        { "$rooms.id$": { [Op.not]: null } },
        { "$homestays.id$": { [Op.not]: null } },
      ];
    }

    const booking = await Booking.findOne({
      where,
      include,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found or you don't have permission to view it",
      });
    }

    return res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error("Error fetching booking:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch booking",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Cancel booking
exports.cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancellationReason } = req.body;

    const where = { id };

    // Role-based access control
    if (req.user.accountType === "customer") {
      const customer = await CustomerProfile.findOne({
        where: { userId: req.user.id },
      });
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Customer profile not found",
        });
      }
      where.customerId = customer.id;
    } else if (req.user.accountType === "merchant") {
      const merchant = await MerchantProfile.findOne({
        where: { userId: req.user.id },
      });
      if (!merchant) {
        return res.status(404).json({
          success: false,
          message: "Merchant profile not found",
        });
      }

      // Check if booking has at least one room/homestay from this merchant
      const booking = await Booking.findOne({
        where: { id },
        include: [
          {
            model: Room,
            as: "rooms",
            through: { attributes: [] },
            where: { merchantId: merchant.id },
            required: false,
          },
          {
            model: HomeStay,
            as: "homestays",
            through: { attributes: [] },
            where: { merchantId: merchant.id },
            required: false,
          },
        ],
      });

      if (!booking || (!booking.rooms.length && !booking.homestays.length)) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to cancel this booking",
        });
      }
    }

    const booking = await Booking.findOne({ where });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found or you don't have permission to cancel it",
      });
    }

    // Check if booking can be cancelled
    if (["cancelled", "completed", "failed"].includes(booking.bookingStatus)) {
      return res.status(400).json({
        success: false,
        message: `Booking is already ${booking.bookingStatus} and cannot be cancelled`,
      });
    }

    if (new Date(booking.checkInDate) < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel a booking that has already started",
      });
    }

    // Calculate refund amount if applicable
    let refundAmount = 0;
    if (booking.isRefundable) {
      // Implement your refund policy logic here
      // For example: full refund if cancelled 7+ days before check-in
      const daysBeforeCheckIn =
        (new Date(booking.checkInDate) - new Date()) / (1000 * 60 * 60 * 24);

      if (daysBeforeCheckIn > 7) {
        refundAmount = booking.totalAmount;
      } else if (daysBeforeCheckIn > 3) {
        refundAmount = booking.totalAmount * 0.5; // 50% refund
      }
    }

    // Update booking status
    await booking.update({
      bookingStatus: "cancelled",
      paymentStatus: refundAmount > 0 ? "refunded" : booking.paymentStatus,
      cancellationReason,
      cancellationDate: new Date(),
      refundAmount,
    });

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      data: {
        refundAmount,
        cancellationDate: new Date(),
      },
    });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel booking",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update booking status (admin/merchant only)
exports.updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["confirmed", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const where = { id };

    // Only admin or merchant can update status
    if (req.user.accountType === "merchant") {
      const merchant = await MerchantProfile.findOne({
        where: { userId: req.user.id },
      });
      if (!merchant) {
        return res.status(404).json({
          success: false,
          message: "Merchant profile not found",
        });
      }

      // Check if booking has at least one room/homestay from this merchant
      const booking = await Booking.findOne({
        where: { id },
        include: [
          {
            model: Room,
            as: "rooms",
            through: { attributes: [] },
            where: { merchantId: merchant.id },
            required: false,
          },
          {
            model: HomeStay,
            as: "homestays",
            through: { attributes: [] },
            where: { merchantId: merchant.id },
            required: false,
          },
        ],
      });

      if (!booking || (!booking.rooms.length && !booking.homestays.length)) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to update this booking",
        });
      }
    } else if (req.user.accountType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins and merchants can update booking status",
      });
    }

    const booking = await Booking.findOne({ where });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Validate status transition
    if (booking.bookingStatus === "cancelled" && status !== "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cannot change status of a cancelled booking",
      });
    }

    if (booking.bookingStatus === "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot change status of a completed booking",
      });
    }

    // Update booking status
    await booking.update({
      bookingStatus: status,
      ...(status === "completed" && { paymentStatus: "paid" }),
    });

    return res.status(200).json({
      success: true,
      message: "Booking status updated successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error updating booking status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update booking status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
