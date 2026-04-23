import type { Types } from "mongoose";

export type AuthRole = "user" | "guide" | "lead-guide" | "admin";

/** Minimal user shape attached by `protect` middleware */
export interface RequestUser {
  _id: Types.ObjectId;
  id: string;
  name: string;
  email: string;
  role: AuthRole;
  photo?: string;
  password?: string;
  passwordChangedAt?: Date | null;
  passwordResetToken?: string | undefined;
  passwordResetExpires?: Date | undefined;
  correctPassword(
    candidatePassword: string,
    userPassword: string,
  ): Promise<boolean>;
  changedPasswordAfter(JWTTimestamp: number): boolean;
  createPasswordResetToken(): string;
  save(options?: { validateBeforeSave?: boolean }): Promise<unknown>;
}

declare global {
  namespace Express {
    interface Request {
      requestTime?: string;
      user?: RequestUser;
    }
    interface Locals {
      /** Set by `aliasTopTours` so `getAll` can read a mutable, sanitized query. */
      apiQuery?: Record<string, string | undefined>;
    }
  }
}

export {};
