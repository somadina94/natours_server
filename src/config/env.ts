import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

/** Always load `server/.env` regardless of process cwd (e.g. monorepo root). */
const envDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(envDir, "../../.env") });

const str = (v: string | undefined, fallback?: string) => v ?? fallback ?? "";

export const env = {
  nodeEnv: str(process.env.NODE_ENV, "development"),
  port: Number(process.env.PORT) || 4040,

  database: str(process.env.DATABASE),
  databasePassword: str(process.env.DATABASE_PASSWORD),

  jwtSecret: str(process.env.JWT_SECRET),
  jwtExpiresIn: str(process.env.JWT_EXPIRES_IN, "90d"),
  jwtCookieExpiresIn: Number(process.env.JWT_COOKIE_EXPIRES_IN) || 90,

  apiUrl: str(process.env.API_URL, "http://localhost:4040"),
  frontendUrl: str(process.env.FRONTEND_URL, "http://localhost:3000"),

  companyName: str(process.env.COMPANY_NAME, "Natours"),

  emailHost: str(process.env.EMAIL_HOST),
  emailPort: str(process.env.EMAIL_PORT, "587"),
  emailSecure: str(process.env.EMAIL_SECURE),
  emailRequireTls: str(process.env.EMAIL_REQUIRE_TLS),
  emailTlsRejectUnauthorized: str(process.env.EMAIL_TLS_REJECT_UNAUTHORIZED),
  emailAddress: str(process.env.EMAIL_ADDRESS),
  emailFrom: str(process.env.EMAIL_FROM),
  emailPassword: str(process.env.EMAIL_PASSWORD),

  b2ApplicationKeyId: str(process.env.B2_APPLICATION_KEY_ID).trim(),
  b2ApplicationKey: str(process.env.B2_APPLICATION_KEY).trim(),
  b2BucketId: str(process.env.B2_BUCKET_ID).trim(),
  b2BucketName: str(process.env.B2_BUCKET_NAME).trim(),
  b2PublicBaseUrl: str(process.env.B2_PUBLIC_BASE_URL).trim().replace(/\/$/, ""),

  stripeSecretKey: str(process.env.STRIPE_SECRET_KEY),
  stripePublishableKey: str(process.env.STRIPE_PUBLISHABLE_KEY),
  stripeWebhookSecret: str(process.env.STRIPE_WEBHOOK_SECRET),
  stripeCheckoutSuccessUrl: str(process.env.STRIPE_CHECKOUT_SUCCESS_URL),
  stripeCheckoutCancelUrl: str(process.env.STRIPE_CHECKOUT_CANCEL_URL),
  stripeCurrency: str(process.env.STRIPE_CURRENCY, "usd"),
} as const;

export const isB2Configured = (): boolean =>
  Boolean(
    env.b2ApplicationKeyId &&
      env.b2ApplicationKey &&
      env.b2BucketId &&
      env.b2PublicBaseUrl,
  );

/** Base URL for resolving relative media keys in API responses (B2 public URL). */
export const publicMediaBaseUrl = (): string => {
  const b2 = env.b2PublicBaseUrl.replace(/\/$/, "");
  return b2 || "";
};

export const isStripeConfigured = (): boolean => Boolean(env.stripeSecretKey);

export const assertJwtSecret = (): void => {
  if (!env.jwtSecret) {
    throw new Error("JWT_SECRET is required");
  }
};
