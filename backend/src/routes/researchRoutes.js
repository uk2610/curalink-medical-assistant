const express = require("express");
const { queryResearchAssistant } = require("../controllers/chatController");

const router = express.Router();

router.post("/", queryResearchAssistant);

module.exports = router;
