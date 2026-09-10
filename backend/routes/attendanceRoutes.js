const express = require("express");

const {
    markAttendance,
    getAttendance,
    updateAttendance,
    getAttendanceAudit,
    getCourseHolidays,
    createCourseHoliday,
    updateCourseHoliday,
    deleteCourseHoliday
} = require("../controllers/attendanceController");

const { createStudentLeave } = require("../controllers/leaveController");
const {
    authenticate,
    teacherOnly
} = require("../middleware/authMiddleware");
const { requireApprovedCourse } = require("../middleware/courseApprovalMiddleware");

const router = express.Router();

router.use(authenticate, teacherOnly);


// =========================
// MARK ATTENDANCE
// =========================

router.post(
    "/mark",
    requireApprovedCourse,
    markAttendance
);


// =========================
// GET COURSE ATTENDANCE
// =========================

router.use("/course/:courseId", requireApprovedCourse);

router.get(
    "/course/:courseId",
    getAttendance
);

router.post("/course/:courseId/leave", createStudentLeave);
router.put("/course/:courseId/:date", updateAttendance);
router.get("/course/:courseId/audit/log", getAttendanceAudit);

router.get("/course/:courseId/holidays", getCourseHolidays);
router.post("/course/:courseId/holidays", createCourseHoliday);
router.put("/course/:courseId/holidays/:holidayId", updateCourseHoliday);
router.delete("/course/:courseId/holidays/:holidayId", deleteCourseHoliday);

module.exports = router;
