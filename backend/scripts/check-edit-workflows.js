require("dotenv").config();
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const app = require("../server");

(async () => {
    const teacherResult = await pool.query("SELECT id FROM users WHERE role = 'teacher' AND is_active = TRUE ORDER BY id LIMIT 1");
    if (!teacherResult.rows.length) throw new Error("An active teacher is required");
    const teacherId = teacherResult.rows[0].id;
    const token = jwt.sign({ id: teacherId, role: "teacher" }, process.env.JWT_SECRET, { expiresIn: "10m" });
    const adminResult = await pool.query("SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE ORDER BY id LIMIT 1");
    if (!adminResult.rows.length) throw new Error("An active administrator is required");
    const adminToken = jwt.sign({ id: adminResult.rows[0].id, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "10m" });
    const suffix = Date.now().toString(36);
    const initialCode = `check-${suffix}`;
    const editedCode = `edited-${suffix}`;
    const server = app.listen(0);
    await new Promise(resolve => server.once("listening", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    let courseId = null;

    async function request(path, options = {}, expected = 200) {
        const response = await fetch(`${origin}${path}`, {
            ...options,
            headers: { Cookie: `token=${token}`, "Content-Type": "application/json", ...(options.headers || {}) }
        });
        const data = await response.json();
        if (response.status !== expected || (expected < 400 && !data.success)) {
            throw new Error(`${options.method || "GET"} ${path} failed (${response.status}): ${data.message || "unknown error"}`);
        }
        return data;
    }

    async function adminRequest(path, options = {}, expected = 200) {
        const response = await fetch(`${origin}${path}`, {
            ...options,
            headers: { Cookie: `token=${adminToken}`, "Content-Type": "application/json", ...(options.headers || {}) }
        });
        const data = await response.json();
        if (response.status !== expected || (expected < 400 && !data.success)) {
            throw new Error(`${options.method || "GET"} ${path} failed (${response.status}): ${data.message || "unknown error"}`);
        }
        return data;
    }

    try {
        const rejectedOverlap = await request("/api/courses", {
            method: "POST",
            body: JSON.stringify({
                name: `__INVALID_RANGE_CHECK_${suffix}__`,
                rollRanges: [{ start: 9001, end: 9003 }, { start: 9003, end: 9005 }]
            })
        }, 400);
        if (!/overlap|duplicate|unique/i.test(rejectedOverlap.message || "")) {
            throw new Error("Overlapping roll-number ranges were not rejected");
        }

        const created = await request("/api/courses", {
            method: "POST",
            body: JSON.stringify({
                name: `__EDIT_WORKFLOW_CHECK_${suffix}__`, course_code: "MTH-CHECK", program: "Test", semester: "Test", section: "T",
                rollStart: 9001, rollEnd: 9010,
                rollRanges: [{ start: 9001, end: 9002 }, { start: 9010, end: 9010 }],
                course_name_enabled: true, roll_number_enabled: true,
                program_enabled: true, semester_enabled: true, section_enabled: true, student_name_enabled: true,
                student_names: [
                    { roll_number: "9001", name: "Test Student One" },
                    { roll_number: "9002", name: "Test Student Two" },
                    { roll_number: "9010", name: "Test Student Ten" }
                ],
                attendance_enabled: true,
                assignments_enabled: true, assignment_count: 1, assignment_max_marks: 10,
                quizzes_enabled: true, quiz_count: 1, quiz_max_marks: 5,
                midterm_enabled: true, midterm_max_marks: 30,
                final_enabled: true, final_max_marks: 50,
                results_enabled: true, result_code: initialCode
            })
        }, 201);
        courseId = created.course.id;
        if (created.course.approval_status !== "pending") throw new Error("New class was not created as pending");
        const blocked = await request(`/api/courses/${courseId}/students`, {}, 403);
        if (blocked.code !== "COURSE_APPROVAL_REQUIRED") throw new Error("Pending class was not blocked");
        const approvalQueue = await adminRequest("/api/admin/course-approvals");
        if (!approvalQueue.courses.some(course => Number(course.id) === Number(courseId))) {
            throw new Error("Pending class did not appear in the administrator approval queue");
        }
        await adminRequest(`/api/admin/courses/${courseId}/approval`, {
            method: "PATCH",
            body: JSON.stringify({ status: "approved" })
        });

        let courseData = await request(`/api/courses/${courseId}/students`);
        if (courseData.course.course_code !== "MTH-CHECK") throw new Error("Course code was not saved during creation");
        if (courseData.course.roll_numbers.join(",") !== "9001,9002,9010") {
            throw new Error("Separate roll-number ranges were not returned accurately");
        }
        if (courseData.students.length !== 3 || courseData.students.some(student => student.roll_number === "9003")) {
            throw new Error("Separate roll-number ranges were not created correctly");
        }
        const firstStudentId = courseData.students[0].id;
        const todayParts = Object.fromEntries(
            new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit"
            }).formatToParts(new Date()).map(part => [part.type, part.value])
        );
        const today = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
        const dateBeforeToday = days => {
            const value = new Date(`${today}T00:00:00Z`);
            value.setUTCDate(value.getUTCDate() - days);
            return value.toISOString().slice(0, 10);
        };
        const firstAttendanceDate = dateBeforeToday(2);
        const missedAttendanceDate = dateBeforeToday(1);

        await request("/api/attendance/mark", {
            method: "POST",
            body: JSON.stringify({ courseId, date: today, absentStudentIds: [] })
        }, 201);
        const savedAttendance = await request(`/api/attendance/course/${courseId}`);
        if (!savedAttendance.attendance.length || savedAttendance.attendance.some(record => record.attendance_date !== today)) {
            throw new Error("Attendance dates shifted during API serialization");
        }
        await pool.query(
            "UPDATE attendance SET attendance_date = $1 WHERE course_id = $2 AND attendance_date = $3",
            [firstAttendanceDate, courseId, today]
        );
        await request("/api/attendance/mark", {
            method: "POST",
            body: JSON.stringify({ courseId, date: missedAttendanceDate, absentStudentIds: [] })
        }, 201);
        const corrected = await request(`/api/attendance/course/${courseId}/${firstAttendanceDate}`, {
            method: "PUT",
            body: JSON.stringify({ absentStudentIds: [firstStudentId] })
        });
        if (corrected.changed !== 1) throw new Error("Attendance correction did not record one change");
        const audit = await request(`/api/attendance/course/${courseId}/audit/log`);
        if (audit.audit.length !== 1 || audit.audit[0].changed_by_name === undefined) throw new Error("Attendance audit was not recorded");

        await request(`/api/courses/${courseId}/settings`, {
            method: "PUT",
            body: JSON.stringify({
                name: "Edited Workflow Class", course_code: "MTH-EDIT", section: "E", results_enabled: true, result_code: editedCode,
                assignments_enabled: true, assignment_count: 2, assignment_max_marks: 12,
                quizzes_enabled: true, quiz_count: 2, quiz_max_marks: 6,
                midterm_enabled: true, midterm_max_marks: 35,
                final_enabled: true, final_max_marks: 60
            })
        });
        const marks = await request(`/api/courses/${courseId}/marks`);
        if (marks.assignments.length !== 2 || marks.quizzes.length !== 2) throw new Error("Assessment counts did not update");
        if (marks.course.name !== "Edited Workflow Class" || marks.course.course_code !== "MTH-EDIT" || marks.course.section !== "E") {
            throw new Error("Class information did not update");
        }

        await request(`/api/courses/${courseId}/students/import`, {
            method: "POST",
            body: JSON.stringify({ students: [
                { roll_number: "9001", name: "Updated Student One" },
                { roll_number: "9003", name: "Imported Student Three" }
            ] })
        });
        courseData = await request(`/api/courses/${courseId}/students`);
        if (courseData.students.length !== 4 || !courseData.students.some(student => student.name === "Imported Student Three")) {
            throw new Error("Student import did not update and add students");
        }
        const importedStudent = courseData.students.find(student => student.roll_number === "9003");
        const statusesWithImportedStudent = courseData.students.map(student => ({
            student_id: Number(student.id),
            status: Number(student.id) === Number(firstStudentId) || Number(student.id) === Number(importedStudent.id)
                ? "absent"
                : "present"
        }));
        const addedToAttendance = await request(`/api/attendance/course/${courseId}/${firstAttendanceDate}`, {
            method: "PUT",
            body: JSON.stringify({ studentStatuses: statusesWithImportedStudent })
        });
        if (![0, 1].includes(Number(addedToAttendance.changed))) {
            throw new Error("Newly imported student's existing attendance could not be confirmed");
        }
        const attendanceWithImportedStudent = await request(`/api/attendance/course/${courseId}`);
        const importedAttendance = attendanceWithImportedStudent.attendance.find(record =>
            Number(record.student_id) === Number(importedStudent.id) && record.attendance_date === firstAttendanceDate
        );
        if (!importedAttendance || importedAttendance.status !== "absent") {
            throw new Error("Newly imported student's attendance status was not saved");
        }

        const published = await fetch(`${origin}/api/results/lookup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resultCode: editedCode, rollNumber: "9001" })
        });
        const publishedData = await published.json();
        if (!publishedData.success || publishedData.result.assignments.length !== 2 || publishedData.result.quizzes.length !== 2) {
            throw new Error("Published results did not reflect edited assessments");
        }

        console.log("Pending-class blocking, administrator approval, course code, missed-date attendance, multiple roll ranges, class settings, assessment counts, custom result code, student import, attendance correction (including a newly added student), audit history, and published results all passed.");
    } finally {
        if (courseId !== null) {
            const target = await pool.query("SELECT name FROM courses WHERE id = $1 AND teacher_id = $2", [courseId, teacherId]);
            if (target.rows[0]?.name === "Edited Workflow Class" || target.rows[0]?.name?.startsWith("__EDIT_WORKFLOW_CHECK_")) {
                await request(`/api/courses/${courseId}`, { method: "DELETE" });
            } else if (target.rows.length) {
                throw new Error("Refused to clean up a course that was not created by this check");
            }
            const remaining = await pool.query("SELECT 1 FROM courses WHERE id = $1", [courseId]);
            if (remaining.rows.length) throw new Error("Temporary test course cleanup failed");
        }
        await new Promise(resolve => server.close(resolve));
        await pool.end();
    }
})().catch(error => {
    console.error(`Edit workflow check failed: ${error.message}`);
    process.exitCode = 1;
});
