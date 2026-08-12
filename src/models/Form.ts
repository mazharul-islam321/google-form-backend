import mongoose, { Schema, Document } from "mongoose";

export interface IFormItem {
  type: "question" | "title";
  questionTitle?: string;
  questionType?: "multiplechoice" | "checkbox" | "paragraph" | "shortanswer" | string;
  options?: string[];
  title?: string;
  description?: string;
  required?: boolean;
}

export interface IForm extends Document {
  owner: mongoose.Types.ObjectId;
  title: string;
  description: string;
  items: IFormItem[];
  createdAt: Date;
  updatedAt: Date;
}

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
