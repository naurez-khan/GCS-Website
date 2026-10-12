ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS class_start_date DATE;

UPDATE courses course_row
SET class_start_date = COALESCE(
    (
        SELECT MIN(attendance.attendance_date)
        FROM attendance
        WHERE attendance.course_id = course_row.id
          AND attendance.status <> 'leave'
    ),
    (course_row.created_at AT TIME ZONE 'Asia/Karachi')::DATE
)
WHERE class_start_date IS NULL;

ALTER TABLE courses
    ALTER COLUMN class_start_date SET DEFAULT CURRENT_DATE,
    ALTER COLUMN class_start_date SET NOT NULL;
