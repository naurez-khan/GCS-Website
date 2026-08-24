const jwt = require("jsonwebtoken");
const pool = require("../config/db");


// ==========================================
// AUTHENTICATE USER
// ==========================================

const authenticate = async (req, res, next) => {

    try {

        const token = req.cookies.token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }


        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );


        req.user = decoded;

        const accountResult = await pool.query(
            "SELECT role, is_active FROM users WHERE id = $1",
            [decoded.id]
        );
        const account = accountResult.rows[0];
        if (!account || !account.is_active || account.role !== decoded.role) {
            return res.status(401).json({
                success: false,
                message: "Account is inactive or unavailable"
            });
        }

        next();


    } catch (error) {

        return res.status(401).json({
            success: false,
            message: "Invalid or expired authentication"
        });

    }

};


// ==========================================
// ADMIN ONLY
// ==========================================

const adminOnly = (req, res, next) => {

    if (!req.user || req.user.role !== "admin") {

        return res.status(403).json({
            success: false,
            message: "Admin access required"
        });

    }

    next();

};


const teacherOnly = async (req, res, next) => {
    if (req.user?.role === "teacher") return next();

    const viewedTeacherId = Number(req.user?.acting_as_teacher_id);
    if (req.user?.role === "admin" && Number.isInteger(viewedTeacherId) && viewedTeacherId > 0) {
        const teacherResult = await pool.query(
            "SELECT id FROM users WHERE id = $1 AND role = 'teacher' AND is_active = TRUE",
            [viewedTeacherId]
        );
        if (!teacherResult.rows.length) {
            return res.status(403).json({
                success: false,
                message: "The selected teacher account is inactive or unavailable"
            });
        }
        const adminId = req.user.id;
        req.user = { id: viewedTeacherId, role: "teacher", actingAdminId: adminId };
        return next();
    }

    return res.status(403).json({
        success: false,
        message: "Teacher access required. Administrators must select a teacher first."
    });
};

module.exports = {
    authenticate,
    adminOnly,
    teacherOnly
};
