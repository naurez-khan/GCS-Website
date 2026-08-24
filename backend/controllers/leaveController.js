const pool = require("../config/db");

const createStudentLeave = async (req, res) => {
    const client = await pool.connect();
    try {
        const courseId = Number(req.params.courseId);
        const rollNumber = String(req.body.roll_number || "").trim();
        const startDate = String(req.body.start_date || "");
        const endDate = String(req.body.end_date || "");
        if (!Number.isInteger(courseId) || !rollNumber || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
            return res.status(400).json({ success: false, message: "Roll number and valid leave dates are required" });
        }
        const start = new Date(`${startDate}T00:00:00Z`);
        const end = new Date(`${endDate}T00:00:00Z`);
        const dayCount = Math.floor((end - start) / 86400000) + 1;
        if (!Number.isFinite(dayCount) || dayCount < 1 || dayCount > 366) {
            return res.status(400).json({ success: false, message: "Leave end date must be on or after the start date, within one year" });
        }
        await client.query("BEGIN");
        const student = await client.query(
            `SELECT s.id, s.roll_number FROM students s JOIN courses c ON c.id=s.course_id
             WHERE s.course_id=$1 AND s.roll_number=$2 AND s.deleted_at IS NULL AND c.teacher_id=$3 FOR UPDATE`,
            [courseId, rollNumber, req.user.id]
        );
        if (!student.rows.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Student roll number was not found in this class" });
        }
        const studentId = student.rows[0].id;
        for (let offset = 0; offset < dayCount; offset += 1) {
            const date = new Date(start.getTime() + offset * 86400000).toISOString().slice(0, 10);
            const existing = await client.query("SELECT id,status FROM attendance WHERE course_id=$1 AND student_id=$2 AND attendance_date=$3 FOR UPDATE", [courseId, studentId, date]);
            if (existing.rows.length && existing.rows[0].status !== "leave") {
                await client.query(`INSERT INTO attendance_audit_logs (course_id,student_id,attendance_date,old_status,new_status,changed_by) VALUES ($1,$2,$3,$4,'leave',$5)`, [courseId, studentId, date, existing.rows[0].status, req.user.actingAdminId || req.user.id]);
            }
            if (existing.rows.length) {
                await client.query("UPDATE attendance SET status='leave',updated_at=CURRENT_TIMESTAMP WHERE id=$1", [existing.rows[0].id]);
            } else {
                await client.query("INSERT INTO attendance (course_id,student_id,attendance_date,status) VALUES ($1,$2,$3,'leave')", [courseId, studentId, date]);
            }
        }
        await client.query("COMMIT");
        res.status(201).json({ success: true, message: `Leave saved for roll number ${rollNumber} from ${startDate} to ${endDate}.`, student_id: studentId, days: dayCount });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Create student leave error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    } finally {
        client.release();
    }
};

module.exports = { createStudentLeave };
