const express = require("express");

const {
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
router.patch("/teachers/:teacherId/status", authenticate, adminOnly, setTeacherStatus);
router.patch("/admins/:adminId/status", authenticate, adminOnly, setAdminStatus);
router.get("/courses", authenticate, adminOnly, getTransferableCourses);
router.patch("/courses/:courseId/transfer", authenticate, adminOnly, transferCourse);
router.patch("/users/:userId/password", authenticate, adminOnly, resetUserPassword);
router.post("/backups/restore", authenticate, adminOnly, restoreClassBackup);


module.exports = router;
