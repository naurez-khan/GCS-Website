const params =
    new URLSearchParams(
        window.location.search
    );


const courseId =
    params.get("id");


// =========================
// ELEMENTS
// =========================

const teacherName =
    document.getElementById(
        "teacherName"
    );


const courseHeader =
    document.getElementById(
        "courseHeader"
    );


const marksDescription =
    document.getElementById(
        "marksDescription"
    );


const marksTableContainer =
    document.getElementById(
        "marksTableContainer"
    );


const marksMessage =
    document.getElementById(
        "marksMessage"
    );


const saveMarksBtn =
    document.getElementById(
        "saveMarksBtn"
    );


const logoutBtn =
    document.getElementById(
        "logoutBtn"
    );


const backBtn =
    document.getElementById(
        "backBtn"
    );


// =========================
// GLOBAL DATA
// =========================

let currentCourse = null;

let students = [];

let assignments = [];

let quizzes = [];
let monthlyTests = [];

let assignmentMarks = [];

let quizMarks = [];
let monthlyTestMarks = [];


// =========================
// LOAD TEACHER
// =========================

function loadTeacher() {

    const teacher =
        JSON.parse(
            localStorage.getItem(
                "teacher"
            )
        );


    if (!teacher) {

        window.location.href =
            "/test-login.html";

        return;

    }


    if (teacherName) {

        teacherName.textContent =
            teacher.name;

    }

}


// =========================
// BACK BUTTON
// =========================

if (backBtn) {

    backBtn.addEventListener(
        "click",
        (event) => {

            event.preventDefault();

            window.location.href =
                `/course.html?id=${courseId}`;

        }
    );

}


// =========================
// LOAD COURSE MARKS
// =========================

async function loadMarks() {

    if (!courseId) {

        showError(
            "Course ID is missing."
        );

        return;

    }


    try {

        const response =
            await fetch(
                `/api/courses/${courseId}/marks`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );


        const data =
            await response.json();


        console.log(
            "Marks response:",
            data
        );


        if (
            !response.ok ||
            !data.success
        ) {

            showError(
                data.message ||
                "Could not load marks."
            );

            return;

        }


        currentCourse =
            data.course;


        students =
            data.students || [];


        assignments =
            data.assignments || [];


        quizzes =
            data.quizzes || [];

        monthlyTests =
            data.monthlyTests || [];


        assignmentMarks =
            data.assignmentMarks || [];


        quizMarks =
            data.quizMarks || [];

        monthlyTestMarks =
            data.monthlyTestMarks || [];


        displayCourse();


        displayMarksTable();


    } catch (error) {

        console.error(
            "Load marks error:",
            error
        );


        showError(
            "Could not connect to the server."
        );

    }

}


// =========================
// DISPLAY COURSE
// =========================

function displayCourse() {

    if (!currentCourse) {
        return;
    }


    let detailsHTML = "";


    if (
        currentCourse.program_enabled !== false
    ) {

        detailsHTML += `

            <span>
                <strong>Program:</strong>
                ${escapeHTML(currentCourse.program || "N/A")}
            </span>

        `;

    }


    if (
        currentCourse.semester_enabled !== false
    ) {

        detailsHTML += `

            <span>
                <strong>Semester:</strong>
                ${escapeHTML(currentCourse.semester || "N/A")}
            </span>

        `;

    }


    if (
        currentCourse.section_enabled !== false
    ) {

        detailsHTML += `

            <span>
                <strong>Section:</strong>
                ${escapeHTML(currentCourse.section || "N/A")}
            </span>

        `;

    }


    courseHeader.innerHTML = `

        <h1>
            ${escapeHTML(currentCourse.name || "Course")}
        </h1>

        <div class="course-details">

            ${detailsHTML}

            <span>
                <strong>Students:</strong>
                ${students.length}
            </span>

        </div>

    `;


    const assignmentText =
        assignments.length === 1
            ? "1 assignment"
            : `${assignments.length} assignments`;


    const quizText =
        quizzes.length === 1
            ? "1 quiz"
            : `${quizzes.length} quizzes`;

    const monthlyText = monthlyTests.length === 1 ? "1 monthly test" : `${monthlyTests.length} monthly tests`;


    if (marksDescription) {

        marksDescription.textContent =
            currentCourse?.class_type === "intermediate"
                ? `Enter ${monthlyText}, the fixed December Test, and Preboard marks.`
                : `Enter marks for ${assignmentText}, ${quizText}, and ${monthlyText}.`;

    }

}


// =========================
// DISPLAY MARKS TABLE
// =========================

