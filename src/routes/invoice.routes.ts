import { Router } from "express";
import prisma from "../config/prisma";
import { protect } from "../middlewares/auth";
import { generateInvoicePDF } from "../services/pdfServices";
import { sendInvoiceEmail } from "../services/emailServices";

const router = Router();

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
      paymentDetails,
    } = req.body;

    // 🔐 Check active subscription
    const sub = await prisma.subscription.findFirst({
      where: { userId: req.user.id, status: "active" },
    });

    if (!sub) {
      // Free plan → 5 total invoices limit
      const invoiceCount = await prisma.invoice.count({
        where: { userId: req.user.id },
      });

      if (invoiceCount >= 5) {
        return res.status(403).json({
          message: "Free plan limit reached (5 invoices). Upgrade to continue.",
        });
      }
    } else {
      // Starter / Pro plan monthly limits
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const monthlyCount = await prisma.invoice.count({
        where: {
          userId: req.user.id,
          createdAt: { gte: monthStart },
        },
      });

      if (sub.planName === "starter" && monthlyCount >= 50) {
        return res.status(403).json({
          message:
            "Starter plan limit reached (50 invoices/month). Upgrade to Pro for higher limits.",
        });
      }

      if (sub.planName === "pro" && monthlyCount >= 100) {
        return res.status(403).json({
          message: "Pro plan limit reached (100 invoices/month).",
        });
      }
    }

    // Resolve client info if clientId provided
    let finalClientName = clientName;
    let finalClientEmail = clientEmail;
    if (clientId) {
      const client = await prisma.client.findFirst({
        where: { id: clientId, userId: req.user.id },
      });
      if (!client) return res.status(404).json({ message: "Client not found" });
      finalClientName = client.name;
      finalClientEmail = client.email;
    }

    // Ensure company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) return res.status(404).json({ message: "Company not found" });

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
        paymentDetails: paymentDetails || null,
      },
    });

    // 🧾 Generate and upload PDF
    const pdfUrl = await generateInvoicePDF(invoice.id, {
      clientName: finalClientName,
      clientEmail: finalClientEmail,
      companyName: company.name,
      companyAddress: company.address || "",
      // @ts-ignore
      companyLogo: company.logoUrl,
      // @ts-ignore
      companyTaxInfo: company.taxInfo,
      tax: tax || 0,
      total,
      items,
      dueDate: invoice.dueDate,
      paymentDetails: paymentDetails || "",
    });

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { pdfUrl },
    });

    res.status(201).json({ message: "Invoice created successfully", invoice });
  } catch (error: any) {
    console.error("Create invoice error:", error);
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
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
  });

  if (!invoice || invoice.userId !== req.user.id) {
    return res.status(404).json({ message: "Invoice not found" });
  }

  const company = await prisma.company.findUnique({
    where: { id: invoice.companyId },
  });

  if (!company) {
    return res.status(404).json({ message: "Company not found" });
  }

  // 🧾 Generate PDF with full data (including payment details)
  const pdfUrl = await generateInvoicePDF(invoice.id, {
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    companyName: company.name,
    companyAddress: company.address || "",
    // @ts-ignore
    companyLogo: company.logoUrl,
    // @ts-ignore
    companyTaxInfo: company.taxInfo,
    tax: invoice.tax,
    total: invoice.total,
    // @ts-ignore
    items: invoice.items,
    dueDate: invoice.dueDate,
    paymentDetails: invoice.paymentDetails || "", // 👈 fixed line
  });

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

  // 🧾 Generate PDF with payment details for email
  const pdfPath = await generateInvoicePDF(invoice.id, {
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    companyName: company.name,
    companyAddress: company.address || "",
    // @ts-ignore
    companyLogo: company.logoUrl,
    // @ts-ignore
    companyTaxInfo: company.taxInfo,
    tax: invoice.tax,
    total: invoice.total,
    // @ts-ignore
    items: invoice.items,
    dueDate: invoice.dueDate,
    paymentDetails: invoice.paymentDetails || "", // 👈 include this here too
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
