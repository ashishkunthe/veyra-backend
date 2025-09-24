import nodemailer from "nodemailer";

export const sendInvoiceEmail = async (
  clientEmail: string,
  subject: string,
  text: string,
  pdfPath: string
) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `"SaaS Invoice Tool" <${process.env.SMTP_USER}>`,
    to: clientEmail,
    subject,
    text,
    attachments: [
      {
        filename: "invoice.pdf",
        path: pdfPath,
      },
    ],
  });
};
