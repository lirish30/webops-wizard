ALTER TABLE "page_state_snapshots"
ADD COLUMN "status_code" INTEGER,
ADD COLUMN "snapshot_html" TEXT,
ADD COLUMN "fetch_mode" TEXT,
ADD COLUMN "requested_url" TEXT,
ADD COLUMN "final_url" TEXT;
