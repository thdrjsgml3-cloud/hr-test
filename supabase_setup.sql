-- Supabase SQL Editor에서 이 SQL을 실행하세요

CREATE TABLE hr_data (
  type TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '[]'
);

ALTER TABLE hr_data DISABLE ROW LEVEL SECURITY;

INSERT INTO hr_data (type, data) VALUES
  ('interviews', '[]'),
  ('onboards', '[]'),
  ('proposals', '[]'),
  ('costs', '[]');
