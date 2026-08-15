ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS result_code VARCHAR(24);

UPDATE courses
SET result_code = SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT || id::TEXT), 1, 24)
WHERE result_code IS NULL;

ALTER TABLE courses
    ALTER COLUMN result_code SET DEFAULT SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 24),
    ALTER COLUMN result_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS courses_result_code_unique
    ON courses(result_code);
