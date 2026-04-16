require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");

const chatRoutes = require("./routes/chatRoutes");
const researchRoutes = require("./routes/researchRoutes");

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") || "*" }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "curalink-backend", timestamp: new Date().toISOString() });
});

app.use("/api/research", researchRoutes);
app.use("/api/chat", chatRoutes);

app.use((err, _req, res, _next) => {
  // Unified error response for client-friendly handling.
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || "Unexpected server error"
  });
});

const PORT = Number(process.env.PORT || 5000);
const MONGO_URI = process.env.MONGO_URI;
const DEMO_MODE = String(process.env.DEMO_MODE || "false").toLowerCase() === "true";

async function start() {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is required in .env");
  }

  await mongoose.connect(MONGO_URI);
  app.listen(PORT, () => {
    console.log(`Curalink backend listening on port ${PORT}`);
    console.log(`Curalink demo mode: ${DEMO_MODE ? "enabled" : "disabled"}`);
  });
}

start().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
