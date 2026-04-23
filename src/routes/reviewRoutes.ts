import { Router } from "express";
import * as reviewController from "../controllers/reviewController.js";
import * as authController from "../controllers/authController.js";

const router = Router({ mergeParams: true });

router.use(authController.protect);

router.get("/my-reviews", reviewController.getMyReviews);

router
  .route("/")
  .get(reviewController.getReviews)
  .post(
    authController.restrictTo("user"),
    reviewController.setTourUserIds,
    reviewController.createReview,
  );

router
  .route("/:id")
  .get(reviewController.getReview)
  .patch(
    authController.restrictTo("user", "admin"),
    reviewController.updateReview,
  )
  .delete(
    authController.restrictTo("user", "admin"),
    reviewController.deleteReview,
  );

export default router;
