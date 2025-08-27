const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const Booking = require("../models/booking.model");
const Property = require("../models/property.model");
const Room = require("../models/room.model");
const HomeStay = require("../models/homeStay.model");
const BookingRoom = require("../models/bookingRoom.model");
const BookingHomeStay = require("../models/bookingHomestay.model");
const CustomerProfile = require("../models/customerProfile.model");
const MerchantProfile = require("../models/merchantProfile.model");
const User = require("../models/user.model");

// Helper function to check if merchant has access to a booking
async function checkMerchantBookingAccess(bookingId, merchantId) {
  try {
    // Check if booking has rooms belonging to this merchant
    const roomBooking = await BookingRoom.findOne({
      include: [
        {
          model: Room,
          as: "room",
          include: [
            {
              model: Property,
              as: "property",
              where: { merchantId: merchantId },
            },
          ],
        },
      ],
      where: { bookingId: bookingId },
    });

    if (roomBooking) {
      return true;
    }

    // Check if booking has homestays belonging to this merchant
    const homestayBooking = await BookingHomeStay.findOne({
      include: [
        {
          model: HomeStay,
          as: "homestay",
          where: { merchantId: merchantId },
        },
      ],
      where: { bookingId: bookingId },
    });

    if (homestayBooking) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error checking merchant access:", error);
    return false;
  }
}

// Helper function to determine cancellation policy
function determineCancellationPolicy(booking) {
  // Priority: Room cancellation policy > Homestay cancellation policy > Default
  if (booking.rooms && booking.rooms.length > 0) {
    return booking.rooms[0].property.cancellationPolicy || "moderate";
  }
  if (booking.homestays && booking.homestays.length > 0) {
    return booking.homestays[0].cancellationPolicy || "moderate";
  }
  return "moderate"; // Default policy
}

// Helper function to calculate refund amount
function calculateRefundAmount(booking, daysUntilCheckIn, cancellationPolicy) {
  const totalAmount = parseFloat(booking.totalAmount);

  switch (cancellationPolicy) {
    case "flexible":
      // Full refund if cancelled more than 24 hours before check-in
      if (daysUntilCheckIn > 1) {
        return totalAmount;
      } else {
        return totalAmount * 0.5; // 50% refund if within 24 hours
      }

    case "moderate":
      // Full refund if cancelled more than 5 days before check-in
      if (daysUntilCheckIn > 5) {
        return totalAmount;
      } else if (daysUntilCheckIn > 3) {
        return totalAmount * 0.7; // 70% refund 3-5 days before
      } else if (daysUntilCheckIn > 1) {
        return totalAmount * 0.5; // 50% refund 1-3 days before
      } else {
        return 0; // No refund within 24 hours
      }

    case "strict":
      // 50% refund if cancelled more than 7 days before check-in
      if (daysUntilCheckIn > 7) {
        return totalAmount * 0.5;
      } else if (daysUntilCheckIn > 3) {
        return totalAmount * 0.3; // 30% refund 3-7 days before
      } else {
        return 0; // No refund within 3 days
      }

    case "non_refundable":
      return 0; // No refund under any circumstances

    default:
      // Default moderate policy
      if (daysUntilCheckIn > 3) {
        return totalAmount * 0.8; // 80% refund more than 3 days before
      } else {
        return 0; // No refund within 3 days
      }
  }
}

