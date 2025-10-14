import { Router } from "express";
import prisma from "../config/prisma";
import { protect } from "../middlewares/auth";
import { razorpay } from "../config/razorpay";

const router = Router();

// 📦 Create subscription
router.post("/create-subscription", protect, async (req: any, res) => {
  try {
    const { planId } = req.body;

    // 🧠 Map Razorpay plan IDs to readable names
    const planMap: Record<string, string> = {
      plan_RQWtzIDOuFsegM: "starter",
      plan_RQWuo7mIXF9QzV: "pro",
    };

    const planName = planMap[planId] || "free";

    // Create Razorpay subscription
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: 12,
    });

    // Save in DB with mapped plan name
    await prisma.subscription.create({
      data: {
        userId: req.user.id,
        stripeSubscriptionId: subscription.id,
        planName, // ✅ "starter" or "pro"
        status: subscription.status,
        startDate: new Date(),
      },
    });

    res.json({ subscription });
  } catch (error: any) {
    console.error("❌ Error creating subscription:", error);
    res.status(500).json({ message: error.message });
  }
});

// 📊 Get subscription status (returns free/starter/pro)
router.get("/status", protect, async (req: any, res) => {
  try {
    const sub = await prisma.subscription.findFirst({
      where: { userId: req.user.id, status: "active" },
      orderBy: { createdAt: "desc" },
    });

    if (!sub) {
      return res.json({
        plan: "free",
        message: "Using free plan (5 invoices total)",
        invoicesLimit: 5,
      });
    }

    let plan = "free";
    let invoicesLimit = 5;
    let message = "Using free plan.";

    if (sub.planName == "starter") {
      plan = "starter";
      invoicesLimit = 1000;
      message = "Using Starter plan (1000 invoices/month)";
    } else if (sub.planName == "pro") {
      plan = "pro";
      invoicesLimit = Infinity;
      message = "Using Pro plan (Unlimited invoices)";
    }

    res.json({
      plan,
      planName: sub.planName,
      status: sub.status,
      startDate: sub.startDate,
      endDate: sub.endDate,
      invoicesLimit,
      message,
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
