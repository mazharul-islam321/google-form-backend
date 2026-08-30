import { GoogleGenAI, Type } from "@google/genai";
import config from "../../../config";
import { IFormItem, ICreateFormPayload } from "../form/form.interface";
import { FormService } from "../form/form.service";

const CANDIDATE_GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-2.5-flash",
];

const normalizeQuestionType = (raw: string | undefined): string => {
  if (!raw) return "multiplechoice";
  const lower = raw.toLowerCase().replace(/[-_\s]/g, "");
  if (lower.includes("multi") || lower === "mcq" || lower === "radio" || lower.includes("drop") || lower.includes("select")) return "multiplechoice";
  if (lower.includes("check") || lower.includes("box")) return "checkbox";
  if (lower.includes("para") || lower.includes("long") || lower.includes("area")) return "paragraph";
  if (lower.includes("short") || lower.includes("text") || lower.includes("input")) return "shortanswer";
  return "multiplechoice";
};

const generateFallbackForm = (promptText: string): ICreateFormPayload => {
  const p = promptText.toLowerCase();

  if (p.includes("quiz") || p.includes("exam") || p.includes("test")) {
    return {
      name: "Knowledge Assessment Quiz",
      title: "Knowledge Assessment & Quiz",
      description: "Please answer all the questions below to test your knowledge.",
      headerImage: "",
      items: [
        {
          type: "question",
          questionTitle: "What is the primary topic covered in this assessment?",
          questionType: "multiplechoice",
          options: ["Core Fundamentals", "Advanced Concepts", "Practical Application", "All of the Above"],
          required: true,
        },
        {
          type: "question",
          questionTitle: "Select all concepts that apply:",
          questionType: "checkbox",
          options: ["Theoretical Principles", "Practical Techniques", "Case Studies", "Historical Context"],
          required: false,
        },
        {
          type: "question",
          questionTitle: "Please explain a key concept in your own words:",
          questionType: "paragraph",
          options: [],
          required: true,
        },
      ],
    };
  }

  return {
    name: promptText.slice(0, 30) || "Feedback Survey",
    title: promptText || "Feedback Survey Form",
    description: "Thank you for taking the time to complete this form. Your feedback is very valuable to us.",
    headerImage: "",
    items: [
      {
        type: "question",
        questionTitle: "How would you rate your overall experience?",
        questionType: "multiplechoice",
        options: ["Excellent", "Very Good", "Good", "Fair", "Poor"],
        required: true,
      },
      {
        type: "question",
        questionTitle: "What did you like most?",
        questionType: "checkbox",
        options: ["Ease of Use", "Speed & Performance", "Design & Aesthetics", "Customer Support", "Value for Money"],
        required: false,
      },
      {
        type: "question",
        questionTitle: "What areas do you think need improvement?",
        questionType: "paragraph",
        options: [],
        required: false,
      },
      {
        type: "question",
        questionTitle: "How likely are you to recommend this to a friend or colleague?",
        questionType: "multiplechoice",
        options: ["Extremely Likely", "Very Likely", "Somewhat Likely", "Not Likely"],
        required: true,
      },
      {
        type: "question",
        questionTitle: "Any additional comments or suggestions?",
        questionType: "paragraph",
        options: [],
        required: false,
      },
    ],
  };
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
              "You are an expert Google Forms Architect. Your sole job is to design complete, realistic, professional Google Forms based on user prompts.\n\nCRITICAL LANGUAGE RULE:\n- ALWAYS detect the language and script of the user's prompt (e.g. Bengali / বাংলা, Spanish, French, Arabic, Hindi, English, etc.) and generate ALL form names, titles, descriptions, question titles, and options in that EXACT SAME language and script as the prompt. If the prompt is written in Bengali, the entire form MUST be in Bengali.\n\nCRITICAL NAMING RULES:\n- 'name': The short document file name displayed in the top header in the prompt's language. MUST be concise (2 to 4 words max, e.g. 'সাধারণ জ্ঞান কুইজ', 'Coffee Shop Feedback', 'Class 8 Math Quiz').\n- 'title': The full, descriptive and engaging title displayed on the main form card in the prompt's language.\n\nQUESTION RULES:\n- Choose the most appropriate questionType for each field ('multiplechoice', 'checkbox', 'shortanswer', 'paragraph').\n- Include 4 to 8 realistic questions. For multiplechoice/checkbox questions, always provide 3 to 6 logical options in the prompt's language.",
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
          const cleanText = textResponse.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
          generatedData = JSON.parse(cleanText);
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

  // Return structured form payload draft for preview & confirmation
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
              "You are a survey and form design specialist. Provide 4 to 6 concise, realistic choice options in the EXACT SAME language and script as the provided question (e.g. if question is in Bengali / বাংলা, return options in Bengali). Return only a JSON array of option strings.",
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
): Promise<{ questions: IFormItem[] }> => {
  const cleanPrompt = promptText.trim();
  const effectiveContext = context && context.trim() !== "Untitled form" ? context.trim() : "";

  if (config.gemini_api_key && config.gemini_api_key.trim() !== "") {
    const ai = new GoogleGenAI({ apiKey: config.gemini_api_key.trim() });
    for (const modelName of CANDIDATE_GEMINI_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: `Create Google Form questions for: "${cleanPrompt}". ${effectiveContext ? `Form Context / Topic: "${effectiveContext}".` : "Context: General project / survey topic"}`,
          config: {
            systemInstruction:
              "You are an expert Google Forms Architect.\n\nCRITICAL QUESTION COUNT RULES:\n- If the user prompt requests a specific number of questions (e.g. '1 question', '2 questions', '3 questions', '5 questions'), generate EXACTLY that number of questions.\n- If NO number of questions is specified in the prompt, generate 2 to 4 diverse, high-quality questions covering different aspects of the topic.\n- Only generate 1 single question if the prompt explicitly asks for 1 question.\n\nCRITICAL LANGUAGE RULE:\n- ALWAYS detect and match the language and script of the user's prompt (e.g. Bengali / বাংলা). If the prompt is in Bengali, generate questions and all options in Bengali.\n\nQUESTION RULES:\n- Never output placeholder names like 'Option 1, Option 2, Option 3'. Always create realistic, relevant options matching the question.\n- Select the best questionType ('multiplechoice', 'checkbox', 'shortanswer', 'paragraph') for each question.\n- For multiplechoice and checkbox, provide 3 to 5 realistic, logical options.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                questions: {
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
              required: ["questions"],
            },
          },
        });

        if (response.text) {
          const cleanText = response.text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleanText);
          const rawQuestions = Array.isArray(parsed.questions)
            ? parsed.questions
            : parsed.question
            ? [parsed.question]
            : [];

          if (rawQuestions.length > 0) {
            const sanitizedQuestions: IFormItem[] = rawQuestions.map((q: any) => {
              const qType = normalizeQuestionType(q.questionType);
              const needsOptions = ["multiplechoice", "checkbox"].includes(qType);
              return {
                type: "question",
                questionTitle: q.questionTitle || "Untitled Question",
                questionType: qType,
                options: needsOptions
                  ? Array.isArray(q.options) && q.options.length > 0
                    ? q.options
                    : ["Yes", "No", "Maybe"]
                  : [],
                required: Boolean(q.required),
              };
            });

            return { questions: sanitizedQuestions };
          }
        }
      } catch (err: any) {
        console.warn(`generateQuestionWithAI failed with ${modelName}:`, err?.message);
      }
    }
  }

  // Smart fallback matching question count if AI is offline
  const matchNum = cleanPrompt.match(/(\d+)\s*(?:question|item)/i);
  const count = matchNum ? Math.min(Math.max(parseInt(matchNum[1], 10), 1), 5) : 2;
  const fallbackList: IFormItem[] = [];

  for (let i = 1; i <= count; i++) {
    fallbackList.push({
      type: "question",
      questionTitle: count === 1 ? cleanPrompt || "Untitled Question" : `Question ${i}: ${cleanPrompt}`,
      questionType: "multiplechoice",
      options: ["Strongly Agree", "Agree", "Neutral", "Disagree"],
      required: false,
    });
  }

  return { questions: fallbackList };
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
                "You are an expert Google Forms Architect. Polish or rewrite the form title and description to make it professional, engaging, and clear based on the user instruction. CRITICAL: Preserve and use the same language and script (e.g. Bengali / বাংলা if the instruction or current text is in Bengali). Return JSON with 'title' and 'description'.",
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
            const cleanText = response.text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
            const parsed = JSON.parse(cleanText);
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
            const cleanText = response.text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
            const parsed = JSON.parse(cleanText);
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
                    : currentQuestion.options || ["Option 1", "Option 2"]
                  : [],
                required: Boolean(parsed.required ?? currentQuestion.required),
              },
            };
          }
        }
      } catch (err: any) {
        console.warn(`editQuestionWithAI failed with ${modelName}:`, err?.message);
      }
    }
  }

  // Fallback if AI fails
  if (isHeader) {
    return {
      header: {
        title: currentQuestion.title || currentQuestion.questionTitle || formTitle || "Untitled form",
        description: currentQuestion.description || "",
      },
    };
  }

  return {
    question: {
      type: "question",
      questionTitle: currentQuestion.questionTitle || "Untitled Question",
      questionType: currentQuestion.questionType || "multiplechoice",
      description: currentQuestion.description || "",
      options: currentQuestion.options || ["Option 1", "Option 2"],
      required: Boolean(currentQuestion.required),
    },
  };
};

