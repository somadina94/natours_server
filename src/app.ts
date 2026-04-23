import express from "express";
import helmet from "helmet";
import ExpressMongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import cors from "cors";
import rateLimit from "express-rate-limit";

import { env } from "./config/env.js";
import globalErrorHandler from "./controllers/errorController.js";
import AppError from "./utils/appError.js";
import { stripeWebhook } from "./controllers/bookingController.js";

import tourRouter from "./routes/tourRoutes.js";
import userRouter from "./routes/userRoutes.js";
import reviewRouter from "./routes/reviewRoutes.js";
import bookingRouter from "./routes/bookingRoutes.js";

import type { Request, Response, NextFunction } from "express";

const app = express();

app.set("trust proxy", 1);

app.post(
  "/api/v1/bookings/stripe-webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook,
);

if (env.nodeEnv === "development") {
  app.use(morgan("dev"));
}

app.use(helmet());
const corsOptions = { origin: true, credentials: true } as const;
app.use(cors(corsOptions));

const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: "Too many requests from this IP, please try again in an hour!",
});
app.use("/api", limiter);

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());
// Express 5: `req.query` is getter-only — do not use `express-mongo-sanitize()` middleware
// (it assigns `req.query`). Query cloning + sanitization happens in `handlerFactory.getAll`.
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    ExpressMongoSanitize.sanitize(req.body as Record<string, unknown>);
  }
  if (req.params && typeof req.params === "object") {
    ExpressMongoSanitize.sanitize(req.params as Record<string, unknown>);
  }
  next();
});
app.use(
  hpp({
    whitelist: [
      "duration",
      "ratingsAverage",
      "ratingsQuantity",
      "maxGroupSize",
      "difficulty",
      "price",
    ],
  }),
);
app.use(compression());

app.use((req: Request, _res: Response, next: NextFunction) => {
  req.requestTime = new Date().toISOString();
  next();
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/v1/tours", tourRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/reviews", reviewRouter);
app.use("/api/v1/bookings", bookingRouter);

app.use((req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

export default app;
