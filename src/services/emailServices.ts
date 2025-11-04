import { Resend } from "resend";
import fs from "fs";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendInvoiceEmail = async (
  clientEmail: string,
  subject: string,
  text: string,
  pdfPath: string
) => {
  // Load PDF as a buffer
  const pdfBuffer = fs.readFileSync(pdfPath);

  await resend.emails.send({
    from: "SaaS Invoice Tool <onboarding@resend.dev>",
    to: clientEmail,
    subject,
    text,
    attachments: [
      {
        filename: "invoice.pdf",
        content: pdfBuffer,
      },
    ],
  });
};
