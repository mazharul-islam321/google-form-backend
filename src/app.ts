import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import routes from "./app/routes";
import globalErrorHandler from "./app/middlewares/globalErrorHandler";
import { httpStatus } from "./shared/http-status";

const app: Application = express();

app.use(
  cors({
    origin: "*",
    credentials: true,
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
