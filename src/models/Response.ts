import mongoose, { Schema, Document } from "mongoose";

export interface IAnswer {
  itemIndex: number;
  value: any;
}

export interface IResponse extends Document {
  form: mongoose.Types.ObjectId;
  submittedBy?: mongoose.Types.ObjectId;
  answers: IAnswer[];
  createdAt: Date;
  updatedAt: Date;
}

const AnswerSchema = new Schema<IAnswer>({
  itemIndex: {
    type: Number,
    required: true,
  },
  value: {
    type: Schema.Types.Mixed,
    required: true,
  },
});

const ResponseSchema = new Schema<IResponse>(
  {
    form: {
      type: Schema.Types.ObjectId,
      ref: "Form",
      required: true,
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    answers: [AnswerSchema],
  },
  {
    timestamps: true,
  }
);

export const Response = mongoose.model<IResponse>("Response", ResponseSchema);