/* create booking */
exports.createBooking = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Get customer profile
    const customer = await CustomerProfile.findOne({
      where: { userId: req.user.id },
    });

    if (!customer) {
      return res.status(403).json({
        success: false,
        message: "Customer profile not found or inactive",
      });
    }

    const { homestayIds = [], roomIds = [], ...bookingData } = req.body;

    // Validate that at least one room or homestay is selected
    if (roomIds.length === 0 && homestayIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one room or homestay must be selected for booking",
      });
    }

    let subTotalAmount = 0;
    let rooms = [];
    let homestays = [];
    const bookingDetails = {
      rooms: [],
      homestays: [],
      nights: 0,
    };

    // Check date availability
    const checkInDate = new Date(bookingData.checkInDate);
    const checkOutDate = new Date(bookingData.checkOutDate);
    const nights = Math.ceil(
      (checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)
    );
    bookingDetails.nights = nights;

    // Process rooms if any
    if (roomIds.length > 0) {
      rooms = await Room.findAll({
        where: {
          id: roomIds,
          isActive: true,
          approvalStatus: "approved",
          availabilityStatus: { [Op.in]: ["available", "booked"] }, // Allow booked rooms to be checked
        },
        include: [
          {
            model: Property,
            as: "property",
            attributes: ["id", "title"],
          },
        ],
      });

      if (rooms.length !== roomIds.length) {
        return res.status(400).json({
          success: false,
          message: "Some rooms are not available for booking",
        });
      }

      // Check room availability for dates using the new method
      for (const room of rooms) {
        const isAvailable = await room.checkAvailability(
          checkInDate,
          checkOutDate
        );
        if (!isAvailable) {
          return res.status(400).json({
            success: false,
            message: `Room ${room.roomNumber} is not available for the selected dates`,
          });
        }
      }
    }

    // Process homestays if any
    if (homestayIds.length > 0) {
      homestays = await HomeStay.findAll({
        where: {
          id: homestayIds,
          isActive: true,
          approvalStatus: "approved",
          availabilityStatus: { [Op.in]: ["available", "booked"] }, // Allow booked homestays to be checked
        },
        include: [
          {
            model: MerchantProfile,
            as: "merchant",
            attributes: ["id", "merchantName", "businessName"],
          },
        ],
      });

      if (homestays.length !== homestayIds.length) {
        return res.status(400).json({
          success: false,
          message: "Some homestays are not available for booking",
        });
      }

      // Check homestay availability for dates using the new method
      for (const homestay of homestays) {
        const isAvailable = await homestay.checkAvailability(
          checkInDate,
          checkOutDate
        );
        if (!isAvailable) {
          return res.status(400).json({
            success: false,
            message: `Homestay ${homestay.title} is not available for the selected dates`,
          });
        }
      }
    }

    // Calculate costs
    for (const room of rooms) {
      const roomTotal = parseFloat(room.basePrice) * nights;
      subTotalAmount += roomTotal;

      bookingDetails.rooms.push({
        id: room.id,
        roomNumber: room.roomNumber,
        propertyId: room.propertyId,
        propertyName: room.property?.title,
        basePrice: room.basePrice,
        nights: nights,
        total: roomTotal,
      });
    }

    for (const homestay of homestays) {
      const homestayTotal =
        parseFloat(homestay.basePrice) * nights +
        parseFloat(homestay.cleaningFee || 0);
      subTotalAmount += homestayTotal;

      bookingDetails.homestays.push({
        id: homestay.id,
        title: homestay.title,
        basePrice: homestay.basePrice,
        cleaningFee: homestay.cleaningFee || 0,
        nights: nights,
        total: homestayTotal,
      });
    }

    const totalAmount = subTotalAmount;

    // Determine booking type
    const bookingType =
      roomIds.length > 0 && homestayIds.length > 0
        ? "mixed"
        : roomIds.length > 0
        ? "room"
        : "homestay";

    // Create booking
    const booking = await Booking.create({
      ...bookingData,
      customerId: customer.id,
      subTotalAmount,
      totalAmount,
      bookingType,
      bookingStatus: "confirmed",
      numberOfGuests: bookingData.numberOfGuests || 1,
    });

    // Link rooms to booking if any
    if (rooms.length > 0) {
      const bookingRooms = rooms.map((room) => ({
        bookingId: booking.id,
        roomId: room.id,
        priceAtBooking: room.basePrice,
        numberOfGuests: bookingData.numberOfGuests || 1,
      }));

      await BookingRoom.bulkCreate(bookingRooms);

     /*  // Update room availability status to "booked"
      for (const room of rooms) {
        await room.update({ availabilityStatus: "booked" });
      } */
    }

    // Link homestays to booking if any
    if (homestays.length > 0) {
      const bookingHomestays = homestays.map((homestay) => ({
        bookingId: booking.id,
        homestayId: homestay.id,
        priceAtBooking: homestay.basePrice,
        cleaningFeeAtBooking: homestay.cleaningFee || 0,
        numberOfGuests: bookingData.numberOfGuests || 1,
      }));

      await BookingHomeStay.bulkCreate(bookingHomestays);

      // Update homestay availability status to "booked"
      /* for (const homestay of homestays) {
        await homestay.update({ availabilityStatus: "booked" });
      } */
    }

    // Return complete booking details
    const bookingWithDetails = await Booking.findByPk(booking.id);

    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: {
        booking: bookingWithDetails,
        bookingDetails,
        nights,
        subTotalAmount,
        totalAmount,
      },
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

