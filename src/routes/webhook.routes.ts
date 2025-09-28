import { Router } from "express";
import crypto from "crypto";
import prisma from "../config/prisma";

const router = Router();

router.post("/", async (req, res) => {
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

export default router;
