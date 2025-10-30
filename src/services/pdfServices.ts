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
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const writableStream = new streamBuffers.WritableStreamBuffer();
  doc.pipe(writableStream);

  const currency = (val: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);

  // Colors
  const primaryColor = "#F59E0B"; // Blue
  const lightBg = "#F1F5F9";
  const darkText = "#1E293B";
  const grayText = "#64748B";

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;

  // ========== HEADER SECTION ==========
  // Top colored bar
  doc.rect(0, 0, pageWidth, 120).fill(primaryColor);

  // INVOICE title (right side)
  doc
    .fillColor("#FFFFFF")
    .fontSize(36)
    .font("Helvetica-Bold")
    .text("INVOICE", margin, 30, {
      width: contentWidth,
      align: "right",
    });

  // Company Name (left side)
  doc.fontSize(20).font("Helvetica-Bold").text(data.companyName, margin, 35, {
    width: 300,
  });

  // Company details
  doc.fontSize(9).font("Helvetica");
  let headerY = 62;
  if (data.companyAddress) {
    doc.text(data.companyAddress, margin, headerY, { width: 300 });
    headerY += 12;
  }
  if (data.companyTaxInfo) {
    doc.text(`GST: ${data.companyTaxInfo}`, margin, headerY, { width: 300 });
  }

  // Invoice metadata (right side)
  doc.fontSize(9).font("Helvetica");
  const rightX = pageWidth - margin - 180;

  doc.text(`Date: ${new Date().toLocaleDateString("en-IN")}`, rightX, 86, {
    width: 180,
    align: "right",
    lineBreak: false,
  });
  doc.text(
    `Due: ${new Date(data.dueDate).toLocaleDateString("en-IN")}`,
    rightX,
    100,
    {
      width: 180,
      align: "right",
      lineBreak: false,
    }
  );

  let y = 150;

  // ========== BILL TO SECTION ==========
  doc.fillColor(darkText).fontSize(11).font("Helvetica-Bold");
  doc.text("BILL TO", margin, y);

  y += 18;
  doc.fontSize(10).font("Helvetica").fillColor(darkText);
  doc.text(data.clientName, margin, y);
  y += 14;
  doc.fillColor(grayText);
  doc.text(data.clientEmail, margin, y);

  y += 40;

  // ========== ITEMS TABLE ==========
  const tableStart = y;
  const tableX = margin;
  const tableWidth = contentWidth;

  // Column configuration
  const col1X = tableX;
  const col1W = 50; // Qty
  const col2X = col1X + col1W;
  const col2W = 270; // Description
  const col3X = col2X + col2W;
  const col3W = 100; // Unit Price
  const col4X = col3X + col3W;
  const col4W = tableWidth - col1W - col2W - col3W; // Amount

  // Table header
  const headerHeight = 30;
  doc.rect(tableX, y, tableWidth, headerHeight).fill(primaryColor);

  doc.fillColor("#FFFFFF").fontSize(10).font("Helvetica-Bold");
  doc.text("QTY", col1X + 5, y + 10, { width: col1W - 10, align: "center" });
  doc.text("DESCRIPTION", col2X + 10, y + 10, { width: col2W - 20 });
  doc.text("UNIT PRICE", col3X + 5, y + 10, {
    width: col3W - 10,
    align: "right",
  });
  doc.text("AMOUNT", col4X + 5, y + 10, { width: col4W - 10, align: "right" });

  y += headerHeight;

  // Table rows
  let subtotal = 0;
  const rowHeight = 28;

  if (!Array.isArray(data.items) || data.items.length === 0) {
    doc.rect(tableX, y, tableWidth, rowHeight).fill(lightBg);
    doc
      .fillColor(grayText)
      .fontSize(10)
      .font("Helvetica")
      .text("No items listed", col2X + 10, y + 9, { width: col2W - 20 });
    y += rowHeight;
  } else {
    data.items.forEach((item, i) => {
      const amount = item.qty * item.price;
      subtotal += amount;

      // Page break if needed
      if (y > pageHeight - 250) {
        doc.addPage();
        y = 80;
      }

      // Alternating row background
      if (i % 2 === 0) {
        doc.rect(tableX, y, tableWidth, rowHeight).fill(lightBg);
      }

      doc.fillColor(darkText).fontSize(9.5).font("Helvetica");
      const textY = y + 9;

      // Quantity
      doc.text(String(item.qty), col1X + 5, textY, {
        width: col1W - 10,
        align: "center",
      });

      // Description
      doc.text(item.description, col2X + 10, textY, {
        width: col2W - 20,
        ellipsis: true,
        lineBreak: false,
      });

      // Unit Price
      doc.text(currency(item.price), col3X + 5, textY, {
        width: col3W - 10,
        align: "right",
      });

      // Amount
      doc.text(currency(amount), col4X + 5, textY, {
        width: col4W - 10,
        align: "right",
      });

      y += rowHeight;
    });
  }

  // Table bottom border
  doc.strokeColor(primaryColor).lineWidth(2);
  doc
    .moveTo(tableX, y)
    .lineTo(tableX + tableWidth, y)
    .stroke();

  y += 30;

  // ========== TOTALS SECTION ==========
  const totalsX = pageWidth - margin - 220;
  const labelW = 120;
  const valueW = 100;

  doc.fillColor(darkText).fontSize(10).font("Helvetica");

  // Subtotal
  doc.text("Subtotal:", totalsX, y, { width: labelW });
  doc.text(currency(subtotal), totalsX + labelW, y, {
    width: valueW,
    align: "right",
  });

  y += 18;

  // Tax
  const taxAmount = subtotal * ((data.tax || 0) / 100);
  doc.text(`Tax (${data.tax || 0}%):`, totalsX, y, { width: labelW });
  doc.text(currency(taxAmount), totalsX + labelW, y, {
    width: valueW,
    align: "right",
  });

  y += 26;

  // Total (highlighted)
  const grandTotal = subtotal + taxAmount;
  const totalBoxH = 32;
  doc
    .rect(totalsX - 10, y - 5, labelW + valueW + 20, totalBoxH)
    .fill(primaryColor);

  doc.fillColor("#FFFFFF").fontSize(12).font("Helvetica-Bold");
  doc.text("TOTAL DUE", totalsX, y + 5, { width: labelW });
  doc.text(currency(grandTotal), totalsX + labelW, y + 5, {
    width: valueW,
    align: "right",
  });

  y += totalBoxH + 35;

  // ========== PAYMENT DETAILS ==========
  if (data.paymentDetails && data.paymentDetails.trim().length > 0) {
    if (y > pageHeight - 180) {
      doc.addPage();
      y = 80;
    }

    doc.fillColor(primaryColor).fontSize(12).font("Helvetica-Bold");
    doc.text("Payment Details", margin, y);

    y += 18;
    doc.fillColor(darkText).fontSize(9).font("Helvetica");
    doc.text(data.paymentDetails, margin, y, {
      width: contentWidth,
      align: "left",
      lineGap: 2,
    });

    y += 50;
  }

  // ========== FOOTER ==========
  const footerY = pageHeight - 70;

  doc.strokeColor("#E2E8F0").lineWidth(1);
  doc
    .moveTo(margin, footerY)
    .lineTo(pageWidth - margin, footerY)
    .stroke();

  doc.fillColor(grayText).fontSize(9).font("Helvetica");
  doc.text("Thank you for your business!", margin, footerY + 15, {
    width: contentWidth,
    align: "center",
  });
  doc.text(
    `${data.companyName} © ${new Date().getFullYear()}`,
    margin,
    footerY + 28,
    {
      width: contentWidth,
      align: "center",
    }
  );

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
