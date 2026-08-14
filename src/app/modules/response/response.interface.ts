import { Document, Types } from "mongoose";

export interface IAnswer {
  itemIndex: number;
  value: any;
}

export interface IResponse extends Document {
  form: Types.ObjectId;
  submittedBy?: Types.ObjectId;
  answers: IAnswer[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubmitResponsePayload {
  answers: IAnswer[];
}
