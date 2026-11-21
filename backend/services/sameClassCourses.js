const MIN_ROLL_OVERLAP_RATIO = 0.5;

const PROGRAM_ALIASES = [
    [/^(?:bs\s+)?math(?:ematics)?$/, "bs mathematics"],
    [/^(?:bs\s+)?(?:cs|computer\s+science)$/, "bs computer science"],
    [/^(?:bs\s+)?(?:it|information\s+technology)$/, "bs information technology"],
    [/^(?:bs\s+)?(?:se|software\s+engineering)$/, "bs software engineering"],
    [/^(?:bs\s+)?(?:phy|physics)$/, "bs physics"],
    [/^(?:bs\s+)?(?:chem|chemistry)$/, "bs chemistry"],
    [/^(?:bs\s+)?(?:stat|statistics)$/, "bs statistics"],
    [/^(?:bs\s+)?(?:eng|english)$/, "bs english"],
    [/^(?:bs\s+)?(?:eco|economics)$/, "bs economics"],
    [/^(?:bs\s+)?(?:bot|botany)$/, "bs botany"],
    [/^(?:bs\s+)?(?:zoo|zoology)$/, "bs zoology"],
    [/^(?:bs\s+)?(?:isl|islamiat|islamic\s+studies)$/, "bs islamic studies"],
    [/^(?:bs\s+)?urdu$/, "bs urdu"],
    [/^(?:bs\s+)?(?:bba|business\s+administration)$/, "bba"],
    [/^fsc\s*(?:pre\s*eng(?:ineering)?)?$/, "fsc pre engineering"],
    [/^fsc\s*pre\s*med(?:ical)?$/, "fsc pre medical"],
    [/^ics$/, "ics"],
    [/^icom$/, "icom"],
    [/^fa$/, "fa"]
];

const ROMAN_SEMESTERS = new Map([
    ["i", "1"],
    ["ii", "2"],
    ["iii", "3"],
    ["iv", "4"],
    ["v", "5"],
    ["vi", "6"],
    ["vii", "7"],
    ["viii", "8"]
]);

function normalizeRollNumber(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");
}

function normalizeProgram(value) {
    const raw = String(value ?? "").trim().toLowerCase();
    if (!raw) return "";
    const compact = raw
        .replace(/\bb\s*\.\s*s\b\.?/g, "bs")
        .replace(/\bf\s*\.\s*sc\b\.?/g, "fsc")
        .replace(/\bi\s*\.\s*c\s*\.\s*s\b\.?/g, "ics")
        .replace(/\bi\s*\.\s*com\b\.?/g, "icom")
        .replace(/\bf\s*\.\s*a\b\.?/g, "fa")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\bhons?\b/g, "")
        .replace(/\s+/g, " ")
        .trim();
    if (!compact) return "";
    for (const [pattern, canonical] of PROGRAM_ALIASES) {
        if (pattern.test(compact)) return canonical;
    }
    return compact;
}

function normalizeSemesterOrYear(course) {
    const classType = String(course?.class_type || "bachelors").trim().toLowerCase();
    const raw = classType === "intermediate"
        ? String(course?.intermediate_year || course?.semester || "").trim().toLowerCase()
        : String(course?.semester || "").trim().toLowerCase();

    if (!raw) return "";

    if (classType === "intermediate") {
        if (/\b(1st|1|first|xi|11|part\s*1|part\s*i)\b/.test(raw) || raw === "1st_year") return "1";
        if (/\b(2nd|2|second|xii|12|part\s*2|part\s*ii)\b/.test(raw) || raw === "2nd_year") return "2";
    }

    const digitMatch = raw.match(/\b([1-8])(?:st|nd|rd|th)?\b/);
    if (digitMatch) return digitMatch[1];

    const cleaned = raw
        .replace(/\b(?:semester|sem|year|part)\b/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    if (ROMAN_SEMESTERS.has(cleaned)) return ROMAN_SEMESTERS.get(cleaned);

    return cleaned;
}

function normalizeSection(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/^(?:sec(?:tion)?)\s*[-:.]?\s*/i, "")
        .replace(/[^a-z0-9]+/g, "");
}

