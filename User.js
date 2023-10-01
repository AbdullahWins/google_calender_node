const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  accessToken: {
    type: String, // Store the access token as a string
  },
  refreshToken: {
    type: String, // Store the refresh token as a string
  },
  // Add more fields as needed
  // ...
});

const User = mongoose.model("User", userSchema);

module.exports = User;
