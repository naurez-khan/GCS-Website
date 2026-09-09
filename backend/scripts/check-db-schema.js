require("dotenv").config();
const pool = require("../config/db");

const expected = {
    users: ["id", "name", "email", "password_hash", "role", "is_active"],
    courses: ["id", "name", "course_code", "class_type", "intermediate_year", "class_shift", "roll_entry_mode", "roll_number_type", "monthly_tests_enabled", "teacher_id", "roll_start", "roll_end", "result_code", "updated_at"],
    students: ["id", "course_id", "roll_number", "midterm_marks", "final_marks", "december_test_marks", "preboard_marks", "updated_at"],
    attendance: ["id", "course_id", "student_id", "attendance_date", "status", "updated_at"],
    attendance_audit_logs: ["id", "course_id", "student_id", "attendance_date", "old_status", "new_status", "changed_by", "changed_at"],
    course_holidays: ["id", "course_id", "holiday_date", "name", "created_by", "created_at", "updated_at"],
    assignments: ["id", "course_id", "assignment_number", "name", "max_marks", "assessment_type", "month_number", "updated_at"],
    quizzes: ["id", "course_id", "quiz_number", "name", "max_marks", "updated_at"],
    assignment_marks: ["id", "assignment_id", "student_id", "marks"],
    quiz_marks: ["id", "quiz_id", "student_id", "marks"]
};

(async () => {
    try {
        const result = await pool.query(
            `SELECT table_name, column_name
             FROM information_schema.columns
             WHERE table_schema = 'public'`
        );
        const actual = result.rows.reduce((tables, row) => {
            (tables[row.table_name] ||= new Set()).add(row.column_name);
            return tables;
        }, {});

        const problems = [];
        for (const [table, columns] of Object.entries(expected)) {
            if (!actual[table]) {
                problems.push(`Missing table: ${table}`);
                continue;
            }
            for (const column of columns) {
                if (!actual[table].has(column)) problems.push(`Missing column: ${table}.${column}`);
            }
        }

        if (problems.length) {
            console.error(problems.join("\n"));
            process.exitCode = 1;
        } else {
            console.log("Database schema matches the application contract.");
        }
    } finally {
        await pool.end();
    }
})().catch(error => {
    console.error(`Database schema check failed: ${error.message}`);
    process.exitCode = 1;
});
