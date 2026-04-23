import dotenv from "dotenv";
import path from "path";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { User } from "../models/User.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  let DB = env.database;
  if (env.databasePassword) {
    DB = DB.replace(/<password>/gi, env.databasePassword).replace(
      /<PASSWORD>/gi,
      env.databasePassword,
    );
  }
  await mongoose.connect(DB);

  const email = process.env.SEED_OWNER_EMAIL;
  const password = process.env.SEED_OWNER_PASSWORD;
  const company = process.env.SEED_COMPANY_NAME ?? env.companyName;

  if (!email || !password) {
    console.error("Set SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD in .env");
    process.exit(1);
  }

  const existing = await User.findOne({ email });
  if (existing) {
    console.log("Seed user already exists:", email);
    await mongoose.connection.close();
    process.exit(0);
  }

  await User.create({
    name: company,
    email,
    password,
    passwordConfirm: password,
    role: "admin",
  });

  console.log("Seeded admin user:", email);
  await mongoose.connection.close();
  process.exit(0);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
