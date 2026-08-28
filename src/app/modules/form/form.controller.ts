import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { httpStatus } from "../../../shared/http-status";
import { FormService } from "./form.service";
import { AuthenticatedRequest } from "../../middlewares/auth";
import ApiError from "../../../errors/ApiError";

const createForm = catchAsync(async (req: Request, res: Response) => {
	const user = (req as AuthenticatedRequest).user;
	if (!user) {
		throw new ApiError(httpStatus.UNAUTHORIZED, "Not authenticated.");
	}

	const result = await FormService.createForm(user.id, req.body);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Form created successfully.",
		data: result,
	});
});

const getUserForms = catchAsync(async (req: Request, res: Response) => {
	const user = (req as AuthenticatedRequest).user;
	if (!user) {
		throw new ApiError(httpStatus.UNAUTHORIZED, "Not authenticated.");
	}

	const result = await FormService.getUserForms(user.id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Forms retrieved successfully.",
		data: result,
	});
});

const getFormById = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params;
	const result = await FormService.getFormById(id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Form retrieved successfully.",
		data: result,
	});
});

const updateForm = catchAsync(async (req: Request, res: Response) => {
	const user = (req as AuthenticatedRequest).user;
	if (!user) {
		throw new ApiError(httpStatus.UNAUTHORIZED, "Not authenticated.");
	}

	const { id } = req.params;
	const result = await FormService.updateForm(user.id, id, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Form updated successfully.",
		data: result,
	});
});

const updateFormName = catchAsync(async (req: Request, res: Response) => {
	const user = (req as AuthenticatedRequest).user;
	if (!user) {
		throw new ApiError(httpStatus.UNAUTHORIZED, "Not authenticated.");
	}
	const { id } = req.params;
	const { name } = req.body;
	const result = await FormService.updateFormName(user.id, id, name);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Form name updated successfully.",
		data: result,
	});
});

const toggleFormStar = catchAsync(async (req: Request, res: Response) => {
	const user = (req as AuthenticatedRequest).user;
	if (!user) {
		throw new ApiError(httpStatus.UNAUTHORIZED, "Not authenticated.");
	}
	const { id } = req.params;
	const { isStarred } = req.body;
	const result = await FormService.toggleFormStar(
		user.id,
		id,
		Boolean(isStarred),
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Form star status updated successfully.",
		data: result,
	});
});

const deleteForm = catchAsync(async (req: Request, res: Response) => {
	const user = (req as AuthenticatedRequest).user;
	if (!user) {
		throw new ApiError(httpStatus.UNAUTHORIZED, "Not authenticated.");
	}

	const { id } = req.params;
	await FormService.deleteForm(user.id, id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Form deleted successfully.",
		data: null,
	});
});

const generateFormWithAI = catchAsync(async (req: Request, res: Response) => {
	const user = (req as AuthenticatedRequest).user;
	const { prompt } = req.body;

	if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
		throw new ApiError(
			httpStatus.BAD_REQUEST,
			"Prompt is required to generate a form.",
		);
	}

	const result = await FormService.generateFormWithAI(
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

		const result = await FormService.generateOptionsWithAI(
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

		const result = await FormService.generateQuestionWithAI(
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

		const result = await FormService.editQuestionWithAI(
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

export const FormController = {
	createForm,
	getUserForms,
	getFormById,
	updateForm,
	updateFormName,
	toggleFormStar,
	deleteForm,
	generateFormWithAI,
	generateOptionsWithAI,
	generateQuestionWithAI,
	editQuestionWithAI,
};
