import { Router } from "express";
import { protect } from "../middlewares/auth";
import prisma from "../config/prisma";

const router = Router();

router.get("/dashboard/stats", protect, async (req: any, res) => {
  try {
    const userId = req.user.id;

    const [invoices, clients] = await Promise.all([
      prisma.invoice.findMany({ where: { userId } }),
      prisma.client.findMany({ where: { userId } }),
    ]);

    const totalRevenue = invoices
      .filter((inv) => inv.status === "paid")
      .reduce((sum, inv) => sum + inv.total, 0);

    const openInvoices = invoices.filter((inv) => inv.status !== "paid").length;

    res.json({
      totalRevenue,
      totalInvoices: invoices.length,
      openInvoices,
      totalClients: clients.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch dashboard stats" });
  }
});

export default router;
