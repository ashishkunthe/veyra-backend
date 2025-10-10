import PDFDocument from "pdfkit";
import { supabase } from "../config/supabase";
import streamBuffers from "stream-buffers";

interface InvoiceItem {
  description: string;
  qty: number;
  price: number;
}

interface InvoicePDFProps {
  clientName: string;
  clientEmail: string;
  companyName: string;
  companyAddress?: string;
  companyLogo?: string;
  companyTaxInfo?: string;
  tax?: number;
  total: number;
  items: InvoiceItem[];
  dueDate: Date;
  paymentDetails?: string;
}

export const generateInvoicePDF = async (
  invoiceId: string,
  data: InvoicePDFProps
): Promise<string> => {
  const doc = new PDFDocument({ margin: 50 });
  const writableStream = new streamBuffers.WritableStreamBuffer();
  doc.pipe(writableStream);

  const currency = (val: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);

  // ---- Header ----
  doc
    .fontSize(22)
    .text("INVOICE", { align: "center" })
    .moveDown(0.5)
    .fontSize(12)
    .text(`Invoice ID: ${invoiceId}`)
    .text(`Date: ${new Date().toLocaleDateString()}`)
    .text(`Due Date: ${new Date(data.dueDate).toLocaleDateString()}`)
    .moveDown();

  // ---- Company Info ----
  doc.fontSize(14).text(data.companyName, { underline: true }).moveDown(0.3);
  if (data.companyAddress) doc.text(`Address: ${data.companyAddress}`);
  if (data.companyTaxInfo) doc.text(`GST: ${data.companyTaxInfo}`);
  doc.moveDown(1);

  // ---- Client Info ----
  doc.fontSize(14).text("Bill To:", { underline: true }).moveDown(0.3);
  doc.fontSize(12).text(`Name: ${data.clientName}`);
  doc.text(`Email: ${data.clientEmail}`);
  doc.moveDown(1);

  // ---- Items ----
  doc.fontSize(14).text("Items:", { underline: true }).moveDown(0.3);
  let subtotal = 0;
  if (!Array.isArray(data.items) || data.items.length === 0) {
    doc.fontSize(12).text("No items listed.");
  } else {
    data.items.forEach((item, i) => {
      const amount = item.qty * item.price;
      subtotal += amount;
      doc
        .fontSize(12)
        .text(
          `${i + 1}. ${item.description} — Qty: ${item.qty} × ₹${
            item.price
          } = ${currency(amount)}`
        );
    });
  }

  doc.moveDown(1);

  // ---- Totals ----
  const taxAmount = subtotal * ((data.tax || 0) / 100);
  const grandTotal = subtotal + taxAmount;

  doc
    .fontSize(12)
    .text(`Subtotal: ${currency(subtotal)}`)
    .text(`Tax (${data.tax || 0}%): ${currency(taxAmount)}`)
    .moveDown(0.3)
    .fontSize(14)
    .text(`Total: ${currency(grandTotal)}`, { underline: true })
    .moveDown(1.5);

  // ---- Payment Details ----
  if (data.paymentDetails && data.paymentDetails.trim().length > 0) {
    // ensure visible on page
    if (doc.y > doc.page.height - 120) doc.addPage();
    doc
      .fontSize(14)
      .text("💳 Payment Details", { underline: true })
      .moveDown(0.4)
      .fontSize(12)
      .text(data.paymentDetails, {
        width: 480,
        align: "left",
      })
      .moveDown(1);
  }

  // ---- Footer ----
  if (doc.y > doc.page.height - 100) doc.addPage();
  doc
    .fontSize(10)
    .text("Thank you for your business!", { align: "center" })
    .text(`${data.companyName} © ${new Date().getFullYear()}`, {
      align: "center",
    });

  // Finalize
  doc.end();
  await new Promise((resolve) => writableStream.on("finish", resolve));
  const pdfBuffer = writableStream.getContents();
  if (!pdfBuffer) throw new Error("Failed to generate PDF buffer");

  // Upload to Supabase
  const bucket = process.env.SUPABASE_BUCKET as string;
  const filePath = `invoices/${invoiceId}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) throw new Error("Failed to upload PDF");

  const { data: publicUrlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
};
