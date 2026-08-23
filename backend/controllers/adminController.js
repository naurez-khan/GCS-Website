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
    transferCourse
};
