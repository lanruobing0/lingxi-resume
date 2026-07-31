CREATE DATABASE IF NOT EXISTS ai_resume_coach
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE ai_resume_coach;

DROP TABLE IF EXISTS interview_answer;
DROP TABLE IF EXISTS mock_interview;
DROP TABLE IF EXISTS resume_grammar_check_record;
DROP TABLE IF EXISTS resume_optimize_record;
DROP TABLE IF EXISTS resume_analysis_record;
DROP TABLE IF EXISTS resume_version_history;
DROP TABLE IF EXISTS interview_question;
DROP TABLE IF EXISTS skill;
DROP TABLE IF EXISTS project_experience;
DROP TABLE IF EXISTS work_experience;
DROP TABLE IF EXISTS education_experience;
DROP TABLE IF EXISTS resume;
DROP TABLE IF EXISTS job_position;
DROP TABLE IF EXISTS system_notice;
DROP TABLE IF EXISTS user;

CREATE TABLE user (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  real_name VARCHAR(50),
  phone VARCHAR(20),
  email VARCHAR(100),
  role VARCHAR(20) NOT NULL DEFAULT 'USER',
  status TINYINT NOT NULL DEFAULT 1,
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE job_position (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  position_name VARCHAR(80) NOT NULL,
  position_type VARCHAR(50),
  keywords VARCHAR(500),
  description TEXT,
  status TINYINT NOT NULL DEFAULT 1,
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE resume (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  title VARCHAR(100) NOT NULL,
  target_position_id BIGINT,
  real_name VARCHAR(50),
  gender VARCHAR(10),
  birthday VARCHAR(20),
  phone VARCHAR(20),
  email VARCHAR(100),
  city VARCHAR(100),
  website VARCHAR(200),
  self_evaluation TEXT,
  template_name VARCHAR(50) DEFAULT 'modern',
  theme_color VARCHAR(30) DEFAULT 'black',
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_resume_user FOREIGN KEY (user_id) REFERENCES user(id),
  CONSTRAINT fk_resume_position FOREIGN KEY (target_position_id) REFERENCES job_position(id)
);

CREATE TABLE education_experience (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  resume_id BIGINT NOT NULL,
  school_name VARCHAR(100) NOT NULL,
  major VARCHAR(100),
  degree VARCHAR(50),
  start_date VARCHAR(20),
  end_date VARCHAR(20),
  description TEXT,
  sort_no INT DEFAULT 0,
  CONSTRAINT fk_education_resume FOREIGN KEY (resume_id) REFERENCES resume(id)
);

CREATE TABLE work_experience (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  resume_id BIGINT NOT NULL,
  company_name VARCHAR(100) NOT NULL,
  job_title VARCHAR(100),
  start_date VARCHAR(20),
  end_date VARCHAR(20),
  work_content TEXT,
  sort_no INT DEFAULT 0,
  CONSTRAINT fk_work_resume FOREIGN KEY (resume_id) REFERENCES resume(id)
);

CREATE TABLE project_experience (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  resume_id BIGINT NOT NULL,
  project_name VARCHAR(100) NOT NULL,
  role_name VARCHAR(100),
  start_date VARCHAR(20),
  end_date VARCHAR(20),
  project_desc TEXT,
  responsibility TEXT,
  result_desc TEXT,
  sort_no INT DEFAULT 0,
  CONSTRAINT fk_project_resume FOREIGN KEY (resume_id) REFERENCES resume(id)
);

CREATE TABLE skill (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  resume_id BIGINT NOT NULL,
  skill_name VARCHAR(100) NOT NULL,
  skill_level VARCHAR(30),
  description TEXT,
  sort_no INT DEFAULT 0,
  CONSTRAINT fk_skill_resume FOREIGN KEY (resume_id) REFERENCES resume(id)
);

CREATE TABLE resume_version_history (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  resume_id BIGINT NOT NULL,
  version_no INT NOT NULL,
  summary VARCHAR(200),
  snapshot_json TEXT,
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_history_resume FOREIGN KEY (resume_id) REFERENCES resume(id)
);

CREATE TABLE resume_analysis_record (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  resume_id BIGINT NOT NULL,
  resume_version INT NOT NULL,
  target_position_id BIGINT,
  target_position VARCHAR(120) NOT NULL,
  total_score INT,
  completeness_score INT,
  match_score INT,
  keyword_score INT,
  project_score INT,
  dimensions_json JSON NOT NULL,
  keywords_json JSON NOT NULL,
  analysis_result TEXT,
  suggestions_json JSON NOT NULL,
  model_provider VARCHAR(50),
  model_id VARCHAR(120),
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_analysis_user FOREIGN KEY (user_id) REFERENCES user(id),
  CONSTRAINT fk_analysis_resume FOREIGN KEY (resume_id) REFERENCES resume(id),
  CONSTRAINT fk_analysis_position FOREIGN KEY (target_position_id) REFERENCES job_position(id)
);

CREATE TABLE resume_optimize_record (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  resume_id BIGINT NOT NULL,
  optimize_type VARCHAR(50) NOT NULL,
  original_content TEXT,
  optimized_content TEXT,
  prompt_text TEXT,
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_optimize_user FOREIGN KEY (user_id) REFERENCES user(id),
  CONSTRAINT fk_optimize_resume FOREIGN KEY (resume_id) REFERENCES resume(id)
);

CREATE TABLE resume_grammar_check_record (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  resume_id BIGINT NOT NULL,
  score INT,
  original_content TEXT,
  issue_json TEXT,
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_grammar_user FOREIGN KEY (user_id) REFERENCES user(id),
  CONSTRAINT fk_grammar_resume FOREIGN KEY (resume_id) REFERENCES resume(id)
);

CREATE TABLE interview_question (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  position_id BIGINT NOT NULL,
  question_text TEXT NOT NULL,
  question_type VARCHAR(50),
  difficulty VARCHAR(20),
  reference_answer TEXT,
  status TINYINT NOT NULL DEFAULT 1,
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_question_position FOREIGN KEY (position_id) REFERENCES job_position(id)
);

CREATE TABLE mock_interview (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  resume_id BIGINT NOT NULL,
  position_id BIGINT NOT NULL,
  title VARCHAR(100),
  total_score INT,
  overall_feedback TEXT,
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_interview_user FOREIGN KEY (user_id) REFERENCES user(id),
  CONSTRAINT fk_interview_resume FOREIGN KEY (resume_id) REFERENCES resume(id),
  CONSTRAINT fk_interview_position FOREIGN KEY (position_id) REFERENCES job_position(id)
);

CREATE TABLE interview_answer (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  interview_id BIGINT NOT NULL,
  question_id BIGINT,
  question_text TEXT NOT NULL,
  answer_text TEXT,
  score INT,
  feedback TEXT,
  reference_answer TEXT,
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_answer_interview FOREIGN KEY (interview_id) REFERENCES mock_interview(id),
  CONSTRAINT fk_answer_question FOREIGN KEY (question_id) REFERENCES interview_question(id)
);

CREATE TABLE system_notice (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  status TINYINT NOT NULL DEFAULT 1,
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create users through the application registration flow so passwords are stored as scrypt hashes.

INSERT INTO job_position (position_name, position_type, keywords, description) VALUES
('前端开发工程师', '技术', 'React,Vue,TypeScript,工程化,性能优化,组件化', '负责 Web 前端页面、组件和业务交互开发。'),
('Java 后端开发', '技术', 'Spring Boot,MySQL,Redis,接口设计,微服务', '负责后端接口、业务逻辑和数据库设计。'),
('软件测试工程师', '技术', '测试用例,自动化测试,接口测试,缺陷管理', '负责软件质量保障和测试流程。');

INSERT INTO resume (user_id, title, target_position_id, real_name, birthday, phone, email, city, website, self_evaluation) VALUES
(2, '前端开发工程师简历', 1, '林澈', '1999/04', '13800138000', 'linche@example.com', '杭州市西湖区', 'https://linche.dev', '具备前端工程化和组件化开发经验，关注性能优化与用户体验。');

INSERT INTO project_experience (resume_id, project_name, role_name, start_date, end_date, project_desc, responsibility, result_desc, sort_no) VALUES
(1, 'AI 智能简历优化平台', '前端负责人', '2026/03', '2026/06', '面向求职者的简历优化与模拟面试平台。', '负责三栏简历工作台、AI 诊断结果页和模拟面试页面。', '完成简历编辑、AI 分析、优化记录和面试反馈闭环。', 1);

INSERT INTO skill (resume_id, skill_name, skill_level, description, sort_no) VALUES
(1, 'React / Vue', '熟练', '能够完成组件化开发、状态管理和复杂表单页面。', 1),
(1, 'Spring Boot 联调', '掌握', '能够根据接口文档完成前后端联调。', 2);

INSERT INTO resume_version_history (resume_id, version_no, summary, snapshot_json) VALUES
(1, 1, '创建基础简历信息', '{}'),
(1, 2, '补充项目经历和岗位方向', '{}'),
(1, 3, '加入 AI 诊断后的量化结果', '{}');

INSERT INTO resume_grammar_check_record (user_id, resume_id, score, original_content, issue_json) VALUES
(2, 1, 82, '负责招聘平台页面开发，完成筛选和面试排期功能，Thier 页面响应比较快。', '[{"type":"拼写","original":"Thier","suggestion":"Their"},{"type":"表达","original":"负责","suggestion":"主导"}]');

INSERT INTO interview_question (position_id, question_text, question_type, difficulty, reference_answer) VALUES
(1, '请介绍一个你主导或深度参与的前端项目，并说明你解决的核心问题。', '项目经历', '中等', '建议按项目背景、个人职责、技术难点、解决方案和结果进行回答。'),
(1, '如果一个页面首屏加载很慢，你会从哪些角度定位和优化？', '技术能力', '中等', '可从资源体积、接口耗时、渲染阻塞、缓存策略和代码分割等角度回答。');

INSERT INTO system_notice (title, content) VALUES
('系统上线提示', 'AI 简历诊断、简历优化和模拟面试功能已开放体验。');
