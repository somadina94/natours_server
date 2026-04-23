import path from "path";
import { fileURLToPath } from "url";
import pug from "pug";
import nodemailer from "nodemailer";
import { htmlToText } from "html-to-text";
import type Mail from "nodemailer/lib/mailer/index.js";
import { env } from "../config/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const isEmailConfigured = (): boolean =>
  Boolean(env.emailHost && env.emailAddress && env.emailPassword);

export const createMailTransport = () => {
  const host = env.emailHost;
  const port = env.emailPort ? Number(env.emailPort) : 587;
  const secure =
    env.emailSecure !== undefined
      ? env.emailSecure === "true"
      : port === 465;
  const requireTLS = env.emailRequireTls === "true";
  const rejectUnauthorized =
    env.emailTlsRejectUnauthorized === undefined
      ? true
      : env.emailTlsRejectUnauthorized === "true";
  const user = env.emailAddress;
  const pass = env.emailPassword;
  if (!host || !user || !pass) {
    throw new Error(
      "Email is not configured. Set EMAIL_HOST, EMAIL_ADDRESS, and EMAIL_PASSWORD.",
    );
  }
  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS,
    tls: { rejectUnauthorized },
    auth: { user, pass },
  });
};

export async function verifyMailTransport(): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error(
      "Email is not configured. Set EMAIL_HOST, EMAIL_ADDRESS, and EMAIL_PASSWORD.",
    );
  }
  const transport = createMailTransport();
  await transport.verify();
}

export async function sendTemplatedMail(params: {
  to: string;
  subject: string;
  template: string;
  locals: Record<string, unknown>;
  attachments?: Mail.Attachment[];
}): Promise<void> {
  if (!isEmailConfigured()) return;

  const html = pug.renderFile(
    path.join(__dirname, "../views/email", `${params.template}.pug`),
    {
      companyName: env.companyName,
      subject: params.subject,
      ...params.locals,
    },
  );

  const transport = createMailTransport();
  await transport.sendMail({
    from: `${env.companyName} <${env.emailFrom ?? env.emailAddress ?? "noreply@localhost"}>`,
    to: params.to,
    subject: params.subject,
    html,
    text: htmlToText(html),
    attachments: params.attachments,
  });
}

type EmailUser = { name: string; email: string };

export default class Email {
  to: string;
  firstName: string;
  url: string;
  from: string;

  constructor(user: EmailUser, url: string) {
    this.to = user.email;
    this.firstName = user.name.split(" ")[0] ?? user.name;
    this.url = url;
    this.from = `${env.companyName} <${env.emailFrom ?? env.emailAddress ?? "noreply@localhost"}>`;
  }

  async send(template: string, subject: string) {
    const html = pug.renderFile(
      path.join(__dirname, "../views/email", `${template}.pug`),
      {
        firstName: this.firstName,
        url: this.url,
        subject,
        companyName: env.companyName,
      },
    );

    await createMailTransport().sendMail({
      from: this.from,
      to: this.to,
      subject,
      html,
      text: htmlToText(html),
    });
  }

  async sendWelcome() {
    await this.send("welcome", `Welcome to ${env.companyName}`);
  }

  async sendPasswordReset() {
    await this.send(
      "passwordReset",
      `Your password reset token (valid for only 10 minutes)`,
    );
  }
}
