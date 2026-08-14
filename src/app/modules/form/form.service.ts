import { Types } from "mongoose";
import ApiError from "../../../errors/ApiError";
import { httpStatus } from "../../../shared/http-status";
import { ICreateFormPayload, IForm, IUpdateFormPayload } from "./form.interface";
import { Form } from "./form.model";

const createForm = async (
  userId: string,
  payload: ICreateFormPayload
): Promise<IForm> => {
  const newForm = await Form.create({
    owner: new Types.ObjectId(userId),
    title: payload.title || "Untitled form",
    description: payload.description || "",
    items: payload.items || [],
  });

  return newForm;
};

const getUserForms = async (userId: string): Promise<IForm[]> => {
  const forms = await Form.find({ owner: new Types.ObjectId(userId) }).sort({
    updatedAt: -1,
  });
  return forms;
};

const getFormById = async (formId: string): Promise<IForm | null> => {
  const form = await Form.findById(formId);
  if (!form) {
    throw new ApiError(httpStatus.NOT_FOUND, "Form not found.");
  }
  return form;
};

const updateForm = async (
  userId: string,
  formId: string,
  payload: IUpdateFormPayload
): Promise<IForm | null> => {
  const form = await Form.findById(formId);
  if (!form) {
    throw new ApiError(httpStatus.NOT_FOUND, "Form not found.");
  }

  if (form.owner.toString() !== userId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Not authorized to update this form."
    );
  }

  if (payload.title !== undefined) form.title = payload.title;
  if (payload.description !== undefined) form.description = payload.description;
  if (payload.items !== undefined) form.items = payload.items;

  const updatedForm = await form.save();
  return updatedForm;
};

const deleteForm = async (userId: string, formId: string): Promise<void> => {
  const form = await Form.findById(formId);
  if (!form) {
    throw new ApiError(httpStatus.NOT_FOUND, "Form not found.");
  }

  if (form.owner.toString() !== userId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Not authorized to delete this form."
    );
  }

  await Form.deleteOne({ _id: formId });
};

export const FormService = {
  createForm,
  getUserForms,
  getFormById,
  updateForm,
  deleteForm,
};
