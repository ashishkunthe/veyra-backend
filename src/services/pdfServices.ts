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
  tax?: number;
  total: number;
  items: InvoiceItem[];
  dueDate: Date;
}

export const generateInvoicePDF = async (
  invoiceId: string,
  data: InvoicePDFProps
): Promise<string> => {
  const doc = new PDFDocument();
  const writableStream = new streamBuffers.WritableStreamBuffer();

  doc.pipe(writableStream);

  doc.fontSize(20).text("Invoice", { align: "center" }).moveDown();
  doc.fontSize(14).text(`Invoice ID: ${invoiceId}`);
  doc.text(`Client: ${data.clientName} (${data.clientEmail})`);
  doc.text(`Company: ${data.companyName}`);
  if (data.companyAddress) doc.text(`Address: ${data.companyAddress}`);
  doc.text(`Due Date: ${data.dueDate.toDateString()}`);
  doc.moveDown();

  doc.text("Items:");
  data.items.forEach((item, idx) => {
    doc.text(`${idx + 1}. ${item.description} - ${item.qty} x $${item.price}`);
  });

  doc.moveDown();
  if (data.tax) doc.text(`Tax: $${data.tax}`);
  doc.fontSize(16).text(`Total: $${data.total}`, { align: "right" });

  doc.end();

  // Wait for the PDF to be fully written
  await new Promise((resolve) => writableStream.on("finish", resolve));
  const pdfBuffer = writableStream.getContents();

  // Upload PDF to Supabase
  const { data: uploadData, error } = await supabase.storage
    .from(process.env.SUPABASE_BUCKET as string) //@ts-ignore
    .upload(`invoices/${invoiceId}.pdf`, pdfBuffer!, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) {
    console.error("Upload error:", error.message);
    throw new Error("Failed to upload PDF");
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from(process.env.SUPABASE_BUCKET as string)
    .getPublicUrl(`invoices/${invoiceId}.pdf`);

  return publicUrlData.publicUrl;
};
