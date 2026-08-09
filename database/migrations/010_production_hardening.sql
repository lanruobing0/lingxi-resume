-- Stage 10 non-destructive MySQL migration. Apply with a least-privilege
-- application account after the earlier schema/migrations have been applied.
-- JSON payloads match the server's audited normalized records; no prompt,
-- provider key, embedding vector, resume photo, or user answer payload is stored.

CREATE TABLE IF NOT EXISTS lingxi_store_snapshot (
  id TINYINT PRIMARY KEY,
  payload_json LONGTEXT NOT NULL,
  updated_at DATETIME NOT NULL
);

-- JSON columns canonicalize object key order. ResumeVersion content hashes are
-- byte-stable JSON hashes, so the authoritative snapshot must preserve text order.
ALTER TABLE lingxi_store_snapshot MODIFY payload_json LONGTEXT NOT NULL;

CREATE TABLE IF NOT EXISTS lingxi_entity_projection (
  entity_type VARCHAR(64) NOT NULL,
  entity_id BIGINT NOT NULL,
  user_id BIGINT NULL,
  payload_json JSON NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (entity_type, entity_id),
  INDEX idx_lingxi_entity_owner (entity_type, user_id)
);

CREATE TABLE IF NOT EXISTS rag_job (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  type VARCHAR(64) NOT NULL,
  user_id BIGINT NOT NULL,
  resource_id BIGINT NOT NULL,
  status VARCHAR(16) NOT NULL,
  progress INT NOT NULL DEFAULT 0,
  failure_code VARCHAR(100) NULL,
  created_at DATETIME NOT NULL,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  INDEX idx_rag_job_owner_created (user_id, created_at),
  INDEX idx_rag_job_status_created (status, created_at)
);

-- Entity projections kept by MysqlPersistence and mirrored in the snapshot:
-- knowledge_retrieval_run (RetrievalRun), match_report (MatchReport),
-- suggestion_run / resume_suggestion, resume_version_history,
-- rag_interview_session / rag_interview_question / rag_interview_answer /
-- rag_answer_feedback, agent_run, agent_step.  Their detailed relational
-- reference schemas are maintained in database.sql and use the same field names.
