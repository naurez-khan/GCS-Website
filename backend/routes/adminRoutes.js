const express = require("express");

const {
    addTeacher,
    getTeachers,
    updateTeacherName,
    addAdmin,
    getAdmins,
    viewTeacherDashboard,
    stopViewingTeacher,
    deleteTeacher,
    setTeacherAdminAccess,
    setAdminStatus,
    getTransferableCourses,
    getPendingCourseApprovals,
    setCourseApprovalStatus,
    transferCourse,
    resetUserPassword,
    restoreClassBackup,
    getBsMathSemestersList,
    getBsMathConsolidatedAttendance,
    downloadBsMathConsolidatedPdf
} = require("../controllers/adminController");

const {
    authenticate,
    adminOnly
} = require("../middleware/authMiddleware");

const router = express.Router();


// Add teacher

router.post(
    "/teachers",
    authenticate,
    adminOnly,
    addTeacher
);


// Get teachers

router.get(
    "/teachers",
    authenticate,
    adminOnly,
    getTeachers
);

router.post("/admins", authenticate, adminOnly, addAdmin);
router.get("/admins", authenticate, adminOnly, getAdmins);
router.post("/teachers/:teacherId/view", authenticate, adminOnly, viewTeacherDashboard);
router.post("/stop-viewing-teacher", authenticate, adminOnly, stopViewingTeacher);
router.delete("/teachers/:teacherId", authenticate, adminOnly, deleteTeacher);
router.patch("/teachers/:teacherId/name", authenticate, adminOnly, updateTeacherName);
router.patch("/teachers/:teacherId/admin-access", authenticate, adminOnly, setTeacherAdminAccess);
router.patch("/admins/:adminId/status", authenticate, adminOnly, setAdminStatus);
router.get("/courses", authenticate, adminOnly, getTransferableCourses);
router.get("/course-approvals", authenticate, adminOnly, getPendingCourseApprovals);
router.patch("/courses/:courseId/approval", authenticate, adminOnly, setCourseApprovalStatus);
router.patch("/courses/:courseId/transfer", authenticate, adminOnly, transferCourse);
router.patch("/users/:userId/password", authenticate, adminOnly, resetUserPassword);
router.post("/backups/restore", authenticate, adminOnly, restoreClassBackup);
router.get("/attendance/bs-math/semesters", authenticate, adminOnly, getBsMathSemestersList);
router.get("/attendance/bs-math/consolidated", authenticate, adminOnly, getBsMathConsolidatedAttendance);
router.get("/attendance/bs-math/consolidated-pdf", authenticate, adminOnly, downloadBsMathConsolidatedPdf);


module.exports = router;
