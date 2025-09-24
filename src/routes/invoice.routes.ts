import { Router } from "express";
import prisma from "../config/prisma";
import { protect } from "../middlewares/auth";
import { generateInvoicePDF } from "../services/pdfServices";
import { sendInvoiceEmail } from "../services/emailServices";

const router = Router();

// Create invoice
router.post("/", protect, async (req: any, res) => {
  try {
    const { companyId, clientName, clientEmail, items, tax, total, dueDate } =
      req.body;

    const invoice = await prisma.invoice.create({
      data: {
        userId: req.user.id,
        companyId,
        clientName,
        clientEmail,
        items,
        tax,
        total,
        status: "unpaid",
        dueDate: new Date(dueDate),
      },
    });

    res.status(201).json(invoice);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all invoices
router.get("/", protect, async (req: any, res) => {
  const invoices = await prisma.invoice.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
  });
  res.json(invoices);
});

// Get single invoice
router.get("/:id", protect, async (req: any, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
  });
  if (!invoice || invoice.userId !== req.user.id)
    return res.status(404).json({ message: "Invoice not found" });

  res.json(invoice);
});

// Update invoice
router.put("/:id", protect, async (req: any, res) => {
  const invoice = await prisma.invoice.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(invoice);
});

// Delete invoice
router.delete("/:id", protect, async (req: any, res) => {
  await prisma.invoice.delete({ where: { id: req.params.id } });
  res.json({ message: "Invoice deleted" });
});

// Generate & download PDF
router.get("/:id/pdf", protect, async (req: any, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
  });
  if (!invoice || invoice.userId !== req.user.id)
    return res.status(404).json({ message: "Invoice not found" });

  const pdfUrl = await generateInvoicePDF(invoice.id, {
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    companyName: "Your Company",
    total: invoice.total,
    // @ts-ignore
    items: invoice.items,
    dueDate: invoice.dueDate,
    tax: invoice.tax,
  });

  // Save the PDF URL to DB
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { pdfUrl },
  });

  res.json({ pdfUrl });
});

// Send invoice via email
router.post("/:id/send", protect, async (req: any, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
  });
  if (!invoice || invoice.userId !== req.user.id)
    return res.status(404).json({ message: "Invoice not found" });

  const pdfPath = await generateInvoicePDF(invoice.id, {
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    companyName: "Your Company",
    total: invoice.total,
    // @ts-ignore
    items: invoice.items,
    dueDate: invoice.dueDate,
    tax: invoice.tax,
  });

  await sendInvoiceEmail(
    invoice.clientEmail,
    "Your Invoice",
    "Please find attached invoice",
    pdfPath
  );
  res.json({ message: "Invoice sent successfully" });
});

export default router;
