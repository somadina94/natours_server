import mongoose, { Schema, type Query } from "mongoose";

const bookingSchema = new Schema(
  {
    tour: {
      type: Schema.Types.ObjectId,
      ref: "Tour",
      required: [true, "Booking must belong to a Tour!"],
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Booking must belong to a User!"],
    },
    price: {
      type: Number,
      required: [true, "Booking must have a price."],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    paid: {
      type: Boolean,
      default: true,
    },
    stripeCheckoutSessionId: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  { toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

bookingSchema.pre(/^find/, function () {
  const q = this as Query<unknown, unknown>;
  void q.populate("user").populate({
    path: "tour",
    select: "name slug imageCover",
  });
});

export const Booking = mongoose.model("Booking", bookingSchema);
