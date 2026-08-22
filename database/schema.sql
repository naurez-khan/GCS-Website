-- Math Department Portal - PostgreSQL schema
-- This schema matches the tables and columns used by the Express controllers.

BEGIN;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'teacher')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
    ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    course_code VARCHAR(50),
    class_type VARCHAR(20) NOT NULL DEFAULT 'bachelors' CHECK (class_type IN ('bachelors', 'intermediate')),
    intermediate_year VARCHAR(20) CHECK (intermediate_year IS NULL OR intermediate_year IN ('1st_year', '2nd_year')),
    class_shift VARCHAR(10) NOT NULL DEFAULT 'morning' CHECK (class_shift IN ('morning', 'evening')),
    roll_entry_mode VARCHAR(20) NOT NULL DEFAULT 'range' CHECK (roll_entry_mode IN ('range', 'manual', 'excel')),
    program VARCHAR(100),
    semester VARCHAR(50),
    section VARCHAR(20),
    teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    roll_start INTEGER NOT NULL,
    roll_end INTEGER NOT NULL,
    course_name_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    program_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    semester_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    section_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    roll_number_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    student_name_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    attendance_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    assignments_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    assignment_count INTEGER NOT NULL DEFAULT 0 CHECK (assignment_count BETWEEN 0 AND 100),
    quizzes_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    quiz_count INTEGER NOT NULL DEFAULT 0 CHECK (quiz_count BETWEEN 0 AND 100),
    midterm_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    final_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    results_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    monthly_tests_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    midterm_max_marks NUMERIC(8,2) CHECK (midterm_max_marks IS NULL OR midterm_max_marks > 0),
    final_max_marks NUMERIC(8,2) CHECK (final_max_marks IS NULL OR final_max_marks > 0),
    result_code VARCHAR(24) NOT NULL DEFAULT SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 24),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (roll_start <= roll_end)
);

CREATE UNIQUE INDEX IF NOT EXISTS courses_result_code_unique ON courses(result_code);
CREATE UNIQUE INDEX IF NOT EXISTS courses_result_code_lower_unique ON courses(LOWER(result_code));
CREATE INDEX IF NOT EXISTS courses_teacher_idx ON courses(teacher_id);

CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    roll_number VARCHAR(50) NOT NULL,
    name VARCHAR(150),
    program VARCHAR(100),
    semester VARCHAR(50),
    midterm_marks NUMERIC(8,2) CHECK (midterm_marks IS NULL OR midterm_marks >= 0),
    final_marks NUMERIC(8,2) CHECK (final_marks IS NULL OR final_marks >= 0),
    december_test_marks NUMERIC(8,2) CHECK (december_test_marks IS NULL OR december_test_marks BETWEEN 0 AND 100),
    preboard_marks NUMERIC(8,2) CHECK (preboard_marks IS NULL OR preboard_marks BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (course_id, roll_number)
);

CREATE INDEX IF NOT EXISTS students_course_idx ON students(course_id);
CREATE INDEX IF NOT EXISTS students_roll_idx ON students(roll_number);

CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status VARCHAR(10) NOT NULL CHECK (status IN ('present', 'absent')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (course_id, student_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS attendance_course_date_idx
    ON attendance(course_id, attendance_date);
CREATE INDEX IF NOT EXISTS attendance_student_idx ON attendance(student_id);

CREATE TABLE IF NOT EXISTS attendance_audit_logs (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    old_status VARCHAR(10) NOT NULL CHECK (old_status IN ('present', 'absent')),
    new_status VARCHAR(10) NOT NULL CHECK (new_status IN ('present', 'absent')),
    changed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS attendance_audit_course_date_idx
    ON attendance_audit_logs(course_id, attendance_date, changed_at DESC);

CREATE TABLE IF NOT EXISTS assignments (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    assignment_number INTEGER NOT NULL CHECK (assignment_number > 0),
    name VARCHAR(150) NOT NULL,
    max_marks NUMERIC(8,2) NOT NULL CHECK (max_marks > 0),
    assessment_type VARCHAR(20) NOT NULL DEFAULT 'assignment' CHECK (assessment_type IN ('assignment', 'monthly_test')),
    month_number SMALLINT CHECK (month_number IS NULL OR month_number BETWEEN 1 AND 12),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (course_id, assignment_number)
);

CREATE INDEX IF NOT EXISTS assignments_course_idx ON assignments(course_id);
CREATE UNIQUE INDEX IF NOT EXISTS assignments_course_monthly_test_unique
    ON assignments (course_id, month_number) WHERE assessment_type = 'monthly_test';

CREATE TABLE IF NOT EXISTS quizzes (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    quiz_number INTEGER NOT NULL CHECK (quiz_number > 0),
    name VARCHAR(150) NOT NULL,
    max_marks NUMERIC(8,2) NOT NULL CHECK (max_marks > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (course_id, quiz_number)
);

CREATE INDEX IF NOT EXISTS quizzes_course_idx ON quizzes(course_id);

CREATE TABLE IF NOT EXISTS assignment_marks (
    id SERIAL PRIMARY KEY,
    assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    marks NUMERIC(8,2) NOT NULL CHECK (marks >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS assignment_marks_student_idx ON assignment_marks(student_id);

CREATE TABLE IF NOT EXISTS quiz_marks (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    marks NUMERIC(8,2) NOT NULL CHECK (marks >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (quiz_id, student_id)
);

CREATE INDEX IF NOT EXISTS quiz_marks_student_idx ON quiz_marks(student_id);

COMMIT;
