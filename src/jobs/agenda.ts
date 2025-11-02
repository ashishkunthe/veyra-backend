import Agenda from "agenda";
import prisma from "../config/prisma";
import { generateInvoicePDF } from "../services/pdfServices";
import { sendInvoiceEmail } from "../services/emailServices";

const agenda = new Agenda({ db: { address: process.env.MONGO_URL! } });

// 🧾 Define job: generate recurring invoices
agenda.define("generate recurring invoices", async () => {
  const recurringInvoices = await prisma.invoice.findMany({
    where: { isRecurring: true },
    include: {
      company: true,
      user: true,
      client: true,
    },
  });

  const now = new Date();

  for (const invoice of recurringInvoices) {
    let shouldGenerate = false;

    const lastGenerated = new Date(invoice.createdAt);
    let nextDate = new Date(lastGenerated);

    if (invoice.recurrenceInterval === "monthly") {
      nextDate.setMonth(lastGenerated.getMonth() + 1);
    } else if (invoice.recurrenceInterval === "weekly") {
      nextDate.setDate(lastGenerated.getDate() + 7);
    } else if (invoice.recurrenceInterval === "yearly") {
      nextDate.setFullYear(lastGenerated.getFullYear() + 1);
    }

    if (now >= nextDate) {
      shouldGenerate = true;
    }

    if (!shouldGenerate) continue;

    // 🧩 Create a new invoice based on the recurring one
    const newInvoice = await prisma.invoice.create({
      data: {
        userId: invoice.userId,
        companyId: invoice.companyId,
        clientId: invoice.clientId,
        clientName: invoice.clientName,
        clientEmail: invoice.clientEmail,
        items: invoice.items as any,
        tax: invoice.tax,
        total: invoice.total,
        dueDate: new Date(now.setDate(now.getDate() + 7)), // due in 7 days
        status: "pending",
        isRecurring: true,
        recurrenceInterval: invoice.recurrenceInterval,
        paymentDetails: invoice.paymentDetails,
      },
    });

    // 🧾 Generate new PDF dynamically from company data
    const pdfUrl = await generateInvoicePDF(newInvoice.id, {
      clientName: newInvoice.clientName,
      clientEmail: newInvoice.clientEmail,
      companyName: invoice.company?.name || "Unknown Company",
      companyAddress: invoice.company?.address || "",
      companyTaxInfo: invoice.company?.taxInfo || "",
      tax: newInvoice.tax,
      total: newInvoice.total,
      items: newInvoice.items as any,
      dueDate: newInvoice.dueDate,
      paymentDetails: newInvoice.paymentDetails || "",
    });

    // 🔗 Update invoice with PDF URL
    await prisma.invoice.update({
      where: { id: newInvoice.id },
      data: { pdfUrl },
    });

    // ✉️ Send email automatically
    await sendInvoiceEmail(
      newInvoice.clientEmail,
      "Your Recurring Invoice",
      "Please find your new recurring invoice attached.",
      pdfUrl
    );

    console.log(`📬 Recurring invoice generated & sent: ${newInvoice.id}`);
  }
});

// 🔁 Start agenda
(async () => {
  await agenda.start();
  await agenda.every("1 day", "generate recurring invoices");
})();

export default agenda;
