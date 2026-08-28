import express from "express";
import { FormController } from "./form.controller";
import { auth, optionalAuth } from "../../middlewares/auth";

const router = express.Router();

router.post("/ai-generate", optionalAuth, FormController.generateFormWithAI);
router.post("/ai-options", optionalAuth, FormController.generateOptionsWithAI);
router.post("/ai-question", optionalAuth, FormController.generateQuestionWithAI);
router.post("/ai-edit-question", optionalAuth, FormController.editQuestionWithAI);
router.post("/", auth(), FormController.createForm);
router.get("/", auth(), FormController.getUserForms);
router.get("/:id", FormController.getFormById);
router.put("/:id", auth(), FormController.updateForm);
router.patch("/:id/name", auth(), FormController.updateFormName);
router.patch("/:id/star", auth(), FormController.toggleFormStar);
router.delete("/:id", auth(), FormController.deleteForm);

export const FormRoutes = router;
