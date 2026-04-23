import { randomUUID } from "node:crypto";
import multer from "multer";
import sharp from "sharp";
import type { Request, Response, NextFunction } from "express";
import { Tour } from "../models/Tour.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";
import * as factory from "./handlerFactory.js";
import { cloneAndSanitizeQuery } from "../utils/sanitizeNoSql.js";
import { uploadManyBuffers } from "../services/b2.js";
import { isB2Configured } from "../config/env.js";

const multerStorage = multer.memoryStorage();

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
  storage: multerStorage,
  fileFilter: multerFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 24 },
});

export const uploadTourImages = upload.fields([
  { name: "imageCover", maxCount: 1 },
  { name: "images", maxCount: 12 },
]);

/** Run multer only for multipart bodies so JSON create/update still work. */
export const maybeUploadTourImages = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const ct = String(req.headers["content-type"] ?? "").toLowerCase();
  if (!ct.includes("multipart/form-data")) {
    return next();
  }
  return uploadTourImages(req, res, next);
};

/**
 * Multipart text parts are always strings. The dashboard stringifies arrays/objects
 * in FormData (`appendTourJsonToFormData`), so restore real arrays before Mongoose.
 */
export const parseMultipartTourBody = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const ct = String(req.headers["content-type"] ?? "").toLowerCase();
  if (!ct.includes("multipart/form-data")) {
    next();
    return;
  }
  const body = req.body as Record<string, unknown>;
  const jsonKeys = [
    "startDates",
    "images",
    "locations",
    "guides",
    "startLocation",
  ] as const;
  for (const key of jsonKeys) {
    const raw = body[key];
    if (typeof raw !== "string") continue;
    const s = raw.trim();
    const looksJson =
      (s.startsWith("[") && s.endsWith("]")) ||
      (s.startsWith("{") && s.endsWith("}"));
    if (!looksJson) continue;
    try {
      body[key] = JSON.parse(s) as unknown;
    } catch {
      /* leave string; validators / cast errors surface if invalid */
    }
  }
  next();
};

function tourKeyForUploads(req: Request): string {
  const idRaw = req.params["id"];
  const id = Array.isArray(idRaw) ? idRaw[0] : idRaw;
  if (id && typeof id === "string") return id;
  return `new-${Date.now()}`;
}

function parseImagesKeep(body: Record<string, unknown>): string[] {
  const raw = body["imagesKeep"];
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return p.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export const resizeTourImages = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const files = req.files as
      | {
          imageCover?: Express.Multer.File[];
          images?: Express.Multer.File[];
        }
      | undefined;

    const coverFile = files?.imageCover?.[0];
    const galleryFiles = files?.images ?? [];
    const hasCover = Boolean(coverFile);
    const hasGallery = galleryFiles.length > 0;
    const body = req.body as Record<string, unknown>;

    if (!hasCover && !hasGallery) {
      const keepOnly = parseImagesKeep(body);
      if (keepOnly.length) {
        body["images"] = keepOnly;
      }
      delete body["imagesKeep"];
      return next();
    }

    if (!isB2Configured()) {
      return next(
        new AppError(
          "Image uploads require Backblaze B2: set B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_ID, and B2_PUBLIC_BASE_URL in server/.env, then restart the API.",
          500,
        ),
      );
    }

    const tourKey = tourKeyForUploads(req);

    type Prepared = { key: string; buffer: Buffer; contentType: string };
    const prepared: Prepared[] = [];

    if (hasCover && coverFile) {
      const coverName = `tours/tour-${tourKey}-${randomUUID()}-cover.jpeg`;
      const coverBuf = await sharp(coverFile.buffer)
        .resize(2000, 1333)
        .toFormat("jpeg")
        .jpeg({ quality: 90 })
        .toBuffer();
      prepared.push({
        key: coverName,
        buffer: coverBuf,
        contentType: "image/jpeg",
      });
    }

    if (hasGallery) {
      for (const file of galleryFiles) {
        const name = `tours/tour-${tourKey}-${randomUUID()}.jpeg`;
        const buf = await sharp(file.buffer)
          .resize(2000, 1333)
          .toFormat("jpeg")
          .jpeg({ quality: 90 })
          .toBuffer();
        prepared.push({ key: name, buffer: buf, contentType: "image/jpeg" });
      }
    }

    const urls = await uploadManyBuffers(prepared);
    let u = 0;
    if (hasCover && coverFile) {
      body["imageCover"] = urls[u] ?? "";
      u += 1;
    }
    if (hasGallery) {
      const keep = parseImagesKeep(body);
      const uploadedKeys = urls.slice(u);
      body["images"] = [...keep, ...uploadedKeys];
    } else {
      const keep = parseImagesKeep(body);
      if (keep.length) {
        body["images"] = keep;
      }
    }

    delete body["imagesKeep"];
    next();
  },
);

