const pool = require("../config/db");
const crypto = require("node:crypto");


// =========================
// CREATE COURSE
// =========================

const createCourse = async (req, res) => {

    const client = await pool.connect();

    try {

        const {
            name,
            course_code,
            program,
            semester,
            section,
            rollStart,
            rollEnd,
            rollRanges,
            roll_numbers,
            roll_entry_mode,
            class_type,
            intermediate_year,
            class_shift,

            course_name_enabled,
            roll_number_enabled,

            program_enabled,
            semester_enabled,
            section_enabled,
            student_name_enabled,
            student_names = [],

            attendance_enabled,
            assignments_enabled,
            assignment_count,
            assignment_max_marks,
            quizzes_enabled,
            quiz_count,
            quiz_max_marks,
            monthly_tests_enabled,
            monthly_tests = [],
            midterm_enabled,
            midterm_max_marks,
            final_enabled,
            final_max_marks,
            results_enabled,
            result_code

        } = req.body;

        // =========================
        // REQUIRED FIELDS
        // =========================

        if (!name || !name.trim()) {

            return res.status(400).json({
                success: false,
                message: "Course name is required"
            });

        }

        const hasExplicitRollNumbers = Array.isArray(roll_numbers) && roll_numbers.length > 0;
        const requestedRollRanges = Array.isArray(rollRanges) && rollRanges.length
            ? rollRanges
            : (hasExplicitRollNumbers ? [] : [{ start: rollStart, end: rollEnd, step: 1 }]);

        if (!hasExplicitRollNumbers && (!requestedRollRanges.length || requestedRollRanges.length > 50)) {

            return res.status(400).json({
                success: false,
                message: "Add between 1 and 50 roll number ranges"
            });

        }

        const requestedCourseCode = String(course_code || "").trim() || null;

        if (requestedCourseCode && requestedCourseCode.length > 50) {
            return res.status(400).json({
                success: false,
                message: "Course code cannot exceed 50 characters"
            });
        }

        // =========================
        // ROLL NUMBER VALIDATION
        // =========================

        const parseRollLimit = value => (
            value === undefined || value === null || String(value).trim() === ""
                ? Number.NaN
                : Number(value)
        );
        const normalizedRollRanges = requestedRollRanges.map(range => ({
            start: parseRollLimit(range?.start),
            end: parseRollLimit(range?.end),
            step: range?.step === undefined ? 1 : parseRollLimit(range.step)
        }));

        if (normalizedRollRanges.some(range =>
            !Number.isInteger(range.start) ||
            !Number.isInteger(range.end) ||
            !Number.isInteger(range.step) ||
            range.start < 0 ||
            range.end < 0 ||
            range.step < 1 ||
            range.start > range.end
        )) {

            return res.status(400).json({
                success: false,
                message: "Each roll number range must have valid limits and a positive sequence difference"
            });

        }

        normalizedRollRanges.sort((first, second) =>
            first.start - second.start || first.end - second.end
        );

        const generatedRollNumbers = normalizedRollRanges.flatMap(range => {
            const values = [];
            for (let roll = range.start; roll <= range.end; roll += range.step) values.push(roll);
            return values;
        });
        const rollNumbers = hasExplicitRollNumbers
            ? roll_numbers.map(parseRollLimit)
            : generatedRollNumbers;
        const studentCount = rollNumbers.length;

        if (studentCount < 1 || studentCount > 500 || rollNumbers.some(roll => !Number.isInteger(roll) || roll < 0)) {
            return res.status(400).json({
                success: false,
                message: "Provide between 1 and 500 whole, non-negative roll numbers"
            });
        }

        const rollNumberSet = new Set(rollNumbers);
        if (rollNumberSet.size !== rollNumbers.length) {
            return res.status(400).json({ success: false, message: "Roll numbers must be unique" });
        }
        const start = Math.min(...rollNumbers);
        const end = Math.max(...rollNumbers);

        const classType = String(class_type || "bachelors").trim().toLowerCase();
        const intermediateYear = classType === "intermediate" ? String(intermediate_year || "").trim() : null;
        const classShift = String(class_shift || "morning").trim().toLowerCase();
        const cleanCourseCode = classType === "intermediate" ? null : requestedCourseCode;
        const rollEntryMode = ["range", "manual", "excel"].includes(roll_entry_mode) ? roll_entry_mode : "range";
        if (!["bachelors", "intermediate"].includes(classType) || (classType === "intermediate" && !["1st_year", "2nd_year"].includes(intermediateYear))) {
            return res.status(400).json({ success: false, message: "Choose a valid class level and Intermediate year" });
        }
        if (!["morning", "evening"].includes(classShift)) {
            return res.status(400).json({ success: false, message: "Choose Morning or Evening shift" });
        }

        // =========================
        // FEATURE SETTINGS
        // =========================

        const programEnabled = program_enabled !== false;
        const semesterEnabled = semester_enabled !== false;
        const sectionEnabled = section_enabled !== false;
        const studentNameEnabled = student_name_enabled === true;
        const attendanceEnabled = attendance_enabled !== false;
        const assignmentsEnabled = classType !== "intermediate" && assignments_enabled === true;
        const quizzesEnabled = classType !== "intermediate" && quizzes_enabled === true;
        const monthlyTestsEnabled = classType === "intermediate" && monthly_tests_enabled === true;
        const midtermEnabled = classType !== "intermediate" && midterm_enabled === true;
        const finalEnabled = classType !== "intermediate" && final_enabled === true;
        const resultsEnabled = results_enabled === true;
        const requestedResultCode = String(result_code || "").trim().toLowerCase();

        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const cleanMonthlyTests = monthlyTestsEnabled && Array.isArray(monthly_tests)
            ? monthly_tests.map(test => ({ month: Number(test?.month), maxMarks: Number(test?.max_marks) }))
            : [];
        if (monthlyTestsEnabled && (!cleanMonthlyTests.length || cleanMonthlyTests.length > 11 || cleanMonthlyTests.some(test => !Number.isInteger(test.month) || test.month < 1 || test.month > 11 || !Number.isFinite(test.maxMarks) || test.maxMarks <= 0) || new Set(cleanMonthlyTests.map(test => test.month)).size !== cleanMonthlyTests.length)) {
            return res.status(400).json({ success: false, message: "Monthly tests need unique months from January to November and positive maximum marks" });
        }

        if (resultsEnabled && !/^[a-z0-9-]{4,24}$/.test(requestedResultCode)) {
            return res.status(400).json({
                success: false,
                message: "Result code must be 4-24 letters, numbers, or hyphens"
            });
        }

        const studentNameMap = new Map();

        if (studentNameEnabled) {
            if (!Array.isArray(student_names) || student_names.length !== rollNumbers.length) {
                return res.status(400).json({
                    success: false,
                    message: "A student name is required for every roll number"
                });
            }

            for (const student of student_names) {
                const rollNumber = Number(student.roll_number);
                const studentName = String(student.name || "").trim();

                if (
                    !Number.isInteger(rollNumber) ||
                    !rollNumberSet.has(rollNumber) ||
                    !studentName ||
                    studentName.length > 150 ||
                    studentNameMap.has(rollNumber)
                ) {
                    return res.status(400).json({
                        success: false,
                        message: "Student names must be complete and match the roll number range"
                    });
                }

                studentNameMap.set(rollNumber, studentName);
            }
        }

        // =========================
        // ASSIGNMENT COUNT + MAX MARKS
        // =========================

        let assignmentCount = 0;
        let assignmentMaxMarks = null;

        if (assignmentsEnabled) {

            assignmentCount = parseInt(assignment_count, 10) || 0;

            if (assignmentCount < 1 || assignmentCount > 100) {

                return res.status(400).json({
                    success: false,
                    message: "Assignment count must be between 1 and 100"
                });

            }

            assignmentMaxMarks = Number(assignment_max_marks);

            if (Number.isNaN(assignmentMaxMarks) || assignmentMaxMarks <= 0) {

                return res.status(400).json({
                    success: false,
                    message: "Assignment max marks must be a positive number"
                });

            }

        }

        // =========================
        // QUIZ COUNT + MAX MARKS
        // =========================

        let quizCount = 0;
        let quizMaxMarks = null;

        if (quizzesEnabled) {

            quizCount = parseInt(quiz_count, 10) || 0;

            if (quizCount < 1 || quizCount > 100) {

                return res.status(400).json({
                    success: false,
                    message: "Quiz count must be between 1 and 100"
                });

            }

            quizMaxMarks = Number(quiz_max_marks);

            if (Number.isNaN(quizMaxMarks) || quizMaxMarks <= 0) {

                return res.status(400).json({
                    success: false,
                    message: "Quiz max marks must be a positive number"
                });

            }

        }

        // =========================
        // MIDTERM / FINAL MAX MARKS
        // =========================

        let midtermMaxMarks = null;
        let finalMaxMarks = null;

        if (midtermEnabled) {

            midtermMaxMarks = Number(midterm_max_marks);

            if (Number.isNaN(midtermMaxMarks) || midtermMaxMarks <= 0) {

                return res.status(400).json({
                    success: false,
                    message: "Midterm total marks must be a positive number"
                });

            }

        }

        if (finalEnabled) {

            finalMaxMarks = Number(final_max_marks);

            if (Number.isNaN(finalMaxMarks) || finalMaxMarks <= 0) {

                return res.status(400).json({
                    success: false,
                    message: "Final exam total marks must be a positive number"
                });

            }

        }

        // =========================
        // TEACHER ID
        // =========================

        const teacherId = req.user.id;
        const resultCode = resultsEnabled
            ? requestedResultCode
            : crypto.randomBytes(12).toString("hex");

        // =========================
        // OPTIONAL VALUES
        // =========================

        const courseProgram =
            programEnabled && program ? program.trim() : null;

        const courseSemester =
            semesterEnabled && semester ? semester.trim() : null;

        const courseSection =
            sectionEnabled && section ? section.trim() : null;

        // =========================
        // DATABASE INSERT
        // =========================

        await client.query("BEGIN");

        const courseResult =
            await client.query(
                `
                INSERT INTO courses
                (
                    name,
                    course_code,
                    program,
                    semester,
                    section,
                    teacher_id,
                    roll_start,
                    roll_end,

                    course_name_enabled,
                    program_enabled,
                    semester_enabled,
                    section_enabled,
                    roll_number_enabled,
                    student_name_enabled,

                    attendance_enabled,
                    assignments_enabled,
                    assignment_count,
                    quizzes_enabled,
                    quiz_count,
                    midterm_enabled,
                    final_enabled,
                    results_enabled,

                    midterm_max_marks,
                    final_max_marks,
                    result_code,
                    class_type,
                    intermediate_year,
                    roll_entry_mode,
                    monthly_tests_enabled,
                    class_shift
                )

                VALUES
                (
                    $1, $2, $3, $4, $5, $6, $7, $8,
                    $9, $10, $11, $12, $13, $14,
                    $15, $16, $17, $18, $19, $20, $21, $22,
                    $23, $24, $25, $26, $27, $28, $29, $30
                )

                RETURNING *
                `,
                [
                    name.trim(),
                    cleanCourseCode,
                    courseProgram,
                    courseSemester,
                    courseSection,
                    teacherId,
                    start,
                    end,

                    course_name_enabled !== false,
                    programEnabled,
                    semesterEnabled,
                    sectionEnabled,
                    roll_number_enabled !== false,
                    studentNameEnabled,

                    attendanceEnabled,
                    assignmentsEnabled,
                    assignmentCount,
                    quizzesEnabled,
                    quizCount,
                    midtermEnabled,
                    finalEnabled,
                    resultsEnabled,

                    midtermMaxMarks,
                    finalMaxMarks,
                    resultCode,
                    classType,
                    intermediateYear,
                    rollEntryMode,
                    monthlyTestsEnabled,
                    classShift
                ]
            );

        const course = courseResult.rows[0];

        // =========================
        // CREATE STUDENTS
        // =========================

        for (const roll of rollNumbers) {

            await client.query(
                `
                INSERT INTO students
                (roll_number, name, program, semester, course_id)
                VALUES ($1, $2, $3, $4, $5)
                `,
                [
                    roll.toString(),
                    studentNameEnabled
                        ? studentNameMap.get(roll)
                        : null,
                    courseProgram,
                    courseSemester,
                    course.id
                ]
            );

        }

        // =========================
        // CREATE ASSIGNMENT SLOTS
        // =========================

        if (assignmentsEnabled && assignmentCount > 0) {

            for (let i = 1; i <= assignmentCount; i++) {

                await client.query(
                    `
                    INSERT INTO assignments
                    (course_id, assignment_number, name, max_marks)
                    VALUES ($1, $2, $3, $4)
                    `,
                    [
                        course.id,
                        i,
                        `Assignment ${i}`,
                        assignmentMaxMarks
                    ]
                );

            }

        }

        // =========================
        // CREATE QUIZ SLOTS
        // =========================

        if (quizzesEnabled && quizCount > 0) {

            for (let i = 1; i <= quizCount; i++) {

                await client.query(
                    `
                    INSERT INTO quizzes
                    (course_id, quiz_number, name, max_marks)
                    VALUES ($1, $2, $3, $4)
                    `,
                    [
                        course.id,
                        i,
                        `Quiz ${i}`,
                        quizMaxMarks
                    ]
                );

            }

        }

        if (monthlyTestsEnabled) {
            for (const test of cleanMonthlyTests) {
                await client.query(
                    `INSERT INTO assignments
                     (course_id, assignment_number, name, max_marks, assessment_type, month_number)
                     VALUES ($1, $2, $3, $4, 'monthly_test', $5)`,
                    [course.id, 1000 + test.month, `${monthNames[test.month - 1]} Monthly Test`, test.maxMarks, test.month]
                );
            }
        }

        // =========================
        // RESPONSE
        // =========================

        await client.query("COMMIT");

        res.status(201).json({
            success: true,
            message: "Course created successfully",
            course: course
        });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error("Create course error:", error);

        res.status(error.code === "23505" ? 409 : 500).json({
            success: false,
            message: error.code === "23505"
                ? "That result code is already being used"
                : "Server error"
        });

    } finally {

        client.release();

    }

};