function displayMarksTable() {

    if (!marksTableContainer) {
        return;
    }


    if (students.length === 0) {

        marksTableContainer.innerHTML = `
            <p>
                No students found.
            </p>
        `;

        return;

    }


    const isIntermediate = currentCourse?.class_type === "intermediate";

    let html = `

        <table class="marks-table">

            <thead>

                <tr>

                    <th class="student-column">
                        Roll Number
                    </th>

    `;


    const showStudentName =
        currentCourse &&
        currentCourse.student_name_enabled === true;


    if (showStudentName) {

        html += `

                    <th class="name-column">
                        Student Name
                    </th>

        `;

    }


    // =========================
    // ASSIGNMENT COLUMNS
    // =========================

    assignments.forEach(
        assignment => {

            html += `

                <th class="assignment-header">

                    <span class="assessment-name">
                        ${escapeHTML(
                            assignment.name ||
                            `Assignment ${assignment.assignment_number}`
                        )}
                    </span>

                    <span class="max-marks">
                        ${
                            assignment.max_marks !== null
                                ? `Max: ${assignment.max_marks}`
                                : "Max marks not set"
                        }
                    </span>

                </th>

            `;

        }
    );


    // =========================
    // QUIZ COLUMNS
    // =========================

    quizzes.forEach(
        quiz => {

            html += `

                <th class="quiz-header">

                    <span class="assessment-name">
                        ${escapeHTML(
                            quiz.name ||
                            `Quiz ${quiz.quiz_number}`
                        )}
                    </span>

                    <span class="max-marks">
                        ${
                            quiz.max_marks !== null
                                ? `Max: ${quiz.max_marks}`
                                : "Max marks not set"
                        }
                    </span>

                </th>

            `;

        }
    );

    monthlyTests.forEach(test => {
        html += `<th class="assignment-header"><span class="assessment-name">${escapeHTML(test.name)}</span><span class="max-marks">Max: ${test.max_marks}</span></th>`;
    });

    if (isIntermediate) {
        html += `
            <th class="total-header">Monthly Total</th>
            <th class="total-header">Monthly %</th>
            <th class="assignment-header"><span class="assessment-name">December Test</span><span class="max-marks">Max: 100</span></th>
            <th class="assignment-header"><span class="assessment-name">Preboard</span><span class="max-marks">Max: 100</span></th>`;
    }


    html += `

                    ${isIntermediate ? "" : `<th class="total-header">Total</th>`}

                </tr>

            </thead>

            <tbody>

    `;


    // =========================
    // STUDENTS
    // =========================

    students.forEach(
        student => {

            html += `

                <tr>

                    <td class="student-roll">
                        ${escapeHTML(
                            student.roll_number
                        )}
                    </td>

            `;


            if (showStudentName) {

                html += `

                    <td class="student-name">
                        ${escapeHTML(
                            student.name ||
                            "Not added"
                        )}
                    </td>

                `;

            }


            // Assignments

            assignments.forEach(
                assignment => {

                    const existingMarks =
                        findAssignmentMark(
                            assignment.id,
                            student.id
                        );


                    html += `

                        <td>

                            <input
                                type="number"
                                class="marks-input"
                                min="0"
                                ${
                                    assignment.max_marks !== null
                                        ? `max="${assignment.max_marks}"`
                                        : ""
                                }
                                step="0.01"
                                value="${
                                    existingMarks !== null
                                        ? existingMarks
                                        : ""
                                }"
                                data-type="assignment"
                                data-assessment-id="${assignment.id}"
                                data-student-id="${student.id}"
                            >

                        </td>

                    `;

                }
            );


            // Quizzes

            quizzes.forEach(
                quiz => {

                    const existingMarks =
                        findQuizMark(
                            quiz.id,
                            student.id
                        );


                    html += `

                        <td>

                            <input
                                type="number"
                                class="marks-input"
                                min="0"
                                ${
                                    quiz.max_marks !== null
                                        ? `max="${quiz.max_marks}"`
                                        : ""
                                }
                                step="0.01"
                                value="${
                                    existingMarks !== null
                                        ? existingMarks
                                        : ""
                                }"
                                data-type="quiz"
                                data-assessment-id="${quiz.id}"
                                data-student-id="${student.id}"
                            >

                        </td>

                    `;

                }
            );

            monthlyTests.forEach(test => {
                const existingMarks = findMonthlyTestMark(test.id, student.id);
                html += `<td><input type="number" class="marks-input" min="0" max="${test.max_marks}" step="0.01" value="${existingMarks === null ? "" : existingMarks}" data-type="monthly-test" data-assessment-id="${test.id}" data-student-id="${student.id}"></td>`;
            });

            if (isIntermediate) {
                html += `
                    <td class="total-cell" data-monthly-total-student="${student.id}">0</td>
                    <td class="total-cell" data-monthly-percentage-student="${student.id}">—</td>
                    <td><input type="number" class="marks-input" min="0" max="100" step="0.01" value="${student.december_test_marks ?? ""}" data-type="december-test" data-student-id="${student.id}"></td>
                    <td><input type="number" class="marks-input" min="0" max="100" step="0.01" value="${student.preboard_marks ?? ""}" data-type="preboard" data-student-id="${student.id}"></td>`;
            }


            html += `

                    ${isIntermediate ? "" : `<td class="total-cell" data-total-student="${student.id}">0</td>`}

                </tr>

            `;

        }
    );


    html += `

            </tbody>

        </table>

    `;


    marksTableContainer.innerHTML =
        html;


    setupMarkInputs();

    updateAllTotals();

}


