import { Router } from "express";
import prisma from "../config/prisma";
import { protect } from "../middlewares/auth";

const router = Router();

router.get("/", protect, async (req: any, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      businessType: true,
      country: true,
      profileImageUrl: true,
      onboardingComplete: true,
      companies: true,
    },
  });
  res.json(user);
});

router.put("/", protect, async (req: any, res) => {
  const { name, phone, businessType, country, profileImageUrl } = req.body;

  const updatedUser = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      name,
      phone,
      businessType,
      country,
      profileImageUrl,
      onboardingComplete: true,
    },
  });

  res.json(updatedUser);
});

export default router;
