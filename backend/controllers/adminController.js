const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const setSessionCookie = (res, payload) => {
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "8h" });
    res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 8 * 60 * 60 * 1000
    });
};


// ==========================================
// ADD TEACHER
// ==========================================

const addTeacher = async (req, res) => {

    try {

        const {
            name,
            email,
            password
        } = req.body;


        // Validate input

        const cleanName = String(name || "").trim();
        const cleanEmail = String(email || "").trim().toLowerCase();

        if (!cleanName || !cleanEmail || !password) {

            return res.status(400).json({
                success: false,
                message: "Name, email and password are required"
            });

        }


        if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
            return res.status(400).json({ success: false, message: "Enter a valid email address" });
        }

        if (String(password).length < 8) {
            return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
        }

        // Check if email already exists

        const existingUser = await pool.query(
            `
            SELECT id
            FROM users
            WHERE LOWER(email) = $1
            `,
            [cleanEmail]
        );


        if (existingUser.rows.length > 0) {

            return res.status(409).json({
                success: false,
                message: "A user with this email already exists"
            });

        }


        // Hash password

        const passwordHash = await bcrypt.hash(
            password,
            12
        );


        // Create teacher

        const result = await pool.query(
            `
            INSERT INTO users
            (name, email, password_hash, role, is_active)
            VALUES ($1, $2, $3, 'teacher', true)
            RETURNING id, name, email, role, is_active, created_at
            `,
            [
                cleanName,
                cleanEmail,
                passwordHash
            ]
        );


        res.status(201).json({
            success: true,
            message: "Teacher created successfully",
            teacher: result.rows[0]
        });


    } catch (error) {

        console.error("Add teacher error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });

    }

};


// ==========================================
// GET ALL TEACHERS
// ==========================================

