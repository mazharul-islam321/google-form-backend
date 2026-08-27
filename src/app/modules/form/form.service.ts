import { Types } from "mongoose";
import { GoogleGenAI, Type } from "@google/genai";
import ApiError from "../../../errors/ApiError";
import { httpStatus } from "../../../shared/http-status";
import config from "../../../config";
import { ICreateFormPayload, IForm, IUpdateFormPayload, IFormItem } from "./form.interface";
import { Form } from "./form.model";
import { generateFallbackForm, normalizeQuestionType } from "./form.ai.fallback";

const CANDIDATE_GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-3.6-flash",
  "gemini-2.0-flash",
];

const createForm = async (
  userId: string,
  payload: ICreateFormPayload
): Promise<IForm> => {
  const newForm = await Form.create({
    owner: new Types.ObjectId(userId),
    name: payload.name || "Untitled form",
    title: payload.title || "Untitled form",
    description: payload.description || "",
    headerImage: payload.headerImage || "",
    items: payload.items || [],
    settings: payload.settings || {},
    isStarred: payload.isStarred || false,
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

const updateFormName = async (
  userId: string,
  formId: string,
  name: string
): Promise<IForm | null> => {
  const form = await Form.findById(formId);
  if (!form) {
    throw new ApiError(httpStatus.NOT_FOUND, "Form not found.");
  }
  if (form.owner.toString() !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, "Not authorized to update this form.");
  }
  form.name = name;
  return form.save();
};

const toggleFormStar = async (
  userId: string,
  formId: string,
  isStarred: boolean
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
  form.isStarred = isStarred;
  return form.save();
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

  if (payload.name !== undefined) form.name = payload.name;
  if (payload.title !== undefined) form.title = payload.title;
  if (payload.description !== undefined) form.description = payload.description;
  if (payload.headerImage !== undefined) form.headerImage = payload.headerImage;
  if (payload.items !== undefined) form.items = payload.items;
  if (payload.settings !== undefined) {
    form.settings = { ...form.settings, ...payload.settings };
  }
  if (payload.isStarred !== undefined) form.isStarred = payload.isStarred;

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

const generateFormWithAI = async (
  promptText: string,
  userId?: string
): Promise<any> => {
  let generatedData: ICreateFormPayload | null = null;

  if (config.gemini_api_key && config.gemini_api_key.trim() !== "") {
    const ai = new GoogleGenAI({ apiKey: config.gemini_api_key.trim() });

    for (const modelName of CANDIDATE_GEMINI_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: `Create a complete Google Form for: "${promptText}". Provide relevant, high quality questions with clear options.`,
          config: {
            systemInstruction:
              "You are an expert Google Forms Architect. Your sole job is to design complete, realistic, professional Google Forms based on user prompts. Choose the most appropriate questionType for each field ('multiplechoice', 'checkbox', 'shortanswer', 'paragraph', 'dropdown'). Include 4 to 8 realistic questions. For multiplechoice/checkbox/dropdown questions, always provide 3 to 6 logical options.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING },
                      questionTitle: { type: Type.STRING },
                      questionType: { type: Type.STRING },
                      options: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      required: { type: Type.BOOLEAN },
                    },
                    required: ["type", "questionTitle", "questionType"],
                  },
                },
              },
              required: ["title", "description", "items"],
            },
          },
        });

        const textResponse = response.text;
        if (textResponse) {
          generatedData = JSON.parse(textResponse);
          if (generatedData && Array.isArray(generatedData.items) && generatedData.items.length > 0) {
            break;
          }
        }
      } catch (err: any) {
        console.warn(`Attempt with ${modelName} failed (${err?.message}), trying next model...`);
      }
    }
  }

  if (!generatedData) {
    generatedData = generateFallbackForm(promptText);
  }

  // Sanitize items
  const sanitizedItems: IFormItem[] = (generatedData.items || []).map((item) => {
    const qType = normalizeQuestionType(item.questionType);
    const needsOptions = ["multiplechoice", "checkbox", "dropdown"].includes(qType);
    return {
      type: "question",
      questionTitle: item.questionTitle || "Untitled Question",
      questionType: qType,
      options: needsOptions
        ? Array.isArray(item.options) && item.options.length > 0
          ? item.options
          : ["Option 1", "Option 2", "Option 3"]
        : [],
      required: Boolean(item.required),
    };
  });

  const finalPayload: ICreateFormPayload = {
    name: generatedData.name || generatedData.title || "AI Generated Form",
    title: generatedData.title || "AI Generated Form",
    description: generatedData.description || "",
    headerImage: generatedData.headerImage || "",
    items: sanitizedItems.length > 0 ? sanitizedItems : [
      { type: "question", questionTitle: "Untitled Question", questionType: "multiplechoice", options: ["Option 1"] }
    ],
  };

  // If user is authenticated, save directly to MongoDB and return created document
  if (userId) {
    const saved = await createForm(userId, finalPayload);
    return saved;
  }

  // Otherwise return structured draft payload for guest
  return finalPayload;
};

export const FormService = {
  createForm,
  getUserForms,
  getFormById,
  updateFormName,
  toggleFormStar,
  updateForm,
  deleteForm,
  generateFormWithAI,
};
