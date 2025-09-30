import { Router } from "express";

import { protect } from "../middlewares/auth";
import prisma from "../config/prisma";

const router = Router();

// 📥 Create Client
router.post("/", protect, async (req: any, res) => {
  const { name, email, phone, address } = req.body;
  const client = await prisma.client.create({
    data: {
      name,
      email,
      phone,
      address,
      userId: req.user.id,
    },
  });
  res.json(client);
});

// 📚 Get All Clients
router.get("/", protect, async (req: any, res) => {
  const clients = await prisma.client.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
  });
  res.json(clients);
});

// 📄 Get Single Client
router.get("/:id", protect, async (req: any, res) => {
  const client = await prisma.client.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });
  if (!client) return res.status(404).json({ message: "Client not found" });
  res.json(client);
});

// ✏️ Update Client
router.put("/:id", protect, async (req: any, res) => {
  const { name, email, phone, address } = req.body;
  const client = await prisma.client.updateMany({
    where: { id: req.params.id, userId: req.user.id },
    data: { name, email, phone, address },
  });
  res.json({ message: "Client updated", client });
});

// ❌ Delete Client
router.delete("/:id", protect, async (req: any, res) => {
  await prisma.client.deleteMany({
    where: { id: req.params.id, userId: req.user.id },
  });
  res.json({ message: "Client deleted" });
});

export default router;
