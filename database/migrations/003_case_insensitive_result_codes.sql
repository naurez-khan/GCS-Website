CREATE UNIQUE INDEX IF NOT EXISTS courses_result_code_lower_unique
    ON courses(LOWER(result_code));
