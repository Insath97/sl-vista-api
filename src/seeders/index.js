const { sequelize } = require("../config/database");
const seedAdmin = require("../seeders/admin.seeder");

sequelize.sync().then(async () => {
  await seedAdmin();
  process.exit(); // Exit after seeding
});
