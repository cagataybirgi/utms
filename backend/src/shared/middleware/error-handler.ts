import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      details: err.details,
    });
    return;
  }
  if (err instanceof ZodError) {
    // Extract field names for better error messages
    const fieldErrors = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: fieldErrors || "Invalid request body",
      details: err.errors,
    });
    return;
  }
  res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: err.message,
  });
}