export const aliasTopTours = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const base = cloneAndSanitizeQuery(req.query);
  res.locals.apiQuery = {
    ...base,
    limit: "5",
    sort: "-ratingsAverage,price",
    fields: "name,price,ratingsAverage,summary,difficulty",
  };
  next();
};

export const getAllTours = factory.getAll(Tour);
export const getTour = factory.getOne(Tour, { path: "reviews" });
export const createTour = factory.createOne(Tour);
export const updateTour = factory.updateOne(Tour);
export const deleteTour = factory.deleteOne(Tour);

export const getTourStats = catchAsync(
  async (_req: Request, res: Response) => {
    const stats = await Tour.aggregate([
      { $match: { ratingsAverage: { $gte: 4.5 } } },
      {
        $group: {
          _id: { $toUpper: "$difficulty" },
          numTours: { $sum: 1 },
          numRatings: { $sum: "$ratingsQuantity" },
          avgRating: { $avg: "$ratingsAverage" },
          avgPrice: { $avg: "$price" },
          minPrice: { $min: "$price" },
          maxPrice: { $max: "$price" },
        },
      },
      { $sort: { avgPrice: 1 } },
    ]);

    res.status(200).json({ status: "success", data: { stats } });
  },
);

export const getMonthlyPlan = catchAsync(
  async (req: Request, res: Response) => {
    const year = Number(req.params["year"]);
    const plan = await Tour.aggregate([
      { $unwind: "$startDates" },
      {
        $match: {
          startDates: {
            $gte: new Date(`${year}-01-01`),
            $lte: new Date(`${year}-12-31`),
          },
        },
      },
      {
        $group: {
          _id: { $month: "$startDates" },
          numTourStarts: { $sum: 1 },
          tours: { $push: "$name" },
        },
      },
      { $addFields: { month: "$_id" } },
      { $project: { _id: 0 } },
      { $sort: { numTourStarts: -1 } },
      { $limit: 12 },
    ]);

    res.status(200).json({ status: "success", data: { plan } });
  },
);

export const getTourWithin = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const distRaw = req.params.distance;
    const unitRaw = req.params.unit;
    const distance = Number(Array.isArray(distRaw) ? distRaw[0] : distRaw);
    const unit = Array.isArray(unitRaw) ? unitRaw[0] : unitRaw;
    const latlngRaw = req.params.latlng;
    const latlngStr = String(
      Array.isArray(latlngRaw) ? latlngRaw[0] : latlngRaw ?? "",
    );
    const [lat, lng] = latlngStr.split(",");
    const radius =
      unit === "mi" ? distance / 3963.2 : distance / 6378.1;

    if (!lat || !lng) {
      return next(
        new AppError(
          "Please provide latitude and longitude in the format lat,lng.",
          400,
        ),
      );
    }

    const tours = await Tour.find({
      startLocation: {
        $geoWithin: { $centerSphere: [[Number(lng), Number(lat)], radius] },
      },
    });

    res.status(200).json({
      status: "success",
      results: tours.length,
      data: { data: tours },
    });
  },
);

export const getDistances = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const unitRaw = req.params.unit;
    const unit = Array.isArray(unitRaw) ? unitRaw[0] : unitRaw;
    const latlngRaw = req.params.latlng;
    const latlngStr = String(
      Array.isArray(latlngRaw) ? latlngRaw[0] : latlngRaw ?? "",
    );
    const [lat, lng] = latlngStr.split(",");
    const multiplier = unit === "mi" ? 0.000621371 : 0.001;

    if (!lat || !lng) {
      return next(
        new AppError(
          "Please provide latitude and longitude in the format lat,lng.",
          400,
        ),
      );
    }

    const distances = await Tour.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [Number(lng), Number(lat)],
          },
          distanceField: "distance",
          distanceMultiplier: multiplier,
        },
      },
      { $project: { distance: 1, name: 1 } },
    ]);

    res.status(200).json({
      status: "success",
      data: { data: distances },
    });
  },
);