/* Get All Bookings */
exports.getAllBookings = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    console.log("User logged in with account type : " + req.user.accountType);

    const {
      page = 1,
      limit = 10,
      bookingStatus,
      paymentStatus,
      bookingType,
      startDate,
      endDate,
      includeDeleted,
    } = req.query;

    const where = {};
    const include = [
      {
        model: CustomerProfile,
        as: "customer",
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "email"],
          },
        ],
      },
    ];

    // Always include both rooms and homestays associations
    include.push({
      model: Room,
      as: "rooms",
      through: { attributes: [] },
      include: [
        {
          model: Property,
          as: "property",
          attributes: ["id", "title", "propertyType"],
          include: [
            {
              model: MerchantProfile,
              as: "merchant",
              attributes: [
                "id",
                "merchantName",
                "businessName",
                "businessType",
              ],
            },
          ],
        },
      ],
    });

    include.push({
      model: HomeStay,
      as: "homestays",
      through: { attributes: [] },
      include: [
        {
          model: MerchantProfile,
          as: "merchant",
          attributes: ["id", "merchantName", "businessName", "businessType"],
        },
      ],
    });

    // Filter by status
    if (bookingStatus) where.bookingStatus = bookingStatus;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (bookingType) where.bookingType = bookingType;

    // Date range filter
    if (startDate && endDate) {
      where.checkInDate = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    } else if (startDate) {
      where.checkInDate = { [Op.gte]: new Date(startDate) };
    } else if (endDate) {
      where.checkInDate = { [Op.lte]: new Date(endDate) };
    }

    // Role-based filtering
    if (req.user.accountType === "customer") {
      // Customer can only see their own bookings
      const customer = await CustomerProfile.findOne({
        where: { userId: req.user.id },
      });

      if (!customer) {
        return res.status(403).json({
          success: false,
          message: "Customer profile not found",
        });
      }
      where.customerId = customer.id;
    } else if (req.user.accountType === "merchant") {
      // Merchant can only see bookings for their properties/homestays
      const merchant = await MerchantProfile.findOne({
        where: { userId: req.user.id },
      });

      if (!merchant) {
        return res.status(403).json({
          success: false,
          message: "Merchant profile not found",
        });
      }

      console.log(
        `Merchant ID: ${merchant.id}, Business Type: ${merchant.businessType}`
      );

      // SIMPLIFIED: Show all bookings for this merchant regardless of business type
      const merchantWhere = {
        [Op.or]: [
          { "$rooms.property.merchantId$": merchant.id },
          { "$homestays.merchantId$": merchant.id },
        ],
      };

      where[Op.and] = [merchantWhere];
    }
    // Admin can see all bookings (no additional filtering)

    const options = {
      where,
      include,
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      paranoid: includeDeleted !== "true",
      distinct: true,
      subQuery: false,
    };

    const { count, rows: bookings } = await Booking.findAndCountAll(options);

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

