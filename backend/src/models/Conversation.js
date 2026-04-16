const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    structuredInput: {
      patientName: String,
      disease: String,
      intent: String,
      location: String
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const ConversationSchema = new mongoose.Schema(
  {
    patientName: String,
    diseaseContext: String,
    locationContext: String,
    intentContext: String,
    messages: {
      type: [MessageSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Conversation", ConversationSchema);
