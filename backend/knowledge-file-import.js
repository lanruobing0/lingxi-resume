import path from "node:path";
import { Worker } from "node:worker_threads";

export const knowledgeUploadLimit = 6 * 1024 * 1024;
export const knowledgeTextLimit = 300000;
const extensions = new Set([".txt", ".md", ".pdf", ".docx"]);
let activeExtractions = 0;

export function importError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

export function validateUploadName(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 200 || /[\x00-\x1f/\\]/.test(value)) {
    throw importError(400, "UPLOAD_NAME_INVALID", "文件名无效，请使用不超过 200 字的文件名");
  }
  if (!extensions.has(path.extname(value).toLowerCase())) {
    throw importError(415, "UPLOAD_FORMAT_UNSUPPORTED", "支持 PDF、DOCX、TXT 和 Markdown；暂不支持 DOC 或图片");
  }
  return value.trim();
}

export async function readKnowledgeUpload(req) {
  if (!String(req.headers["content-type"] || "").startsWith("application/octet-stream")) {
    throw importError(415, "UPLOAD_CONTENT_TYPE", "请使用文件上传入口");
  }
  let fileName;
  try { fileName = decodeURIComponent(req.headers["x-file-name"] || ""); }
  catch { throw importError(400, "UPLOAD_NAME_INVALID", "文件名编码无效"); }
  fileName = validateUploadName(fileName);
  if (Number(req.headers["content-length"]) > knowledgeUploadLimit) throw importError(413, "UPLOAD_TOO_LARGE", "文件不能超过 6 MB");
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > knowledgeUploadLimit) throw importError(413, "UPLOAD_TOO_LARGE", "文件不能超过 6 MB");
    chunks.push(chunk);
  }
  if (!size) throw importError(400, "UPLOAD_EMPTY", "文件为空，请选择包含文字的资料");
  return { fileName, buffer: Buffer.concat(chunks) };
}

// Binary parsing is bounded and isolated from the HTTP event loop. Files are
// never written to disk or passed to a model. Only plain text is returned.
export async function extractKnowledgeFile({ fileName, buffer }, { timeoutMs = 20000 } = {}) {
  validateUploadName(fileName);
  if (!buffer.length) throw importError(400, "UPLOAD_EMPTY", "文件为空");
  if (buffer.length > knowledgeUploadLimit) throw importError(413, "UPLOAD_TOO_LARGE", "文件不能超过 6 MB");
  if (activeExtractions >= 2) throw importError(429, "UPLOAD_BUSY", "正在提取其他资料，请稍后重试");
  activeExtractions += 1;
  try {
    return await new Promise((resolve, reject) => {
      const worker = new Worker(new URL("./knowledge-file-worker.js", import.meta.url), {
        workerData: { fileName, bytes: buffer },
        execArgv: process.execArgv.filter((argument) => !argument.startsWith("--input-type")),
        resourceLimits: { maxOldGenerationSizeMb: 128 },
      });
      let settled = false;
      const finish = (error, result) => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        worker.terminate().catch(() => {});
        if (error) reject(error); else resolve({ ...result, fileName, fileSize: buffer.length });
      };
      const timer = setTimeout(() => finish(importError(422, "UPLOAD_TIMEOUT", "文件提取超时，请拆分资料后重新上传")), timeoutMs);
      worker.once("message", ({ result, error }) => finish(error ? importError(error.status || 422, error.code, error.message) : null, result));
      worker.once("error", () => finish(importError(422, "UPLOAD_PARSE_FAILED", "文件无法读取，请重新导出后上传")));
      worker.once("exit", () => { if (!settled) finish(importError(422, "UPLOAD_PARSE_FAILED", "文件提取中断，请重新导出后上传")); });
    });
  } finally { activeExtractions -= 1; }
}
