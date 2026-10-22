const pool = require("../config/db");
const { createBsMathConsolidatedAttendancePdf, compareRollNumbers } = require("../lib/bsMathConsolidatedAttendancePdf");

const BS_MATH_COURSE_FILTER = `
    (c.program ILIKE '%math%')
`;

function normalizeSemester(sem) {
    if (!sem) return "";
    return String(sem).trim();
}

async function getAvailableBsMathSemesters() {
    const result = await pool.query(`
        SELECT DISTINCT c.semester, c.section, c.class_shift, COUNT(c.id)::integer AS course_count
        FROM courses c
        WHERE ${BS_MATH_COURSE_FILTER}
          AND c.semester IS NOT NULL
          AND TRIM(c.semester) <> ''
        GROUP BY c.semester, c.section, c.class_shift
        ORDER BY c.semester, c.section, c.class_shift
    `);

    const semestersMap = new Map();
    for (const row of result.rows) {
        const sem = normalizeSemester(row.semester);
        if (!semestersMap.has(sem)) {
            semestersMap.set(sem, {
                semester: sem,
                sections: new Set(),
                shifts: new Set(),
                courseCount: 0
            });
        }
        const item = semestersMap.get(sem);
        if (row.section) item.sections.add(row.section.trim());
        if (row.class_shift) item.shifts.add(row.class_shift.trim());
        item.courseCount += row.course_count;
    }

    return [...semestersMap.values()].map(item => ({
        semester: item.semester,
        sections: [...item.sections].sort(),
        shifts: [...item.shifts].sort(),
        courseCount: item.courseCount
    }));
}

