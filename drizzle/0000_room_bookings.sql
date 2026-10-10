CREATE TABLE bookings (
 id TEXT PRIMARY KEY NOT NULL,
 request_id TEXT NOT NULL UNIQUE,
 room TEXT NOT NULL CHECK (room IN ('a','b')),
 date TEXT NOT NULL,
 start INTEGER NOT NULL,
 end INTEGER NOT NULL,
 name TEXT NOT NULL,
 department TEXT NOT NULL,
 purpose TEXT NOT NULL,
 code_hash TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL CHECK(status IN ('confirmed','cancelled')),
 created_at TEXT NOT NULL,
 ip_hash TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX bookings_calendar ON bookings(date,room,status);
--> statement-breakpoint
CREATE TABLE booking_slots (
 room TEXT NOT NULL,
 date TEXT NOT NULL,
 minute INTEGER NOT NULL,
 booking_id TEXT NOT NULL REFERENCES bookings(id),
 PRIMARY KEY(room,date,minute)
);
--> statement-breakpoint
CREATE TRIGGER booking_daily_limit BEFORE INSERT ON bookings WHEN (SELECT COUNT(*) FROM bookings WHERE ip_hash=NEW.ip_hash)>=30 BEGIN SELECT RAISE(ABORT,'booking_limit'); END;
