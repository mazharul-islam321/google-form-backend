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
              "You are an expert Google Forms Architect. Your sole job is to design complete, realistic, professional Google Forms based on user prompts.\n\nCRITICAL NAMING RULES:\n- 'name': The short document file name displayed in the top header. MUST be concise (2 to 4 words max, e.g. 'Coffee Shop Feedback', 'React Developer Application', 'Class 8 Math Quiz', 'Wedding RSVP').\n- 'title': The full, descriptive and engaging title displayed on the main form card (e.g. 'Coffee Shop Customer Satisfaction & Experience Survey', 'Senior React Developer Job Application Form', 'Mathematics Mid-Term Assessment - Grade 8').\n\nQUESTION RULES:\n- Choose the most appropriate questionType for each field ('multiplechoice', 'checkbox', 'shortanswer', 'paragraph', 'dropdown').\n- Include 4 to 8 realistic questions. For multiplechoice/checkbox/dropdown questions, always provide 3 to 6 logical options.",
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
              required: ["name", "title", "description", "items"],
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

  const finalName = (generatedData.name || "").trim() || "Untitled form";
  const finalTitle = (generatedData.title || "").trim() || "Untitled form";

  const finalPayload: ICreateFormPayload = {
    name: finalName,
    title: finalTitle,
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

const generateOptionsWithAI = async (
  questionTitle: string,
  questionType: string = "multiplechoice"
): Promise<{ options: string[] }> => {
  if (config.gemini_api_key && config.gemini_api_key.trim() !== "") {
    const ai = new GoogleGenAI({ apiKey: config.gemini_api_key.trim() });
    for (const modelName of CANDIDATE_GEMINI_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: `Provide 4 to 6 logical, distinct, realistic answer choices for this survey question: "${questionTitle}" (Type: ${questionType}).`,
          config: {
            systemInstruction:
              "You are a survey and form design specialist. Provide 4 to 6 concise, realistic choice options for the given question. Return only a JSON array of option strings.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ["options"],
            },
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          if (Array.isArray(parsed.options) && parsed.options.length > 0) {
            return { options: parsed.options.map((opt: any) => String(opt).trim()) };
          }
        }
      } catch (err: any) {
        console.warn(`generateOptionsWithAI failed with ${modelName}:`, err?.message);
      }
    }
  }

  // Fallback options based on keywords
  const q = questionTitle.toLowerCase();
  if (q.includes("experience") || q.includes("year")) {
    return { options: ["Less than 1 year", "1-2 years", "3-5 years", "5+ years"] };
  }
  if (q.includes("rate") || q.includes("satisfied") || q.includes("satisfaction") || q.includes("how was")) {
    return { options: ["Very Satisfied", "Satisfied", "Neutral", "Unsatisfied", "Very Unsatisfied"] };
  }
  if (q.includes("agree")) {
    return { options: ["Strongly Agree", "Agree", "Neutral", "Disagree", "Strongly Disagree"] };
  }
  if (q.includes("how often") || q.includes("frequency")) {
    return { options: ["Daily", "Weekly", "Monthly", "Rarely", "Never"] };
  }
  if (q.includes("gender")) {
    return { options: ["Female", "Male", "Non-binary", "Prefer not to say"] };
  }
  if (q.includes("recommend")) {
    return { options: ["Definitely", "Probably", "Not Sure", "Probably Not", "Definitely Not"] };
  }

  return {
    options: ["Option 1", "Option 2", "Option 3", "Option 4"],
  };
};

const generateQuestionWithAI = async (
  promptText: string,
  context?: string
): Promise<{ question: IFormItem }> => {
  if (config.gemini_api_key && config.gemini_api_key.trim() !== "") {
    const ai = new GoogleGenAI({ apiKey: config.gemini_api_key.trim() });
    for (const modelName of CANDIDATE_GEMINI_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: `Create 1 single well-formulated question for a Google Form based on: "${promptText}". ${context ? `Form Context: "${context}".` : ""}`,
          config: {
            systemInstruction:
              "You are a Google Forms expert. Generate 1 single well-formulated question matching the user prompt. Select the best questionType ('multiplechoice', 'checkbox', 'shortanswer', 'paragraph', 'dropdown'). For multiplechoice/checkbox/dropdown, provide 3 to 6 logical options.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                questionTitle: { type: Type.STRING },
                questionType: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                required: { type: Type.BOOLEAN },
              },
              required: ["questionTitle", "questionType"],
            },
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          const qType = normalizeQuestionType(parsed.questionType);
          const needsOptions = ["multiplechoice", "checkbox", "dropdown"].includes(qType);
          return {
            question: {
              type: "question",
              questionTitle: parsed.questionTitle || "Untitled Question",
              questionType: qType,
              options: needsOptions
                ? Array.isArray(parsed.options) && parsed.options.length > 0
                  ? parsed.options
                  : ["Option 1", "Option 2", "Option 3"]
                : [],
              required: Boolean(parsed.required),
            },
          };
        }
      } catch (err: any) {
        console.warn(`generateQuestionWithAI failed with ${modelName}:`, err?.message);
      }
    }
  }

  // Fallback single question
  return {
    question: {
      type: "question",
      questionTitle: promptText.trim() || "Untitled Question",
      questionType: "multiplechoice",
      options: ["Option 1", "Option 2", "Option 3"],
      required: false,
    },
  };
};

