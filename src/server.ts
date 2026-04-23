process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION");
  console.error(err);
  console.error(err instanceof Error ? err.stack : "Not an Error");
  process.exit(1);
});

import mongoose from "mongoose";
import { env, assertJwtSecret } from "./config/env.js";
import app from "./app.js";

assertJwtSecret();

const port = env.port;

let DB = env.database;
if (env.databasePassword) {
  DB = DB.replace(/<password>/gi, env.databasePassword).replace(
    /<PASSWORD>/gi,
    env.databasePassword,
  );
}

const server = app.listen(port, () => {
  console.log(`Natours API listening on port ${port}`);
});

const connectDB = async () => {
  await mongoose.connect(DB);
  if (mongoose.connection.readyState === 1) {
    console.log("MongoDB connected");
  }
};

void connectDB();

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION");
  console.error(reason);
  server.close(() => {
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully");
  server.close(() => {
    void mongoose.connection.close(false);
    process.exit(0);
  });
});
