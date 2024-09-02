import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    age: {
      type: Number,
      required: true,
    },
    diagnosis: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      required: true,
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "others"],
    },
    addmissionDate: {
      type: Date,
      required: true,
    },
    dischargeDate: {
      type: Date,
    },
    medicalRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MedicalRecord",
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
    },
  },
  { timestamps: true }
);

const Patient = mongoose.model("Patient", patientSchema);