async function getBsMathConsolidatedReport({ semester, section = "", shift = "", month = "", from = "", to = "" }) {
    if (!semester) {
        throw new Error("Semester is required to generate consolidated attendance");
    }

    let startDate = from || null;
    let endDate = to || null;
    let periodLabel = "";

    if (month && /^\d{4}-\d{2}$/.test(month)) {
        const [year, monthNum] = month.split("-").map(Number);
        const lastDay = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
        startDate = `${month}-01`;
        endDate = `${month}-${String(lastDay).padStart(2, "0")}`;
        periodLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
            .format(new Date(Date.UTC(year, monthNum - 1, 1)));
    } else if (startDate && endDate) {
        periodLabel = `${startDate} to ${endDate}`;
    }

    // 1. Fetch matching courses
    const courseQuery = `
        SELECT c.id, c.name, c.course_code, c.program, c.semester, c.section, c.class_shift,
               u.name AS teacher_name
        FROM courses c
        JOIN users u ON c.teacher_id = u.id
        WHERE ${BS_MATH_COURSE_FILTER}
          AND (
              LOWER(TRIM(c.semester)) = LOWER(TRIM($1))
              OR (
                  NULLIF(REGEXP_REPLACE(c.semester, '[^0-9]', '', 'g'), '') IS NOT NULL
                  AND NULLIF(REGEXP_REPLACE($1, '[^0-9]', '', 'g'), '') IS NOT NULL
                  AND NULLIF(REGEXP_REPLACE(c.semester, '[^0-9]', '', 'g'), '')::integer = NULLIF(REGEXP_REPLACE($1, '[^0-9]', '', 'g'), '')::integer
              )
          )
          AND ($2::text IS NULL OR $2 = '' OR LOWER(TRIM(COALESCE(c.section, ''))) = LOWER(TRIM($2)))
          AND ($3::text IS NULL OR $3 = '' OR LOWER(TRIM(c.class_shift)) = LOWER(TRIM($3)))
        ORDER BY c.course_code NULLS LAST, c.name
    `;

    const coursesRes = await pool.query(courseQuery, [
        semester,
        section ? section.trim() : null,
        shift ? shift.trim() : null
    ]);

    if (!coursesRes.rows.length) {
        throw new Error(`No BS Mathematics classes found for semester "${semester}"`);
    }

    const courseIds = coursesRes.rows.map(row => Number(row.id));

    // 2. Total lectures conducted per course in date range
    const lecturesQuery = `
        SELECT course_id, COUNT(DISTINCT attendance_date)::integer AS total_lectures
        FROM attendance
        WHERE course_id = ANY($1::int[])
          AND ($2::date IS NULL OR attendance_date >= $2)
          AND ($3::date IS NULL OR attendance_date <= $3)
        GROUP BY course_id
    `;
    const lecturesRes = await pool.query(lecturesQuery, [courseIds, startDate, endDate]);
    const totalLecturesMap = new Map();
    lecturesRes.rows.forEach(r => totalLecturesMap.set(Number(r.course_id), Number(r.total_lectures)));

    // 3. Students across these courses
    const studentsQuery = `
        SELECT course_id, TRIM(roll_number) AS roll_number, TRIM(name) AS name
        FROM students
        WHERE course_id = ANY($1::int[])
          AND deleted_at IS NULL
    `;
    const studentsRes = await pool.query(studentsQuery, [courseIds]);

    const studentNamesMap = new Map();
    const allRollsSet = new Set();
    studentsRes.rows.forEach(row => {
        const roll = row.roll_number;
        allRollsSet.add(roll);
        if (row.name && (!studentNamesMap.has(roll) || !studentNamesMap.get(roll))) {
            studentNamesMap.set(roll, row.name);
        }
    });

    // 4. Attendance counts per student per course
    const attendanceQuery = `
        SELECT a.course_id, TRIM(s.roll_number) AS roll_number,
               COUNT(CASE WHEN a.status = 'present' THEN 1 END)::integer AS present_count,
               COUNT(CASE WHEN a.status = 'leave' THEN 1 END)::integer AS leave_count,
               COUNT(CASE WHEN a.status = 'absent' THEN 1 END)::integer AS absent_count
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        WHERE a.course_id = ANY($1::int[])
          AND s.deleted_at IS NULL
          AND ($2::date IS NULL OR a.attendance_date >= $2)
          AND ($3::date IS NULL OR a.attendance_date <= $3)
        GROUP BY a.course_id, TRIM(s.roll_number)
    `;
    const attendanceRes = await pool.query(attendanceQuery, [courseIds, startDate, endDate]);

    // Map: rollNumber -> Map(courseId -> { present, leave, absent, attended, pct })
    const attendanceMatrix = new Map();
    attendanceRes.rows.forEach(r => {
        const roll = r.roll_number;
        if (!attendanceMatrix.has(roll)) attendanceMatrix.set(roll, new Map());
        const total = totalLecturesMap.get(Number(r.course_id)) || 0;
        const present = Number(r.present_count);
        const leave = Number(r.leave_count);
        const attended = present + leave; // Leave is credited as attended in college records
        const pct = total > 0 ? (attended / total) * 100 : 0;

        attendanceMatrix.get(roll).set(Number(r.course_id), {
            present,
            leave,
            absent: Number(r.absent_count),
            attended,
            total,
            pct
        });
    });

    const courses = coursesRes.rows.map(c => ({
        id: Number(c.id),
        name: c.name,
        courseCode: c.course_code || c.name,
        teacherName: c.teacher_name,
        totalLectures: totalLecturesMap.get(Number(c.id)) || 0
    }));

    const sortedRolls = [...allRollsSet].sort(compareRollNumbers);

    const students = sortedRolls.map(roll => {
        const studentCourseStats = {};
        let totalLectures = 0;
        let totalAttended = 0;

        courses.forEach(c => {
            const stat = attendanceMatrix.get(roll)?.get(c.id) || {
                present: 0,
                leave: 0,
                absent: 0,
                attended: 0,
                total: c.totalLectures,
                pct: 0
            };
            studentCourseStats[c.id] = stat;
            totalLectures += c.totalLectures;
            totalAttended += stat.attended;
        });

        const overallPct = totalLectures > 0 ? (totalAttended / totalLectures) * 100 : 0;

        return {
            rollNumber: roll,
            name: studentNamesMap.get(roll) || "—",
            courses: studentCourseStats,
            overall: {
                totalLectures,
                totalAttended,
                percentage: overallPct
            }
        };
    });

    return {
        semester,
        section: section || null,
        shift: shift ? (shift === "evening" ? "Evening" : "Morning") : null,
        periodLabel: periodLabel || "Full Semester",
        courses,
        students
    };
}

module.exports = {
    getAvailableBsMathSemesters,
    getBsMathConsolidatedReport,
    createBsMathConsolidatedAttendancePdf
};
