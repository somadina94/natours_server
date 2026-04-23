import multer from "multer";
import sharp from "sharp";
import type { Request, Response, NextFunction } from "express";
import { User } from "../models/User.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";
import * as factory from "./handlerFactory.js";
import { uploadBuffer } from "../services/b2.js";
import { isB2Configured } from "../config/env.js";

const multerFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new AppError("Not an image! Please upload only images.", 400));
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: multerFilter,
});

export const uploadUserPhoto = upload.single("photo");

export const resizeUserPhoto = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) return next();
    if (!isB2Configured()) {
      return next(
        new AppError(
          "Image uploads require Backblaze B2 env vars on the server. See server/.env.",
          500,
        ),
      );
    }

    const userId = req.user?.id;
    const filename = `users/user-${userId}-${Date.now()}.jpeg`;
    const buffer = await sharp(req.file.buffer)
      .resize(500, 500)
      .toFormat("jpeg")
      .jpeg({ quality: 90 })
      .toBuffer();

    const url = await uploadBuffer({
      key: filename,
      buffer,
      contentType: "image/jpeg",
    });
    req.body.photo = url;
    next();
  },
);

const filterObj = (obj: Record<string, unknown>, ...allowed: string[]) => {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (allowed.includes(key)) out[key] = obj[key];
  }
  return out;
};

export const getAllUsers = factory.getAll(User);

export const getMe = (req: Request, _res: Response, next: NextFunction) => {
  if (req.user) req.params["id"] = req.user.id;
  next();
};

export const updateMe = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (req.body.password || req.body.passwordConfirm) {
      return next(
        new AppError(
          "This route is not for password updates. Please use /updateMyPassword.",
          400,
        ),
      );
    }

    const filtered = filterObj(req.body as Record<string, unknown>, "name", "email") as {
      name?: string;
      email?: string;
      photo?: string;
    };
    if (req.body.photo) filtered.photo = req.body.photo as string;

    const updatedUser = await User.findByIdAndUpdate(req.user?.id, filtered, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      status: "success",
      data: { user: updatedUser },
    });
  },
);

export const deleteMe = catchAsync(async (req: Request, res: Response) => {
  await User.findByIdAndUpdate(req.user?.id, { active: false });
  res.status(204).json({ status: "success", data: null });
});

export const getUser = factory.getOne(User);

export const createUser = (_req: Request, res: Response) => {
  res.status(500).json({
    status: "error",
    message: "This route is not defined! Please use /signup instead.",
  });
};

export const updateUser = factory.updateOne(User);
export const deleteUser = factory.deleteOne(User);
