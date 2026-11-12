const mongoose = require("mongoose");

const LeaveRequestSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["casual", "medical"],
    required: true
  },
  days: {
    type: Number,
    required: true,
    min: 1
  },
  reason: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ["pending", "approved", "disapproved"],
    default: "pending"
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: Date,
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin"
  },
  reviewNote: {
    type: String,
    trim: true,
    default: ""
  }
});

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    unique: true
  },
  passwordHash: {
    type: String,
    required: true,
    select: false
  },
  passwordSalt: {
    type: String,
    required: true,
    select: false
  },
  rollNumber: {
    type: String,
    required: true
  },
  department: {
    type: String,
    default: "General"
  },
  casualLeave: {
    type: Number,
    default: 10
  },
  medicalLeave: {
    type: Number,
    default: 10
  },
  leaveRequests: {
    type: [LeaveRequestSchema],
    default: []
  }
});

module.exports = mongoose.model("User", UserSchema);