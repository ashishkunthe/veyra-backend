import { Router } from "express";
import prisma from "../config/prisma";
import { protect } from "../middlewares/auth";
import { razorpay } from "../config/razorpay";
import crypto from "crypto";

const router = Router();

// 📦 Create subscription
router.post("/create-subscription", protect, async (req: any, res) => {
  try {
    const { planId } = req.body; // Razorpay plan_id

    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: 12, // 12 billing cycles (1 year)
    });

    // Save subscription in DB
    await prisma.subscription.create({
      data: {
        userId: req.user.id,
        stripeSubscriptionId: subscription.id, // reusing column name
        planName: planId,
        status: subscription.status,
        startDate: new Date(),
      },
    });

    res.json({ subscription });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

// 📡 Webhook (listen for events)
router.post("/webhook", async (req, res) => {
  const webhookSecret = "AaPYLWS_WPny8VV";

  const signature = req.headers["x-razorpay-signature"];
  const shasum = crypto.createHmac("sha256", webhookSecret);
  shasum.update(JSON.stringify(req.body));
  const digest = shasum.digest("hex");

  if (digest !== signature) {
    return res.status(400).json({ message: "Invalid signature" });
  }

  const event = req.body.event;

  if (event === "subscription.activated" || event === "subscription.charged") {
    const subId = req.body.payload.subscription.entity.id;
    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subId },
      data: { status: "active" },
    });
  } else if (event === "subscription.cancelled") {
    const subId = req.body.payload.subscription.entity.id;
    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subId },
      data: { status: "canceled" },
    });
  }

  res.json({ status: "success" });
});

// 📊 Get subscription status
router.get("/status", protect, async (req: any, res) => {
  const sub = await prisma.subscription.findFirst({
    where: { userId: req.user.id },
  });
  res.json(sub);
});

export default router;
