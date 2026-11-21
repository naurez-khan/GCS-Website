const test = require("node:test");
const assert = require("node:assert/strict");
const {
    normalizeProgram,
    normalizeSemesterOrYear,
    normalizeSection,
    evaluateSameClassMatch,
    mapAbsentRollsToTargetCourse
} = require("../services/sameClassCourses");

test("normalizeProgram unifies BS Math variants without colliding with other programs", () => {
    assert.equal(normalizeProgram("BS Mathematics"), "bs mathematics");
    assert.equal(normalizeProgram("BS Math"), "bs mathematics");
    assert.equal(normalizeProgram("B.S. Mathematics (Hons)"), "bs mathematics");
    assert.equal(normalizeProgram("BS Physics"), "bs physics");
    assert.notEqual(normalizeProgram("BS Mathematics"), normalizeProgram("BS Physics"));
});

test("normalizeSemesterOrYear normalizes Bachelors semesters and Intermediate years", () => {
    assert.equal(normalizeSemesterOrYear({ class_type: "bachelors", semester: "3rd" }), "3");
    assert.equal(normalizeSemesterOrYear({ class_type: "bachelors", semester: "3rd Semester" }), "3");
    assert.equal(normalizeSemesterOrYear({ class_type: "bachelors", semester: "Semester 3" }), "3");
    assert.equal(normalizeSemesterOrYear({ class_type: "bachelors", semester: "III" }), "3");
    assert.equal(normalizeSemesterOrYear({ class_type: "intermediate", intermediate_year: "1st_year" }), "1");
    assert.equal(normalizeSemesterOrYear({ class_type: "intermediate", semester: "2nd Year" }), "2");
    assert.equal(normalizeSection("Section A"), "a");
    assert.equal(normalizeSection("Sec-A"), "a");
});

test("evaluateSameClassMatch detects same-class courses across minor label differences", () => {
    const calculus = {
        id: 1,
        teacher_id: 10,
        approval_status: "approved",
        attendance_enabled: true,
        class_type: "bachelors",
        class_shift: "morning",
        program: "BS Mathematics",
        semester: "3rd",
        section: ""
    };
    const linearAlgebra = {
        id: 2,
        teacher_id: 10,
        approval_status: "approved",
        attendance_enabled: true,
        class_type: "bachelors",
        class_shift: "morning",
        program: "BS Math",
        semester: "3rd Semester",
        section: ""
    };

    const rollsA = ["101", "102", "103", "104", "105", "106"];
    const rollsB = ["101", "102", "103", "104", "105", "999"]; // 5/6 match + 1 repeater

    const match = evaluateSameClassMatch(calculus, rollsA, linearAlgebra, rollsB);
    assert.equal(match.matched, true);
    assert.equal(match.overlapCount, 5);
    assert.equal(match.overlapPercent, 83);
});

test("evaluateSameClassMatch rejects different shifts, different programs, and non-overlapping sections", () => {
    const rolls1to6 = ["1", "2", "3", "4", "5", "6"];
    const rolls7to12 = ["7", "8", "9", "10", "11", "12"];

    const base = {
        id: 1,
        teacher_id: 10,
        approval_status: "approved",
        attendance_enabled: true,
        class_type: "bachelors",
        class_shift: "morning",
        program: "BS Mathematics",
        semester: "1st",
        section: ""
    };

    // Different shift with identical rolls
    const eveningCourse = { ...base, id: 2, class_shift: "evening" };
    assert.equal(evaluateSameClassMatch(base, rolls1to6, eveningCourse, rolls1to6).matched, false);

    // Different program with identical rolls
    const physicsCourse = { ...base, id: 3, program: "BS Physics" };
    assert.equal(evaluateSameClassMatch(base, rolls1to6, physicsCourse, rolls1to6).matched, false);

    // Same metadata (blank section) but completely different students
    const otherSectionCourse = { ...base, id: 4 };
    assert.equal(evaluateSameClassMatch(base, rolls1to6, otherSectionCourse, rolls7to12).matched, false);

    // Unapproved course
    const pendingCourse = { ...base, id: 5, approval_status: "pending" };
    assert.equal(evaluateSameClassMatch(base, rolls1to6, pendingCourse, rolls1to6).matched, false);

    // Different teacher
    const otherTeacherCourse = { ...base, id: 6, teacher_id: 11 };
    assert.equal(evaluateSameClassMatch(base, rolls1to6, otherTeacherCourse, rolls1to6).matched, false);

    // Small unrelated test course sharing a handful of rolls with a large class (5/56 < 50%)
    const largeRolls = Array.from({ length: 56 }, (_, i) => String(i + 1));
    const tinySubsetRolls = ["1", "2", "3", "4", "5", "91", "92", "93", "94", "95"];
    const blankCourse = { ...base, id: 7, program: "", semester: "", section: "" };
    assert.equal(evaluateSameClassMatch(base, largeRolls, blankCourse, tinySubsetRolls).matched, false);
});

test("evaluateSameClassMatch supports Intermediate classes", () => {
    const mathInter = {
        id: 21,
        teacher_id: 5,
        approval_status: "approved",
        attendance_enabled: true,
        class_type: "intermediate",
        intermediate_year: "1st_year",
        class_shift: "morning",
        section: "M1"
    };
    const statsInter = {
        id: 22,
        teacher_id: 5,
        approval_status: "approved",
        attendance_enabled: true,
        class_type: "intermediate",
        intermediate_year: "1st_year",
        class_shift: "morning",
        section: "Sec M1"
    };
    const rolls = ["201", "202", "203", "204"];
    assert.equal(evaluateSameClassMatch(mathInter, rolls, statsInter, rolls).matched, true);
});

test("mapAbsentRollsToTargetCourse matches by roll number, preserves leaves, and handles repeaters", () => {
    const targetStudents = [
        { id: 501, roll_number: "BS-101" },
        { id: 502, roll_number: "BS-102" },
        { id: 503, roll_number: "BS-103" },
        { id: 504, roll_number: "BS-104" }
    ];
    const targetLeaveIds = new Set([502]); // BS-102 is already on leave in Course B
    const absentRollNumbers = ["bs-101", "BS-102", "BS-999"]; // BS-999 is only in Course A

    const mapped = mapAbsentRollsToTargetCourse(absentRollNumbers, targetStudents, targetLeaveIds);
    assert.equal(mapped.totalStudents, 4);
    assert.equal(mapped.leaveCount, 1);
    assert.equal(mapped.absentCount, 1);
    assert.equal(mapped.presentCount, 2);
    assert.equal(mapped.unmatchedAbsentCount, 1);
    assert.deepEqual(mapped.entries, [
        { studentId: 501, status: "absent" },
        { studentId: 503, status: "present" },
        { studentId: 504, status: "present" }
    ]);
});
