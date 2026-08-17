import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import routes from "./app/routes";
import globalErrorHandler from "./app/middlewares/globalErrorHandler";
import { httpStatus } from "./shared/http-status";

import config from "./config";

const app: Application = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  config.client_url,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, curl)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        config.env !== "production"
      ) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes mounting
app.use("/api/v1", routes);
app.use("/api", routes); // backwards compatibility for /api

// Healthcheck route
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    message: "Google Form Backend is running",
    timestamp: new Date(),
  });
});

// Handle Not Found Routes (404)
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(httpStatus.NOT_FOUND).json({
    success: false,
    message: "API Endpoint Not Found",
    errorMessages: [
      {
        path: req.originalUrl,
        message: "API Endpoint Not Found",
      },
    ],
  });
});

// Global Error Handler (Must be placed after all routes and handlers)
app.use(globalErrorHandler);

export default app;
