require("dotenv").config();

const mongoose = require("mongoose");
const { app } = require("../src/app");

let initialized = false;

async function initializePersistence() {
  if (initialized) {
    return;
  }

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    process.env.DISABLE_DB = "true";
    initialized = true;
    return;
  }

  try {
    await mongoose.connect(mongoUri);
    process.env.DISABLE_DB = "false";
  } catch (error) {
    process.env.DISABLE_DB = "true";
    console.warn("MongoDB unavailable in serverless mode. Continuing with in-memory persistence.", error.message);
  }

  initialized = true;
}

module.exports = async (req, res) => {
  await initializePersistence();
  return app(req, res);
};
