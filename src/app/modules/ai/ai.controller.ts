import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { httpStatus } from "../../../shared/http-status";
import { AiService } from "./ai.service";
import { AuthenticatedRequest } from "../../middlewares/auth";
import ApiError from "../../../errors/ApiError";

const generateFormWithAI = catchAsync(async (req: Request, res: Response) => {
	const user = (req as AuthenticatedRequest).user;
	const { prompt } = req.body;

	if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
		throw new ApiError(
			httpStatus.BAD_REQUEST,
			"Prompt is required to generate a form.",
		);
	}

	const result = await AiService.generateFormWithAI(
		prompt.trim(),
		user?.id,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Form generated successfully with AI.",
		data: result,
	});
});

const generateOptionsWithAI = catchAsync(
	async (req: Request, res: Response) => {
		const { questionTitle, questionType } = req.body;

		if (!questionTitle || typeof questionTitle !== "string") {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"Question title is required to generate options.",
			);
		}

		const result = await AiService.generateOptionsWithAI(
			questionTitle.trim(),
			questionType,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Options generated successfully with AI.",
			data: result,
		});
	},
);

const generateQuestionWithAI = catchAsync(
	async (req: Request, res: Response) => {
		const { prompt, context } = req.body;

		if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"Prompt is required to generate a question.",
			);
		}

		const result = await AiService.generateQuestionWithAI(
			prompt.trim(),
			context,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Question generated successfully with AI.",
			data: result,
		});
	},
);

const editQuestionWithAI = catchAsync(
	async (req: Request, res: Response) => {
		const { instruction, currentQuestion, formTitle } = req.body;

		if (!instruction || typeof instruction !== "string" || instruction.trim().length === 0) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"Instruction is required to edit the question.",
			);
		}

		const result = await AiService.editQuestionWithAI(
			instruction.trim(),
			currentQuestion || {},
			formTitle,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Question updated successfully with AI.",
			data: result,
		});
	},
);

export const AiController = {
	generateFormWithAI,
	generateOptionsWithAI,
	generateQuestionWithAI,
	editQuestionWithAI,
};