// =========================
// GET MY COURSES
// =========================

const getMyCourses = async (req, res) => {

    try {

        const teacherId =
            req.user.id;


        const result =
            await pool.query(
                `
                SELECT
                    id,
                    name,
                    course_code,
                    class_type,
                    intermediate_year,
                    class_shift,
                    roll_entry_mode,
                    program,
                    semester,
                    section,
                    roll_start,
                    roll_end,
                    ARRAY(
                        SELECT student.roll_number
                        FROM students student
                        WHERE student.course_id = courses.id
                        AND student.deleted_at IS NULL
                        ORDER BY student.roll_number::INTEGER
                    ) AS roll_numbers,

                    course_name_enabled,
                    program_enabled,
                    semester_enabled,
                    section_enabled,
                    roll_number_enabled,
                    student_name_enabled,

                    attendance_enabled,
                    assignments_enabled,
                    assignment_count,
                    quizzes_enabled,
                    quiz_count,
                    midterm_enabled,
                    final_enabled,
                    results_enabled,
                    monthly_tests_enabled,
                    result_code,

                    created_at

                FROM courses

                WHERE teacher_id = $1

                ORDER BY created_at DESC
                `,
                [teacherId]
            );


        res.json({

            success: true,

            courses:
                result.rows

        });


    } catch (error) {

        console.error(
            "Get courses error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Server error"

        });

    }

};



// =========================
// GET COURSE STUDENTS
// =========================

