import { publicMediaBaseUrl } from "../config/env.js";

/** Turn a stored key or relative path into a browser-loadable absolute URL. */
export function absolutePublicFileUrl(path: string | undefined | null): string {
  if (path == null || path === "") return "";
  const s = String(path).trim();
  if (/^https?:\/\//i.test(s)) return s;
  const base = publicMediaBaseUrl();
  if (!base) return s;
  return `${base}/${s.replace(/^\//, "")}`;
}
