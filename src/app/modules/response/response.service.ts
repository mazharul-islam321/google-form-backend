import { Types } from "mongoose";
import ApiError from "../../../errors/ApiError";
import { httpStatus } from "../../../shared/http-status";
import { Form } from "../form/form.model";
import { IResponse, ISubmitResponsePayload } from "./response.interface";
import { FormResponse } from "./response.model";

const submitResponse = async (
  formId: string,
  userId: string | undefined,
  payload: ISubmitResponsePayload
): Promise<IResponse> => {
  const form = await Form.findById(formId);
  if (!form) {
    throw new ApiError(httpStatus.NOT_FOUND, "Form not found.");
  }

  if (!payload.answers || !Array.isArray(payload.answers)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Answers must be provided as an array."
    );
  }

  const newResponse = await FormResponse.create({
    form: new Types.ObjectId(formId),
    submittedBy: userId ? new Types.ObjectId(userId) : undefined,
    answers: payload.answers,
  });

  return newResponse;
};

const getFormResponses = async (
  formId: string,
  userId: string
): Promise<IResponse[]> => {
  const form = await Form.findById(formId);
  if (!form) {
    throw new ApiError(httpStatus.NOT_FOUND, "Form not found.");
  }

  if (form.owner.toString() !== userId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Not authorized to view responses for this form."
    );
  }

  const responses = await FormResponse.find({
    form: new Types.ObjectId(formId),
  }).sort({ createdAt: -1 });

  return responses;
};

export const ResponseService = {
  submitResponse,
  getFormResponses,
};