const getCourseStudents = async (
    req,
    res
) => {

    try {

        const teacherId =
            req.user.id;

        const courseId =
            req.params.courseId;


        // =========================
        // CHECK COURSE OWNERSHIP
        // =========================

        const courseResult =
            await pool.query(
                `
                SELECT
                    id,
                    name,
                    course_code,
                    class_type,
                    intermediate_year,
                    class_shift,
                    roll_entry_mode,
                    program,
                    semester,
                    section,
                    roll_start,
                    roll_end,
                    ARRAY(
                        SELECT student.roll_number
                        FROM students student
                        WHERE student.course_id = courses.id
                        AND student.deleted_at IS NULL
                        ORDER BY student.roll_number::INTEGER
                    ) AS roll_numbers,

                    course_name_enabled,
                    program_enabled,
                    semester_enabled,
                    section_enabled,
                    roll_number_enabled,
                    student_name_enabled,

                    attendance_enabled,
                    assignments_enabled,
                    assignment_count,
                    quizzes_enabled,
                    quiz_count,
                    midterm_enabled,
                    final_enabled,
                    results_enabled,
                    monthly_tests_enabled,
                    result_code,
                    midterm_max_marks,
                    final_max_marks

                FROM courses

                WHERE id = $1
                AND teacher_id = $2
                `,
                [
                    courseId,
                    teacherId
                ]
            );


        if (
            courseResult.rows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Course not found or access denied"

            });

        }


        // =========================
        // GET STUDENTS
        // =========================

        const studentsResult =
            await pool.query(
                `
                SELECT
                    id,
                    roll_number,
                    name,
                    program,
                    semester

                FROM students

                WHERE course_id = $1
                AND deleted_at IS NULL

                ORDER BY roll_number::INTEGER
                `,
                [courseId]
            );


        // =========================
        // RESPONSE
        // =========================

        res.json({

            success: true,

            course:
                courseResult.rows[0],

            students:
                studentsResult.rows

        });


    } catch (error) {

        console.error(
            "Get course students error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Server error"

        });

    }

};


// =========================
// GET COURSE ASSIGNMENTS
// =========================

