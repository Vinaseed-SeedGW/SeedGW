-- Tim kiem khong dau cho tieng Viet, cot duoc PostgreSQL tu tinh khi ghi.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE FUNCTION immutable_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

ALTER TABLE "users"
  ADD COLUMN "search_text" TEXT
  GENERATED ALWAYS AS (lower(immutable_unaccent("employee_code" || ' ' || "full_name"))) STORED;

CREATE INDEX "users_search_text_trgm_idx" ON "users" USING GIN ("search_text" gin_trgm_ops);
