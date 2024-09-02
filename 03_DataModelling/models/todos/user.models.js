import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      min: [6, "Password must be at least 6 characters long"],
      max: 20,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
