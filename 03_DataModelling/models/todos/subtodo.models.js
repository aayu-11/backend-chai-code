import mongoose from "mongoose";

const subtodoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    todoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Todo",
    },
  },
  { timestamps: true }
);

const Subtodo = mongoose.model("Subtodo", subtodoSchema);
