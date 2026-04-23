import mongoose, { Schema, type Query, type Types } from "mongoose";
import { Tour } from "./Tour.js";

export async function recalcTourRatingStats(tourId: Types.ObjectId): Promise<void> {
  const ReviewModel = mongoose.model("Review");
  const stats = await ReviewModel.aggregate([
    { $match: { tour: tourId } },
    {
      $group: {
        _id: "$tour",
        nRating: { $sum: 1 },
        avgRating: { $avg: "$rating" },
      },
    },
  ]);

  if (stats.length > 0) {
    const row = stats[0] as { nRating?: number; avgRating?: number };
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: row.nRating,
      ratingsAverage: row.avgRating,
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5,
    });
  }
}

const reviewSchema = new Schema(
  {
    review: {
      type: String,
      required: [true, "Review cannot be empty."],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    tour: {
      type: Schema.Types.ObjectId,
      ref: "Tour",
      required: [true, "Review must belong to a tour."],
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Review must belong to a user."],
    },
  },
  { toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

reviewSchema.index({ tour: 1, user: 1 }, { unique: true });

reviewSchema.pre(/^find/, function () {
  void (this as Query<unknown, unknown>).populate({
    path: "user",
    select: "name photo",
  });
});

reviewSchema.post("save", function (doc) {
  void recalcTourRatingStats(doc.tour as Types.ObjectId);
});

reviewSchema.pre(/^findOneAnd/, async function () {
  const q = this as Query<unknown, unknown> & {
    rev?: { tour: Types.ObjectId } | null;
  };
  const filter = q.getFilter();
  const doc = await mongoose
    .model<{ tour: Types.ObjectId }>("Review")
    .findOne(filter)
    .lean();
  q.rev = doc;
});

reviewSchema.post(/^findOneAnd/, async function () {
  const q = this as mongoose.Query<unknown, unknown> & {
    rev?: { tour: Types.ObjectId } | null;
  };
  if (q.rev?.tour) {
    await recalcTourRatingStats(q.rev.tour);
  }
});

export const Review = mongoose.model("Review", reviewSchema);
