-- PageView — LP 訪問計測 (素通り訪問者を捕捉、referrer/UTM/国コード/bot 判定付き)
--
-- 既存 PlaygroundLog は demo "Run" 押下時のみ記録だったため、/about /start
-- /sellers /me /start/v2 等の素通り訪問者が見えなかった。このテーブルが
-- 「LP に来た全員」を referrer/UTM/国/bot フラグ付きで記録する。
--
-- ingestion: POST /api/telemetry/pageview (public, fire-and-forget)
-- 表示:     /admin/funnel の「流入源」セクション
--
-- 注: schema.prisma に追加後 prisma db push でローカル Supabase 反映済み。
-- この migration ファイルは Railway の prisma migrate deploy が schema drift
-- せず通るようにするための後追い宣言（IF NOT EXISTS でべき等）。

CREATE TABLE IF NOT EXISTS "page_views" (
  "id"          TEXT         PRIMARY KEY,
  "path"        TEXT         NOT NULL,
  "referrer"    TEXT,
  "utmSource"   TEXT,
  "utmMedium"   TEXT,
  "utmCampaign" TEXT,
  "ipHash"      TEXT,
  "country"     TEXT,
  "userAgent"   TEXT,
  "isBot"       BOOLEAN      NOT NULL DEFAULT FALSE,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "page_views_path_createdAt_idx"      ON "page_views" ("path", "createdAt");
CREATE INDEX IF NOT EXISTS "page_views_createdAt_idx"           ON "page_views" ("createdAt");
CREATE INDEX IF NOT EXISTS "page_views_utmSource_createdAt_idx" ON "page_views" ("utmSource", "createdAt");
CREATE INDEX IF NOT EXISTS "page_views_country_createdAt_idx"   ON "page_views" ("country", "createdAt");
