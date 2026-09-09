const pool = require("../config/db");

const getStudentResult = async (req, res) => {
    try {
        const resultCode = String(req.body.resultCode || "").trim();
        const rollNumber = String(req.body.rollNumber || "").trim();

        if (!resultCode || !rollNumber) {
            return res.status(400).json({ success: false, message: "Result code and roll number are required" });
        }

        const studentResult = await pool.query(
            `
            SELECT
                s.id, s.roll_number, s.name, s.midterm_marks, s.final_marks,
                s.december_test_marks, s.preboard_marks,
                c.id AS course_id, c.name AS course_name, c.course_code, c.program, c.semester, c.section, c.class_shift, c.class_type,
                c.midterm_enabled, c.final_enabled, c.midterm_max_marks, c.final_max_marks,
                u.name AS teacher_name
            FROM students s
            JOIN courses c ON c.id = s.course_id
            JOIN users u ON u.id = c.teacher_id
            WHERE LOWER(c.result_code) = LOWER($1)
              AND s.roll_number = $2
              AND s.deleted_at IS NULL
              AND c.results_enabled = TRUE
            `,
            [resultCode, rollNumber]
        );

        if (studentResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: "No published result matches those details" });
        }

        const student = studentResult.rows[0];

        const [assignmentResult, quizResult, monthlyTestResult, attendanceResult] = await Promise.all([
            pool.query(
                `SELECT a.name, a.max_marks, am.marks
                 FROM assignments a
                 LEFT JOIN assignment_marks am ON am.assignment_id = a.id AND am.student_id = $2
                 WHERE a.course_id = $1 AND a.assessment_type = 'assignment' ORDER BY a.assignment_number`,
                [student.course_id, student.id]
            ),
            pool.query(
                `SELECT q.name, q.max_marks, qm.marks
                 FROM quizzes q
                 LEFT JOIN quiz_marks qm ON qm.quiz_id = q.id AND qm.student_id = $2
                 WHERE q.course_id = $1 ORDER BY q.quiz_number`,
                [student.course_id, student.id]
            ),
            pool.query(
                `SELECT a.name, a.max_marks, am.marks
                 FROM assignments a
                 LEFT JOIN assignment_marks am ON am.assignment_id = a.id AND am.student_id = $2
                 WHERE a.course_id = $1 AND a.assessment_type = 'monthly_test'
                 ORDER BY a.month_number`,
                [student.course_id, student.id]
            ),
            pool.query(
                `SELECT COUNT(*)::INTEGER AS total,
                        COUNT(*) FILTER (WHERE status IN ('present', 'leave'))::INTEGER AS present
                 FROM attendance WHERE course_id = $1 AND student_id = $2`,
                [student.course_id, student.id]
            )
        ]);

        let earned = 0;
        let maximum = 0;
        const addScore = (marks, maxMarks) => {
            if (maxMarks !== null) maximum += Number(maxMarks);
            if (marks !== null) earned += Number(marks);
        };

        assignmentResult.rows.forEach(item => addScore(item.marks, item.max_marks));
        quizResult.rows.forEach(item => addScore(item.marks, item.max_marks));
        monthlyTestResult.rows.forEach(item => addScore(item.marks, item.max_marks));
        if (student.midterm_enabled) addScore(student.midterm_marks, student.midterm_max_marks);
        if (student.final_enabled) addScore(student.final_marks, student.class_type === "intermediate" ? student.final_max_marks : 15);
        if (student.class_type === "intermediate") {
            addScore(student.december_test_marks, 100);
            addScore(student.preboard_marks, 100);
        }

        const monthlyEarned = monthlyTestResult.rows.reduce(
            (sum, item) => sum + (item.marks === null ? 0 : Number(item.marks)),
            0
        );
        const monthlyMaximum = monthlyTestResult.rows.reduce(
            (sum, item) => sum + Number(item.max_marks || 0),
            0
        );

        const attendance = attendanceResult.rows[0];

        res.setHeader("Cache-Control", "no-store");
        res.json({
            success: true,
            result: {
                student: { rollNumber: student.roll_number, name: student.name },
                course: {
                    name: student.course_name,
                    code: student.course_code,
                    program: student.program,
                    semester: student.semester,
                    section: student.section,
                    shift: student.class_shift,
                    classType: student.class_type,
                    teacherName: student.teacher_name
                },
                assignments: assignmentResult.rows,
                quizzes: quizResult.rows,
                monthlyTests: monthlyTestResult.rows,
                monthlySummary: {
                    earned: monthlyEarned,
                    maximum: monthlyMaximum,
                    percentage: monthlyMaximum > 0
                        ? Number(((monthlyEarned / monthlyMaximum) * 100).toFixed(2))
                        : null
                },
                decemberTest: student.class_type === "intermediate"
                    ? { marks: student.december_test_marks, maxMarks: 100 }
                    : null,
                preboard: student.class_type === "intermediate"
                    ? { marks: student.preboard_marks, maxMarks: 100 }
                    : null,
                midterm: student.midterm_enabled ? { marks: student.midterm_marks, maxMarks: student.midterm_max_marks } : null,
                final: student.final_enabled ? { marks: student.final_marks, maxMarks: student.class_type === "intermediate" ? student.final_max_marks : 15 } : null,
                summary: {
                    earned,
                    maximum,
                    percentage: maximum > 0 ? Number(((earned / maximum) * 100).toFixed(2)) : null
                },
                attendance: {
                    present: attendance.present,
                    total: attendance.total,
                    percentage: attendance.total > 0
                        ? Number(((attendance.present / attendance.total) * 100).toFixed(2))
                        : null
                }
            }
        });
    } catch (error) {
        console.error("Get student result error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

module.exports = { getStudentResult };
