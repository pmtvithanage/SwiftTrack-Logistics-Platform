import Product from "../models/Product.js";
import Offer from "../models/Offer.js";

export const showProducts = async (req, res) => {
  try {
    const { category, search, minPrice, maxPrice } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (search) filter.name = { $regex: search, $options: "i" };
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, products, count: products.length });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching products", error: err.message });
  }
};

export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching product", error: err.message });
  }
};

export const getOffers = async (req, res) => {
  try {
    const offers = await Offer.find().sort({ createdAt: -1 });
    res.json(offers);
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching offers", error: err.message });
  }
};

export const decrementProductCount = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    if (!productId || !quantity || quantity < 1) {
      return res.status(400).json({ success: false, error: "Invalid productId or quantity" });
    }
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });
    if (product.stock < quantity) {
      return res.status(400).json({ success: false, error: "Insufficient stock", currentStock: product.stock });
    }
    const updated = await Product.findByIdAndUpdate(productId, { $inc: { stock: -quantity } }, { new: true });
    res.json({ success: true, message: "Stock updated", newStock: updated.stock });
  } catch (err) {
    res.status(500).json({ success: false, error: "Internal server error", message: err.message });
  }
};

export const getCategories = async (req, res) => {
  try {
    const categories = await Product.distinct("category");
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching categories", error: err.message });
  }
};