const generateImageWithAI = async (
  promptText: string,
  aspectRatio: string = "16:9",
  style?: string
): Promise<{ imageUrl: string }> => {
  const cleanPrompt = promptText.trim();
  const styleInstruction = style ? `, in ${style} aesthetic style` : "";
  const enhancedPrompt = `${cleanPrompt}${styleInstruction}, clean high resolution, professional quality for Google Form`;

  const width = aspectRatio === "16:9" ? 1200 : aspectRatio === "4:3" ? 800 : 800;
  const height = aspectRatio === "16:9" ? 675 : aspectRatio === "4:3" ? 600 : 800;
  const seed = Math.floor(Math.random() * 999999);
  const encodedPrompt = encodeURIComponent(enhancedPrompt);
  const generatorUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(generatorUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (response.ok) {
      const buffer = await response.arrayBuffer();
      if (buffer && buffer.byteLength > 0) {
        const base64 = Buffer.from(buffer).toString("base64");
        const mimeType = response.headers.get("content-type") || "image/jpeg";
        return { imageUrl: `data:${mimeType};base64,${base64}` };
      }
    }
  } catch (err: any) {
    console.warn("Direct image buffer download fallback:", err?.message);
  }

  // Fallback to direct URL if buffer conversion timed out
  return { imageUrl: generatorUrl };
};

export const AiService = {
  generateFormWithAI,
  generateOptionsWithAI,
  generateQuestionWithAI,
  editQuestionWithAI,
  generateImageWithAI,
};
