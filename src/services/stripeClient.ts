import Stripe from "stripe";
import { env, isStripeConfigured } from "../config/env.js";
import AppError from "../utils/appError.js";

let client: Stripe | null = null;

/**
 * Lazily instantiates the Stripe client. Throws if `STRIPE_SECRET_KEY` is unset.
 */
export const getStripe = (): Stripe => {
  if (!isStripeConfigured()) {
    throw new AppError("Payments are not configured.", 500);
  }
  if (!client) {
    client = new Stripe(env.stripeSecretKey);
  }
  return client;
};
