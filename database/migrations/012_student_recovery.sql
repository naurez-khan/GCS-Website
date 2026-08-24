ALTER TABLE students
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DROP INDEX IF EXISTS students_course_roll_unique;
ALTER TABLE students
    DROP CONSTRAINT IF EXISTS students_course_id_roll_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS students_course_roll_active_unique
    ON students(course_id, roll_number)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS students_deleted_course_idx
    ON students(course_id, deleted_at);
