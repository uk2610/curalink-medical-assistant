const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const chatRoutes = require("./routes/chatRoutes");
const researchRoutes = require("./routes/researchRoutes");

const app = express();

function resolveCorsOrigin() {
  const raw = process.env.CORS_ORIGIN;
  if (!raw) {
    return "*";
  }

  const origins = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!origins.length || origins.includes("*")) {
    return "*";
  }

  return origins;
}

app.use(helmet());
app.use(cors({ origin: resolveCorsOrigin() }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "curalink-backend",
    persistence: String(process.env.DISABLE_DB || "false").toLowerCase() === "true" ? "in-memory" : "mongodb",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/research", researchRoutes);
app.use("/api/chat", chatRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || "Unexpected server error"
  });
});

module.exports = {
  app
};
