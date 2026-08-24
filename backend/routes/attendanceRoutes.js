const express = require("express");

const {
    markAttendance,
    getAttendance,
    updateAttendance,
    getAttendanceAudit
} = require("../controllers/attendanceController");

const { createStudentLeave } = require("../controllers/leaveController");
const {
    authenticate,
    teacherOnly
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate, teacherOnly);


// =========================
// MARK ATTENDANCE
// =========================

router.post(
    "/mark",
    markAttendance
);


// =========================
// GET COURSE ATTENDANCE
// =========================

router.get(
    "/course/:courseId",
    getAttendance
);

router.post("/course/:courseId/leave", createStudentLeave);
router.put("/course/:courseId/:date", updateAttendance);
router.get("/course/:courseId/audit/log", getAttendanceAudit);


module.exports = router;
