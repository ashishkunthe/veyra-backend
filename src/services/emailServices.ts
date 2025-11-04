import { Resend } from "resend";
import axios from "axios";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendInvoiceEmail = async (
  clientEmail: string,
  subject: string,
  text: string,
  pdfUrl: string // this is the Supabase public URL
) => {
  // Download the PDF from Supabase
  const response = await axios.get(pdfUrl, { responseType: "arraybuffer" });
  const pdfBuffer = Buffer.from(response.data);

  // Send email via Resend
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