/* Get Booking by ID */
exports.getBookingById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    console.log("User logged in with account type : " + req.user.accountType);

    const { includeDeleted } = req.query;
    const bookingId = req.params.id;

    // First, get the booking without merchant filters to check existence
    let booking = await Booking.findByPk(bookingId, {
      include: [
        {
          model: CustomerProfile,
          as: "customer",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "email"],
            },
          ],
        },
      ],
      paranoid: includeDeleted !== "true",
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Role-based access control
    if (req.user.accountType === "customer") {
      // Customer can only see their own bookings
      const customer = await CustomerProfile.findOne({
        where: { userId: req.user.id },
      });

      if (!customer || booking.customerId !== customer.id) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to view this booking",
        });
      }
    } else if (req.user.accountType === "merchant") {
      // Merchant can only see bookings for their properties/homestays
      const merchant = await MerchantProfile.findOne({
        where: { userId: req.user.id },
      });

      if (!merchant) {
        return res.status(403).json({
          success: false,
          message: "Merchant profile not found",
        });
      }

      console.log(
        `Merchant ID: ${merchant.id}, Business Type: ${merchant.businessType}`
      );

      // Check if this booking contains the merchant's rooms or homestays
      const hasAccess = await checkMerchantBookingAccess(
        bookingId,
        merchant.id
      );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to view this booking",
        });
      }
    }
    // Admin can see all bookings (no additional filtering)

    // Now load the full booking details with all associations
    const fullInclude = [
      {
        model: CustomerProfile,
        as: "customer",
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "email"],
          },
        ],
      },
      {
        model: Room,
        as: "rooms",
        through: { attributes: [] },
        include: [
          {
            model: Property,
            as: "property",
            attributes: ["id", "title", "propertyType"],
            include: [
              {
                model: MerchantProfile,
                as: "merchant",
                attributes: [
                  "id",
                  "merchantName",
                  "businessName",
                  "businessType",
                ],
              },
            ],
          },
        ],
      },
      {
        model: HomeStay,
        as: "homestays",
        through: {
          attributes: [],
        },
        include: [
          {
            model: MerchantProfile,
            as: "merchant",
            attributes: ["id", "merchantName", "businessName", "businessType"],
          },
        ],
      },
    ];

    booking = await Booking.findByPk(bookingId, {
      include: fullInclude,
      paranoid: includeDeleted !== "true",
    });

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

