import mongoose from "mongoose";

const hospitalSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    contact: {
      type: Number,
      required: true,
    },
    doctors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Doctor",
      },
    ],
    facilities: {
      type: [String],
      required: true,
    },
    specializations: [
      {
        type: String,
      },
    ],
  },
  { timestamps: true }
);

const Hospital = mongoose.model("Hospital", hospitalSchema);
