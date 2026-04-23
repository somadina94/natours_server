import type { Request } from "express";
import ExpressMongoSanitize from "express-mongo-sanitize";

/**
 * Deep-clone then strip MongoDB operator keys ($gt, etc.) from query objects.
 * Express 5 makes `req.query` read-only, so we cannot use `express-mongo-sanitize`
 * middleware in-place on `req.query`.
 */
export function cloneAndSanitizeQuery(
  q: Request["query"],
): Record<string, string | undefined> {
  const plain = JSON.parse(JSON.stringify(q ?? {})) as Record<
    string,
    string | undefined
  >;
  return ExpressMongoSanitize.sanitize(plain) as Record<
    string,
    string | undefined
  >;
}
