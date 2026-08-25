import { PDFDocument, StandardFonts } from "pdf-lib";

export interface GeneratedPdf {
  fileName: string;
  body: string;
  file: File;
}

/**
 * Builds a minimal single-page PDF containing `body` text and wraps it in a
 * `File` with the given `fileName`. Distinct filenames matter: they are how the
 * belongs-to-user1 / belongs-to-user2 entries are told apart in the exported
 * zip during manual verification.
 */
async function buildPdf(fileName: string, body: string): Promise<GeneratedPdf> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(fileName);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.addPage([400, 200]);
  page.drawText(body, { x: 40, y: 120, size: 18, font });

  const bytes = await pdfDoc.save();
  const file = new File([Buffer.from(bytes)], fileName, {
    type: "application/pdf",
  });

  return { fileName, body, file };
}

/**
 * Generates the two marker PDFs used to demonstrate the leak:
 *  - `belongs-to-user1.pdf` ("belongs to user1")
 *  - `belongs-to-user2.pdf` ("belongs to user2")
 */
export async function generateMarkerPdfs(): Promise<{
  pdfA: GeneratedPdf;
  pdfB: GeneratedPdf;
}> {
  const [pdfA, pdfB] = await Promise.all([
    buildPdf("belongs-to-user1.pdf", "belongs to user1"),
    buildPdf("belongs-to-user2.pdf", "belongs to user2"),
  ]);

  return { pdfA, pdfB };
}
