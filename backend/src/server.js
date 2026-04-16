require("dotenv").config();

const mongoose = require("mongoose");
const { app } = require("./app");

const PORT = Number(process.env.PORT || 5000);
const MONGO_URI = process.env.MONGO_URI;
const DEMO_MODE = String(process.env.DEMO_MODE || "false").trim().toLowerCase() === "true";

async function connectDatabase() {
  if (!MONGO_URI) {
    process.env.DISABLE_DB = "true";
    console.warn("MONGO_URI not configured. Running without conversation persistence.");
    return false;
  }

  try {
    await mongoose.connect(MONGO_URI);
    process.env.DISABLE_DB = "false";
    return true;
  } catch (error) {
    process.env.DISABLE_DB = "true";
    console.warn("MongoDB connection failed. Running without persistence.", error.message);
    return false;
  }
}

async function start() {
  const dbConnected = await connectDatabase();

  app.listen(PORT, () => {
    console.log(`Curalink backend listening on port ${PORT}`);
    console.log(`Curalink demo mode: ${DEMO_MODE ? "enabled" : "disabled"}`);
    console.log(`Curalink persistence: ${dbConnected ? "mongodb" : "in-memory"}`);
  });
}

start().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
