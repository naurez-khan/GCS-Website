ALTER TABLE courses
ADD COLUMN IF NOT EXISTS class_tests_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE courses
ADD COLUMN IF NOT EXISTS class_test_count INTEGER NOT NULL DEFAULT 0
    CHECK (class_test_count BETWEEN 0 AND 100);

ALTER TABLE assignments
DROP CONSTRAINT IF EXISTS assignments_assessment_type_check;

ALTER TABLE assignments
ADD CONSTRAINT assignments_assessment_type_check
CHECK (assessment_type IN ('assignment', 'monthly_test', 'class_test'));
