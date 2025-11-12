import mammoth from "mammoth";
import Tesseract from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    if (buffer.length < 100) {
      throw new Error("File is too small to be a valid PDF");
    }

    const header = buffer.slice(0, 5).toString('utf-8');
    if (!header.startsWith('%PDF-')) {
      throw new Error("File is not a valid PDF format. Please upload a real PDF file, not a text file with a .pdf extension.");
    }

    const uint8Array = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({ 
      data: uint8Array,
      verbosity: 0
    });
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
      throw new Error("PDF appears to be empty or contains no extractable text. If your resume is image-based, try uploading it as PNG or JPG instead.");
    }
    return text;
  } catch (error: any) {
    console.error("PDF extraction error:", error);
    
    if (error.message?.includes("not a valid PDF format")) {
      throw error;
    }
    if (error.message?.includes("no extractable text")) {
      throw error;
    }
    if (error.message?.includes("too small")) {
      throw error;
    }
    
    if (error.message?.toLowerCase().includes("invalid") || 
        error.message?.toLowerCase().includes("corrupt") ||
        error.message?.toLowerCase().includes("password") ||
        error.message?.toLowerCase().includes("encrypted")) {
      throw new Error("Unable to read PDF file. The file may be corrupted, password-protected, or in an unsupported format. Please try: (1) saving a new copy of your PDF, or (2) uploading as an image (PNG/JPG).");
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
