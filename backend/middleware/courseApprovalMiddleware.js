const pool = require("../config/db");

function createRequireApprovedCourse(database = pool) {
    return async function requireApprovedCourse(req, res, next) {
        try {
            const courseId = Number(req.params.courseId || req.body?.courseId);
            const teacherId = Number(req.user?.id);
            if (!Number.isInteger(courseId) || courseId < 1) {
                return res.status(400).json({ success: false, message: "Choose a valid class" });
            }

            const result = await database.query(
                "SELECT approval_status FROM courses WHERE id = $1 AND teacher_id = $2",
                [courseId, teacherId]
            );
            const course = result.rows[0];
            if (!course) {
                return res.status(404).json({ success: false, message: "Class not found or access denied" });
            }
            if (course.approval_status !== "approved") {
                const rejected = course.approval_status === "rejected";
                return res.status(403).json({
                    success: false,
                    code: "COURSE_APPROVAL_REQUIRED",
                    approval_status: course.approval_status,
                    message: rejected
                        ? "This class was rejected by an administrator and cannot be used"
                        : "This class is waiting for administrator approval"
                });
            }
            next();
        } catch (error) {
            console.error("Course approval check error:", error);
            res.status(500).json({ success: false, message: "Server error" });
        }
    };
}

module.exports = {
    createRequireApprovedCourse,
    requireApprovedCourse: createRequireApprovedCourse()
};
