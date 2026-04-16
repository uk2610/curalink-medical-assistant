const express = require("express");
const { queryResearchAssistant } = require("../controllers/chatController");

const router = express.Router();

router.post("/query", queryResearchAssistant);

module.exports = router;
