import { parentPort, workerData } from "node:worker_threads";
import path from "node:path";

const textLimit = 300000;
const failure = (code, message) => Object.assign(new Error(message), { status: 422, code });

// Check the ZIP directory before DOCX inflation. Reject ZIP64, encryption and
// oversized archives, including tiny compressed files with huge XML entries.
function validateDocxZip(buffer) {
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw failure("UPLOAD_PARSE_FAILED", "DOCX 文件已损坏，请重新导出");
  const count = buffer.readUInt16LE(end + 10);
  const offset = buffer.readUInt32LE(end + 16);
  if (count === 65535 || count > 2000 || offset === 0xffffffff) throw failure("UPLOAD_ARCHIVE_LIMIT", "DOCX 内部内容过多，请拆分文件");
  let cursor = offset; let inflated = 0; const names = new Set();
  for (let i = 0; i < count; i += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) throw failure("UPLOAD_PARSE_FAILED", "DOCX 文件目录无效");
    if (buffer.readUInt16LE(cursor + 8) & 1) throw failure("UPLOAD_ENCRYPTED", "暂不支持加密文件，请先解除密码保护");
    inflated += buffer.readUInt32LE(cursor + 24);
    if (inflated > 24 * 1024 * 1024) throw failure("UPLOAD_ARCHIVE_LIMIT", "DOCX 解压后内容过大，请拆分文件");
    const size = buffer.readUInt16LE(cursor + 28);
    const next = cursor + 46 + size + buffer.readUInt16LE(cursor + 30) + buffer.readUInt16LE(cursor + 32);
    if (next > end) throw failure("UPLOAD_PARSE_FAILED", "DOCX 文件目录无效");
    names.add(buffer.subarray(cursor + 46, cursor + 46 + size).toString("utf8"));
    cursor = next;
  }
  if (!names.has("word/document.xml") || !names.has("[Content_Types].xml")) throw failure("UPLOAD_PARSE_FAILED", "文件不是有效的 DOCX 文档");
}

async function extract() {
  const buffer = Buffer.from(workerData.bytes);
  const extension = path.extname(workerData.fileName).toLowerCase();
  let rawText = ""; const warnings = [];
  if ([".txt", ".md"].includes(extension)) {
    try {
      let encoding = "utf-8";
      if (buffer[0] === 0xff && buffer[1] === 0xfe) encoding = "utf-16le";
      if (buffer[0] === 0xfe && buffer[1] === 0xff) encoding = "utf-16be";
      rawText = new TextDecoder(encoding, { fatal: true }).decode(buffer);
      if (rawText.includes("\0")) throw new Error("binary");
    } catch { throw failure("UPLOAD_ENCODING", "文本编码无法读取，请另存为 UTF-8 后上传"); }
  } else if (extension === ".docx") {
    validateDocxZip(buffer);
    const mammoth = (await import("mammoth")).default;
    const result = await mammoth.extractRawText({ buffer }, { externalFileAccess: false });
    rawText = result.value;
    if (result.messages.length) warnings.push("部分格式无法提取，请核对下方正文；图片不会导入。");
  } else {
    if (!buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"))) throw failure("UPLOAD_PARSE_FAILED", "文件不是有效的 PDF");
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true, useWorkerFetch: false, verbosity: 0 });
    let pdf;
    try {
      pdf = await task.promise;
      if (pdf.numPages > 200) throw failure("UPLOAD_PAGE_LIMIT", "PDF 不能超过 200 页，请拆分后上传");
      let emptyPages = 0;
      for (let i = 1; i <= pdf.numPages; i += 1) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const text = content.items.map((item) => `${item.str || ""}${item.hasEOL ? "\n" : " "}`).join("").trim();
        if (!text) emptyPages += 1;
        rawText += `${text}\n\n`;
        page.cleanup();
        if (rawText.length > textLimit) throw failure("UPLOAD_TEXT_LIMIT", "提取内容不能超过 30 万字，请拆分资料");
      }
      if (emptyPages) warnings.push(`${emptyPages} 页未提取到文字，图片或扫描内容不会导入。`);
    } catch (error) {
      if (error.name === "PasswordException") throw failure("UPLOAD_ENCRYPTED", "暂不支持加密 PDF，请先解除密码保护");
      throw error;
    } finally { await task.destroy(); }
  }
  rawText = rawText.replace(/^\uFEFF/, "").trim();
  if (!rawText) throw failure("UPLOAD_NO_TEXT", "未提取到文字；扫描版 PDF 和图片暂不支持，请上传文字版资料");
  if (rawText.length > textLimit) throw failure("UPLOAD_TEXT_LIMIT", "提取内容不能超过 30 万字，请拆分资料");
  return { rawText, characterCount: rawText.length, warnings };
}

extract().then((result) => parentPort.postMessage({ result })).catch((error) => parentPort.postMessage({ error: {
  status: error.status || 422, code: error.code || "UPLOAD_PARSE_FAILED",
  message: error.code ? error.message : "文件无法提取，请重新导出为 PDF、DOCX 或 UTF-8 文本",
} }));
