import { Router } from "express";
import * as tourController from "../controllers/tourController.js";
import * as authController from "../controllers/authController.js";
import reviewRouter from "./reviewRoutes.js";

const router = Router();

router.use("/:tourId/reviews", reviewRouter);

router.route("/top-5-cheap").get(tourController.aliasTopTours, tourController.getAllTours);
router.route("/tour-stats").get(tourController.getTourStats);
router
  .route("/monthly-plan/:year")
  .get(
    authController.protect,
    authController.restrictTo("admin", "lead-guide", "guide"),
    tourController.getMonthlyPlan,
  );

router.route("/tours-within/:distance/center/:latlng/unit/:unit").get(tourController.getTourWithin);
router.route("/distances/:latlng/unit/:unit").get(tourController.getDistances);

router
  .route("/")
  .get(tourController.getAllTours)
  .post(
    authController.protect,
    authController.restrictTo("admin", "lead-guide"),
    tourController.maybeUploadTourImages,
    tourController.parseMultipartTourBody,
    tourController.resizeTourImages,
    tourController.createTour,
  );

router
  .route("/:id")
  .get(tourController.getTour)
  .patch(
    authController.protect,
    authController.restrictTo("admin", "lead-guide"),
    tourController.maybeUploadTourImages,
    tourController.parseMultipartTourBody,
    tourController.resizeTourImages,
    tourController.updateTour,
  )
  .delete(
    authController.protect,
    authController.restrictTo("admin", "lead-guide"),
    tourController.deleteTour,
  );

export default router;
