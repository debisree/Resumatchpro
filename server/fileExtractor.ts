import mammoth from "mammoth";
import Tesseract from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const uint8Array = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdf = await loadingTask.promise;
    
    let fullText = "";
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(" ");
      fullText += pageText + "\n";
    }
    
    const text = fullText.trim();
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
  } else if (mimeType === "text/plain") {
    return buffer.toString("utf-8");
  } else {
    throw new Error("Unsupported file type");
  }
}