/* Cancel Booking */
exports.cancelBooking = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { cancellationReason } = req.body;

    const booking = await Booking.findByPk(req.params.id, {
      include: [
        {
          model: CustomerProfile,
          as: "customer",
          attributes: ["id", "userId"],
        },
        {
          model: Room,
          as: "rooms",
          through: { attributes: [] },
          include: [
            {
              model: Property,
              as: "property",
              attributes: ["id", "cancellationPolicy"],
            },
          ],
        },
        {
          model: HomeStay,
          as: "homestays",
          through: { attributes: [] },
          attributes: ["id", "cancellationPolicy"],
        },
      ],
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Check permissions
    if (req.user.accountType === "customer") {
      const customer = await CustomerProfile.findOne({
        where: { userId: req.user.id },
      });

      if (!customer || booking.customerId !== customer.id) {
        return res.status(403).json({
          success: false,
          message: "You can only cancel your own bookings",
        });
      }
    } else if (req.user.accountType === "merchant") {
      // Merchant can only cancel bookings for their properties
      const merchant = await MerchantProfile.findOne({
        where: { userId: req.user.id },
      });

      if (!merchant) {
        return res.status(403).json({
          success: false,
          message: "Merchant profile not found",
        });
      }

      // Check if booking contains merchant's properties
      const hasMerchantRooms = booking.rooms.some(
        (room) => room.property.merchantId === merchant.id
      );
      const hasMerchantHomestays = booking.homestays.some(
        (homestay) => homestay.merchantId === merchant.id
      );

      if (!hasMerchantRooms && !hasMerchantHomestays) {
        return res.status(403).json({
          success: false,
          message: "You can only cancel bookings for your properties",
        });
      }
    }

    // Check if booking is already cancelled
    if (booking.bookingStatus === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Booking is already cancelled",
      });
    }

    // Check if booking can be cancelled (within 3 days before check-in)
    const checkInDate = new Date(booking.checkInDate);
    const today = new Date();
    const daysUntilCheckIn = Math.ceil(
      (checkInDate - today) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilCheckIn < 3) {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel booking within 3 days of check-in",
      });
    }

    // Determine cancellation policy and refund amount
    const cancellationPolicy = determineCancellationPolicy(booking);
    const refundAmount = calculateRefundAmount(
      booking,
      daysUntilCheckIn,
      cancellationPolicy
    );

    // Update booking status
    await booking.update({
      bookingStatus: "cancelled",
      cancellationReason,
      cancellationDate: new Date(),
      refundAmount,
      isRefundable: refundAmount > 0,
    });

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      data: {
        booking,
        refundAmount,
        cancellationPolicy,
        daysUntilCheckIn,
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

/* Update Booking Status */
exports.updateBookingStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { status } = req.body;
    const bookingId = req.params.id;

    const booking = await Booking.findByPk(bookingId, {
      include: [
        {
          model: Room,
          as: "rooms",
          through: { attributes: [] },
          attributes: ["id"],
        },
        {
          model: HomeStay,
          as: "homestays",
          through: { attributes: [] },
          attributes: ["id"],
        },
        {
          model: CustomerProfile,
          as: "customer",
          attributes: ["id", "userId"],
        },
      ],
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Check permissions
    if (req.user.accountType === "merchant") {
      const merchant = await MerchantProfile.findOne({
        where: { userId: req.user.id },
      });

      if (!merchant) {
        return res.status(403).json({
          success: false,
          message: "Merchant profile not found",
        });
      }

      // Check if booking contains merchant's properties
      const hasMerchantRooms = await BookingRoom.findOne({
        include: [
          {
            model: Room,
            as: "room",
            include: [
              {
                model: Property,
                as: "property",
                where: { merchantId: merchant.id },
              },
            ],
          },
        ],
        where: { bookingId: bookingId },
      });

      const hasMerchantHomestays = await BookingHomeStay.findOne({
        include: [
          {
            model: HomeStay,
            as: "homestay",
            where: { merchantId: merchant.id },
          },
        ],
        where: { bookingId: bookingId },
      });

      if (!hasMerchantRooms && !hasMerchantHomestays) {
        return res.status(403).json({
          success: false,
          message: "You can only update bookings for your properties",
        });
      }
    }
    // Admin can update any booking

    // Validate status transition
    const validStatuses = [
      "pending",
      "confirmed",
      "cancelled",
      "completed",
      "failed",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking status",
      });
    }

    // Update booking status
    await booking.update({
      bookingStatus: status,
      ...(status === "completed" && { completedAt: new Date() }),
    });

    // If status is completed, update room/homestay availability
    if (status === "completed") {
      // Update rooms to available
      if (booking.rooms && booking.rooms.length > 0) {
        const roomIds = booking.rooms.map((room) => room.id);
        await Room.update(
          { availabilityStatus: "available" },
          { where: { id: roomIds } }
        );
      }

      // Update homestays to available
      if (booking.homestays && booking.homestays.length > 0) {
        const homestayIds = booking.homestays.map((homestay) => homestay.id);
        await HomeStay.update(
          { availabilityStatus: "available" },
          { where: { id: homestayIds } }
        );
      }
    }

    // If status is cancelled, also update availability (in case cancellation happens after booking was confirmed)
    if (status === "cancelled") {
      // Update rooms to available
      if (booking.rooms && booking.rooms.length > 0) {
        const roomIds = booking.rooms.map((room) => room.id);
        await Room.update(
          { availabilityStatus: "available" },
          { where: { id: roomIds } }
        );
      }

      // Update homestays to available
      if (booking.homestays && booking.homestays.length > 0) {
        const homestayIds = booking.homestays.map((homestay) => homestay.id);
        await HomeStay.update(
          { availabilityStatus: "available" },
          { where: { id: homestayIds } }
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: `Booking status updated to ${status} successfully`,
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
