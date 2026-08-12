import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db";
import authRoutes from "./routes/auth";
import formRoutes from "./routes/forms";
import responseRoutes from "./routes/responses";

// Load env vars
dotenv.config();

const app = express();

// Connect Database
connectDB();

// Init Middleware
app.use(
  cors({
    origin: "*", // Adjust as necessary for production
    credentials: true,
  })
);
app.use(express.json());

// Define Routes
app.use("/api/auth", authRoutes);
app.use("/api/forms", formRoutes);
app.use("/api/forms", responseRoutes); // Mount response routes under /api/forms for nested path resolving

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Google Form Clone backend is running" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
