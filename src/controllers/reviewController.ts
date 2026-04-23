import type { Request, Response, NextFunction } from "express";
import { Review } from "../models/Review.js";
import * as factory from "./handlerFactory.js";
import catchAsync from "../utils/catchAsync.js";

export const setTourUserIds = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  if (!req.body.tour) req.body.tour = req.params["tourId"];
  if (!req.body.user) req.body.user = req.user?.id;
  next();
};

export const getMyReviews = catchAsync(async (req: Request, res: Response) => {
  const uid = req.user?.id;
  const list = await Review.find({ user: uid })
    .sort("-createdAt")
    .populate({ path: "tour", select: "name slug" });
  res.status(200).json({
    status: "success",
    results: list.length,
    data: { data: list },
  });
});

export const createReview = factory.createOne(Review);
export const getReviews = factory.getAll(Review);
export const getReview = factory.getOne(Review);
export const updateReview = factory.updateOne(Review);
export const deleteReview = factory.deleteOne(Review);
