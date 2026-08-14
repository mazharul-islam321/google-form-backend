import express from "express";
import { ResponseController } from "./response.controller";
import { auth, optionalAuth } from "../../middlewares/auth";

const router = express.Router({ mergeParams: true });

router.post("/:formId/responses", optionalAuth, ResponseController.submitResponse);
router.get("/:formId/responses", auth(), ResponseController.getFormResponses);

export const ResponseRoutes = router;
