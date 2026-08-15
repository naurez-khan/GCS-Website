const express = require("express");

const {
    createCourse,
    getMyCourses,
    getCourseStudents,
    updateStudent,
    getCourseAssignments,
    updateAssignment,
    getCourseQuizzes,
    updateQuiz,
    getCourseMarks,
    updateCourseMarks,
    updateCourseSettings,
    importStudents,
    deleteCourse
} = require("../controllers/courseController");

const {
    authenticate,
    teacherOnly
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate, teacherOnly);


// =========================
// CREATE COURSE
// =========================

router.post(
    "/",
    createCourse
);


// =========================
// GET MY COURSES
// =========================

router.get(
    "/my",
    getMyCourses
);


// =========================
// GET COURSE STUDENTS
// =========================

router.get(
    "/:courseId/students",
    getCourseStudents
);

router.put(
    "/:courseId/students/:studentId",
    updateStudent
);

router.post("/:courseId/students/import", importStudents);

router.put("/:courseId/settings", updateCourseSettings);


// =========================
// GET COURSE ASSIGNMENTS
// =========================

router.get(
    "/:courseId/assignments",
    getCourseAssignments
);


// =========================
// UPDATE ASSIGNMENT
// =========================

router.put(
    "/:courseId/assignments/:assignmentId",
    updateAssignment
);


// =========================
// GET COURSE QUIZZES
// =========================

router.get(
    "/:courseId/quizzes",
    getCourseQuizzes
);


// =========================
// UPDATE QUIZ
// =========================

router.put(
    "/:courseId/quizzes/:quizId",
    updateQuiz
);


// =========================
// GET COURSE MARKS
// =========================

router.get(
    "/:courseId/marks",
    getCourseMarks
);


// =========================
// UPDATE COURSE MARKS
// =========================

router.put(
    "/:courseId/marks",
    updateCourseMarks
);


// =========================
// DELETE COURSE
// =========================

router.delete(
    "/:courseId",
    deleteCourse
);


module.exports = router;
