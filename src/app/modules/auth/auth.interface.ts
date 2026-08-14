import { Document } from "mongoose";

export interface IUser extends Document {
  email: string;
  password?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISignupUser {
  email: string;
  password: string;
}

export interface ILoginUser {
  email: string;
  password: string;
}

export interface ILoginResponse {
  user: {
    id: string;
    email: string;
  };
  token: string;
}
