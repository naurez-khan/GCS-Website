const pool = require("../config/db");
function getPakistanDate() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Karachi",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}


const markAttendance = async (req, res) => {

    const client = await pool.connect();

    try {

        const teacherId = req.user.id;

        const {
            courseId,
            date,
            absentStudentIds
        } = req.body;


        // Validate input

        if (!courseId || !date) {
            return res.status(400).json({
                success: false,
                message: "Course ID and date are required"
            });
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
            return res.status(400).json({
                success: false,
                message: "Date must use the YYYY-MM-DD format"
            });
        }


        const absentIds = Array.isArray(absentStudentIds)
            ? absentStudentIds
            : [];


        // Start transaction

        await client.query("BEGIN");


        // Check that this course belongs to the logged-in teacher

        const courseResult = await client.query(
            `
            SELECT id
            FROM courses
            WHERE id = $1
            AND teacher_id = $2
            `,
            [courseId, teacherId]
        );


        if (courseResult.rows.length === 0) {

            await client.query("ROLLBACK");

            return res.status(403).json({
                success: false,
                message: "You do not have access to this course"
            });

        }


        // Get all students in this course

        const studentsResult = await client.query(
            `
            SELECT id
            FROM students
            WHERE course_id = $1
            AND deleted_at IS NULL
            ORDER BY roll_number
            `,
            [courseId]
        );


        const students = studentsResult.rows;


        if (students.length === 0) {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "No students found in this course"
            });

        }


        // Make sure all absent student IDs actually belong
        // to this course

        const studentIds = students.map(student => student.id);

        const invalidAbsentIds = absentIds.filter(
            id => !studentIds.includes(Number(id))
        );


        if (invalidAbsentIds.length > 0) {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "One or more absent students do not belong to this course"
            });

        }


        const today = getPakistanDate();
        const attendanceWindow = await client.query(
            `SELECT TO_CHAR(
                 MIN(attendance_date) FILTER (WHERE status <> 'leave'),
                 'YYYY-MM-DD'
             ) AS first_attendance_date
             FROM attendance
             WHERE course_id = $1`,
            [courseId]
        );
        const firstAttendanceDate = attendanceWindow.rows[0]?.first_attendance_date || null;
        if (date > today) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: "Future attendance dates are not allowed"
            });
        }
        if ((!firstAttendanceDate && date !== today) || (firstAttendanceDate && date < firstAttendanceDate)) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: firstAttendanceDate
                    ? `Attendance cannot be marked before ${firstAttendanceDate}`
                    : "The first attendance must be marked for today"
            });
        }

        // Check whether attendance has already been marked

        const existingAttendance = await client.query(
            `
            SELECT student_id, status
            FROM attendance
            WHERE course_id = $1
            AND attendance_date = $2
            `,
            [courseId, date]
        );


        if (existingAttendance.rows.some(record => record.status !== "leave")) {

            await client.query("ROLLBACK");

            return res.status(409).json({
                success: false,
                message: "Attendance has already been marked for this date"
            });

        }


        // Insert attendance for every student

        const leaveIds = new Set(existingAttendance.rows.filter(record => record.status === "leave").map(record => Number(record.student_id)));

        for (const student of students) {

            if (leaveIds.has(Number(student.id))) continue;
            const status = absentIds.includes(student.id) ||
                           absentIds.includes(String(student.id))
                ? "absent"
                : "present";


            await client.query(
                `
                INSERT INTO attendance
                (
                    course_id,
                    student_id,
                    attendance_date,
                    status
                )
                VALUES ($1, $2, $3, $4)
                `,
                [
                    courseId,
                    student.id,
                    date,
                    status
                ]
            );

        }


        // Everything succeeded

        await client.query("COMMIT");


        const absentCount = students.filter(student =>
            absentIds.includes(student.id) ||
            absentIds.includes(String(student.id))
        ).length;

        const leaveCount = leaveIds.size;

        res.status(201).json({
            success: true,
            message: "Attendance marked successfully",
            date: date,
            totalStudents: students.length,
            presentStudents: students.length - absentCount - leaveCount,
            absentStudents: absentCount,
            leaveStudents: leaveCount
        });


    } catch (error) {

        await client.query("ROLLBACK");

        console.error("Mark attendance error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });


    } finally {

        client.release();

    }

};

const getAttendance = async (req, res) => {

    try {

        const teacherId = req.user.id;
        const courseId = req.params.courseId;

        // Check that the course belongs to this teacher

        const courseResult = await pool.query(
            `
            SELECT
                id,
                name,
                program,
                semester,
                section
            FROM courses
            WHERE id = $1
            AND teacher_id = $2
            `,
            [courseId, teacherId]
        );


        if (courseResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Course not found or access denied"
            });

        }


        // Get attendance records

        const attendanceResult = await pool.query(
            `
            SELECT
                a.id,
                TO_CHAR(a.attendance_date, 'YYYY-MM-DD') AS attendance_date,
                a.status,
                s.id AS student_id,
                s.roll_number,
                s.name AS student_name
            FROM attendance a

            JOIN students s
                ON a.student_id = s.id

            WHERE a.course_id = $1
            AND s.deleted_at IS NULL

            ORDER BY
                a.attendance_date DESC,
                s.roll_number
            `,
            [courseId]
        );


        res.json({
            success: true,
            course: courseResult.rows[0],
            attendance: attendanceResult.rows
        });


    } catch (error) {

        console.error("Get attendance error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });

    }

};


