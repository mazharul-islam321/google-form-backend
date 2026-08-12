import { Router, Response } from "express";
import { Response as DbResponse } from "../models/Response";
import { Form } from "../models/Form";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import jwt from "jsonwebtoken";

const router = Router();

// Helper to optionally retrieve user ID from token without forcing authentication
const optionalAuth = (req: any, res: Response, next: any) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "super_secret_google_form_clone_key_123456"
      ) as { userId: string };
      req.userId = decoded.userId;
    } catch (error) {
      // Ignore token validation issues for optional auth
    }
  }
  next();
};

// @route   POST /api/forms/:formId/responses
// @desc    Submit a response to a form
router.post("/:formId/responses", optionalAuth, async (req: AuthRequest, res) => {
  const { formId } = req.params;
  const { answers } = req.body;

  try {
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ message: "Answers must be a valid array" });
    }

    const newResponse = new DbResponse({
      form: formId,
      submittedBy: req.userId || undefined,
      answers,
    });

    const savedResponse = await newResponse.save();
    return res.status(201).json(savedResponse);
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: (error as Error).message,
    });
  }
});

// @route   GET /api/forms/:formId/responses
// @desc    Get all responses for a form (requires form owner check)
router.get("/:formId/responses", authMiddleware, async (req: AuthRequest, res) => {
  const { formId } = req.params;

  try {
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }

    // Verify owner
    if (form.owner.toString() !== req.userId) {
      return res.status(403).json({
        message: "Not authorized to view responses for this form",
      });
    }

    const responses = await DbResponse.find({ form: formId }).sort({
      createdAt: -1,
    });
    return res.json(responses);
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: (error as Error).message,
    });
  }
});

export default router;
