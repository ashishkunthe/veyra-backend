import { Router } from "express";
import prisma from "../config/prisma";
import { protect } from "../middlewares/auth";

const router = Router();

// 📊 1. Overview – total stats
router.get("/overview", protect, async (req: any, res) => {
  const userId = req.user.id;
  const { startDate, endDate } = req.query;

  const dateFilter =
    startDate && endDate
      ? {
          createdAt: {
            gte: new Date(startDate as string),
            lte: new Date(endDate as string),
          },
        }
      : {};

  const [totalInvoices, totalRevenue, totalClients] = await Promise.all([
    prisma.invoice.count({ where: { userId, ...dateFilter } }),
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: { userId, status: "paid", ...dateFilter },
    }),
    prisma.client.count({ where: { userId } }),
  ]);

  res.json({
    totalInvoices,
    totalRevenue: totalRevenue._sum.total || 0,
    totalClients,
  });
});

// 📅 2. Monthly revenue (last 6 months or filtered)
router.get("/monthly-revenue", protect, async (req: any, res) => {
  const userId = req.user.id;
  const { startDate, endDate } = req.query;

  const result = await prisma.$queryRawUnsafe(`
    SELECT 
      TO_CHAR("createdAt", 'YYYY-MM') as month,
      SUM(total) as revenue
    FROM "Invoice"
    WHERE "userId" = '${userId}' 
      AND status = 'paid'
      ${
        startDate && endDate
          ? `AND "createdAt" BETWEEN '${startDate}' AND '${endDate}'`
          : ""
      }
    GROUP BY month
    ORDER BY month ASC
  `);

  res.json(result);
});

// 👤 3. Top 5 clients by revenue
router.get("/top-clients", protect, async (req: any, res) => {
  const userId = req.user.id;
  const { startDate, endDate } = req.query;

  const clients = await prisma.invoice.groupBy({
    by: ["clientEmail", "clientName"],
    where: {
      userId,
      status: "paid",
      ...(startDate && endDate
        ? {
            createdAt: {
              gte: new Date(startDate as string),
              lte: new Date(endDate as string),
            },
          }
        : {}),
    },
    _sum: { total: true },
    orderBy: { _sum: { total: "desc" } },
    take: 5,
  });

  res.json(clients);
});

// 📦 4. Invoice status summary
router.get("/status-summary", protect, async (req: any, res) => {
  const userId = req.user.id;
  const { startDate, endDate } = req.query;

  const dateFilter =
    startDate && endDate
      ? {
          createdAt: {
            gte: new Date(startDate as string),
            lte: new Date(endDate as string),
          },
        }
      : {};

  const [paid, pending, overdue] = await Promise.all([
    prisma.invoice.count({ where: { userId, status: "paid", ...dateFilter } }),
    prisma.invoice.count({
      where: { userId, status: "pending", ...dateFilter },
    }),
    prisma.invoice.count({
      where: { userId, status: "overdue", ...dateFilter },
    }),
  ]);

  res.json({ paid, pending, overdue });
});

export default router;
