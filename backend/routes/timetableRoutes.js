const express = require("express");
const { authenticate, teacherOnly } = require("../middleware/authMiddleware");
const { getTimetable, updateTimetable, downloadMonthlyLectureRecord } = require("../controllers/timetableController");

const router = express.Router();
router.use(authenticate, teacherOnly);
router.get("/", getTimetable);
router.put("/", updateTimetable);
router.get("/monthly-record.pdf", downloadMonthlyLectureRecord);

module.exports = router;
