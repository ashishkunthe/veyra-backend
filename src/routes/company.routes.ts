import { Router } from "express";
import prisma from "../config/prisma";
import { protect } from "../middlewares/auth";

const router = Router();

// 📌 Create company info
router.post("/", protect, async (req: any, res) => {
  try {
    const { name, logoUrl, address, taxInfo } = req.body;

    const company = await prisma.company.create({
      data: {
        name,
        logoUrl,
        address,
        taxInfo,
        userId: req.user.id,
      },
    });

    res.status(201).json(company);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// 📥 Get current user's company
router.get("/", protect, async (req: any, res) => {
  try {
    const company = await prisma.company.findFirst({
      where: { userId: req.user.id },
    });

    if (!company) return res.status(404).json({ message: "No company found" });

    res.json(company);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✏️ Update company info
router.put("/:id", protect, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { name, logoUrl, address, taxInfo } = req.body;

    const company = await prisma.company.findUnique({ where: { id } });

    if (!company || company.userId !== req.user.id) {
      return res
        .status(404)
        .json({ message: "Company not found or unauthorized" });
    }

    const updated = await prisma.company.update({
      where: { id },
      data: { name, logoUrl, address, taxInfo },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
