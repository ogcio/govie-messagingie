import { describe, expect, it } from "vitest";
import { generateMarkerPdfs } from "../../../scripts/reproduce-export-leak/pdf/generate-pdfs.js";

describe("generateMarkerPdfs", () => {
  it("builds the two distinct marker PDFs", async () => {
    const { pdfA, pdfB } = await generateMarkerPdfs();

    expect(pdfA.fileName).toBe("belongs-to-user1.pdf");
    expect(pdfA.body).toBe("belongs to user1");
    expect(pdfB.fileName).toBe("belongs-to-user2.pdf");
    expect(pdfB.body).toBe("belongs to user2");

    for (const pdf of [pdfA, pdfB]) {
      expect(pdf.file.type).toBe("application/pdf");
      expect(pdf.file.name).toBe(pdf.fileName);
      const bytes = Buffer.from(await pdf.file.arrayBuffer());
      expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    }
  });
});