const getTeachers = async (req, res) => {

    try {

        const result = await pool.query(
            `
            SELECT
                id,
                name,
                email,
                role,
                is_active,
                created_at
            FROM users
            WHERE role = 'teacher'
            ORDER BY name
            `
        );


        res.json({
            success: true,
            teachers: result.rows
        });


    } catch (error) {

        console.error("Get teachers error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });

    }

};

const getTransferableCourses = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.id, c.name, c.course_code, c.section, c.class_type, c.teacher_id,
                    u.name AS teacher_name
             FROM courses c
             JOIN users u ON u.id = c.teacher_id AND u.role = 'teacher'
             ORDER BY u.name, c.name, c.section NULLS LAST, c.id`
        );
        res.json({ success: true, courses: result.rows });
    } catch (error) {
        console.error("Get transferable courses error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

const transferCourse = async (req, res) => {
    const client = await pool.connect();
    try {
        const courseId = Number(req.params.courseId);
        const newTeacherId = Number(req.body.new_teacher_id);
        if (!Number.isInteger(courseId) || courseId < 1 || !Number.isInteger(newTeacherId) || newTeacherId < 1) {
            return res.status(400).json({ success: false, message: "Choose a valid class and receiving teacher" });
        }

        await client.query("BEGIN");
        const courseResult = await client.query(
            `SELECT c.id, c.name, c.teacher_id, u.name AS teacher_name
             FROM courses c JOIN users u ON u.id = c.teacher_id
             WHERE c.id = $1 FOR UPDATE OF c`,
            [courseId]
        );
        const course = courseResult.rows[0];
        if (!course) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Class not found" });
        }
        if (Number(course.teacher_id) === newTeacherId) {
            await client.query("ROLLBACK");
            return res.status(400).json({ success: false, message: "Choose a different receiving teacher" });
        }

        const teacherResult = await client.query(
            "SELECT id, name FROM users WHERE id = $1 AND role = 'teacher' AND is_active = TRUE",
            [newTeacherId]
        );
        const newTeacher = teacherResult.rows[0];
        if (!newTeacher) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "The receiving teacher is not active or does not exist" });
        }

        await client.query("UPDATE courses SET teacher_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [newTeacherId, courseId]);
        await client.query("COMMIT");
        res.json({
            success: true,
            message: `${course.name} transferred from ${course.teacher_name} to ${newTeacher.name}. All class records were preserved.`
        });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Transfer course error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    } finally {
        client.release();
    }
};

const addAdmin = async (req, res) => {
    try {
        const cleanName = String(req.body.name || "").trim();
        const cleanEmail = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");

        if (!cleanName || !cleanEmail || !password) {
            return res.status(400).json({ success: false, message: "Name, email and password are required" });
        }
        if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
            return res.status(400).json({ success: false, message: "Enter a valid email address" });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
        }

        const existing = await pool.query("SELECT id FROM users WHERE LOWER(email) = $1", [cleanEmail]);
        if (existing.rows.length) {
            return res.status(409).json({ success: false, message: "A user with this email already exists" });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const result = await pool.query(
            `INSERT INTO users (name, email, password_hash, role, is_active)
             VALUES ($1, $2, $3, 'admin', true)
             RETURNING id, name, email, role, is_active, created_at`,
            [cleanName, cleanEmail, passwordHash]
        );

        res.status(201).json({
            success: true,
            message: "Administrator created successfully",
            admin: result.rows[0]
        });
    } catch (error) {
        console.error("Add admin error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

const getAdmins = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, email, role, is_active, created_at
             FROM users WHERE role = 'admin' ORDER BY name`
        );
        res.json({ success: true, admins: result.rows });
    } catch (error) {
        console.error("Get admins error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

const viewTeacherDashboard = async (req, res) => {
    try {
        const teacherId = Number(req.params.teacherId);
        if (!Number.isInteger(teacherId) || teacherId < 1) {
            return res.status(400).json({ success: false, message: "Invalid teacher" });
        }

        const result = await pool.query(
            `SELECT id, name, email, role, is_active
             FROM users WHERE id = $1 AND role = 'teacher'`,
            [teacherId]
        );
        const teacher = result.rows[0];
        if (!teacher) {
            return res.status(404).json({ success: false, message: "Teacher not found" });
        }
        if (!teacher.is_active) {
            return res.status(403).json({ success: false, message: "This teacher account is inactive" });
        }

        setSessionCookie(res, {
            id: req.user.id,
            role: "admin",
            acting_as_teacher_id: teacher.id
        });
        res.json({ success: true, message: `Viewing ${teacher.name}'s dashboard`, teacher });
    } catch (error) {
        console.error("View teacher dashboard error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

const stopViewingTeacher = async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, name, email, role, is_active FROM users WHERE id = $1 AND role = 'admin'",
            [req.user.id]
        );
        const admin = result.rows[0];
        if (!admin || !admin.is_active) {
            return res.status(401).json({ success: false, message: "Administrator account is unavailable" });
        }

        setSessionCookie(res, { id: admin.id, role: "admin" });
        res.json({ success: true, message: "Returned to administration", user: admin });
    } catch (error) {
        console.error("Stop viewing teacher error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

const setTeacherStatus = async (req, res) => {
    try {
        const teacherId = Number(req.params.teacherId);
        const isActive = req.body.is_active;
        if (!Number.isInteger(teacherId) || teacherId < 1 || typeof isActive !== "boolean") {
            return res.status(400).json({ success: false, message: "A valid teacher and status are required" });
        }

        const result = await pool.query(
            `UPDATE users SET is_active = $1
             WHERE id = $2 AND role = 'teacher'
             RETURNING id, name, email, role, is_active, created_at`,
            [isActive, teacherId]
        );
        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: "Teacher not found" });
        }

        res.json({
            success: true,
            message: isActive ? "Teacher restored successfully" : "Teacher removed successfully. Their records were preserved.",
            teacher: result.rows[0]
        });
    } catch (error) {
        console.error("Set teacher status error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

const setAdminStatus = async (req, res) => {
    const client = await pool.connect();
    try {
        const adminId = Number(req.params.adminId);
        const isActive = req.body.is_active;
        if (!Number.isInteger(adminId) || adminId < 1 || typeof isActive !== "boolean") {
            return res.status(400).json({ success: false, message: "A valid administrator and status are required" });
        }
        if (!isActive && adminId === Number(req.user.id)) {
            return res.status(400).json({ success: false, message: "You cannot remove your own administrator account" });
        }

        await client.query("BEGIN");
        const admins = await client.query(
            "SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE FOR UPDATE"
        );
        if (!isActive && admins.rows.length <= 1) {
            await client.query("ROLLBACK");
            return res.status(409).json({ success: false, message: "The last active administrator cannot be removed" });
        }

        const result = await client.query(
            `UPDATE users SET is_active = $1
             WHERE id = $2 AND role = 'admin'
             RETURNING id, name, email, role, is_active, created_at`,
            [isActive, adminId]
        );
        if (!result.rows.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Administrator not found" });
        }

        await client.query("COMMIT");
        res.json({
            success: true,
            message: isActive ? "Administrator restored successfully" : "Administrator removed successfully. Their audit records were preserved.",
            admin: result.rows[0]
        });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Set admin status error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    } finally {
        client.release();
    }
};

const resetUserPassword = async (req, res) => {
    try {
        const userId = Number(req.params.userId);
        const password = String(req.body.password || "");
        if (!Number.isInteger(userId) || userId < 1) {
            return res.status(400).json({ success: false, message: "Choose a valid account" });
        }
        if (password.length < 8 || password.length > 128) {
            return res.status(400).json({ success: false, message: "Temporary password must be 8-128 characters" });
        }

        const target = await pool.query(
            "SELECT id, name, email, role FROM users WHERE id=$1 AND role IN ('teacher','admin')",
            [userId]
        );
        if (!target.rows.length) {
            return res.status(404).json({ success: false, message: "Account not found" });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        await pool.query(
            "UPDATE users SET password_hash=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2",
            [passwordHash, userId]
        );
        res.json({
            success: true,
            message: `Password reset successfully for ${target.rows[0].name}. Their old password no longer works.`
        });
    } catch (error) {
        console.error("Reset user password error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

const restoreClassBackup = async (req, res) => {
    const client = await pool.connect();
    try {
        const teacherId = Number(req.body.teacher_id);
        const backup = req.body.backup;
        if (!Number.isInteger(teacherId) || teacherId < 1) {
            return res.status(400).json({ success: false, message: "Choose a receiving teacher" });
        }
        if (!backup || backup.format !== "math-department-class-backup" || Number(backup.version) !== 1 || !backup.course) {
            return res.status(400).json({ success: false, message: "This is not a supported class backup file" });
        }

        const students = Array.isArray(backup.students) ? backup.students : [];
        const attendance = Array.isArray(backup.attendance) ? backup.attendance : [];
        const audit = Array.isArray(backup.attendance_audit_logs) ? backup.attendance_audit_logs : [];
        const assignments = Array.isArray(backup.assignments) ? backup.assignments : [];
        const quizzes = Array.isArray(backup.quizzes) ? backup.quizzes : [];
        const assignmentMarks = Array.isArray(backup.assignment_marks) ? backup.assignment_marks : [];
        const quizMarks = Array.isArray(backup.quiz_marks) ? backup.quiz_marks : [];
        if (!students.length || students.length > 500 || attendance.length > 200000 || audit.length > 200000 || assignments.length > 111 || quizzes.length > 100 || assignmentMarks.length > 100000 || quizMarks.length > 100000) {
            return res.status(400).json({ success: false, message: "Backup contents exceed the supported class limits" });
        }

        const sourceCourse = backup.course;
        const activeStudents = students.filter(student => !student.deleted_at);
        const activeRolls = activeStudents.map(student => Number(student.roll_number));
        if (!activeRolls.length || activeRolls.some(roll => !Number.isInteger(roll) || roll < 0) || new Set(activeRolls).size !== activeRolls.length) {
            return res.status(400).json({ success: false, message: "Backup contains invalid or duplicate active roll numbers" });
        }

        await client.query("BEGIN");
        const teacher = await client.query("SELECT id, name FROM users WHERE id=$1 AND role='teacher' AND is_active=TRUE FOR UPDATE", [teacherId]);
        if (!teacher.rows.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Receiving teacher is not active or does not exist" });
        }

        const restoredName = `${String(sourceCourse.name || "Restored Class").slice(0, 135)} (Restored)`;
        const courseResult = await client.query(
            `INSERT INTO courses (
                name, course_code, class_type, intermediate_year, class_shift, roll_entry_mode,
                program, semester, section, teacher_id, roll_start, roll_end,
                course_name_enabled, program_enabled, semester_enabled, section_enabled,
                roll_number_enabled, student_name_enabled, attendance_enabled,
                assignments_enabled, assignment_count, quizzes_enabled, quiz_count,
                midterm_enabled, final_enabled, results_enabled, monthly_tests_enabled,
                midterm_max_marks, final_max_marks
             ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29
             ) RETURNING *`,
            [
                restoredName, sourceCourse.course_code || null, sourceCourse.class_type || "bachelors",
                sourceCourse.intermediate_year || null, sourceCourse.class_shift || "morning", sourceCourse.roll_entry_mode || "manual",
                sourceCourse.program || null, sourceCourse.semester || null, sourceCourse.section || null, teacherId,
                Math.min(...activeRolls), Math.max(...activeRolls),
                sourceCourse.course_name_enabled !== false, sourceCourse.program_enabled !== false,
                sourceCourse.semester_enabled !== false, sourceCourse.section_enabled !== false,
                sourceCourse.roll_number_enabled !== false, sourceCourse.student_name_enabled === true,
                sourceCourse.attendance_enabled !== false, sourceCourse.assignments_enabled === true,
                Number(sourceCourse.assignment_count) || 0, sourceCourse.quizzes_enabled === true,
                Number(sourceCourse.quiz_count) || 0, sourceCourse.midterm_enabled === true,
                sourceCourse.final_enabled === true, false, sourceCourse.monthly_tests_enabled === true,
                sourceCourse.midterm_max_marks || null, sourceCourse.final_max_marks || null
            ]
        );
        const newCourse = courseResult.rows[0];
        const studentIds = new Map();
        for (const student of students) {
            const oldId = Number(student.id);
            const roll = Number(student.roll_number);
            if (!Number.isInteger(oldId) || !Number.isInteger(roll) || roll < 0) throw Object.assign(new Error("Backup contains an invalid student record"), { status: 400 });
            const inserted = await client.query(
                `INSERT INTO students (course_id,roll_number,name,program,semester,midterm_marks,final_marks,december_test_marks,preboard_marks,deleted_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
                [newCourse.id, String(roll), student.name || null, student.program || null, student.semester || null,
                 student.midterm_marks ?? null, student.final_marks ?? null, student.december_test_marks ?? null,
                 student.preboard_marks ?? null, student.deleted_at || null]
            );
            studentIds.set(oldId, inserted.rows[0].id);
        }

        const assignmentIds = new Map();
        for (const assignment of assignments) {
            const inserted = await client.query(
                `INSERT INTO assignments (course_id,assignment_number,name,max_marks,assessment_type,month_number)
                 VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
                [newCourse.id, Number(assignment.assignment_number), assignment.name, assignment.max_marks,
                 assignment.assessment_type || "assignment", assignment.month_number ?? null]
            );
            assignmentIds.set(Number(assignment.id), inserted.rows[0].id);
        }
        const quizIds = new Map();
        for (const quiz of quizzes) {
            const inserted = await client.query(
                "INSERT INTO quizzes (course_id,quiz_number,name,max_marks) VALUES ($1,$2,$3,$4) RETURNING id",
                [newCourse.id, Number(quiz.quiz_number), quiz.name, quiz.max_marks]
            );
            quizIds.set(Number(quiz.id), inserted.rows[0].id);
        }

        for (const record of attendance) {
            const newStudentId = studentIds.get(Number(record.student_id));
            if (!newStudentId) continue;
            await client.query(
                "INSERT INTO attendance (course_id,student_id,attendance_date,status) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
                [newCourse.id, newStudentId, record.attendance_date, record.status]
            );
        }
        for (const mark of assignmentMarks) {
            const assignmentId = assignmentIds.get(Number(mark.assignment_id));
            const studentId = studentIds.get(Number(mark.student_id));
            if (assignmentId && studentId) await client.query("INSERT INTO assignment_marks (assignment_id,student_id,marks) VALUES ($1,$2,$3)", [assignmentId, studentId, mark.marks]);
        }
        for (const mark of quizMarks) {
            const quizId = quizIds.get(Number(mark.quiz_id));
            const studentId = studentIds.get(Number(mark.student_id));
            if (quizId && studentId) await client.query("INSERT INTO quiz_marks (quiz_id,student_id,marks) VALUES ($1,$2,$3)", [quizId, studentId, mark.marks]);
        }

        const auditUserIds = [...new Set(audit.map(record => Number(record.changed_by)).filter(Number.isInteger))];
        const validAuditUsers = auditUserIds.length
            ? new Set((await client.query("SELECT id FROM users WHERE id=ANY($1::int[])", [auditUserIds])).rows.map(row => Number(row.id)))
            : new Set();
        for (const record of audit) {
            const studentId = studentIds.get(Number(record.student_id));
            if (!studentId) continue;
            const changedBy = validAuditUsers.has(Number(record.changed_by)) ? Number(record.changed_by) : Number(req.user.id);
            await client.query(
                `INSERT INTO attendance_audit_logs (course_id,student_id,attendance_date,old_status,new_status,changed_by,changed_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [newCourse.id, studentId, record.attendance_date, record.old_status, record.new_status, changedBy, record.changed_at || new Date()]
            );
        }

        await client.query("COMMIT");
        res.status(201).json({
            success: true,
            message: `${newCourse.name} restored for ${teacher.rows[0].name}.`,
            course: { id: newCourse.id, name: newCourse.name, teacher_id: teacherId }
        });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Restore class backup error:", error);
        res.status(error.status || 400).json({ success: false, message: error.status ? error.message : "Backup could not be restored. Check that the file is valid." });
    } finally {
        client.release();
    }
};

module.exports = {
    addTeacher,
    getTeachers,
    addAdmin,
    getAdmins,
    viewTeacherDashboard,
    stopViewingTeacher,
    setTeacherStatus,
    setAdminStatus,
    getTransferableCourses,
    transferCourse,
    resetUserPassword,
    restoreClassBackup
};