const updateAttendance = async (req, res) => {
    const client = await pool.connect();
    try {
        const courseId = req.params.courseId;
        const date = String(req.params.date || "");
        const absentIds = Array.isArray(req.body.absentStudentIds)
            ? req.body.absentStudentIds.map(Number)
            : [];

        const requestedStatuses = Array.isArray(req.body.studentStatuses) ? req.body.studentStatuses : [];
        const statusMap = new Map(requestedStatuses.map(item => [Number(item.student_id), String(item.status || "")]));
        const validStatuses = new Set(["present", "absent", "leave"]);
        const invalidStatuses = [...statusMap.entries()].some(([id, status]) => !Number.isInteger(id) || !validStatuses.has(status));

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || absentIds.some(id => !Number.isInteger(id)) || invalidStatuses) {
            return res.status(400).json({ success: false, message: "A valid date and student list are required" });
        }

        await client.query("BEGIN");
        const course = await client.query(
            "SELECT id FROM courses WHERE id = $1 AND teacher_id = $2",
            [courseId, req.user.id]
        );
        if (!course.rows.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Course not found or access denied" });
        }

        const roster = await client.query(
            `SELECT id FROM students
             WHERE course_id = $1 AND deleted_at IS NULL`,
            [courseId]
        );

        const current = await client.query(
            `SELECT a.id, a.student_id, a.status
             FROM attendance a
             JOIN students s ON s.id = a.student_id AND s.course_id = a.course_id
             WHERE a.course_id = $1 AND a.attendance_date = $2 AND s.deleted_at IS NULL
             FOR UPDATE`,
            [courseId, date]
        );
        if (!current.rows.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "No attendance was recorded for this date" });
        }

        const validIds = new Set(roster.rows.map(row => Number(row.id)));
        if (absentIds.some(id => !validIds.has(id)) || [...statusMap.keys()].some(id => !validIds.has(id))) {
            await client.query("ROLLBACK");
            return res.status(400).json({ success: false, message: "One or more students are invalid for this class" });
        }

        const absentSet = new Set(absentIds);
        const recordedIds = new Set(current.rows.map(row => Number(row.student_id)));
        let changed = 0;
        for (const record of current.rows) {
            const newStatus = statusMap.size ? statusMap.get(Number(record.student_id)) : (absentSet.has(Number(record.student_id)) ? "absent" : "present");
            if (!newStatus) continue;
            if (record.status === newStatus) continue;
            await client.query(
                `INSERT INTO attendance_audit_logs
                 (course_id, student_id, attendance_date, old_status, new_status, changed_by)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [courseId, record.student_id, date, record.status, newStatus, req.user.actingAdminId || req.user.id]
            );
            await client.query(
                "UPDATE attendance SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
                [newStatus, record.id]
            );
            changed += 1;
        }

        if (statusMap.size) {
            for (const [studentId, status] of statusMap) {
                if (recordedIds.has(studentId)) continue;
                await client.query(
                    `INSERT INTO attendance
                     (course_id, student_id, attendance_date, status)
                     VALUES ($1, $2, $3, $4)`,
                    [courseId, studentId, date, status]
                );
                changed += 1;
            }
        }

        await client.query("COMMIT");
        res.json({ success: true, message: "Attendance updated successfully", changed });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Update attendance error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    } finally {
        client.release();
    }
};

const getAttendanceAudit = async (req, res) => {
    try {
        const courseId = req.params.courseId;
        const course = await pool.query(
            "SELECT id FROM courses WHERE id = $1 AND teacher_id = $2",
            [courseId, req.user.id]
        );
        if (!course.rows.length) {
            return res.status(404).json({ success: false, message: "Course not found or access denied" });
        }

        const result = await pool.query(
            `SELECT l.id, TO_CHAR(l.attendance_date, 'YYYY-MM-DD') AS attendance_date,
                    l.old_status, l.new_status, l.changed_at,
                    s.roll_number, s.name AS student_name, u.name AS changed_by_name
             FROM attendance_audit_logs l
             JOIN students s ON s.id = l.student_id
             JOIN users u ON u.id = l.changed_by
             WHERE l.course_id = $1
             ORDER BY l.changed_at DESC
             LIMIT 200`,
            [courseId]
        );
        res.json({ success: true, audit: result.rows });
    } catch (error) {
        console.error("Get attendance audit error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

module.exports = {
    markAttendance,
    getAttendance,
    updateAttendance,
    getAttendanceAudit
};
