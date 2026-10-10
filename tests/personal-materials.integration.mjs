import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { startMockServices } from "./vector-index.integration.mjs";
import { sourceAvailability } from "../backend/citation-validator.js";
import { KnowledgeRetrievalService } from "../backend/knowledge-retrieval-service.js";

const root = path.resolve(import.meta.dirname, "..");
const mocks = await startMockServices();
const dir = await mkdtemp(path.join(tmpdir(), "lingxi-personal-materials-"));
const tokens = [1, 2, 3].map(() => randomBytes(24).toString("hex"));
const users = [{id:1,username:"materials_admin",role:"ADMIN",status:1,passwordHash:"test-only"}, {id:2,username:"user_a",realName:"隐私测试甲",email:"private@example.com",phone:"13800138000",role:"USER",status:1}, {id:3,username:"user_b",role:"USER",status:1}];
await writeFile(path.join(dir,"store.json"), JSON.stringify({users, sessions:tokens.map((token,index)=>({id:index+1,userId:index+1,tokenHash:createHash("sha256").update(token).digest("base64url"),expiresAt:new Date(Date.now()+600000).toISOString()})),knowledgeDocuments:[],knowledgeChunks:[]}));
const probe=createServer(); await new Promise(resolve=>probe.listen(0,"127.0.0.1",resolve)); const port=probe.address().port; await new Promise(resolve=>probe.close(resolve));
let backend;
const start=()=>{ backend=spawn(process.execPath,["backend/server.js"],{cwd:root,env:{...process.env,PORT:String(port),API_PORT:String(port),STORAGE_DRIVER:"json",LINGXI_DATA_DIR:dir,EMBEDDING_BASE_URL:`http://127.0.0.1:${mocks.embeddingPort}/v1`,EMBEDDING_API_KEY:"personal-test-only",EMBEDDING_MODEL:"mock-embed",EMBEDDING_DIMENSION:"4",EMBEDDING_MAX_RETRIES:"0",QDRANT_URL:`http://127.0.0.1:${mocks.qdrantPort}`},stdio:"ignore",windowsHide:true}); };
const stop=async()=>{if(backend?.exitCode===null){backend.kill();await new Promise(resolve=>backend.once("exit",resolve));}};
const healthy=async()=>{for(let n=0;n<100;n++){try{if((await fetch(`http://127.0.0.1:${port}/health`)).ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,40));}throw new Error("API did not start");};
const call=async(user,url,body,expected=200,method=body===undefined?"GET":"POST")=>{const res=await fetch(`http://127.0.0.1:${port}${url}`,{method,headers:{"Content-Type":"application/json",...(user?{Cookie:`lingxi_session=${tokens[user-1]}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});const data=await res.json();assert.equal(res.status,expected,JSON.stringify(data));return data;};
const payload=(title,extras={})=>({title,description:"技术复习",documentType:"INTERVIEW_QUESTION",sourceType:"TEXT_ENTRY",rawText:`# ${title}\n\ncommonneedle tool schema validates inputs and permissions before execution.`,skillTags:["Tools"],aiConsent:true,...extras});
const index=async(user,id)=>{await call(user,`/api/personal-materials/${id}/process`,{});return call(user,`/api/personal-materials/${id}/index`,{});};
try {
  start(); await healthy();
  await call(null,"/api/personal-materials",undefined,401);
  const uploaded=await fetch(`http://127.0.0.1:${port}/api/personal-materials/extract`,{method:"POST",headers:{Cookie:`lingxi_session=${tokens[1]}`,"Content-Type":"application/octet-stream","X-File-Name":"notes.md"},body:"# Tools\n\n姓名：隐私测试甲\nprivate@example.com\ncommonneedle permissions."});
  assert.equal(uploaded.status,200);const extracted=await uploaded.json();assert.equal(extracted.rawText.includes("private@example.com"),false);assert.ok(extracted.warnings.length);
  const [first,second]=await Promise.all([call(2,"/api/personal-materials",payload("Owner material",{userId:3,scope:"PUBLIC",rawText:"# Tools\n\ncommonneedle tool schema validates permissions.\n姓名：隐私测试甲\nprivate@example.com 13800138000 https://private.example.com sk-personalSecret123456"}),201),call(3,"/api/personal-materials",payload("Foreign material"),201)]);
  const id=first.item.id,otherId=second.item.id;assert.notEqual(id,otherId);assert.equal(first.item.userId,2);assert.equal(first.item.scope,"PRIVATE");
  const saved=await call(2,`/api/personal-materials/${id}`);for(const value of ["隐私测试甲","private@example.com","13800138000","private.example.com","personalSecret"])assert.equal(saved.item.rawText.includes(value),false);
  for(const route of ["", "/process", "/index"]){await call(3,`/api/personal-materials/${id}${route}`,route?{}:undefined,404);}
  await call(3,`/api/personal-materials/${id}`,{title:"overwrite"},404,"PUT");await call(3,`/api/personal-materials/${id}`,undefined,404,"DELETE");
  await call(1,`/api/admin/knowledge-documents/${id}`,undefined,404);await call(1,`/api/admin/knowledge-documents/${id}/process`,{},404);
  const draft=await call(2,"/api/personal-materials",payload("No consent",{aiConsent:false}),201);await call(2,`/api/personal-materials/${draft.item.id}/process`,{});await call(2,`/api/personal-materials/${draft.item.id}/index`,{},400);assert.equal(mocks.state.embeddingCalls,0);
  await index(2,id);await index(3,otherId);
  assert.equal((await call(2,"/api/interview-materials")).items.length,0);
  assert.equal((await call(1,"/api/admin/knowledge-documents")).items.length,0);
  const publicDoc=await call(1,"/api/admin/knowledge-documents",payload("Public material"),201);await call(1,`/api/admin/knowledge-documents/${publicDoc.item.id}/process`,{});await call(1,`/api/admin/knowledge-documents/${publicDoc.item.id}/index`,{});
  await call(null,`/api/interview-materials/${publicDoc.item.id}`,undefined,401);
  await call(2,`/api/interview-materials/${id}`,undefined,404);
  await call(2,`/api/interview-materials/${otherId}`,undefined,404);
  const publicContent = (await call(2,`/api/interview-materials/${publicDoc.item.id}`)).item;
  assert.equal(publicContent.content,payload("Public material").rawText);
  assert.deepEqual(Object.keys(publicContent).sort(),["content","id","processingVersion","title"]);
  const publicDraft = await call(1,"/api/admin/knowledge-documents",payload("Unpublished public"),201);
  await call(2,`/api/interview-materials/${publicDraft.item.id}`,undefined,404);
  for(const mode of ["KEYWORD","VECTOR","HYBRID"]){const own=await call(2,"/api/personal-materials/search",{query:"commonneedle",mode,filters:{personalUserId:3},useReranker:false});assert.deepEqual([...new Set(own.results.map(r=>r.documentId))].sort((a,b)=>a-b),[id,publicDoc.item.id].sort((a,b)=>a-b));}
  const must=mocks.state.searchFilters.at(-1).must;assert.ok(must.find(rule=>rule.key==="documentId"&&rule.match.any.includes(id)&&!rule.match.any.includes(otherId)));
  mocks.state.ignoreSearchFilters=true;
  const leaked=await call(2,"/api/personal-materials/search",{query:"commonneedle",mode:"VECTOR"});assert.ok(leaked.results.every(result=>result.documentId!==otherId));
  const selectionStore=JSON.parse(await readFile(path.join(dir,"store.json"),"utf8"));
  const selectedService=new KnowledgeRetrievalService({env:{...process.env,VECTOR_STORE_DRIVER:"qdrant",EMBEDDING_BASE_URL:`http://127.0.0.1:${mocks.embeddingPort}/v1`,EMBEDDING_API_KEY:"personal-test-only",EMBEDDING_MODEL:"mock-embed",EMBEDDING_DIMENSION:"4",QDRANT_URL:`http://127.0.0.1:${mocks.qdrantPort}`}});
  for(const mode of ["KEYWORD","VECTOR","HYBRID"]){
    const selected=await selectedService.search(selectionStore,{query:"commonneedle",mode,filters:{allowedDocumentIds:[otherId]}},2,{includePersonal:true,allowedDocumentIds:[id]});
    assert.ok(selected.results.length);assert.ok(selected.results.every(result=>result.documentId===id),"unselected PUBLIC and foreign PRIVATE documents must be excluded even when Qdrant ignores filters");
    const empty=await selectedService.search(selectionStore,{query:"commonneedle",mode},2,{includePersonal:true,allowedDocumentIds:[]});assert.deepEqual(empty.results,[],"empty internal allowlist must never mean all documents");
  }
  const revoked=await call(2,`/api/personal-materials/${id}`,{aiConsent:false},200,"PUT");assert.equal(revoked.item.aiConsent,false);
  assert.equal((await call(2,"/api/personal-materials/search",{query:"commonneedle",mode:"KEYWORD"})).results.some(result=>result.documentId===id),false);
  await call(2,`/api/personal-materials/${id}`,{aiConsent:true},200,"PUT");
  const publicOnly=await call(1,"/api/admin/knowledge-retrieval/search",{query:"commonneedle",mode:"KEYWORD",filters:{personalUserId:2}});assert.ok(publicOnly.results.every(result=>result.documentId===publicDoc.item.id));
  const logs=await call(1,"/api/admin/knowledge-retrieval/runs");assert.ok(logs.items.every(run=>run.materialScope!=="PERSONAL_AND_PUBLIC"));await call(1,`/api/admin/knowledge-retrieval/runs/${leaked.run.id}`,undefined,404);
  const store=JSON.parse(await readFile(path.join(dir,"store.json"),"utf8"));const ref={documentId:id,chunkId:leaked.results.find(r=>r.documentId===id).chunkId,processingVersion:1};assert.equal(sourceAvailability(store,ref,2),true);assert.equal(sourceAvailability(store,ref,3),false);assert.equal(sourceAvailability(store,ref),false);
  assert.equal(mocks.state.received.flat().some(text=>/private@example|13800138000|personalSecret|隐私测试甲/.test(text)),false);
  await call(2,`/api/personal-materials/${id}`,{rawText:"# Updated\n\nnewneedle describes retry and idempotency.",aiConsent:true},200,"PUT");assert.equal((await call(2,"/api/personal-materials/search",{query:"commonneedle",mode:"KEYWORD"})).results.some(r=>r.documentId===id),false);
  mocks.state.failEmbedding=true;await call(2,`/api/personal-materials/${id}/process`,{});await call(2,`/api/personal-materials/${id}/index`,{},503);mocks.state.failEmbedding=false;await call(2,`/api/personal-materials/${id}/index`,{});
  await stop();start();await healthy();assert.equal((await call(2,`/api/personal-materials/${id}`)).item.vectorStatus,"INDEXED");
  await call(2,`/api/personal-materials/${id}`,undefined,200,"DELETE");await call(2,`/api/personal-materials/${id}`,undefined,404);assert.equal((await call(3,`/api/personal-materials/${otherId}`)).item.vectorStatus,"INDEXED");
  const replacement=await call(2,"/api/personal-materials",payload("Replacement"),201);assert.ok(replacement.item.id>publicDoc.item.id);const final=JSON.parse(await readFile(path.join(dir,"store.json"),"utf8"));assert.equal(final.knowledgeChunks.some(chunk=>chunk.documentId===id),false);assert.equal(final.knowledgeVectorRecords.some(record=>record.documentId===id),false);
  console.log("Personal materials passed: ownership, consent, privacy, keyword/vector/hybrid isolation, public-only tools, forged filters, local defense, concurrent create, stale/retry, restart and deletion.");
} finally {await stop();await mocks.close();const target=path.resolve(dir);if(path.dirname(target)!==path.resolve(tmpdir())||!path.basename(target).startsWith("lingxi-personal-materials-"))throw new Error("Unsafe cleanup path");await rm(target,{recursive:true,force:true});}
