import { Document, Types } from "mongoose";

export interface IFormItem {
  type: "question" | "title";
  questionTitle?: string;
  questionType?:
    | "multiplechoice"
    | "checkbox"
    | "paragraph"
    | "shortanswer"
    | string;
  options?: string[];
  title?: string;
  description?: string;
  required?: boolean;
}

export interface IForm extends Document {
  owner: Types.ObjectId;
  name?: string;
  title: string;
  description: string;
  items: IFormItem[];
  isStarred?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateFormPayload {
  name?: string;
  title?: string;
  description?: string;
  items?: IFormItem[];
  isStarred?: boolean;
}

export interface IUpdateFormPayload {
  name?: string;
  title?: string;
  description?: string;
  items?: IFormItem[];
  isStarred?: boolean;
}