// =========================
// FIND ASSIGNMENT MARK
// =========================

function findAssignmentMark(
    assignmentId,
    studentId
) {

    const record =
        assignmentMarks.find(
            item =>
                Number(item.assignment_id) ===
                    Number(assignmentId) &&
                Number(item.student_id) ===
                    Number(studentId)
        );


    if (!record) {
        return null;
    }


    return record.marks;

}


// =========================
// FIND QUIZ MARK
// =========================

function findQuizMark(
    quizId,
    studentId
) {

    const record =
        quizMarks.find(
            item =>
                Number(item.quiz_id) ===
                    Number(quizId) &&
                Number(item.student_id) ===
                    Number(studentId)
        );


    if (!record) {
        return null;
    }


    return record.marks;

}

function findMonthlyTestMark(testId, studentId) {
    const record = monthlyTestMarks.find(item => Number(item.monthly_test_id) === Number(testId) && Number(item.student_id) === Number(studentId));
    return record ? record.marks : null;
}


// =========================
// SETUP INPUTS
// =========================

function setupMarkInputs() {

    const inputs =
        document.querySelectorAll(
            ".marks-input"
        );


    inputs.forEach(input => {

        input.addEventListener(
            "input",
            () => {

                validateInput(
                    input
                );


                updateStudentTotal(
                    input.dataset.studentId
                );

            }
        );

    });

}


// =========================
// VALIDATE INPUT
// =========================

function validateInput(input) {

    const value =
        input.value.trim();


    input.classList.remove(
        "invalid"
    );


    if (value === "") {
        return true;
    }


    const number =
        Number(value);


    if (
        !Number.isFinite(number) ||
        number < 0
    ) {

        input.classList.add(
            "invalid"
        );

        return false;

    }


    const max =
        input.getAttribute(
            "max"
        );


    if (
        max !== null &&
        number > Number(max)
    ) {

        input.classList.add(
            "invalid"
        );

        return false;

    }


    return true;

}


// =========================
// UPDATE TOTAL
// =========================

function updateStudentTotal(
    studentId
) {

    if (currentCourse?.class_type === "intermediate") {
        const monthlyInputs = document.querySelectorAll(
            `.marks-input[data-type="monthly-test"][data-student-id="${studentId}"]`
        );
        let monthlyTotal = 0;
        monthlyInputs.forEach(input => {
            const value = Number(input.value);
            if (input.value.trim() !== "" && Number.isFinite(value)) monthlyTotal += value;
        });
        const monthlyMaximum = monthlyTests.reduce(
            (sum, test) => sum + Number(test.max_marks || 0),
            0
        );
        const totalCell = document.querySelector(`[data-monthly-total-student="${studentId}"]`);
        const percentageCell = document.querySelector(`[data-monthly-percentage-student="${studentId}"]`);
        if (totalCell) totalCell.textContent = formatNumber(monthlyTotal);
        if (percentageCell) {
            percentageCell.textContent = monthlyMaximum > 0
                ? `${formatNumber((monthlyTotal / monthlyMaximum) * 100)}%`
                : "—";
        }
        return;
    }

    const inputs =
        document.querySelectorAll(
            `.marks-input[data-student-id="${studentId}"]`
        );


    let total = 0;


    inputs.forEach(input => {

        const value =
            Number(input.value);


        if (
            input.value.trim() !== "" &&
            Number.isFinite(value)
        ) {

            total += value;

        }

    });


    const totalCell =
        document.querySelector(
            `[data-total-student="${studentId}"]`
        );


    if (totalCell) {

        totalCell.textContent =
            formatNumber(total);

    }

}


