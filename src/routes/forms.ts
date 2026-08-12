import { Router } from "express";
import { Form } from "../models/Form";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

// @route   POST /api/forms
// @desc    Create a new form
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  const { title, description, items } = req.body;

  try {
    const newForm = new Form({
      owner: req.userId,
      title: title || "Untitled form",
      description: description || "",
      items: items || [],
    });

    const savedForm = await newForm.save();
    return res.status(201).json(savedForm);
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: (error as Error).message,
    });
  }
});

// @route   GET /api/forms
// @desc    Get all forms owned by current user
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const forms = await Form.find({ owner: req.userId }).sort({ updatedAt: -1 });
    return res.json(forms);
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: (error as Error).message,
    });
  }
});

// @route   GET /api/forms/:id
// @desc    Get form by ID (can be public for submission)
router.get("/:id", async (req, res) => {
  try {
    const form = await Form.findById(req.params.id);
    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }
    return res.json(form);
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: (error as Error).message,
    });
  }
});

// @route   PUT /api/forms/:id
// @desc    Update a form
router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
  const { title, description, items } = req.body;

  try {
    const form = await Form.findById(req.params.id);
    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }

    // Check ownership
    if (form.owner.toString() !== req.userId) {
      return res.status(403).json({ message: "Not authorized to update this form" });
    }

    form.title = title || form.title;
    form.description = description !== undefined ? description : form.description;
    form.items = items !== undefined ? items : form.items;

    const updatedForm = await form.save();
    return res.json(updatedForm);
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: (error as Error).message,
    });
  }
});

// @route   DELETE /api/forms/:id
// @desc    Delete a form
router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const form = await Form.findById(req.params.id);
    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }

    // Check ownership
    if (form.owner.toString() !== req.userId) {
      return res.status(403).json({ message: "Not authorized to delete this form" });
    }

    await Form.deleteOne({ _id: req.params.id });
    return res.json({ message: "Form deleted successfully" });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: (error as Error).message,
    });
  }
});

export default router;
