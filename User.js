const mongoose = require("mongoose"); // Import Mongoose
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
  // Add more fields as needed
  // ...
});

const User = mongoose.model("User", userSchema);

module.exports = User;
