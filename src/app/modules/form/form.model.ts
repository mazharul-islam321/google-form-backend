import mongoose, { Schema } from "mongoose";
import { IForm, IFormItem } from "./form.interface";

const FormItemSchema = new Schema<IFormItem>({
  type: {
    type: String,
    enum: ["question", "title"],
    required: true,
  },
  questionTitle: { type: String },
  questionType: { type: String },
  options: [{ type: String }],
  title: { type: String },
  description: { type: String },
  required: { type: Boolean, default: false },
});

const FormSchema = new Schema<IForm>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      default: "",
    },
    title: {
      type: String,
      required: true,
      default: "Untitled form",
    },
    description: {
      type: String,
      default: "",
    },
    items: [FormItemSchema],
  },
  {
    timestamps: true,
  }
);

export const Form = mongoose.model<IForm>("Form", FormSchema);
