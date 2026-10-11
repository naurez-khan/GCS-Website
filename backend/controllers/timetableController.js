const pool = require("../config/db");
const { buildMonthlyLectureRecordSpec, createMonthlyLectureRecordPdf } = require("../lib/monthlyLectureRecordPdf");

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function validShift(value) {
    return value === "morning" || value === "evening";
}

const getTimetable = async (req, res) => {
    const teacherId = req.user.id;
    const shift = String(req.query.shift || "morning").toLowerCase();
    const onDate = String(req.query.on || new Date().toISOString().slice(0, 10));
    if (!validShift(shift) || !DATE_PATTERN.test(onDate)) {
        return res.status(400).json({ success: false, message: "Choose a valid shift and effective date" });
    }

    try {
        const [courses, assignments, history] = await Promise.all([
            pool.query(
                `SELECT id, name, class_type, intermediate_year, program, semester, section, class_shift
                   FROM courses
                  WHERE teacher_id = $1 AND class_shift = $2 AND approval_status = 'approved'
                  ORDER BY name, semester, section`,
                [teacherId, shift]
            ),
            pool.query(
                `SELECT period_number, course_id, TO_CHAR(effective_from, 'YYYY-MM-DD') AS effective_from
                   FROM teacher_period_assignments
                  WHERE teacher_id = $1 AND class_shift = $2
                    AND effective_from <= $3::date
                    AND (effective_to IS NULL OR effective_to >= $3::date)
                  ORDER BY period_number`,
                [teacherId, shift, onDate]
            ),
            pool.query(
                `SELECT EXISTS(
                    SELECT 1 FROM teacher_period_assignments
                    WHERE teacher_id = $1 AND class_shift = $2
                ) AS has_history`,
                [teacherId, shift]
            )
        ]);
        return res.json({
            success: true,
            shift,
            effective_date: onDate,
            has_history: history.rows[0]?.has_history === true,
            courses: courses.rows,
            assignments: assignments.rows
        });
    } catch (error) {
        console.error("Get timetable error:", error);
        return res.status(500).json({ success: false, message: "Could not load the period timetable" });
    }
};

const updateTimetable = async (req, res) => {
    const client = await pool.connect();
    try {
        const teacherId = req.user.id;
        const shift = String(req.body.shift || "").toLowerCase();
        const effectiveFrom = String(req.body.effective_from || "");
        const requested = Array.isArray(req.body.assignments) ? req.body.assignments : [];
        if (!validShift(shift) || !DATE_PATTERN.test(effectiveFrom)) {
            return res.status(400).json({ success: false, message: "Choose a valid shift and effective date" });
        }

        const assignments = requested
            .filter(item => item?.course_id !== null && item?.course_id !== undefined && String(item.course_id) !== "")
            .map(item => ({ period: Number(item.period_number), courseId: Number(item.course_id) }));
        if (assignments.some(item => !Number.isInteger(item.period) || item.period < 1 || item.period > 7 || !Number.isInteger(item.courseId) || item.courseId < 1)) {
            return res.status(400).json({ success: false, message: "Every timetable assignment must use a valid class and period" });
        }
        if (new Set(assignments.map(item => item.period)).size !== assignments.length || new Set(assignments.map(item => item.courseId)).size !== assignments.length) {
            return res.status(400).json({ success: false, message: "A class and period can only be assigned once" });
        }

        await client.query("BEGIN");
        if (assignments.length) {
            const allowed = await client.query(
                `SELECT id FROM courses
                  WHERE teacher_id = $1 AND class_shift = $2 AND approval_status = 'approved' AND id = ANY($3::int[])`,
                [teacherId, shift, assignments.map(item => item.courseId)]
            );
            if (allowed.rows.length !== assignments.length) {
                await client.query("ROLLBACK");
                return res.status(400).json({ success: false, message: "Choose only your approved classes from this shift" });
            }
        }

        await client.query(
            `UPDATE teacher_period_assignments
                SET effective_to = $3::date - 1, updated_at = CURRENT_TIMESTAMP
              WHERE teacher_id = $1 AND class_shift = $2
                AND effective_from < $3::date
                AND (effective_to IS NULL OR effective_to >= $3::date)`,
            [teacherId, shift, effectiveFrom]
        );
        await client.query(
            `DELETE FROM teacher_period_assignments
              WHERE teacher_id = $1 AND class_shift = $2 AND effective_from >= $3::date`,
            [teacherId, shift, effectiveFrom]
        );
        for (const assignment of assignments) {
            await client.query(
                `INSERT INTO teacher_period_assignments
                    (teacher_id, course_id, class_shift, period_number, effective_from)
                 VALUES ($1, $2, $3, $4, $5::date)`,
                [teacherId, assignment.courseId, shift, assignment.period, effectiveFrom]
            );
        }
        await client.query("COMMIT");
        return res.json({ success: true, message: `The ${shift} timetable will apply from ${effectiveFrom}` });
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("Update timetable error:", error);
        return res.status(500).json({ success: false, message: "Could not save the period timetable" });
    } finally {
        client.release();
    }
};

const downloadMonthlyLectureRecord = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const month = String(req.query.month || "");
        const shift = String(req.query.shift || "morning").toLowerCase();
        if (!MONTH_PATTERN.test(month) || !validShift(shift)) {
            return res.status(400).json({ success: false, message: "Choose a valid month and shift" });
        }
        const fromDate = `${month}-01`;
        const [year, monthNumber] = month.split("-").map(Number);
        const toDate = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
        const [teacher, lectures] = await Promise.all([
            pool.query("SELECT name FROM users WHERE id = $1 AND role = 'teacher'", [teacherId]),
            pool.query(
                `SELECT DISTINCT ON (a.attendance_date, t.period_number)
                        a.attendance_date, t.period_number, c.id AS course_id, c.name,
                        c.class_type, c.intermediate_year, c.program, c.semester, c.section
                   FROM attendance a
                   JOIN courses c ON c.id = a.course_id
                   JOIN teacher_period_assignments t
                     ON t.course_id = c.id AND t.teacher_id = c.teacher_id
                    AND a.attendance_date >= t.effective_from
                    AND (t.effective_to IS NULL OR a.attendance_date <= t.effective_to)
                  WHERE c.teacher_id = $1 AND c.class_shift = $2
                    AND a.attendance_date BETWEEN $3::date AND $4::date
                    AND a.status IN ('present', 'absent')
                  ORDER BY a.attendance_date, t.period_number, c.id`,
                [teacherId, shift, fromDate, toDate]
            )
        ]);
        if (!teacher.rows.length) return res.status(404).json({ success: false, message: "Teacher not found" });
        if (!lectures.rows.length) return res.status(400).json({ success: false, message: "No saved lectures with period assignments were found for this month" });

        const spec = buildMonthlyLectureRecordSpec({ teacherName: teacher.rows[0].name, month, shift, lectures: lectures.rows });
        const pdf = await createMonthlyLectureRecordPdf(spec);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="Monthly_Lecture_Record_${month}_${shift}.pdf"`);
        res.setHeader("Content-Length", pdf.length);
        return res.send(pdf);
    } catch (error) {
        console.error("Download monthly lecture record error:", error);
        return res.status(500).json({ success: false, message: "Could not create the monthly lecture record PDF" });
    }
};

module.exports = { getTimetable, updateTimetable, downloadMonthlyLectureRecord };