const editQuestionWithAI = async (
  instruction: string,
  currentQuestion: Partial<IFormItem> & { isHeader?: boolean; title?: string },
  formTitle?: string
): Promise<{ question?: IFormItem; header?: { title: string; description: string } }> => {
  const isHeader = Boolean(currentQuestion.isHeader || (currentQuestion.type as string) === "header");

  if (config.gemini_api_key && config.gemini_api_key.trim() !== "") {
    const ai = new GoogleGenAI({ apiKey: config.gemini_api_key.trim() });
    for (const modelName of CANDIDATE_GEMINI_MODELS) {
      try {
        if (isHeader) {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: `Refine/rewrite the following Google Form Title and Description based on the user's instruction.
Instruction: "${instruction}"
Current Form Title: "${currentQuestion.title || currentQuestion.questionTitle || formTitle || "Untitled form"}"
Current Form Description: "${currentQuestion.description || ""}"`,
            config: {
              systemInstruction:
                "You are an expert Google Forms Architect. Polish or rewrite the form title and description to make it professional, engaging, and clear based on the user instruction. Return JSON with 'title' and 'description'.",
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ["title", "description"],
              },
            },
          });

          if (response.text) {
            const parsed = JSON.parse(response.text);
            return {
              header: {
                title: parsed.title || "Untitled form",
                description: parsed.description || "",
              },
            };
          }
        } else {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: `Modify and refine the following Google Form question according to the user's instruction.
Instruction: "${instruction}"
Current Question Title: "${currentQuestion.questionTitle || "Untitled Question"}"
Current Question Type: "${currentQuestion.questionType || "multiplechoice"}"
Current Options: ${JSON.stringify(currentQuestion.options || [])}
${formTitle ? `Form Context: "${formTitle}"` : ""}`,
            config: {
              systemInstruction:
                "You are an expert Google Forms Architect. Your job is to edit, refine, polish, or rewrite the provided question according to the user's instructions (e.g. improving tone, changing question type, rephrasing, generating better options, or adding description guidelines). Always return a complete question object with appropriate questionType and options.",
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  questionTitle: { type: Type.STRING },
                  questionType: { type: Type.STRING },
                  description: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  required: { type: Type.BOOLEAN },
                },
                required: ["questionTitle", "questionType"],
              },
            },
          });

          if (response.text) {
            const parsed = JSON.parse(response.text);
            const qType = normalizeQuestionType(parsed.questionType || currentQuestion.questionType);
            const needsOptions = ["multiplechoice", "checkbox", "dropdown"].includes(qType);
            return {
              question: {
                type: "question",
                questionTitle: parsed.questionTitle || currentQuestion.questionTitle || "Untitled Question",
                questionType: qType,
                description: parsed.description || currentQuestion.description || "",
                options: needsOptions
                  ? Array.isArray(parsed.options) && parsed.options.length > 0
                    ? parsed.options
                    : currentQuestion.options || ["Option 1", "Option 2", "Option 3"]
                  : [],
                required: parsed.required !== undefined ? Boolean(parsed.required) : Boolean(currentQuestion.required),
              },
            };
          }
        }
      } catch (err: any) {
        console.warn(`editQuestionWithAI failed with ${modelName}:`, err?.message);
      }
    }
  }

  // Fallback
  if (isHeader) {
    return {
      header: {
        title: `${currentQuestion.title || currentQuestion.questionTitle || formTitle || "Untitled form"} (${instruction})`,
        description: currentQuestion.description || "",
      },
    };
  }

  return {
    question: {
      type: "question",
      questionTitle: `${currentQuestion.questionTitle || "Untitled Question"} (${instruction})`,
      questionType: currentQuestion.questionType || "multiplechoice",
      options: currentQuestion.options || ["Option 1", "Option 2"],
      required: Boolean(currentQuestion.required),
    },
  };
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
  generateOptionsWithAI,
  generateQuestionWithAI,
  editQuestionWithAI,
};
