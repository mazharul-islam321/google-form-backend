import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

// @route   POST /api/auth/register
// @desc    Register a new user
router.post("/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();

    const token = jwt.sign(
      { userId: newUser._id },
      process.env.JWT_SECRET || "super_secret_google_form_clone_key_123456",
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      token,
      user: { id: newUser._id, email: newUser.email },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: (error as Error).message,
    });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user and get token
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password || "");
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || "super_secret_google_form_clone_key_123456",
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: { id: user._id, email: user.email },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: (error as Error).message,
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
router.get("/me", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.json(user);
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: (error as Error).message,
    });
  }
});

export default router;
