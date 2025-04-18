const { Admin } = require("../models/admin.model");
const bcrypt = require("bcrypt");

const seedAdmin = async () => {
  try {
    const hashedPassword = await bcrypt.hash("password", 10); // Hash default password

    if (!Admin) {
      throw new Error("Admin model is not defined.");
    }

    const [admin, created] = await Admin.findOrCreate({
      where: { email: "admin@example.com" },
      defaults: {
        name: "Super Admin",
        password: hashedPassword,
        isActive: true
      }
    });

    if (created) {
      console.log("✅ Admin seeded successfully!");
    } else {
      console.log("⚠️ Admin already exists!");
    }
  } catch (error) {
    console.error("❌ Error seeding admin:", error);
  }
};

module.exports = seedAdmin;
