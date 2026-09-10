ALTER TABLE courses
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

UPDATE courses
SET approval_status = 'approved',
    approved_at = COALESCE(approved_at, created_at)
WHERE approval_status = 'pending';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'courses_approval_status_check') THEN
        ALTER TABLE courses ADD CONSTRAINT courses_approval_status_check
            CHECK (approval_status IN ('pending', 'approved', 'rejected'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS courses_approval_status_idx
    ON courses (approval_status, created_at DESC);