function evaluateSameClassMatch(baseCourse, baseRollNumbers, candidateCourse, candidateRollNumbers) {
    const noMatch = { matched: false, overlapCount: 0, overlapRatio: 0, overlapPercent: 0 };

    if (!baseCourse || !candidateCourse) return noMatch;
    if (Number(baseCourse.id) === Number(candidateCourse.id)) return noMatch;
    if (Number(baseCourse.teacher_id) !== Number(candidateCourse.teacher_id)) return noMatch;
    if (candidateCourse.approval_status && candidateCourse.approval_status !== "approved") return noMatch;
    if (candidateCourse.attendance_enabled === false) return noMatch;

    const baseType = String(baseCourse.class_type || "bachelors").trim().toLowerCase();
    const candType = String(candidateCourse.class_type || "bachelors").trim().toLowerCase();
    if (baseType !== candType) return noMatch;

    const baseShift = String(baseCourse.class_shift || "morning").trim().toLowerCase();
    const candShift = String(candidateCourse.class_shift || "morning").trim().toLowerCase();
    if (baseShift !== candShift) return noMatch;

    if (baseType === "bachelors") {
        const baseProgram = normalizeProgram(baseCourse.program);
        const candProgram = normalizeProgram(candidateCourse.program);
        if (baseProgram && candProgram && baseProgram !== candProgram) {
            return noMatch;
        }
    }

    const baseSem = normalizeSemesterOrYear(baseCourse);
    const candSem = normalizeSemesterOrYear(candidateCourse);
    if (baseSem && candSem && baseSem !== candSem) {
        return noMatch;
    }

    const baseSec = normalizeSection(baseCourse.section);
    const candSec = normalizeSection(candidateCourse.section);
    if (baseSec && candSec && baseSec !== candSec) {
        return noMatch;
    }

    const baseSet = new Set((baseRollNumbers || []).map(normalizeRollNumber).filter(Boolean));
    const candSet = new Set((candidateRollNumbers || []).map(normalizeRollNumber).filter(Boolean));
    if (baseSet.size === 0 || candSet.size === 0) {
        return noMatch;
    }

    let overlapCount = 0;
    for (const roll of baseSet) {
        if (candSet.has(roll)) overlapCount += 1;
    }

    const maxSize = Math.max(baseSet.size, candSet.size);
    const overlapRatio = maxSize > 0 ? overlapCount / maxSize : 0;
    const overlapPercent = Math.round(overlapRatio * 100);

    if (overlapRatio < MIN_ROLL_OVERLAP_RATIO) {
        return { matched: false, overlapCount, overlapRatio, overlapPercent };
    }

    return { matched: true, overlapCount, overlapRatio, overlapPercent };
}

function mapAbsentRollsToTargetCourse(absentRollNumbers, targetStudents, targetLeaveIds = new Set()) {
    const absentRollSet = new Set((absentRollNumbers || []).map(normalizeRollNumber).filter(Boolean));
    const targetRollSet = new Set();
    const entries = [];
    let presentCount = 0;
    let absentCount = 0;

    for (const student of targetStudents || []) {
        const normalizedRoll = normalizeRollNumber(student.roll_number);
        if (normalizedRoll) targetRollSet.add(normalizedRoll);
        if (targetLeaveIds.has(Number(student.id))) continue;

        const isAbsent = normalizedRoll && absentRollSet.has(normalizedRoll);
        const status = isAbsent ? "absent" : "present";
        if (isAbsent) absentCount += 1;
        else presentCount += 1;

        entries.push({
            studentId: student.id,
            status
        });
    }

    let unmatchedAbsentCount = 0;
    for (const roll of absentRollSet) {
        if (!targetRollSet.has(roll)) unmatchedAbsentCount += 1;
    }

    return {
        entries,
        totalStudents: (targetStudents || []).length,
        presentCount,
        absentCount,
        leaveCount: targetLeaveIds.size,
        unmatchedAbsentCount
    };
}

