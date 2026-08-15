CREATE UNIQUE INDEX IF NOT EXISTS students_course_roll_unique
    ON students(course_id, roll_number);
