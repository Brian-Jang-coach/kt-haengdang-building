CREATE TABLE safety_reports (
 id TEXT PRIMARY KEY NOT NULL,
 request_id TEXT NOT NULL UNIQUE,
 category TEXT NOT NULL,
 location TEXT NOT NULL,
 title TEXT NOT NULL,
 description TEXT NOT NULL,
 name TEXT NOT NULL DEFAULT '',
 contact TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL CHECK(status IN ('received','withdrawn')),
 code_hash TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL,
 ip_hash TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX safety_reports_status ON safety_reports(status,created_at);
--> statement-breakpoint
CREATE TRIGGER report_daily_limit BEFORE INSERT ON safety_reports WHEN (SELECT COUNT(*) FROM safety_reports WHERE ip_hash=NEW.ip_hash)>=30 BEGIN SELECT RAISE(ABORT,'report_daily_limit'); END;