const updateStudent = async (req, res) => {
    try {
        const courseId = req.params.courseId;
        const studentId = req.params.studentId;
        const name = String(req.body.name || "").trim();

        if (name.length > 150) {
            return res.status(400).json({ success: false, message: "Student name cannot exceed 150 characters" });
        }

        const result = await pool.query(
            `UPDATE students
             SET name = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND course_id = $3
               AND deleted_at IS NULL
               AND course_id IN (SELECT id FROM courses WHERE id = $3 AND teacher_id = $4)
             RETURNING id, roll_number, name, program, semester`,
            [name || null, studentId, courseId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Student not found or access denied" });
        }

        res.json({ success: true, student: result.rows[0] });
    } catch (error) {
        console.error("Update student error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

const updateCourseRollNumbers = async (req, res) => {
    const client = await pool.connect();
    try {
        const courseId = Number(req.params.courseId);
        const requestedStudents = Array.isArray(req.body.students) ? req.body.students : [];
        const removedStudentIds = Array.isArray(req.body.removed_student_ids)
            ? req.body.removed_student_ids.map(Number)
            : [];
        if (!Number.isInteger(courseId) || !requestedStudents.length || requestedStudents.length > 500) {
            return res.status(400).json({ success: false, message: "Provide between 1 and 500 roll numbers" });
        }

        const cleaned = requestedStudents.map(item => {
            const numericRoll = Number(String(item?.roll_number ?? "").trim());
            const studentId = item?.student_id === null || item?.student_id === undefined || item?.student_id === ""
                ? null
                : Number(item.student_id);
            return {
                studentId,
                rollNumber: numericRoll,
                rollText: Number.isInteger(numericRoll) ? String(numericRoll) : "",
                name: String(item?.name || "").trim()
            };
        });

        if (cleaned.some(item =>
            (item.studentId !== null && (!Number.isInteger(item.studentId) || item.studentId < 1)) ||
            !Number.isSafeInteger(item.rollNumber) || item.rollNumber < 0 || item.rollNumber > 2147483647 ||
            item.name.length > 150
        )) {
            return res.status(400).json({ success: false, message: "Roll numbers must be unique whole numbers between 0 and 2147483647" });
        }
        if (new Set(cleaned.map(item => item.rollText)).size !== cleaned.length) {
            return res.status(400).json({ success: false, message: "Each roll number must be unique" });
        }
        if (removedStudentIds.some(id => !Number.isInteger(id) || id < 1) || new Set(removedStudentIds).size !== removedStudentIds.length) {
            return res.status(400).json({ success: false, message: "Invalid students selected for removal" });
        }

        await client.query("BEGIN");
        const courseResult = await client.query(
            `SELECT id, program, semester, student_name_enabled
             FROM courses WHERE id=$1 AND teacher_id=$2 FOR UPDATE`,
            [courseId, req.user.id]
        );
        if (!courseResult.rows.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Course not found or access denied" });
        }
        const course = courseResult.rows[0];
        const existingResult = await client.query(
            "SELECT id, name FROM students WHERE course_id=$1 AND deleted_at IS NULL ORDER BY id FOR UPDATE",
            [courseId]
        );
        const existingById = new Map(existingResult.rows.map(student => [Number(student.id), student]));
        const submittedExistingIds = cleaned.filter(item => item.studentId !== null).map(item => item.studentId);
        const submittedSet = new Set(submittedExistingIds);
        const removedSet = new Set(removedStudentIds);
        if (
            new Set(submittedExistingIds).size !== submittedExistingIds.length ||
            submittedExistingIds.some(id => !existingById.has(id)) ||
            removedStudentIds.some(id => !existingById.has(id) || submittedSet.has(id)) ||
            submittedExistingIds.length + removedStudentIds.length !== existingById.size
        ) {
            throw Object.assign(new Error("Reload the page before editing roll numbers; the student list has changed"), { status: 409 });
        }
        if (course.student_name_enabled && cleaned.some(item => item.studentId === null && !item.name)) {
            throw Object.assign(new Error("Enter a name for every new roll number"), { status: 400 });
        }

        if (removedStudentIds.length) {
            await client.query(
                "UPDATE students SET deleted_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE course_id=$1 AND id=ANY($2::int[])",
                [courseId, removedStudentIds]
            );
        }

        // Free the final numeric values first so swaps such as 10 ↔ 11 stay safe.
        for (const student of existingResult.rows.filter(student => !removedSet.has(Number(student.id)))) {
            await client.query(
                "UPDATE students SET roll_number=$1 WHERE id=$2 AND course_id=$3",
                [`__roll_edit_${courseId}_${student.id}`, student.id, courseId]
            );
        }

        for (const item of cleaned) {
            if (item.studentId !== null) {
                const existing = existingById.get(item.studentId);
                await client.query(
                    `UPDATE students SET roll_number=$1, name=$2, updated_at=CURRENT_TIMESTAMP
                     WHERE id=$3 AND course_id=$4`,
                    [
                        item.rollText,
                        course.student_name_enabled ? (item.name || existing.name || null) : existing.name,
                        item.studentId,
                        courseId
                    ]
                );
            } else {
                await client.query(
                    `INSERT INTO students (course_id, roll_number, name, program, semester)
                     VALUES ($1,$2,$3,$4,$5)`,
                    [courseId, item.rollText, course.student_name_enabled ? item.name : null, course.program, course.semester]
                );
            }
        }

        const updatedCourse = await client.query(
            `UPDATE courses SET
                roll_start=(SELECT MIN(roll_number::INTEGER) FROM students WHERE course_id=$1 AND deleted_at IS NULL),
                roll_end=(SELECT MAX(roll_number::INTEGER) FROM students WHERE course_id=$1 AND deleted_at IS NULL),
                roll_entry_mode='manual', updated_at=CURRENT_TIMESTAMP
             WHERE id=$1 RETURNING *`,
            [courseId]
        );
        const updatedStudents = await client.query(
            `SELECT id, roll_number, name, program, semester
             FROM students WHERE course_id=$1 AND deleted_at IS NULL ORDER BY roll_number::INTEGER`,
            [courseId]
        );
        await client.query("COMMIT");
        res.json({
            success: true,
            message: removedStudentIds.length
                ? `${removedStudentIds.length} student${removedStudentIds.length === 1 ? "" : "s"} removed and roll numbers updated successfully`
                : "Roll numbers updated successfully",
            course: updatedCourse.rows[0],
            students: updatedStudents.rows
        });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Update course roll numbers error:", error);
        const duplicate = error.code === "23505";
        res.status(duplicate ? 409 : (error.status || 500)).json({
            success: false,
            message: duplicate ? "Each roll number must be unique" : (error.status ? error.message : "Server error")
        });
    } finally {
        client.release();
    }
};

const getDeletedStudents = async (req, res) => {
    try {
        const courseId = Number(req.params.courseId);
        const result = await pool.query(
            `SELECT s.id, s.roll_number, s.name, s.deleted_at
             FROM students s
             JOIN courses c ON c.id=s.course_id
             WHERE s.course_id=$1 AND c.teacher_id=$2 AND s.deleted_at IS NOT NULL
             ORDER BY s.deleted_at DESC, s.roll_number::INTEGER`,
            [courseId, req.user.id]
        );
        res.json({ success: true, students: result.rows });
    } catch (error) {
        console.error("Get deleted students error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

const restoreStudent = async (req, res) => {
    const client = await pool.connect();
    try {
        const courseId = Number(req.params.courseId);
        const studentId = Number(req.params.studentId);
        await client.query("BEGIN");
        const studentResult = await client.query(
            `SELECT s.id, s.roll_number, s.name
             FROM students s JOIN courses c ON c.id=s.course_id
             WHERE s.id=$1 AND s.course_id=$2 AND s.deleted_at IS NOT NULL AND c.teacher_id=$3
             FOR UPDATE OF s`,
            [studentId, courseId, req.user.id]
        );
        const student = studentResult.rows[0];
        if (!student) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Removed student not found" });
        }
        const conflict = await client.query(
            "SELECT id FROM students WHERE course_id=$1 AND roll_number=$2 AND deleted_at IS NULL",
            [courseId, student.roll_number]
        );
        if (conflict.rows.length) {
            await client.query("ROLLBACK");
            return res.status(409).json({ success: false, message: `Roll number ${student.roll_number} is already used. Change the active roll number before restoring.` });
        }
        await client.query("UPDATE students SET deleted_at=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=$1", [studentId]);
        await client.query(
            `UPDATE courses SET
                roll_start=(SELECT MIN(roll_number::INTEGER) FROM students WHERE course_id=$1 AND deleted_at IS NULL),
                roll_end=(SELECT MAX(roll_number::INTEGER) FROM students WHERE course_id=$1 AND deleted_at IS NULL),
                updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
            [courseId]
        );
        await client.query("COMMIT");
        res.json({ success: true, message: `Student ${student.roll_number} restored with attendance and marks.` });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Restore student error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    } finally {
        client.release();
    }
};

const exportClassBackup = async (req, res) => {
    try {
        const courseId = Number(req.params.courseId);
        const courseResult = await pool.query("SELECT * FROM courses WHERE id=$1 AND teacher_id=$2", [courseId, req.user.id]);
        if (!courseResult.rows.length) return res.status(404).json({ success: false, message: "Course not found or access denied" });

        const [studentsResult, attendanceResult, auditResult, assignmentsResult, quizzesResult, assignmentMarksResult, quizMarksResult] = await Promise.all([
            pool.query("SELECT * FROM students WHERE course_id=$1 ORDER BY id", [courseId]),
            pool.query("SELECT * FROM attendance WHERE course_id=$1 ORDER BY attendance_date, student_id", [courseId]),
            pool.query("SELECT * FROM attendance_audit_logs WHERE course_id=$1 ORDER BY changed_at", [courseId]),
            pool.query("SELECT * FROM assignments WHERE course_id=$1 ORDER BY id", [courseId]),
            pool.query("SELECT * FROM quizzes WHERE course_id=$1 ORDER BY id", [courseId]),
            pool.query("SELECT am.* FROM assignment_marks am JOIN assignments a ON a.id=am.assignment_id WHERE a.course_id=$1 ORDER BY am.id", [courseId]),
            pool.query("SELECT qm.* FROM quiz_marks qm JOIN quizzes q ON q.id=qm.quiz_id WHERE q.course_id=$1 ORDER BY qm.id", [courseId])
        ]);
        const safeName = String(courseResult.rows[0].name || "class").replace(/[^a-z0-9_-]+/gi, "_");
        const backup = {
            format: "math-department-class-backup",
            version: 1,
            exported_at: new Date().toISOString(),
            course: courseResult.rows[0],
            students: studentsResult.rows,
            attendance: attendanceResult.rows,
            attendance_audit_logs: auditResult.rows,
            assignments: assignmentsResult.rows,
            quizzes: quizzesResult.rows,
            assignment_marks: assignmentMarksResult.rows,
            quiz_marks: quizMarksResult.rows
        };
        res.setHeader("Content-Disposition", `attachment; filename="${safeName}_backup.json"`);
        res.type("application/json").send(JSON.stringify(backup, null, 2));
    } catch (error) {
        console.error("Export class backup error:", error);
        res.status(500).json({ success: false, message: "Could not export class backup" });
    }
};

const getCourseAssignments = async (
    req,
    res
) => {

    try {

        const teacherId =
            req.user.id;

        const courseId =
            req.params.courseId;


        const courseResult =
            await pool.query(
                `
                SELECT id
                FROM courses
                WHERE id = $1
                AND teacher_id = $2
                `,
                [
                    courseId,
                    teacherId
                ]
            );


        if (courseResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message:
                    "Course not found or access denied"
            });

        }


        const result =
            await pool.query(
                `
                SELECT
                    id,
                    course_id,
                    assignment_number,
                    name,
                    max_marks
                FROM assignments
                WHERE course_id = $1
                AND assessment_type = 'assignment'
                ORDER BY assignment_number
                `,
                [courseId]
            );


        res.json({
            success: true,
            assignments: result.rows
        });


    } catch (error) {

        console.error(
            "Get course assignments error:",
            error
        );


        res.status(500).json({
            success: false,
            message: "Server error"
        });

    }

};


// =========================
// UPDATE ASSIGNMENT
// =========================

const updateAssignment = async (
    req,
    res
) => {

    try {

        const teacherId =
            req.user.id;

        const courseId =
            req.params.courseId;

        const assignmentId =
            req.params.assignmentId;

        const {
            name,
            max_marks
        } = req.body;


        if (!name || !name.trim()) {

            return res.status(400).json({
                success: false,
                message: "Assignment name is required"
            });

        }


        const parsedMaxMarks =
            Number(max_marks);


        if (
            Number.isNaN(parsedMaxMarks) ||
            parsedMaxMarks <= 0
        ) {

            return res.status(400).json({
                success: false,
                message: "Assignment max marks must be a positive number"
            });

        }


        const result =
            await pool.query(
                `
                UPDATE assignments
                SET
                    name = $1,
                    max_marks = $2
                WHERE id = $3
                AND assessment_type = 'assignment'
                AND course_id IN (
                    SELECT id
                    FROM courses
                    WHERE id = $4
                    AND teacher_id = $5
                )
                RETURNING
                    id,
                    course_id,
                    assignment_number,
                    name,
                    max_marks
                `,
                [
                    name.trim(),
                    parsedMaxMarks,
                    assignmentId,
                    courseId,
                    teacherId
                ]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message:
                    "Assignment not found or access denied"
            });

        }


        res.json({
            success: true,
            message: "Assignment updated successfully",
            assignment: result.rows[0]
        });


    } catch (error) {

        console.error(
            "Update assignment error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Server error"
        });

    }

};


// =========================
// GET COURSE QUIZZES
// =========================

const getCourseQuizzes = async (
    req,
    res
) => {

    try {

        const teacherId =
            req.user.id;

        const courseId =
            req.params.courseId;


        const courseResult =
            await pool.query(
                `
                SELECT id
                FROM courses
                WHERE id = $1
                AND teacher_id = $2
                `,
                [
                    courseId,
                    teacherId
                ]
            );


        if (courseResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message:
                    "Course not found or access denied"
            });

        }


        const result =
            await pool.query(
                `
                SELECT
                    id,
                    course_id,
                    quiz_number,
                    name,
                    max_marks
                FROM quizzes
                WHERE course_id = $1
                ORDER BY quiz_number
                `,
                [courseId]
            );


        res.json({
            success: true,
            quizzes: result.rows
        });


    } catch (error) {

        console.error(
            "Get course quizzes error:",
            error
        );


        res.status(500).json({
            success: false,
            message: "Server error"
        });

    }

};


// =========================
// UPDATE QUIZ
// =========================

const updateQuiz = async (
    req,
    res
) => {

    try {

        const teacherId =
            req.user.id;

        const courseId =
            req.params.courseId;

        const quizId =
            req.params.quizId;

        const {
            name,
            max_marks
        } = req.body;


        if (!name || !name.trim()) {

            return res.status(400).json({
                success: false,
                message: "Quiz name is required"
            });

        }


        const parsedMaxMarks =
            Number(max_marks);


        if (
            Number.isNaN(parsedMaxMarks) ||
            parsedMaxMarks <= 0
        ) {

            return res.status(400).json({
                success: false,
                message: "Quiz max marks must be a positive number"
            });

        }


        const result =
            await pool.query(
                `
                UPDATE quizzes
                SET
                    name = $1,
                    max_marks = $2
                WHERE id = $3
                AND course_id IN (
                    SELECT id
                    FROM courses
                    WHERE id = $4
                    AND teacher_id = $5
                )
                RETURNING
                    id,
                    course_id,
                    quiz_number,
                    name,
                    max_marks
                `,
                [
                    name.trim(),
                    parsedMaxMarks,
                    quizId,
                    courseId,
                    teacherId
                ]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message:
                    "Quiz not found or access denied"
            });

        }


        res.json({
            success: true,
            message: "Quiz updated successfully",
            quiz: result.rows[0]
        });


    } catch (error) {

        console.error(
            "Update quiz error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Server error"
        });

    }

};


// =========================
// GET COURSE MARKS
// =========================

const getCourseMarks = async (
    req,
    res
) => {

    try {

        const teacherId =
            req.user.id;

        const courseId =
            req.params.courseId;


        const courseResult =
            await pool.query(
                `
                SELECT
                    id,
                    name,
                    course_code,
                    class_type,
                    intermediate_year,
                    class_shift,
                    roll_entry_mode,
                    program,
                    semester,
                    section,
                    roll_start,
                    roll_end,
                    program_enabled,
                    semester_enabled,
                    section_enabled,
                    student_name_enabled,
                    midterm_enabled,
                    final_enabled,
                    results_enabled,
                    monthly_tests_enabled,
                    result_code,
                    midterm_max_marks,
                    final_max_marks
                FROM courses
                WHERE id = $1
                AND teacher_id = $2
                `,
                [
                    courseId,
                    teacherId
                ]
            );


        if (courseResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message:
                    "Course not found or access denied"
            });

        }


        const course =
            courseResult.rows[0];


        // =========================
        // ASSIGNMENTS
        // =========================

        const assignmentsResult =
            await pool.query(
                `
                SELECT
                    id,
                    course_id,
                    assignment_number,
                    name,
                    max_marks
                FROM assignments
                WHERE course_id = $1
                AND assessment_type = 'assignment'
                ORDER BY assignment_number
                `,
                [courseId]
            );


        // =========================
        // QUIZZES
        // =========================

        const monthlyTestsResult = await pool.query(
            `SELECT id, course_id, month_number, name, max_marks
             FROM assignments
             WHERE course_id = $1 AND assessment_type = 'monthly_test'
             ORDER BY month_number`,
            [courseId]
        );

        const quizzesResult =
            await pool.query(
                `
                SELECT
                    id,
                    course_id,
                    quiz_number,
                    name,
                    max_marks
                FROM quizzes
                WHERE course_id = $1
                ORDER BY quiz_number
                `,
                [courseId]
            );


        // =========================
        // STUDENTS
        // =========================

        const studentsResult =
            await pool.query(
                `
                SELECT
                    id,
                    roll_number,
                    name,
                    program,
                    semester,
                    midterm_marks,
                    final_marks,
                    december_test_marks,
                    preboard_marks
                FROM students
                WHERE course_id = $1
                AND deleted_at IS NULL
                ORDER BY roll_number::INTEGER
                `,
                [courseId]
            );


        // =========================
        // ASSIGNMENT MARKS
        // =========================

        const assignmentMarksResult =
            await pool.query(
                `
                SELECT
                    am.id,
                    am.assignment_id,
                    am.student_id,
                    am.marks,
                    s.roll_number,
                    s.name AS student_name
                FROM assignment_marks am
                INNER JOIN students s
                    ON s.id = am.student_id
                INNER JOIN assignments a
                    ON a.id = am.assignment_id
                WHERE a.course_id = $1
                AND s.deleted_at IS NULL
                AND a.assessment_type = 'assignment'
                ORDER BY
                    a.assignment_number,
                    s.roll_number::INTEGER
                `,
                [courseId]
            );


        // =========================
        // QUIZ MARKS
        // =========================

        const quizMarksResult =
            await pool.query(
                `
                SELECT
                    qm.id,
                    qm.quiz_id,
                    qm.student_id,
                    qm.marks,
                    s.roll_number,
                    s.name AS student_name
                FROM quiz_marks qm
                INNER JOIN students s
                    ON s.id = qm.student_id
                INNER JOIN quizzes q
                    ON q.id = qm.quiz_id
                WHERE q.course_id = $1
                AND s.deleted_at IS NULL
                ORDER BY
                    q.quiz_number,
                    s.roll_number::INTEGER
                `,
                [courseId]
            );


        // =========================
        // RESPONSE
        // =========================

        const monthlyTestMarksResult = await pool.query(
            `SELECT am.id, am.assignment_id AS monthly_test_id, am.student_id, am.marks,
                    s.roll_number, s.name AS student_name
             FROM assignment_marks am
             JOIN students s ON s.id = am.student_id
             JOIN assignments a ON a.id = am.assignment_id
             WHERE a.course_id = $1 AND a.assessment_type = 'monthly_test' AND s.deleted_at IS NULL
             ORDER BY a.month_number, s.roll_number::INTEGER`,
            [courseId]
        );

        res.json({

            success: true,

            course: course,

            assignments:
                assignmentsResult.rows,

            quizzes:
                quizzesResult.rows,

            monthlyTests:
                monthlyTestsResult.rows,

            students:
                studentsResult.rows,

            assignmentMarks:
                assignmentMarksResult.rows,

            quizMarks:
                quizMarksResult.rows,

            monthlyTestMarks:
                monthlyTestMarksResult.rows

        });


    } catch (error) {

        console.error(
            "Get course marks error:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Server error"

        });

    }

};


// =========================
// UPDATE COURSE MARKS
// =========================

const updateCourseMarks = async (
    req,
    res
) => {

    const client =
        await pool.connect();


    try {

        const teacherId =
            req.user.id;

        const courseId =
            req.params.courseId;

        const {
            assignmentMarks = [],
            monthlyTestMarks = [],
            quizMarks = [],
            midtermMarks = [],
            finalMarks = [],
            decemberTestMarks = [],
            preboardMarks = []
        } = req.body;

        const combinedAssignmentMarks = [
            ...assignmentMarks,
            ...monthlyTestMarks.map(mark => ({ ...mark, assignment_id: mark.monthly_test_id }))
        ];


        const courseResult =
            await client.query(
                `
                SELECT id, class_type, midterm_max_marks, final_max_marks
                FROM courses
                WHERE id = $1
                AND teacher_id = $2
                `,
                [
                    courseId,
                    teacherId
                ]
            );


        if (courseResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message:
                    "Course not found or access denied"
            });

        }


        await client.query("BEGIN");


        // =========================
        // ASSIGNMENT MARKS
        // =========================

        for (const mark of combinedAssignmentMarks) {

            const {
                assignment_id,
                student_id,
                marks
            } = mark;


            if (
                assignment_id === undefined ||
                student_id === undefined ||
                marks === undefined
            ) {

                throw new Error(
                    "Each assignment mark must include assignment_id, student_id, and marks"
                );

            }


            const assignmentCheck =
                await client.query(
                    `
                    SELECT
                        id,
                        max_marks
                    FROM assignments
                    WHERE id = $1
                    AND course_id = $2
                    AND deleted_at IS NULL
                    `,
                    [
                        assignment_id,
                        courseId
                    ]
                );


            if (assignmentCheck.rows.length === 0) {

                throw new Error(
                    "One or more assignment records are invalid for this course"
                );

            }


            const studentCheck =
                await client.query(
                    `
                    SELECT id
                    FROM students
                    WHERE id = $1
                    AND course_id = $2
                    AND deleted_at IS NULL
                    `,
                    [
                        student_id,
                        courseId
                    ]
                );


            if (studentCheck.rows.length === 0) {

                throw new Error(
                    "One or more students are invalid for this course"
                );

            }


            const numericMarks =
                Number(marks);


            if (
                Number.isNaN(numericMarks) ||
                numericMarks < 0
            ) {

                throw new Error(
                    "Assignment marks must be non-negative numbers"
                );

            }

            if (
                assignmentCheck.rows[0].max_marks !== null &&
                numericMarks >
                Number(assignmentCheck.rows[0].max_marks)
            ) {

                throw new Error(
                    "Assignment marks cannot exceed maximum marks"
                );

            }


            await client.query(
                `
                INSERT INTO assignment_marks
                (
                    assignment_id,
                    student_id,
                    marks
                )
                VALUES
                (
                    $1,
                    $2,
                    $3
                )
                ON CONFLICT (assignment_id, student_id)
                DO UPDATE SET
                    marks = EXCLUDED.marks
                `,
                [
                    assignment_id,
                    student_id,
                    numericMarks
                ]
            );

        }


        // =========================
        // QUIZ MARKS
        // =========================

        for (const mark of quizMarks) {

            const {
                quiz_id,
                student_id,
                marks
            } = mark;


            if (
                quiz_id === undefined ||
                student_id === undefined ||
                marks === undefined
            ) {

                throw new Error(
                    "Each quiz mark must include quiz_id, student_id, and marks"
                );

            }


            const quizCheck =
                await client.query(
                    `
                    SELECT
                        id,
                        max_marks
                    FROM quizzes
                    WHERE id = $1
                    AND course_id = $2
                    AND deleted_at IS NULL
                    `,
                    [
                        quiz_id,
                        courseId
                    ]
                );


            if (quizCheck.rows.length === 0) {

                throw new Error(
                    "One or more quiz records are invalid for this course"
                );

            }


            const studentCheck =
                await client.query(
                    `
                    SELECT id
                    FROM students
                    WHERE id = $1
                    AND course_id = $2
                    AND deleted_at IS NULL
                    `,
                    [
                        student_id,
                        courseId
                    ]
                );


            if (studentCheck.rows.length === 0) {

                throw new Error(
                    "One or more students are invalid for this course"
                );

            }


            const numericMarks =
                Number(marks);


            if (
                Number.isNaN(numericMarks) ||
                numericMarks < 0
            ) {

                throw new Error(
                    "Quiz marks must be non-negative numbers"
                );

            }

            if (
                quizCheck.rows[0].max_marks !== null &&
                numericMarks >
                Number(quizCheck.rows[0].max_marks)
            ) {

                throw new Error(
                    "Quiz marks cannot exceed maximum marks"
                );

            }


            await client.query(
                `
                INSERT INTO quiz_marks
                (
                    quiz_id,
                    student_id,
                    marks
                )
                VALUES
                (
                    $1,
                    $2,
                    $3
                )
                ON CONFLICT (quiz_id, student_id)
                DO UPDATE SET
                    marks = EXCLUDED.marks
                `,
                [
                    quiz_id,
                    student_id,
                    numericMarks
                ]
            );

        }


        // =========================
        // MIDTERM MARKS
        // =========================

        for (const mark of midtermMarks) {

            const {
                student_id,
                marks
            } = mark;


            if (
                student_id === undefined ||
                marks === undefined
            ) {

                throw new Error(
                    "Each midterm mark must include student_id and marks"
                );

            }


            const studentCheck =
                await client.query(
                    `
                    SELECT id
                    FROM students
                    WHERE id = $1
                    AND course_id = $2
                    `,
                    [
                        student_id,
                        courseId
                    ]
                );


            if (studentCheck.rows.length === 0) {

                throw new Error(
                    "One or more students are invalid for this course"
                );

            }


            const numericMarks =
                Number(marks);


            if (
                Number.isNaN(numericMarks) ||
                numericMarks < 0
            ) {

                throw new Error(
                    "Midterm marks must be non-negative numbers"
                );

            }

            if (
                courseResult.rows[0].midterm_max_marks !== null &&
                numericMarks > Number(courseResult.rows[0].midterm_max_marks)
            ) {
                throw new Error("Midterm marks cannot exceed maximum marks");
            }


            await client.query(
                `
                UPDATE students
                SET midterm_marks = $1
                WHERE id = $2
                AND course_id = $3
                `,
                [
                    numericMarks,
                    student_id,
                    courseId
                ]
            );

        }


        // =========================
        // FINAL MARKS
        // =========================

        for (const mark of finalMarks) {

            const {
                student_id,
                marks
            } = mark;


            if (
                student_id === undefined ||
                marks === undefined
            ) {

                throw new Error(
                    "Each final mark must include student_id and marks"
                );

            }


            const studentCheck =
                await client.query(
                    `
                    SELECT id
                    FROM students
                    WHERE id = $1
                    AND course_id = $2
                    `,
                    [
                        student_id,
                        courseId
                    ]
                );


            if (studentCheck.rows.length === 0) {

                throw new Error(
                    "One or more students are invalid for this course"
                );

            }


            const numericMarks =
                Number(marks);


            if (
                Number.isNaN(numericMarks) ||
                numericMarks < 0
            ) {

                throw new Error(
                    "Final marks must be non-negative numbers"
                );

            }

            if (
                courseResult.rows[0].final_max_marks !== null &&
                numericMarks > Number(courseResult.rows[0].final_max_marks)
            ) {
                throw new Error("Final marks cannot exceed maximum marks");
            }


            await client.query(
                `
                UPDATE students
                SET final_marks = $1
                WHERE id = $2
                AND course_id = $3
                `,
                [
                    numericMarks,
                    student_id,
                    courseId
                ]
            );

        }

        // =========================
        // INTERMEDIATE FIXED ASSESSMENTS
        // =========================

        const saveFixedIntermediateMarks = async (marksList, column, label) => {
            if (marksList.length && courseResult.rows[0].class_type !== "intermediate") {
                throw new Error(`${label} marks are only available for Intermediate classes`);
            }

            for (const mark of marksList) {
                const studentId = Number(mark?.student_id);
                const numericMarks = Number(mark?.marks);
                if (!Number.isInteger(studentId) || !Number.isFinite(numericMarks) || numericMarks < 0 || numericMarks > 100) {
                    throw new Error(`${label} marks must be between 0 and 100`);
                }

                const updated = await client.query(
                    `UPDATE students
                     SET ${column} = $1, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $2 AND course_id = $3
                     RETURNING id`,
                    [numericMarks, studentId, courseId]
                );
                if (!updated.rows.length) {
                    throw new Error(`One or more students are invalid for ${label}`);
                }
            }
        };

        await saveFixedIntermediateMarks(decemberTestMarks, "december_test_marks", "December Test");
        await saveFixedIntermediateMarks(preboardMarks, "preboard_marks", "Preboard");


        await client.query("COMMIT");


        res.json({

            success: true,

            message:
                "Marks saved successfully"

        });


    } catch (error) {

        await client.query("ROLLBACK");

        console.error(
            "Update course marks error:",
            error
        );

        res.status(400).json({

            success: false,

            message:
                error.message ||
                "Could not save marks"

        });

    } finally {

        client.release();

    }

};


// =========================
// DELETE COURSE
// =========================

const deleteCourse = async (
    req,
    res
) => {

    const client =
        await pool.connect();


    try {

        const teacherId =
            req.user.id;

        const courseId =
            req.params.courseId;


        // =========================
        // CHECK OWNERSHIP
        // =========================

        const courseResult =
            await client.query(
                `
                SELECT id
                FROM courses
                WHERE id = $1
                AND teacher_id = $2
                `,
                [
                    courseId,
                    teacherId
                ]
            );


        if (courseResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message:
                    "Course not found or access denied"
            });

        }


        await client.query("BEGIN");


        // =========================
        // DELETE ASSIGNMENT MARKS
        // =========================

        await client.query(
            `
            DELETE FROM assignment_marks
            WHERE assignment_id IN (
                SELECT id
                FROM assignments
                WHERE course_id = $1
            )
            `,
            [courseId]
        );


        // =========================
        // DELETE QUIZ MARKS
        // =========================

        await client.query(
            `
            DELETE FROM quiz_marks
            WHERE quiz_id IN (
                SELECT id
                FROM quizzes
                WHERE course_id = $1
            )
            `,
            [courseId]
        );


        // =========================
        // DELETE ATTENDANCE
        // =========================

        await client.query(
            `
            DELETE FROM attendance
            WHERE course_id = $1
            `,
            [courseId]
        );


        // =========================
        // DELETE ASSIGNMENTS
        // =========================

        await client.query(
            `
            DELETE FROM assignments
            WHERE course_id = $1
            `,
            [courseId]
        );


        // =========================
        // DELETE QUIZZES
        // =========================

        await client.query(
            `
            DELETE FROM quizzes
            WHERE course_id = $1
            `,
            [courseId]
        );


        // =========================
        // DELETE STUDENTS
        // =========================

        await client.query(
            `
            DELETE FROM students
            WHERE course_id = $1
            `,
            [courseId]
        );


        // =========================
        // DELETE COURSE
        // =========================

        await client.query(
            `
            DELETE FROM courses
            WHERE id = $1
            `,
            [courseId]
        );


        await client.query("COMMIT");


        res.json({

            success: true,

            message:
                "Class deleted successfully"

        });


    } catch (error) {

        await client.query("ROLLBACK");

        console.error(
            "Delete course error:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Server error"

        });

    } finally {

        client.release();

    }

};


const updateCourseSettings = async (req, res) => {
    const client = await pool.connect();
    try {
        const courseId = req.params.courseId;
        const cleanName = String(req.body.name || "").trim();
        const cleanSection = String(req.body.section || "").trim() || null;
        const classType = String(req.body.class_type || "bachelors").trim().toLowerCase();
        const requestedCourseCode = String(req.body.course_code || "").trim() || null;
        const cleanCourseCode = classType === "intermediate" ? null : requestedCourseCode;
        const intermediateYear = classType === "intermediate" ? String(req.body.intermediate_year || "").trim() : null;
        const classShift = String(req.body.class_shift || "morning").trim().toLowerCase();
        const cleanProgram = classType === "intermediate" ? "Intermediate" : (String(req.body.program || "").trim() || null);
        const cleanSemester = classType === "intermediate"
            ? (intermediateYear === "2nd_year" ? "2nd Year" : "1st Year")
            : (String(req.body.semester || "").trim() || null);
        const assignmentsEnabled = classType !== "intermediate" && req.body.assignments_enabled === true;
        const quizzesEnabled = classType !== "intermediate" && req.body.quizzes_enabled === true;
        const monthlyTestsEnabled = classType === "intermediate" && req.body.monthly_tests_enabled === true;
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const cleanMonthlyTests = monthlyTestsEnabled && Array.isArray(req.body.monthly_tests)
            ? req.body.monthly_tests.map(test => ({ month: Number(test?.month), maxMarks: Number(test?.max_marks) }))
            : [];
        const midtermEnabled = classType !== "intermediate" && req.body.midterm_enabled === true;
        const finalEnabled = classType !== "intermediate" && req.body.final_enabled === true;
        const resultsEnabled = req.body.results_enabled === true;
        const resultCode = String(req.body.result_code || "").trim().toLowerCase();
        const assignmentCount = assignmentsEnabled ? Number(req.body.assignment_count) : 0;
        const quizCount = quizzesEnabled ? Number(req.body.quiz_count) : 0;
        const assignmentMax = assignmentsEnabled ? Number(req.body.assignment_max_marks) : null;
        const quizMax = quizzesEnabled ? Number(req.body.quiz_max_marks) : null;
        const midtermMax = midtermEnabled ? Number(req.body.midterm_max_marks) : null;
        const finalMax = finalEnabled ? Number(req.body.final_max_marks) : null;

        if (!cleanName || cleanName.length > 150 || (cleanCourseCode && cleanCourseCode.length > 50) || (cleanSection && cleanSection.length > 20) || (cleanProgram && cleanProgram.length > 100) || (cleanSemester && cleanSemester.length > 50)) {
            return res.status(400).json({ success: false, message: "Enter a valid course name, course code, and section" });
        }
        if (!["bachelors", "intermediate"].includes(classType) || (classType === "intermediate" && !["1st_year", "2nd_year"].includes(intermediateYear))) {
            return res.status(400).json({ success: false, message: "Choose a valid class level and Intermediate year" });
        }
        if (!["morning", "evening"].includes(classShift)) {
            return res.status(400).json({ success: false, message: "Choose Morning or Evening shift" });
        }
        if (!/^[a-z0-9-]{4,24}$/.test(resultCode)) {
            return res.status(400).json({ success: false, message: "Result code must be 4-24 letters, numbers, or hyphens" });
        }
        if (assignmentsEnabled && (!Number.isInteger(assignmentCount) || assignmentCount < 1 || assignmentCount > 100 || !Number.isFinite(assignmentMax) || assignmentMax <= 0)) {
            return res.status(400).json({ success: false, message: "Assignment count and maximum marks are invalid" });
        }
        if (quizzesEnabled && (!Number.isInteger(quizCount) || quizCount < 1 || quizCount > 100 || !Number.isFinite(quizMax) || quizMax <= 0)) {
            return res.status(400).json({ success: false, message: "Quiz count and maximum marks are invalid" });
        }
        if (monthlyTestsEnabled && (!cleanMonthlyTests.length || cleanMonthlyTests.length > 11 || cleanMonthlyTests.some(test => !Number.isInteger(test.month) || test.month < 1 || test.month > 11 || !Number.isFinite(test.maxMarks) || test.maxMarks <= 0) || new Set(cleanMonthlyTests.map(test => test.month)).size !== cleanMonthlyTests.length)) {
            return res.status(400).json({ success: false, message: "Monthly tests need unique months from January to November and positive maximum marks" });
        }
        if (midtermEnabled && (!Number.isFinite(midtermMax) || midtermMax <= 0)) {
            return res.status(400).json({ success: false, message: "Midterm maximum marks are invalid" });
        }
        if (finalEnabled && (!Number.isFinite(finalMax) || finalMax <= 0)) {
            return res.status(400).json({ success: false, message: "Final maximum marks are invalid" });
        }

        await client.query("BEGIN");
        const courseResult = await client.query(
            "SELECT * FROM courses WHERE id = $1 AND teacher_id = $2 FOR UPDATE",
            [courseId, req.user.id]
        );
        if (!courseResult.rows.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Course not found or access denied" });
        }
        const existingCourse = courseResult.rows[0];
        const programEnabledForUpdate = classType === "intermediate" ? true : existingCourse.program_enabled;
        const semesterEnabledForUpdate = classType === "intermediate" ? true : existingCourse.semester_enabled;

        const reconcile = async ({ table, marksTable, foreignKey, numberColumn, enabled, count, maxMarks, label, tableFilter = "", joinFilter = "" }) => {
            const existing = await client.query(
                `SELECT id, ${numberColumn} AS slot_number FROM ${table} WHERE course_id = $1 ${tableFilter} ORDER BY ${numberColumn}`,
                [courseId]
            );

            if (!enabled) {
                const used = await client.query(
                    `SELECT 1 FROM ${marksTable} m JOIN ${table} a ON a.id = m.${foreignKey} WHERE a.course_id = $1 ${joinFilter} LIMIT 1`,
                    [courseId]
                );
                if (used.rows.length) throw Object.assign(new Error(`${label} cannot be disabled while marks exist`), { status: 409 });
                await client.query(`DELETE FROM ${table} WHERE course_id = $1 ${tableFilter}`, [courseId]);
                return;
            }

            const excessive = await client.query(
                `SELECT 1 FROM ${marksTable} m JOIN ${table} a ON a.id = m.${foreignKey}
                 WHERE a.course_id = $1 ${joinFilter} AND m.marks > $2 LIMIT 1`,
                [courseId, maxMarks]
            );
            if (excessive.rows.length) throw Object.assign(new Error(`${label} maximum cannot be lower than marks already entered`), { status: 409 });

            const removedIds = existing.rows.filter(row => Number(row.slot_number) > count).map(row => row.id);
            if (removedIds.length) {
                const usedRemoved = await client.query(
                    `SELECT 1 FROM ${marksTable} WHERE ${foreignKey} = ANY($1::int[]) LIMIT 1`,
                    [removedIds]
                );
                if (usedRemoved.rows.length) throw Object.assign(new Error(`${label} count cannot be reduced because removed items contain marks`), { status: 409 });
                await client.query(`DELETE FROM ${table} WHERE id = ANY($1::int[])`, [removedIds]);
            }

            await client.query(`UPDATE ${table} SET max_marks = $1, updated_at = CURRENT_TIMESTAMP WHERE course_id = $2 ${tableFilter}`, [maxMarks, courseId]);
            const existingNumbers = new Set(existing.rows.map(row => Number(row.slot_number)));
            for (let number = 1; number <= count; number += 1) {
                if (!existingNumbers.has(number)) {
                    await client.query(
                        `INSERT INTO ${table} (course_id, ${numberColumn}, name, max_marks) VALUES ($1, $2, $3, $4)`,
                        [courseId, number, `${label} ${number}`, maxMarks]
                    );
                }
            }
        };

        await reconcile({ table: "assignments", marksTable: "assignment_marks", foreignKey: "assignment_id", numberColumn: "assignment_number", enabled: assignmentsEnabled, count: assignmentCount, maxMarks: assignmentMax, label: "Assignment", tableFilter: "AND assessment_type = 'assignment'", joinFilter: "AND a.assessment_type = 'assignment'" });
        await reconcile({ table: "quizzes", marksTable: "quiz_marks", foreignKey: "quiz_id", numberColumn: "quiz_number", enabled: quizzesEnabled, count: quizCount, maxMarks: quizMax, label: "Quiz" });

        const existingMonthly = await client.query(
            "SELECT id, month_number FROM assignments WHERE course_id=$1 AND assessment_type='monthly_test'",
            [courseId]
        );
        const requestedMonths = new Set(cleanMonthlyTests.map(test => test.month));
        for (const row of existingMonthly.rows) {
            if (!monthlyTestsEnabled || !requestedMonths.has(Number(row.month_number))) {
                const used = await client.query("SELECT 1 FROM assignment_marks WHERE assignment_id=$1 LIMIT 1", [row.id]);
                if (used.rows.length) throw Object.assign(new Error("A monthly test with saved marks cannot be removed"), { status: 409 });
                await client.query("DELETE FROM assignments WHERE id=$1", [row.id]);
            }
        }
        if (monthlyTestsEnabled) {
            for (const test of cleanMonthlyTests) {
                const existing = existingMonthly.rows.find(row => Number(row.month_number) === test.month);
                if (existing) {
                    const excessive = await client.query("SELECT 1 FROM assignment_marks WHERE assignment_id=$1 AND marks>$2 LIMIT 1", [existing.id, test.maxMarks]);
                    if (excessive.rows.length) throw Object.assign(new Error(`${monthNames[test.month - 1]} test maximum cannot be lower than saved marks`), { status: 409 });
                    await client.query("UPDATE assignments SET name=$1, max_marks=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$3", [`${monthNames[test.month - 1]} Monthly Test`, test.maxMarks, existing.id]);
                } else {
                    await client.query(
                        "INSERT INTO assignments (course_id, assignment_number, name, max_marks, assessment_type, month_number) VALUES ($1,$2,$3,$4,'monthly_test',$5)",
                        [courseId, 1000 + test.month, `${monthNames[test.month - 1]} Monthly Test`, test.maxMarks, test.month]
                    );
                }
            }
        }

        if (midtermEnabled) {
            const excessive = await client.query("SELECT 1 FROM students WHERE course_id = $1 AND deleted_at IS NULL AND midterm_marks > $2 LIMIT 1", [courseId, midtermMax]);
            if (excessive.rows.length) throw Object.assign(new Error("Midterm maximum cannot be lower than marks already entered"), { status: 409 });
        }
        if (finalEnabled) {
            const excessive = await client.query("SELECT 1 FROM students WHERE course_id = $1 AND deleted_at IS NULL AND final_marks > $2 LIMIT 1", [courseId, finalMax]);
            if (excessive.rows.length) throw Object.assign(new Error("Final maximum cannot be lower than marks already entered"), { status: 409 });
        }

        const updated = await client.query(
            `UPDATE courses SET name=$1, course_code=$2, section=$3, assignments_enabled=$4, assignment_count=$5,
                    quizzes_enabled=$6, quiz_count=$7, midterm_enabled=$8, final_enabled=$9,
                    results_enabled=$10, midterm_max_marks=$11, final_max_marks=$12, result_code=$13,
                    class_type=$14, intermediate_year=$15, program=$16, semester=$17,
                    program_enabled=$18, semester_enabled=$19, monthly_tests_enabled=$20, class_shift=$21,
                    updated_at=CURRENT_TIMESTAMP
             WHERE id=$22 RETURNING *`,
            [cleanName, cleanCourseCode, cleanSection, assignmentsEnabled, assignmentCount, quizzesEnabled, quizCount,
             midtermEnabled, finalEnabled, resultsEnabled, midtermMax, finalMax, resultCode,
             classType, intermediateYear, cleanProgram, cleanSemester,
             programEnabledForUpdate, semesterEnabledForUpdate, monthlyTestsEnabled, classShift, courseId]
        );
        await client.query(
            "UPDATE students SET program=$1, semester=$2, updated_at=CURRENT_TIMESTAMP WHERE course_id=$3 AND deleted_at IS NULL",
            [cleanProgram, cleanSemester, courseId]
        );
        await client.query("COMMIT");
        res.json({ success: true, message: "Class settings updated successfully", course: updated.rows[0] });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Update course settings error:", error);
        const duplicateCode = error.code === "23505";
        res.status(duplicateCode ? 409 : (error.status || 500)).json({
            success: false,
            message: duplicateCode ? "That result code is already being used" : (error.status ? error.message : "Server error")
        });
    } finally {
        client.release();
    }
};

const importStudents = async (req, res) => {
    const client = await pool.connect();
    try {
        const courseId = req.params.courseId;
        const rows = req.body.students;
        if (!Array.isArray(rows) || rows.length < 1 || rows.length > 500) {
            return res.status(400).json({ success: false, message: "Import between 1 and 500 students" });
        }

        const cleaned = [];
        const seen = new Set();
        for (const row of rows) {
            const rollNumber = String(row.roll_number || "").trim();
            const name = String(row.name || "").trim();
            if (!/^\d+$/.test(rollNumber) || !name || name.length > 150 || seen.has(rollNumber)) {
                return res.status(400).json({ success: false, message: "Every row needs a unique numeric roll number and student name" });
            }
            seen.add(rollNumber);
            cleaned.push({ rollNumber: String(Number(rollNumber)), name });
        }

        await client.query("BEGIN");
        const courseResult = await client.query(
            "SELECT id, program, semester FROM courses WHERE id = $1 AND teacher_id = $2 FOR UPDATE",
            [courseId, req.user.id]
        );
        if (!courseResult.rows.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Course not found or access denied" });
        }
        const course = courseResult.rows[0];

        for (const student of cleaned) {
            await client.query(
                `INSERT INTO students (course_id, roll_number, name, program, semester)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (course_id, roll_number) WHERE deleted_at IS NULL
                 DO UPDATE SET name = EXCLUDED.name, updated_at = CURRENT_TIMESTAMP`,
                [courseId, student.rollNumber, student.name, course.program, course.semester]
            );
        }

        const totalResult = await client.query("SELECT COUNT(*)::INTEGER AS total FROM students WHERE course_id = $1 AND deleted_at IS NULL", [courseId]);
        if (totalResult.rows[0].total > 500) {
            throw Object.assign(new Error("Import would make the class larger than 500 students"), { status: 400 });
        }
        await client.query(
            `UPDATE courses SET student_name_enabled = TRUE,
                    roll_start = (SELECT MIN(roll_number::INTEGER) FROM students WHERE course_id = $1 AND deleted_at IS NULL),
                    roll_end = (SELECT MAX(roll_number::INTEGER) FROM students WHERE course_id = $1 AND deleted_at IS NULL),
                    updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [courseId]
        );

        await client.query("COMMIT");
        res.json({ success: true, message: `${cleaned.length} student rows imported successfully`, imported: cleaned.length, total: totalResult.rows[0].total });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Import students error:", error);
        res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Server error" });
    } finally {
        client.release();
    }
};


// =========================
// EXPORTS
// =========================

module.exports = {

    createCourse,

    getMyCourses,

    getCourseStudents,

    updateStudent,

    updateCourseRollNumbers,

    getDeletedStudents,

    restoreStudent,

    exportClassBackup,

    getCourseAssignments,

    updateAssignment,

    getCourseQuizzes,

    updateQuiz,

    getCourseMarks,

    updateCourseMarks,

    updateCourseSettings,

    importStudents,

    deleteCourse

};
