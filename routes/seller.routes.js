const { Router } = require("express");
const {
  applyForSeller,
  getMySellerProfile,
  getMyProducts,
  getSellerOrders,
  getSellerAnalytics,
  updateSellerOrderItemStatus,
  getMyProductReviews,

  respondToReview,
  deleteReviewResponse,
} = require("../controllers/seller.controller");
const { verifyJWT, verifySeller } = require("../shared/middleware/auth.middleware");
const upload = require("../shared/middleware/multer.middleware");
const validate = require("../shared/middleware/validate.middleware");
const {
  applyForSellerSchema,
  respondToReviewSchema,
  reviewIdParamSchema,
  reviewResponseParamSchema,
} = require("../validators/seller.validators");

const { sellerApplicationLimiter } = require("../shared/middleware/rateLimiter.middleware");

const router = Router();

router.use(verifyJWT);

// open to any logged-in user — this is how a "user" becomes a "seller".
// multer runs before validate() — it's what populates req.body on this
// multipart/form-data route.
router
  .route("/apply")
  .post(sellerApplicationLimiter, upload.single("storeLogo"), validate({ body: applyForSellerSchema }), applyForSeller);

router.route("/me").get(getMySellerProfile);

// approved sellers only
router.route("/products").get(verifySeller, getMyProducts);
router.route("/orders").get(verifySeller, getSellerOrders);
router.route("/orders/:orderId/status").patch(verifySeller, updateSellerOrderItemStatus);
router.route("/analytics").get(verifySeller, getSellerAnalytics);

router.route("/reviews").get(verifySeller, getMyProductReviews);
router
  .route("/reviews/:reviewId/respond")
  .post(
    verifySeller,
    validate({ params: reviewIdParamSchema, body: respondToReviewSchema }),
    respondToReview
  );
router
  .route("/reviews/:reviewId/respond/:responseId")
  .delete(verifySeller, validate({ params: reviewResponseParamSchema }), deleteReviewResponse);

module.exports = router;
