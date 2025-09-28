import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import companyRoutes from "./routes/company.routes";
import invoiceRoutes from "./routes/invoice.routes";
import razorpayRoutes from "./routes/razorpay.routes";
import webhookRoutes from "./routes/webhook.routes";

dotenv.config();
const app = express();

app.use(cors());

app.post(
  "/razorpay/webhook",
  express.raw({ type: "application/json" }),
  webhookRoutes
);

app.use(express.json());

app.get("/", (_req, res) => {
  res.send("SaaS Invoice Backend is running 🚀");
});

app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/company", companyRoutes);
app.use("/invoices", invoiceRoutes);
app.use("/razorpay", express.json(), razorpayRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
