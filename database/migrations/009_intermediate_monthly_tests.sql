ALTER TABLE courses
ADD COLUMN IF NOT EXISTS monthly_tests_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE assignments
ADD COLUMN IF NOT EXISTS assessment_type VARCHAR(20) NOT NULL DEFAULT 'assignment';

ALTER TABLE assignments
ADD COLUMN IF NOT EXISTS month_number SMALLINT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assignments_assessment_type_check') THEN
        ALTER TABLE assignments ADD CONSTRAINT assignments_assessment_type_check
            CHECK (assessment_type IN ('assignment', 'monthly_test'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assignments_month_number_check') THEN
        ALTER TABLE assignments ADD CONSTRAINT assignments_month_number_check
            CHECK (month_number IS NULL OR month_number BETWEEN 1 AND 12);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS assignments_course_monthly_test_unique
ON assignments (course_id, month_number)
WHERE assessment_type = 'monthly_test';
