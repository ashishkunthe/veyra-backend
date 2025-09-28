import { Router } from "express";
import crypto from "crypto";
import prisma from "../config/prisma";

const router = Router();

router.post("/", async (req, res) => {
  const webhookSecret = "AaPYLWS_WPny8VV";
  const signature = req.headers["x-razorpay-signature"];
  const body = req.body.toString();
  const digest = crypto
    .createHmac("sha256", webhookSecret)
    .update(body)
    .digest("hex");

  if (digest !== signature) {
    console.log("❌ Invalid signature. Expected:", digest, "Got:", signature);
    return res.status(400).json({ message: "Invalid signature" });
  }

  const event = JSON.parse(body).event;
  console.log("📬 Webhook Event:", event);

  if (event === "subscription.activated" || event === "subscription.charged") {
    const subId = JSON.parse(body).payload.subscription.entity.id;
    console.log("📦 Activating subscription:", subId);
    const result = await prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subId },
      data: { status: "active" },
    });
    console.log("📊 Rows updated:", result.count);
  } else if (event === "subscription.cancelled") {
    const subId = JSON.parse(body).payload.subscription.entity.id;
    console.log("📦 Cancelling subscription:", subId);
    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subId },
      data: { status: "canceled" },
    });
  }

  res.json({ status: "success" });
});

export default router;