// =========================
// UPDATE ALL TOTALS
// =========================

function updateAllTotals() {

    students.forEach(
        student => {

            updateStudentTotal(
                student.id
            );

        }
    );

}


// =========================
// SAVE MARKS
// =========================

if (saveMarksBtn) {

    saveMarksBtn.addEventListener(
        "click",
        saveMarks
    );

}


async function saveMarks() {

    const inputs =
        document.querySelectorAll(
            ".marks-input"
        );


    const assignmentPayload = [];

    const quizPayload = [];
    const monthlyTestPayload = [];
    const decemberTestPayload = [];
    const preboardPayload = [];


    let hasError = false;


    inputs.forEach(input => {

        const valid =
            validateInput(input);


        if (!valid) {

            hasError = true;

            return;

        }


        const value =
            input.value.trim();


        // Empty means no mark entered yet.
        // Don't send it.

        if (value === "") {
            return;
        }


        const item = {

            student_id:
                Number(
                    input.dataset.studentId
                ),

            marks:
                Number(value)

        };


        if (
            input.dataset.type ===
            "assignment"
        ) {

            assignmentPayload.push({

                assignment_id:
                    Number(
                        input.dataset.assessmentId
                    ),

                student_id:
                    item.student_id,

                marks:
                    item.marks

            });

        }


        if (
            input.dataset.type ===
            "quiz"
        ) {

            quizPayload.push({

                quiz_id:
                    Number(
                        input.dataset.assessmentId
                    ),

                student_id:
                    item.student_id,

                marks:
                    item.marks

            });

        }

        if (input.dataset.type === "monthly-test") {
            monthlyTestPayload.push({ monthly_test_id: Number(input.dataset.assessmentId), student_id: item.student_id, marks: item.marks });
        }

        if (input.dataset.type === "december-test") {
            decemberTestPayload.push(item);
        }

        if (input.dataset.type === "preboard") {
            preboardPayload.push(item);
        }

    });


    if (hasError) {

        showMessage(
            "Please fix the invalid marks before saving.",
            "error"
        );

        return;

    }


    saveMarksBtn.disabled =
        true;


    saveMarksBtn.textContent =
        "Saving...";


    try {

        const response =
            await fetch(
                `/api/courses/${courseId}/marks`,
                {

                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials:
                        "include",

                    body:
                        JSON.stringify({

                            assignmentMarks:
                                assignmentPayload,

                            quizMarks:
                                quizPayload,

                            monthlyTestMarks:
                                monthlyTestPayload,

                            decemberTestMarks:
                                decemberTestPayload,

                            preboardMarks:
                                preboardPayload

                        })

                }
            );


        const data =
            await response.json();


        console.log(
            "Save marks response:",
            data
        );


        if (
            !response.ok ||
            !data.success
        ) {

            showMessage(
                data.message ||
                "Could not save marks.",
                "error"
            );

            return;

        }


        showMessage(
            "Marks saved successfully!",
            "success"
        );


    } catch (error) {

        console.error(
            "Save marks error:",
            error
        );


        showMessage(
            "Could not connect to the server.",
            "error"
        );


    } finally {

        saveMarksBtn.disabled =
            false;


        saveMarksBtn.textContent =
            "Save Marks";

    }

}


// =========================
// MESSAGE
// =========================

function showMessage(
    text,
    type
) {

    if (!marksMessage) {
        return;
    }


    marksMessage.textContent =
        text;


    marksMessage.className =
        `message ${type}`;

}


// =========================
// ERROR
// =========================

function showError(text) {

    if (!marksTableContainer) {
        return;
    }


    marksTableContainer.innerHTML = `

        <p class="error">
            ${escapeHTML(text)}
        </p>

    `;

}


// =========================
// FORMAT NUMBER
// =========================

function formatNumber(number) {

    if (
        Number.isInteger(number)
    ) {

        return String(number);

    }


    return number.toFixed(2);

}


// =========================
// ESCAPE HTML
// =========================

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


// =========================
// LOGOUT
// =========================

if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        async () => {

            try {

                await fetch(
                    "/api/auth/logout",
                    {
                        method: "POST",
                        credentials: "include"
                    }
                );

            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );

            }


            localStorage.removeItem(
                "teacher"
            );


            window.location.href =
                "/test-login.html";

        }
    );

}


// =========================
// START
// =========================

loadTeacher();

loadMarks();
