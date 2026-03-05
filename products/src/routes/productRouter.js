import express from "express";
import {
  showProducts,
  getProductById,
  getOffers,
  decrementProductCount,
  getCategories,
} from "../controllers/productController.js";

const router = express.Router();

router.get("/showProducts", showProducts);
router.get("/categories", getCategories);
router.get("/offers", getOffers);
router.get("/:id", getProductById);
router.post("/decrement-count", decrementProductCount);

export default router;
