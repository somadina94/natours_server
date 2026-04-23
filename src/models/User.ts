import crypto from "crypto";
import mongoose, { Schema, type Query, type Document } from "mongoose";
import validator from "validator";
import bcrypt from "bcryptjs";
import { absolutePublicFileUrl } from "../utils/publicMediaUrl.js";

function userPhotoOut(_doc: unknown, ret: Record<string, unknown>) {
  const p = ret["photo"];
  if (
    typeof p === "string" &&
    p.length > 0 &&
    p !== "default.jpg" &&
    !/^https?:\/\//i.test(p)
  ) {
    ret["photo"] = absolutePublicFileUrl(p);
  }
  return ret;
}

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Please tell us your name"],
    },
    email: {
      type: String,
      required: [true, "Please provide your email"],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, "Please provide a valid email"],
    },
    photo: {
      type: String,
      default: "default.jpg",
    },
    role: {
      type: String,
      enum: ["user", "guide", "lead-guide", "admin"],
      default: "user",
    },
    password: {
      type: String,
      required: [true, "Please provide a password"],
      minlength: 8,
      select: false,
    },
    passwordConfirm: {
      type: String,
      required: [true, "Please confirm your password"],
      validate: {
        validator: function (this: { password?: string }, el: string) {
          return el === this.password;
        },
        message: "Passwords are not the same",
      },
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    active: {
      type: Boolean,
      default: true,
      select: false,
    },
  },
  {
    toJSON: {
      virtuals: true,
      transform: userPhotoOut,
    },
    toObject: {
      virtuals: true,
      transform: userPhotoOut,
    },
  },
);

userSchema.pre("save", async function (this: Document) {
  if (!this.isModified("password")) return;
  const plain = this.get("password") as string;
  this.set("password", await bcrypt.hash(plain, 12));
  this.set("passwordConfirm", undefined);
});

userSchema.pre("save", function (this: Document) {
  if (!this.isModified("password") || this.isNew) return;
  this.set("passwordChangedAt", new Date(Date.now() - 1000));
});

userSchema.pre(/^find/, function () {
  (this as Query<unknown, unknown>).where({ active: { $ne: false } });
});

userSchema.methods.correctPassword = async function (
  candidatePassword: string,
  userPassword: string,
) {
  return bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (
  this: Document,
  JWTTimestamp: number,
) {
  const changed = this.get("passwordChangedAt") as Date | undefined;
  if (changed) {
    const changedTimestamp = Math.floor(changed.getTime() / 1000);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

userSchema.methods.createPasswordResetToken = function (this: Document) {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.set(
    "passwordResetToken",
    crypto.createHash("sha256").update(resetToken).digest("hex"),
  );
  this.set("passwordResetExpires", new Date(Date.now() + 10 * 60 * 1000));
  return resetToken;
};

export const User = mongoose.model("User", userSchema);