async function getSiblingCoursesForAttendance(db, { courseId, teacherId, date }) {
    const coursesResult = await db.query(
        `
        SELECT
            id,
            name,
            course_code,
            class_type,
            intermediate_year,
            class_shift,
            program,
            semester,
            section,
            teacher_id,
            approval_status,
            attendance_enabled,
            TO_CHAR(class_start_date, 'YYYY-MM-DD') AS class_start_date
        FROM courses
        WHERE teacher_id = $1
          AND approval_status = 'approved'
          AND attendance_enabled = TRUE
        ORDER BY id ASC
        `,
        [teacherId]
    );

    const baseCourse = coursesResult.rows.find(c => Number(c.id) === Number(courseId));
    if (!baseCourse) return null;

    const candidates = coursesResult.rows.filter(c => Number(c.id) !== Number(courseId));
    if (!candidates.length) return [];

    const allCourseIds = [Number(baseCourse.id), ...candidates.map(c => Number(c.id))];

    const studentsResult = await db.query(
        `
        SELECT course_id, roll_number
        FROM students
        WHERE course_id = ANY($1::int[])
          AND deleted_at IS NULL
        `,
        [allCourseIds]
    );

    const rollsByCourse = new Map();
    for (const row of studentsResult.rows) {
        const cid = Number(row.course_id);
        if (!rollsByCourse.has(cid)) rollsByCourse.set(cid, []);
        rollsByCourse.get(cid).push(row.roll_number);
    }

    const baseRolls = rollsByCourse.get(Number(baseCourse.id)) || [];
    const matchedCandidates = [];

    for (const candidate of candidates) {
        const candRolls = rollsByCourse.get(Number(candidate.id)) || [];
        const match = evaluateSameClassMatch(baseCourse, baseRolls, candidate, candRolls);
        if (match.matched) {
            matchedCandidates.push({
                course: candidate,
                totalStudents: candRolls.length,
                matchingStudents: match.overlapCount,
                overlapPercent: match.overlapPercent
            });
        }
    }

    if (!matchedCandidates.length) return [];

    const matchedIds = matchedCandidates.map(item => Number(item.course.id));

    const [attendanceResult, holidaysResult] = await Promise.all([
        db.query(
            `
            SELECT DISTINCT course_id
            FROM attendance
            WHERE course_id = ANY($1::int[])
              AND attendance_date = $2
              AND status <> 'leave'
            `,
            [matchedIds, date]
        ),
        db.query(
            `
            SELECT course_id, name
            FROM course_holidays
            WHERE course_id = ANY($1::int[])
              AND holiday_date = $2
            `,
            [matchedIds, date]
        )
    ]);

    const markedSet = new Set(attendanceResult.rows.map(r => Number(r.course_id)));
    const holidayMap = new Map(holidaysResult.rows.map(r => [Number(r.course_id), r.name]));

    return matchedCandidates.map(({ course, totalStudents, matchingStudents, overlapPercent }) => {
        const cid = Number(course.id);
        const alreadyMarked = markedSet.has(cid);
        const holidayName = holidayMap.get(cid) || null;
        const isHoliday = Boolean(holidayName);
        const beforeStartDate = Boolean(date && course.class_start_date && date < course.class_start_date);

        let disabledReason = null;
        if (alreadyMarked) {
            disabledReason = "Already marked for this date";
        } else if (isHoliday) {
            disabledReason = `Public holiday (${holidayName})`;
        } else if (beforeStartDate) {
            disabledReason = `Before class start date (${course.class_start_date})`;
        } else if (totalStudents === 0) {
            disabledReason = "No students in this course";
        }

        return {
            id: cid,
            name: course.name,
            course_code: course.course_code || "",
            program: course.program || "",
            semester: course.semester || "",
            section: course.section || "",
            class_shift: course.class_shift || "morning",
            class_start_date: course.class_start_date || null,
            totalStudents,
            matchingStudents,
            overlapPercent,
            alreadyMarked,
            isHoliday,
            holidayName,
            beforeStartDate,
            canSync: disabledReason === null,
            disabledReason
        };
    });
}

module.exports = {
    MIN_ROLL_OVERLAP_RATIO,
    normalizeRollNumber,
    normalizeProgram,
    normalizeSemesterOrYear,
    normalizeSection,
    evaluateSameClassMatch,
    mapAbsentRollsToTargetCourse,
    getSiblingCoursesForAttendance
};
