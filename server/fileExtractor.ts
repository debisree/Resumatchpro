import mammoth from "mammoth";
import Tesseract from "tesseract.js";

let pdfParse: any = null;

async function getPdfParse() {
  if (!pdfParse) {
    pdfParse = (await import("pdf-parse")).default;
  }
  return pdfParse;
}

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const parse = await getPdfParse();
    const data = await parse(buffer);
    const text = data.text?.trim() || "";
    if (!text) {
      throw new Error("PDF appears to be empty or contains no extractable text");
    }
    return text;
  } catch (error: any) {
    console.error("PDF extraction error:", error);
    if (error.message?.includes("no extractable text")) {
      throw error;
    }
    throw new Error(`Failed to extract text from PDF: ${error.message || "Unknown error"}`);
  }
}

export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value?.trim() || "";
    if (!text) {
      throw new Error("DOCX appears to be empty or contains no extractable text");
    }
    return text;
  } catch (error: any) {
    console.error("DOCX extraction error:", error);
    if (error.message?.includes("no extractable text")) {
      throw error;
    }
    throw new Error(`Failed to extract text from DOCX: ${error.message || "Unknown error"}`);
  }
}

export async function extractTextFromImage(buffer: Buffer): Promise<string> {
  try {
    const { data } = await Tesseract.recognize(buffer, "eng", {
      logger: () => {},
    });
    const text = data.text?.trim() || "";
    if (!text) {
      throw new Error("Image appears to contain no readable text");
    }
    return text;
  } catch (error: any) {
    console.error("OCR extraction error:", error);
    if (error.message?.includes("no readable text")) {
      throw error;
    }
    throw new Error(`Failed to extract text from image using OCR: ${error.message || "Unknown error"}`);
  }
}

export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "application/pdf") {
    return extractTextFromPDF(buffer);
  } else if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    return extractTextFromDOCX(buffer);
  } else if (mimeType.startsWith("image/")) {
    return extractTextFromImage(buffer);
  } else {
    throw new Error("Unsupported file type");
  }
}
