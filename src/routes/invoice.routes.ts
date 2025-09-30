import { Router } from "express";
import prisma from "../config/prisma";
import { protect } from "../middlewares/auth";
import { generateInvoicePDF } from "../services/pdfServices";
import { sendInvoiceEmail } from "../services/emailServices";

const router = Router();

// create invoice
router.post("/", protect, async (req: any, res) => {
  try {
    const {
      companyId,
      clientId,
      clientName,
      clientEmail,
      items,
      tax,
      total,
      dueDate,
      isRecurring,
      recurrenceInterval,
    } = req.body;

    // 🧠 Handle free plan limit check (5 invoices)
    const sub = await prisma.subscription.findFirst({
      where: { userId: req.user.id, status: "active" },
    });

    if (!sub) {
      const invoiceCount = await prisma.invoice.count({
        where: { userId: req.user.id },
      });

      if (invoiceCount >= 5) {
        return res.status(403).json({
          message: "Invoice limit reached. Upgrade your plan to continue.",
        });
      }
    }

    let finalClientName = clientName;
    let finalClientEmail = clientEmail;

    // 🧩 If clientId is provided → fetch client info automatically
    if (clientId) {
      const client = await prisma.client.findFirst({
        where: { id: clientId, userId: req.user.id },
      });
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      finalClientName = client.name;
      finalClientEmail = client.email;
    }

    // 🧾 Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        userId: req.user.id,
        companyId,
        clientId: clientId || null,
        clientName: finalClientName,
        clientEmail: finalClientEmail,
        items,
        tax,
        total,
        dueDate: new Date(dueDate),
        status: "pending",
        isRecurring: isRecurring || false,
        recurrenceInterval: recurrenceInterval || null,
      },
    });

    // 📄 Generate and upload PDF
    const pdfUrl = await generateInvoicePDF(invoice.id, {
      clientName: finalClientName,
      clientEmail: finalClientEmail,
      companyName: "Your Company",
      total,
      items,
      dueDate: invoice.dueDate,
      tax,
    });

    // 📌 Save PDF URL
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { pdfUrl },
    });

    res.status(201).json({ message: "Invoice created successfully", invoice });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
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
  // 🧾 Fetch the invoice first
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
  });

  if (!invoice || invoice.userId !== req.user.id) {
    return res.status(404).json({ message: "Invoice not found" });
  }

  // 🏢 Fetch the company name using companyId from invoice
  const company = await prisma.company.findUnique({
    where: { id: invoice.companyId },
  });

  if (!company) {
    return res.status(404).json({ message: "Company not found" });
  }

  // 🧾 Generate PDF with real company name
  const pdfUrl = await generateInvoicePDF(invoice.id, {
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    companyName: company.name,
    total: invoice.total,
    // @ts-ignore
    items: invoice.items,
    dueDate: invoice.dueDate,
    tax: invoice.tax,
  });

  // 💾 Save the new PDF URL back to DB
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

  const company = await prisma.company.findUnique({
    where: { id: invoice.companyId },
  });

  if (!company) {
    return res.status(404).json({ message: "Company not found" });
  }

  const pdfPath = await generateInvoicePDF(invoice.id, {
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    companyName: company.name,
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
