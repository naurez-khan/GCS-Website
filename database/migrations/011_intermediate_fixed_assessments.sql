ALTER TABLE students
ADD COLUMN IF NOT EXISTS december_test_marks NUMERIC(8,2);

ALTER TABLE students
ADD COLUMN IF NOT EXISTS preboard_marks NUMERIC(8,2);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'students_december_test_marks_check'
    ) THEN
        ALTER TABLE students
        ADD CONSTRAINT students_december_test_marks_check
        CHECK (december_test_marks IS NULL OR december_test_marks BETWEEN 0 AND 100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'students_preboard_marks_check'
    ) THEN
        ALTER TABLE students
        ADD CONSTRAINT students_preboard_marks_check
        CHECK (preboard_marks IS NULL OR preboard_marks BETWEEN 0 AND 100);
    END IF;
END $$;

-- Preserve any existing December monthly-test scores by converting them to /100.
UPDATE students AS student
SET december_test_marks = converted.marks,
    updated_at = CURRENT_TIMESTAMP
FROM (
    SELECT
        marks.student_id,
        ROUND(LEAST(100, (marks.marks / assessment.max_marks) * 100), 2) AS marks
    FROM assignment_marks AS marks
    JOIN assignments AS assessment ON assessment.id = marks.assignment_id
    WHERE assessment.assessment_type = 'monthly_test'
      AND assessment.month_number = 12
) AS converted
WHERE student.id = converted.student_id
  AND student.december_test_marks IS NULL;

-- December is now a permanent fixed assessment, not an optional monthly test.
DELETE FROM assignments
WHERE assessment_type = 'monthly_test'
  AND month_number = 12;
