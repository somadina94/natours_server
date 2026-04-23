import crypto from "crypto";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { User } from "../models/User.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";
import Email, { isEmailConfigured } from "../utils/email.js";
import { env, assertJwtSecret } from "../config/env.js";

const signToken = (id: string) => {
  assertJwtSecret();
  return jwt.sign({ id }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions);
};

const createSendToken = (
  user: InstanceType<typeof User>,
  statusCode: number,
  req: Request,
  res: Response,
) => {
  const token = signToken(user.id);
  const ms =
    env.jwtCookieExpiresIn * 24 * 60 * 60 * 1000;

  res.cookie("jwt", token, {
    expires: new Date(Date.now() + ms),
    httpOnly: true,
    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
    sameSite: "lax",
  });

  (user as { password?: string }).password = undefined;

  res.status(statusCode).json({
    status: "success",
    token,
    data: { user },
  });
};

export const signup = catchAsync(async (req: Request, res: Response) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
  });

  const profileUrl = `${env.frontendUrl.replace(/\/$/, "")}/account`;
  if (isEmailConfigured()) {
    try {
      await new Email(newUser, profileUrl).sendWelcome();
    } catch {
      // non-fatal
    }
  }

  createSendToken(newUser, 201, req, res);
});

export const login = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return next(new AppError("Please provide email and password", 400));
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return next(new AppError("Incorrect email or password", 401));
    }
    const loginUser = user as typeof user & {
      correctPassword(a: string, b: string): Promise<boolean>;
    };
    if (!(await loginUser.correctPassword(password, user.get("password") as string))) {
      return next(new AppError("Incorrect email or password", 401));
    }

    createSendToken(user, 200, req, res);
  },
);

export const logout = (_req: Request, res: Response) => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ status: "success" });
};

export const protect = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    let token: string | undefined;
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer")) {
      token = auth.split(" ")[1];
    } else if (req.cookies?.jwt) {
      token = req.cookies.jwt as string;
    }

    if (!token || token === "loggedout") {
      return next(
        new AppError("You are not logged in! Please log in to get access.", 401),
      );
    }

    assertJwtSecret();
    const decoded = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return next(
        new AppError("The user belonging to this token no longer exists.", 401),
      );
    }

    const cu = currentUser as typeof currentUser & {
      changedPasswordAfter(iat: number): boolean;
    };
    if (cu.changedPasswordAfter(decoded.iat ?? 0)) {
      return next(
        new AppError("User recently changed password! Please log in again.", 401),
      );
    }

    req.user = currentUser as unknown as Express.Request["user"];
    next();
  },
);

export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role || !roles.includes(role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403),
      );
    }
    next();
  };
};

export const forgotPassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return next(new AppError("There is no user with that email address", 404));
    }

    const resetToken = (
      user as typeof user & { createPasswordResetToken(): string }
    ).createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    const resetURL = `${env.frontendUrl.replace(/\/$/, "")}/reset-password/${resetToken}`;

    try {
      if (!isEmailConfigured()) {
        throw new Error("Email not configured");
      }
      await new Email(user, resetURL).sendPasswordReset();
      res.status(200).json({
        status: "success",
        message: "Token sent to email!",
      });
    } catch {
      user.set("passwordResetToken", undefined);
      user.set("passwordResetExpires", undefined);
      await user.save({ validateBeforeSave: false });
      return next(
        new AppError(
          "There was an error sending the email. Try again later!",
          500,
        ),
      );
    }
  },
);

export const resetPassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const rawToken = req.params["token"];
    const tokenStr = String(
      Array.isArray(rawToken) ? rawToken[0] ?? "" : rawToken ?? "",
    );
    const hashedToken = crypto.createHash("sha256").update(tokenStr).digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return next(new AppError("Token is invalid or has expired", 400));
    }

    user.set("password", req.body.password);
    user.set("passwordConfirm", req.body.passwordConfirm);
    user.set("passwordResetToken", undefined);
    user.set("passwordResetExpires", undefined);
    await user.save();

    createSendToken(user, 200, req, res);
  },
);

export const updatePassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = await User.findById(req.user?.id).select("+password");
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    const pwUser = user as typeof user & {
      correctPassword(a: string, b: string): Promise<boolean>;
    };
    if (
      !(await pwUser.correctPassword(
        req.body.passwordCurrent,
        user.get("password") as string,
      ))
    ) {
      return next(new AppError("Your current password is wrong.", 401));
    }

    user.set("password", req.body.password);
    user.set("passwordConfirm", req.body.passwordConfirm);
    await user.save();

    createSendToken(user, 200, req, res);
  },
);
