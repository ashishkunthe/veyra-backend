import Agenda from "agenda";
import prisma from "../config/prisma";
import { generateInvoicePDF } from "../services/pdfServices";
import { sendInvoiceEmail } from "../services/emailServices";

const agenda = new Agenda({ db: { address: process.env.MONGO_URL! } });

// 🧾 Define job: generate recurring invoices
agenda.define("generate recurring invoices", async () => {
  const recurringInvoices = await prisma.invoice.findMany({
    where: { isRecurring: true },
  });

  const now = new Date();

  for (const invoice of recurringInvoices) {
    let shouldGenerate = false;

    if (invoice.recurrenceInterval === "monthly") {
      const nextDate = new Date(invoice.createdAt);
      nextDate.setMonth(nextDate.getMonth() + 1);
      shouldGenerate = now >= nextDate;
    } else if (invoice.recurrenceInterval === "weekly") {
      const nextDate = new Date(invoice.createdAt);
      nextDate.setDate(nextDate.getDate() + 7);
      shouldGenerate = now >= nextDate;
    } else if (invoice.recurrenceInterval === "yearly") {
      const nextDate = new Date(invoice.createdAt);
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      shouldGenerate = now >= nextDate;
    }

    if (shouldGenerate) {
      const newInvoice = await prisma.invoice.create({
        data: {
          userId: invoice.userId,
          companyId: invoice.companyId,
          clientId: invoice.clientId,
          clientName: invoice.clientName,
          clientEmail: invoice.clientEmail, //@ts-ignore
          items: invoice.items,
          tax: invoice.tax,
          total: invoice.total,
          dueDate: new Date(now.setDate(now.getDate() + 7)), // example: due in 7 days
          status: "pending",
          isRecurring: true,
          recurrenceInterval: invoice.recurrenceInterval,
        },
      });

      const pdfUrl = await generateInvoicePDF(newInvoice.id, {
        clientName: newInvoice.clientName,
        clientEmail: newInvoice.clientEmail,
        companyName: "Your Company",
        total: newInvoice.total,
        // @ts-ignore
        items: newInvoice.items,
        dueDate: newInvoice.dueDate,
        tax: newInvoice.tax,
      });

      await prisma.invoice.update({
        where: { id: newInvoice.id },
        data: { pdfUrl },
      });

      await sendInvoiceEmail(
        newInvoice.clientEmail,
        "Your Recurring Invoice",
        "Please find your recurring invoice attached.",
        pdfUrl
      );

      console.log(`📬 Recurring invoice generated: ${newInvoice.id}`);
    }
  }
});

// 🔁 Start agenda
(async () => {
  await agenda.start();
  await agenda.every("1 day", "generate recurring invoices");
})();

export default agenda;
