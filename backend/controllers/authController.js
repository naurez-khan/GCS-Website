const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { getAvailableRoles, canUseRole, getDefaultRole } = require("../lib/roles");

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
// LOGIN
// ==========================================

const login = async (req, res) => {

    try {

        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }


        // Find user
        const result = await pool.query(
            `
            SELECT id, name, email, password_hash, role, can_admin, is_active
            FROM users
            WHERE LOWER(email) = $1
            `,
            [email]
        );


        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }


        const user = result.rows[0];


        // Check if account is active
        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: "Your account has been deactivated"
            });
        }


        // Compare password
        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );


        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }


        const roles = getAvailableRoles(user);
        const activeRole = getDefaultRole(user);
        setSessionCookie(res, { id: user.id, role: activeRole });


        res.json({
            success: true,
            message: "Login successful",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: activeRole,
                roles
            }
        });


    } catch (error) {

        console.error("Login error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });

    }

};


const logout = (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax"
    });
    res.json({ success: true, message: "Logged out successfully" });
};

const getCurrentUser = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, email, role, can_admin, is_active FROM users WHERE id = $1`,
            [req.user.id]
        );
        const user = result.rows[0];
        if (!user || !user.is_active) {
            return res.status(401).json({ success: false, message: "Account is unavailable" });
        }
        const roles = getAvailableRoles(user);
        const sessionUser = { ...user, role: req.user.role, roles };
        delete sessionUser.can_admin;
        let actingAsTeacher = null;
        const actingTeacherId = Number(req.user.acting_as_teacher_id);
        if (req.user.role === "admin" && Number.isInteger(actingTeacherId) && actingTeacherId > 0) {
            const teacherResult = await pool.query(
                "SELECT id, name, email, role, is_active FROM users WHERE id = $1 AND role = 'teacher' AND is_active = TRUE",
                [actingTeacherId]
            );
            actingAsTeacher = teacherResult.rows[0] || null;
        }
        res.json({ success: true, user: sessionUser, acting_as_teacher: actingAsTeacher });
    } catch (error) {
        console.error("Current user error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

const selectRole = async (req, res) => {
    try {
        const role = String(req.body.role || "");
        if (!["teacher", "admin"].includes(role)) {
            return res.status(400).json({ success: false, message: "Choose a valid portal" });
        }

        const result = await pool.query(
            "SELECT id, name, email, role, can_admin, is_active FROM users WHERE id = $1",
            [req.user.id]
        );
        const account = result.rows[0];
        if (!account || !account.is_active) {
            return res.status(401).json({ success: false, message: "Account is unavailable" });
        }
        if (!canUseRole(account, role)) {
            return res.status(403).json({ success: false, message: "You do not have access to that portal" });
        }

        setSessionCookie(res, { id: account.id, role });
        res.json({
            success: true,
            message: role === "admin" ? "Administration portal selected" : "Teacher workspace selected",
            user: {
                id: account.id,
                name: account.name,
                email: account.email,
                role,
                roles: getAvailableRoles(account)
            }
        });
    } catch (error) {
        console.error("Select role error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

const getPendingApprovalCount = async (req, res) => {
    try {
        const accountResult = await pool.query(
            "SELECT role, can_admin, is_active FROM users WHERE id = $1",
            [req.user.id]
        );
        const account = accountResult.rows[0];
        if (!account || !account.is_active || !canUseRole(account, "admin")) {
            return res.status(403).json({ success: false, message: "Administrator access required" });
        }

        const result = await pool.query(
            "SELECT COUNT(*)::int AS count FROM courses WHERE approval_status = 'pending'"
        );
        res.json({ success: true, count: Number(result.rows[0]?.count || 0) });
    } catch (error) {
        console.error("Pending approval count error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

const changePassword = async (req, res) => {
    try {
        const currentPassword = String(req.body.current_password || "");
        const newPassword = String(req.body.new_password || "");

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: "Current and new passwords are required" });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
        }
        if (newPassword.length > 128 || currentPassword.length > 200) {
            return res.status(400).json({ success: false, message: "Password is too long" });
        }

        const result = await pool.query(
            "SELECT password_hash FROM users WHERE id = $1 AND is_active = TRUE",
            [req.user.id]
        );
        if (!result.rows.length) {
            return res.status(401).json({ success: false, message: "Account is unavailable" });
        }

        const currentMatches = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
        if (!currentMatches) {
            return res.status(400).json({ success: false, message: "Current password is incorrect" });
        }
        if (await bcrypt.compare(newPassword, result.rows[0].password_hash)) {
            return res.status(400).json({ success: false, message: "New password must be different from the current password" });
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);
        await pool.query(
            "UPDATE users SET password_hash = $1 WHERE id = $2",
            [passwordHash, req.user.id]
        );

        res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
        console.error("Change password error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

module.exports = {
    login,
    logout,
    getCurrentUser,
    selectRole,
    getPendingApprovalCount,
    changePassword
};
