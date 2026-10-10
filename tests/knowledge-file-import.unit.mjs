import assert from "node:assert/strict";
import { extractKnowledgeFile, knowledgeUploadLimit, validateUploadName } from "../backend/knowledge-file-import.js";
import { docxFixture, pdfFixture } from "./helpers/material-files.mjs";

const text = "说明项目背景、个人职责、技术决策与可验证的实际结果。";
for (const [fileName, buffer] of [["资料.txt", Buffer.from(text)], ["资料.MD", Buffer.from(`# 面试资料\n\n${text}`)], ["资料.docx", docxFixture(text)], ["资料.pdf", pdfFixture()]]) {
  const result = await extractKnowledgeFile({ fileName, buffer });
  assert.ok(result.rawText.includes(fileName.endsWith(".pdf") ? "explain decisions" : text));
  assert.equal(result.characterCount, result.rawText.length);
  assert.equal(result.fileSize, buffer.length);
  assert.equal(result.fileName, fileName);
}
assert.equal((await extractKnowledgeFile({ fileName: "utf16.txt", buffer: Buffer.concat([Buffer.from([255, 254]), Buffer.from(text, "utf16le")]) })).rawText, text);
for (const name of ["../bad.md", "C:\\bad.docx", "bad.exe", "bad.doc", "", "bad\0.txt"]) assert.throws(() => validateUploadName(name));
for (const [fileName, buffer, code] of [
  ["empty.txt", Buffer.alloc(0), "UPLOAD_EMPTY"],
  ["blank.md", Buffer.from(" \n "), "UPLOAD_NO_TEXT"],
  ["binary.txt", Buffer.from([0, 255, 0]), "UPLOAD_ENCODING"],
  ["fake.pdf", Buffer.from("This is not PDF"), "UPLOAD_PARSE_FAILED"],
  ["scan.pdf", pdfFixture(""), "UPLOAD_NO_TEXT"],
  ["fake.docx", Buffer.from("This is not ZIP"), "UPLOAD_PARSE_FAILED"],
  ["long.md", Buffer.from("a".repeat(300001)), "UPLOAD_TEXT_LIMIT"],
  ["large.txt", Buffer.alloc(knowledgeUploadLimit + 1), "UPLOAD_TOO_LARGE"],
]) await assert.rejects(() => extractKnowledgeFile({ fileName, buffer }), (error) => error.code === code, fileName);
const bomb = docxFixture(); const centralOffset = bomb.readUInt32LE(bomb.length - 6); bomb.writeUInt32LE(25 * 1024 * 1024, centralOffset + 24);
await assert.rejects(() => extractKnowledgeFile({ fileName: "bomb.docx", buffer: bomb }), (error) => error.code === "UPLOAD_ARCHIVE_LIMIT");
await assert.rejects(() => extractKnowledgeFile({ fileName: "timeout.txt", buffer: Buffer.from(text) }, { timeoutMs: 1 }), (error) => error.code === "UPLOAD_TIMEOUT");
assert.equal((await extractKnowledgeFile({ fileName: "after-timeout.txt", buffer: Buffer.from(text) })).rawText, text);
console.log("Knowledge file import passed: real PDF/DOCX/text extraction, UTF encodings, no-text/corrupt/binary/oversize/archive boundaries, timeout recovery.");
