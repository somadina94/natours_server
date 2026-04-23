import type { Model, PopulateOptions, Query } from "mongoose";
import type { Request, Response, NextFunction } from "express";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";
import APIFeatures from "../utils/apiFeatures.js";
import { cloneAndSanitizeQuery } from "../utils/sanitizeNoSql.js";

export const deleteOne = (model: Model<unknown>) =>
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const id = String(
      Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"],
    );
    const doc = await model.findByIdAndDelete(id);
    if (!doc) {
      return next(new AppError("No document found with that ID", 404));
    }
    res.status(204).json({ status: "success", data: null });
  });

export const updateOne = (model: Model<unknown>) =>
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const id = String(
      Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"],
    );
    const doc = await model.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!doc) {
      return next(new AppError("No document found with that ID", 404));
    }
    res.status(200).json({ status: "success", data: { data: doc } });
  });

export const createOne = (model: Model<unknown>) =>
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const doc = await model.create(req.body);
    res.status(201).json({ status: "success", data: { data: doc } });
  });

export const getOne = (model: Model<unknown>, popOptions?: PopulateOptions) =>
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const id = String(
      Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"],
    );
    let query = model.findById(id);
    if (popOptions) query = query.populate(popOptions);
    const doc = await query;
    if (!doc) {
      return next(new AppError("No document found with that ID", 404));
    }
    res.status(200).json({ status: "success", data: { data: doc } });
  });

export const getAll = (model: Model<unknown>) =>
  catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
    const filter: Record<string, string> = {};
    const tourIdRaw = req.params["tourId"];
    const tourId = Array.isArray(tourIdRaw) ? tourIdRaw[0] : tourIdRaw;
    if (tourId) filter.tour = tourId;

    const queryString =
      res.locals.apiQuery ?? cloneAndSanitizeQuery(req.query);

    const features = new APIFeatures(
      model.find(filter as never) as Query<unknown[], unknown>,
      queryString,
    )
      .filter()
      .sort()
      .limitFields()
      .paginate();
    const doc = await features.query;

    res.status(200).json({
      status: "success",
      results: doc.length,
      data: { data: doc },
    });
  });
