const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password_hash: { type: String, required: true },
    role: { type: String, default: "guest" },
  },
  { timestamps: true, versionKey: false }
);

let User = mongoose.model("User", userSchema);
module.exports = User;

module.exports.registerUser = async function (model, username, password, role) {
  try {
    existingUser = await model.findOne({ username: username });
    if (existingUser) {
      throw new Error("Username already exists");
    }

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);
    const newUser = new model({ username, password_hash, role });
    await newUser.save();
  } catch (error) {
    throw error;
  }
};

module.exports.loginUser = async function (model, username, password) {
  try {
    const user = await model.findOne({ username: username });
    if (!user) {
      throw new Error("User not found");
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      throw new Error("Incorrect password");
    }

    return user;
  } catch (error) {
    throw error;
  }
};


