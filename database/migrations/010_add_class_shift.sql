ALTER TABLE courses
ADD COLUMN IF NOT EXISTS class_shift VARCHAR(10) NOT NULL DEFAULT 'morning';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'courses_class_shift_check'
    ) THEN
        ALTER TABLE courses
        ADD CONSTRAINT courses_class_shift_check
        CHECK (class_shift IN ('morning', 'evening'));
    END IF;
END $$;
