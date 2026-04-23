import mongoose, { Schema, type Query } from "mongoose";
import slugify from "slugify";
import { absolutePublicFileUrl } from "../utils/publicMediaUrl.js";

const locationSchema = new Schema(
  {
    type: {
      type: String,
      default: "Point",
      enum: ["Point"],
    },
    coordinates: [Number],
    address: String,
    description: String,
    day: Number,
  },
  { _id: false },
);

const tourSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "A tour must have a name"],
      unique: true,
      trim: true,
      maxlength: [40, "A tour name must have less or equal than 40 characters"],
      minlength: [10, "A tour name must have more or equal than 10 characters"],
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, "A tour must have a duration"],
    },
    maxGroupSize: {
      type: Number,
      required: [true, "A tour must have a group size"],
    },
    difficulty: {
      type: String,
      required: [true, "A tour must have a difficulty"],
      enum: {
        values: ["easy", "medium", "difficult"],
        message: "The difficulty is either: easy, medium, or difficult",
      },
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, "Rating must be above 1.0"],
      max: [5, "Rating must be below 5.0"],
      set: (val: number) => Math.round(val * 10) / 10,
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, "A tour must have a price"],
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function (this: { price?: number }, val: number) {
          return val < (this.price ?? 0);
        },
        message: "Discount price should be below regular price",
      },
    },
    summary: {
      type: String,
      trim: true,
      required: [true, "A tour must have a summary"],
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
      required: [true, "A tour must have a cover image"],
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now,
      select: false,
    },
    startDates: [Date],
    secretTour: {
      type: Boolean,
      default: false,
    },
    startLocation: {
      type: {
        type: String,
        default: "Point",
        enum: ["Point"],
      },
      coordinates: [Number],
      address: String,
      description: String,
    },
    locations: [locationSchema],
    guides: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        if (typeof ret.imageCover === "string") {
          ret.imageCover = absolutePublicFileUrl(ret.imageCover);
        }
        if (Array.isArray(ret.images)) {
          ret.images = ret.images.map((p: string) => absolutePublicFileUrl(p));
        }
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform(_doc, ret) {
        if (typeof ret.imageCover === "string") {
          ret.imageCover = absolutePublicFileUrl(ret.imageCover);
        }
        if (Array.isArray(ret.images)) {
          ret.images = ret.images.map((p: string) => absolutePublicFileUrl(p));
        }
        return ret;
      },
    },
  },
);

tourSchema.index({ price: 1, ratingsAverage: -1 });
tourSchema.index({ slug: 1 });
tourSchema.index({ startLocation: "2dsphere" });

tourSchema.virtual("durationWeeks").get(function () {
  return this.duration / 7;
});

tourSchema.virtual("reviews", {
  ref: "Review",
  foreignField: "tour",
  localField: "_id",
});

tourSchema.pre("save", function () {
  this.slug = slugify(this.name, { lower: true });
});

tourSchema.pre(/^find/, function () {
  (this as Query<unknown, unknown>).where({ secretTour: { $ne: true } });
});

tourSchema.pre(/^find/, function () {
  (this as Query<unknown, unknown>).populate({
    path: "guides",
    select: "-__v -email -passwordChangedAt",
  });
});

export const Tour = mongoose.model("Tour", tourSchema);
