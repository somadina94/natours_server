import type { Request, Response, NextFunction } from "express";
import type Stripe from "stripe";
import { Tour } from "../models/Tour.js";
import { Booking } from "../models/Booking.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";
import * as factory from "./handlerFactory.js";
import { getStripe } from "../services/stripeClient.js";
import { env } from "../config/env.js";

function httpsTourImageForStripe(imageCover: string): string[] {
  if (!imageCover) return [];
  const absolute = imageCover.startsWith("http")
    ? imageCover
    : env.b2PublicBaseUrl
      ? `${env.b2PublicBaseUrl.replace(/\/$/, "")}/${imageCover.replace(/^\//, "")}`
      : "";
  if (!absolute.startsWith("https://")) return [];
  return [absolute];
}

export const getCheckoutSession = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.email) {
      return next(new AppError("Authenticated user must have an email.", 400));
    }

    const tourIdRaw = req.params["tourId"];
    const tourId = Array.isArray(tourIdRaw) ? tourIdRaw[0] : tourIdRaw;
    const tour = await Tour.findById(tourId);
    if (!tour) {
      return next(new AppError("No tour found with that ID", 404));
    }

    const stripe = getStripe();
    const images = httpsTourImageForStripe(tour.imageCover as string);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      success_url: String(env.stripeCheckoutSuccessUrl),
      cancel_url: String(env.stripeCheckoutCancelUrl),
      customer_email: req.user.email,
      client_reference_id: String(tourId),
      metadata: {
        tourId: String(tour.id),
        userId: String(req.user?.id),
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: env.stripeCurrency.toLowerCase(),
            unit_amount: Math.round((tour.price as number) * 100),
            product_data: {
              name: `${tour.name} tour`,
              description: (tour.summary as string) ?? undefined,
              images: images.length ? images : undefined,
            },
          },
        },
      ],
    });

    res.status(200).json({ status: "success", session });
  },
);

/** Raw body route — do not pass through `express.json()`. */
export const stripeWebhook = async (req: Request, res: Response) => {
  try {
    const sig = req.headers["stripe-signature"];
    if (!env.stripeWebhookSecret) {
      res.status(500).send("Stripe webhooks are not configured.");
      return;
    }
    if (!sig || typeof sig !== "string") {
      res.status(400).send("Missing Stripe-Signature header");
      return;
    }

    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig,
      env.stripeWebhookSecret,
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const tourId = session.metadata?.tourId;
      const userId = session.metadata?.userId;
      if (!tourId || !userId) {
        res.status(200).json({ received: true });
        return;
      }

      const existing = await Booking.findOne({
        stripeCheckoutSessionId: session.id,
      });
      if (existing) {
        res.status(200).json({ received: true });
        return;
      }

      const price =
        session.amount_total != null
          ? session.amount_total / 100
          : undefined;
      if (price == null) {
        res.status(200).json({ received: true });
        return;
      }

      await Booking.create({
        tour: tourId,
        user: userId,
        price,
        paid: true,
        stripeCheckoutSessionId: session.id,
      });
    }

    res.status(200).json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).send(`Webhook Error: ${message}`);
  }
};

export const getMyBookings = catchAsync(async (req: Request, res: Response) => {
  const uid = req.user?.id;
  const list = await Booking.find({ user: uid }).sort("-createdAt");
  res.status(200).json({
    status: "success",
    results: list.length,
    data: { data: list },
  });
});

export const createBooking = factory.createOne(Booking);
export const getBooking = factory.getOne(Booking);
export const getAllBookings = factory.getAll(Booking);
export const updateBooking = factory.updateOne(Booking);
export const deleteBooking = factory.deleteOne(Booking);
