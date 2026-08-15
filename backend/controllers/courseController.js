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

        const requestedRollRanges = Array.isArray(rollRanges) && rollRanges.length
            ? rollRanges
            : [{ start: rollStart, end: rollEnd }];

        if (!requestedRollRanges.length || requestedRollRanges.length > 50) {

            return res.status(400).json({
                success: false,
                message: "Add between 1 and 50 roll number ranges"
            });

        }

        const cleanCourseCode = String(course_code || "").trim() || null;

        if (cleanCourseCode && cleanCourseCode.length > 50) {
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
            end: parseRollLimit(range?.end)
        }));

        if (normalizedRollRanges.some(range =>
            !Number.isInteger(range.start) ||
            !Number.isInteger(range.end) ||
            range.start < 0 ||
            range.end < 0 ||
            range.start > range.end
        )) {

            return res.status(400).json({
                success: false,
                message: "Each roll number range must have valid whole-number limits"
            });

        }

        normalizedRollRanges.sort((first, second) =>
            first.start - second.start || first.end - second.end
        );

        for (let index = 1; index < normalizedRollRanges.length; index += 1) {
            if (normalizedRollRanges[index].start <= normalizedRollRanges[index - 1].end) {
                return res.status(400).json({
                    success: false,
                    message: "Roll number ranges cannot overlap or contain duplicate numbers"
                });
            }
        }

        const studentCount = normalizedRollRanges.reduce(
            (total, range) => total + range.end - range.start + 1,
            0
        );

        if (studentCount < 1 || studentCount > 500) {
            return res.status(400).json({
                success: false,
                message: "Roll number ranges must contain between 1 and 500 students in total"
            });
        }

        const rollNumbers = normalizedRollRanges.flatMap(range =>
            Array.from(
                { length: range.end - range.start + 1 },
                (_, index) => range.start + index
            )
        );

        const rollNumberSet = new Set(rollNumbers);
        const start = normalizedRollRanges[0].start;
        const end = normalizedRollRanges[normalizedRollRanges.length - 1].end;

        // =========================
        // FEATURE SETTINGS
        // =========================

        const programEnabled = program_enabled !== false;
        const semesterEnabled = semester_enabled !== false;
        const sectionEnabled = section_enabled !== false;
        const studentNameEnabled = student_name_enabled === true;
        const attendanceEnabled = attendance_enabled !== false;
        const assignmentsEnabled = assignments_enabled === true;
        const quizzesEnabled = quizzes_enabled === true;
        const midtermEnabled = midterm_enabled === true;
        const finalEnabled = final_enabled === true;
        const resultsEnabled = results_enabled === true;
        const requestedResultCode = String(result_code || "").trim().toLowerCase();

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
                const rollNumber = Number.parseInt(student.roll_number, 10);
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
                    result_code
                )

                VALUES
                (
                    $1, $2, $3, $4, $5, $6, $7, $8,
                    $9, $10, $11, $12, $13, $14,
                    $15, $16, $17, $18, $19, $20, $21, $22,
                    $23, $24, $25
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
                    resultCode
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
                    program,
                    semester,
                    section,
                    roll_start,
                    roll_end,
                    ARRAY(
                        SELECT student.roll_number
                        FROM students student
                        WHERE student.course_id = courses.id
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
                    program,
                    semester,
                    section,
                    roll_start,
                    roll_end,
                    ARRAY(
                        SELECT student.roll_number
                        FROM students student
                        WHERE student.course_id = courses.id
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
                ORDER BY assignment_number
                `,
                [courseId]
            );


        // =========================
        // QUIZZES
        // =========================

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
                    final_marks
                FROM students
                WHERE course_id = $1
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
                ORDER BY
                    q.quiz_number,
                    s.roll_number::INTEGER
                `,
                [courseId]
            );


        // =========================
        // RESPONSE
        // =========================

        res.json({

            success: true,

            course: course,

            assignments:
                assignmentsResult.rows,

            quizzes:
                quizzesResult.rows,

            students:
                studentsResult.rows,

            assignmentMarks:
                assignmentMarksResult.rows,

            quizMarks:
                quizMarksResult.rows

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
            quizMarks = [],
            midtermMarks = [],
            finalMarks = []
        } = req.body;


        const courseResult =
            await client.query(
                `
                SELECT id, midterm_max_marks, final_max_marks
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

        for (const mark of assignmentMarks) {

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
        const cleanCourseCode = String(req.body.course_code || "").trim() || null;
        const cleanSection = String(req.body.section || "").trim() || null;
        const assignmentsEnabled = req.body.assignments_enabled === true;
        const quizzesEnabled = req.body.quizzes_enabled === true;
        const midtermEnabled = req.body.midterm_enabled === true;
        const finalEnabled = req.body.final_enabled === true;
        const resultsEnabled = req.body.results_enabled === true;
        const resultCode = String(req.body.result_code || "").trim().toLowerCase();
        const assignmentCount = assignmentsEnabled ? Number(req.body.assignment_count) : 0;
        const quizCount = quizzesEnabled ? Number(req.body.quiz_count) : 0;
        const assignmentMax = assignmentsEnabled ? Number(req.body.assignment_max_marks) : null;
        const quizMax = quizzesEnabled ? Number(req.body.quiz_max_marks) : null;
        const midtermMax = midtermEnabled ? Number(req.body.midterm_max_marks) : null;
        const finalMax = finalEnabled ? Number(req.body.final_max_marks) : null;

        if (!cleanName || cleanName.length > 150 || (cleanCourseCode && cleanCourseCode.length > 50) || (cleanSection && cleanSection.length > 20)) {
            return res.status(400).json({ success: false, message: "Enter a valid course name, course code, and section" });
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

        const reconcile = async ({ table, marksTable, foreignKey, numberColumn, enabled, count, maxMarks, label }) => {
            const existing = await client.query(
                `SELECT id, ${numberColumn} AS slot_number FROM ${table} WHERE course_id = $1 ORDER BY ${numberColumn}`,
                [courseId]
            );
            if (!enabled) {
                const used = await client.query(
                    `SELECT 1 FROM ${marksTable} m JOIN ${table} a ON a.id = m.${foreignKey} WHERE a.course_id = $1 LIMIT 1`,
                    [courseId]
                );
                if (used.rows.length) throw Object.assign(new Error(`${label} cannot be disabled while marks exist`), { status: 409 });
                await client.query(`DELETE FROM ${table} WHERE course_id = $1`, [courseId]);
                return;
            }

            const excessive = await client.query(
                `SELECT 1 FROM ${marksTable} m JOIN ${table} a ON a.id = m.${foreignKey}
                 WHERE a.course_id = $1 AND m.marks > $2 LIMIT 1`,
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

            await client.query(`UPDATE ${table} SET max_marks = $1, updated_at = CURRENT_TIMESTAMP WHERE course_id = $2`, [maxMarks, courseId]);
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

        await reconcile({ table: "assignments", marksTable: "assignment_marks", foreignKey: "assignment_id", numberColumn: "assignment_number", enabled: assignmentsEnabled, count: assignmentCount, maxMarks: assignmentMax, label: "Assignment" });
        await reconcile({ table: "quizzes", marksTable: "quiz_marks", foreignKey: "quiz_id", numberColumn: "quiz_number", enabled: quizzesEnabled, count: quizCount, maxMarks: quizMax, label: "Quiz" });

        if (midtermEnabled) {
            const excessive = await client.query("SELECT 1 FROM students WHERE course_id = $1 AND midterm_marks > $2 LIMIT 1", [courseId, midtermMax]);
            if (excessive.rows.length) throw Object.assign(new Error("Midterm maximum cannot be lower than marks already entered"), { status: 409 });
        }
        if (finalEnabled) {
            const excessive = await client.query("SELECT 1 FROM students WHERE course_id = $1 AND final_marks > $2 LIMIT 1", [courseId, finalMax]);
            if (excessive.rows.length) throw Object.assign(new Error("Final maximum cannot be lower than marks already entered"), { status: 409 });
        }

        const updated = await client.query(
            `UPDATE courses SET name=$1, course_code=$2, section=$3, assignments_enabled=$4, assignment_count=$5,
                    quizzes_enabled=$6, quiz_count=$7, midterm_enabled=$8, final_enabled=$9,
                    results_enabled=$10, midterm_max_marks=$11, final_max_marks=$12, result_code=$13,
                    updated_at=CURRENT_TIMESTAMP
             WHERE id=$14 RETURNING *`,
            [cleanName, cleanCourseCode, cleanSection, assignmentsEnabled, assignmentCount, quizzesEnabled, quizCount,
             midtermEnabled, finalEnabled, resultsEnabled, midtermMax, finalMax, resultCode, courseId]
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
                 ON CONFLICT (course_id, roll_number)
                 DO UPDATE SET name = EXCLUDED.name, updated_at = CURRENT_TIMESTAMP`,
                [courseId, student.rollNumber, student.name, course.program, course.semester]
            );
        }

        const totalResult = await client.query("SELECT COUNT(*)::INTEGER AS total FROM students WHERE course_id = $1", [courseId]);
        if (totalResult.rows[0].total > 500) {
            throw Object.assign(new Error("Import would make the class larger than 500 students"), { status: 400 });
        }
        await client.query(
            `UPDATE courses SET student_name_enabled = TRUE,
                    roll_start = (SELECT MIN(roll_number::INTEGER) FROM students WHERE course_id = $1),
                    roll_end = (SELECT MAX(roll_number::INTEGER) FROM students WHERE course_id = $1),
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
