import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import "./jobs/agenda";

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import companyRoutes from "./routes/company.routes";
import invoiceRoutes from "./routes/invoice.routes";
import razorpayRoutes from "./routes/razorpay.routes";
import clientRoutes from "./routes/client.routes";
import analyticsRoutes from "./routes/analytics.routes";
import dashboardRoute from "./routes/dashboard.routes";
import profileRoute from "./routes/profile.routes";

import crypto from "crypto";
import prisma from "./config/prisma";

dotenv.config();
const app = express();

app.use(cors());

app.post(
  "/razorpay/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const webhookSecret = "AaPYLWS_WPny8VV";
      const signature = req.headers["x-razorpay-signature"];
      const body = req.body.toString();
      const digest = crypto
        .createHmac("sha256", webhookSecret)
        .update(body)
        .digest("hex");

      if (digest !== signature) {
        console.log("❌ Invalid signature", { digest, signature });
        return res.status(400).json({ message: "Invalid signature" });
      }

      const payload = JSON.parse(body);
      const event = payload.event;
      console.log("📬 Webhook Event:", event);

      if (["subscription.activated", "subscription.charged"].includes(event)) {
        const subId = payload.payload.subscription.entity.id;
        console.log("📦 Activating subscription:", subId);
        const result = await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subId },
          data: { status: "active" },
        });
        console.log("📊 Rows updated:", result.count);
      } else if (event === "subscription.cancelled") {
        const subId = payload.payload.subscription.entity.id;
        console.log("📦 Cancelling subscription:", subId);
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subId },
          data: { status: "canceled" },
        });
      }

      res.json({ status: "success" });
    } catch (err) {
      console.error("⚠️ Webhook error:", err);
      res.status(500).json({ status: "error" });
    }
  }
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
app.use("/clients", clientRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/", dashboardRoute);
app.use("/profile", profileRoute);

app.post("/waitlist", async (req, res) => {
  const { name, email } = req.body;
  const entry = await prisma.waitlist.create({ data: { name, email } });
  res.status(201).json(entry);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
