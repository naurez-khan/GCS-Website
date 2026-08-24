const params = new URLSearchParams(
    window.location.search
);

const courseId = params.get("id");

const coursePageAction = ({
    "/edit-class.html": "edit",
    "/import-students.html": "import",
    "/take-attendance.html": "attendance",
    "/course-marks.html": "marks",
    "/attendance-history.html": "history"
})[window.location.pathname] || "hub";

const coursePageUrl = page => `/${page}.html?id=${encodeURIComponent(courseId || "")}`;
const returnToCourseHub = () => {
    window.location.href = `/course.html?id=${encodeURIComponent(courseId || "")}`;
};

let courseNavigationPending = false;
function navigateFromCourseHub(url) {
    if (courseNavigationPending) return;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (coursePageAction !== "hub" || reduceMotion) {
        window.location.href = url;
        return;
    }

    courseNavigationPending = true;
    document.body.classList.add("course-page-exit-left");
    window.setTimeout(() => {
        window.location.href = url;
    }, 230);
}

function pulseAttendanceStatus(button) {
    button.classList.remove("status-icon-pop");
    void button.offsetWidth;
    button.classList.add("status-icon-pop");
}

function setAttendanceButtonStatus(button, status, animate = true) {
    button.dataset.status = status;
    button.textContent = status === "present" ? "Present" : (status === "leave" ? "Leave" : "Absent");
    button.classList.toggle("present", status === "present");
    button.classList.toggle("absent", status === "absent");
    button.classList.toggle("leave", status === "leave");
    if (animate) pulseAttendanceStatus(button);
}


// =========================
// ELEMENTS
// =========================

const teacherName =
    document.getElementById("teacherName");

const courseHeader =
    document.getElementById("courseHeader");

const studentCount =
    document.getElementById("studentCount");

const studentsContainer =
    document.getElementById("studentsContainer");

const saveStudentNamesBtn =
    document.getElementById("saveStudentNamesBtn");

const attendanceBtn =
    document.getElementById("attendanceBtn");

const attendanceSection =
    document.getElementById("attendanceSection");

const attendanceDate =
    document.getElementById("attendanceDate");

const attendanceList =
    document.getElementById("attendanceList");

const attendanceMessage =
    document.getElementById("attendanceMessage");

const saveAttendanceBtn =
    document.getElementById("saveAttendanceBtn");

const cancelAttendanceBtn =
    document.getElementById("cancelAttendanceBtn");

const logoutBtn =
    document.getElementById("logoutBtn");


// =========================
// MARKS ELEMENTS
// =========================

const marksBtn =
    document.getElementById("marksBtn");

const marksSection =
    document.getElementById("marksSection");

const marksContainer =
    document.getElementById("marksContainer");

const marksMessage =
    document.getElementById("marksMessage");

const saveMarksBtn =
    document.getElementById("saveMarksBtn");

const cancelMarksBtn =
    document.getElementById("cancelMarksBtn");


// =========================
// ATTENDANCE HISTORY
// =========================

const attendanceSummary =
    document.getElementById("attendanceSummary");

const editClassBtn = document.getElementById("editClassBtn");
const importStudentsBtn = document.getElementById("importStudentsBtn");
const attendanceHistoryBtn = document.getElementById("attendanceHistoryBtn");
const downloadClassBackupBtn = document.getElementById("downloadClassBackupBtn");
const classSettingsSection = document.getElementById("classSettingsSection");
const studentImportSection = document.getElementById("studentImportSection");
const editAttendanceBtn = document.getElementById("editAttendanceBtn");
const attendanceEditor = document.getElementById("attendanceEditor");


// =========================
// EXCEL DOWNLOAD
// =========================

const downloadExcelBtn =
    document.getElementById("downloadExcelBtn");

const downloadMarksExcelBtn =
    document.getElementById("downloadMarksExcelBtn");

const attendanceExportMonth =
    document.getElementById("attendanceExportMonth");


// =========================
// GLOBAL DATA
// =========================

let students = [];

let currentCourse = null;

let courseAssignments = [];

let courseQuizzes = [];
let courseMonthlyTests = [];

let assignmentMarks = [];

let quizMarks = [];
let monthlyTestMarks = [];

let currentAttendanceRecords = [];

let pendingStudentImport = [];


// =========================
// TEACHER
// =========================

function loadTeacher() {

    const teacher =
        JSON.parse(
            localStorage.getItem("teacher")
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
// LOAD COURSE + STUDENTS
// =========================

async function loadCourse() {

    if (!courseId) {

        courseHeader.innerHTML = `
            <p class="error">
                Course ID is missing.
            </p>
        `;

        return;
    }


    try {

        const response =
            await fetch(
                `/api/courses/${courseId}/students`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );


        const data =
            await response.json();


        console.log(
            "Course response:",
            data
        );


        if (!data.success) {

            courseHeader.innerHTML = `
                <p class="error">
                    ${escapeHtml(data.message || "Could not load course.")}
                </p>
            `;

            return;
        }


        currentCourse =
            data.course;


        displayCourse(
            currentCourse
        );


        students =
            data.students || [];


        displayStudents(
            students
        );

        if (editClassBtn) editClassBtn.disabled = false;
        if (importStudentsBtn) importStudentsBtn.disabled = false;


        applyAttendanceSetting(
            currentCourse
        );


        applyMarksSetting(
            currentCourse
        );


        if (
            currentCourse.attendance_enabled !== false
        ) {

            loadAttendanceHistory();

        }

    } catch (error) {

        console.error(
            "Load course error:",
            error
        );


        courseHeader.innerHTML = `
            <p class="error">
                Could not connect to server.
            </p>
        `;

    }

}


// =========================
// DISPLAY COURSE
// =========================

function displayCourse(course) {

    const courseName =
        course.name || "Course";


    let detailsHTML = "";

    if (course.course_code) {
        detailsHTML += `
            <span>
                <strong>Course Code:</strong>
                ${escapeHtml(course.course_code)}
            </span>
        `;
    }

    detailsHTML += `
        <span><strong>Class Level:</strong> ${course.class_type === "intermediate" ? "Intermediate" : "Bachelors"}</span>
        <span><strong>Shift:</strong> ${course.class_shift === "evening" ? "Evening" : "Morning"}</span>
    `;


    if (
        course.program_enabled !== false
    ) {

        detailsHTML += `

            <span>

                <strong>
                    Program:
                </strong>

                ${escapeHtml(course.program || "N/A")}

            </span>

        `;

    }


    if (
        course.semester_enabled !== false
    ) {

        detailsHTML += `

            <span>

                <strong>
                    ${course.class_type === "intermediate" ? "Class / Year" : "Semester"}:
                </strong>

                ${escapeHtml(course.semester || "N/A")}

            </span>

        `;

    }


    if (
        course.section_enabled !== false
    ) {

        detailsHTML += `

            <span>

                <strong>
                    Section:
                </strong>

                ${escapeHtml(course.section || "N/A")}

            </span>

        `;

    }


    detailsHTML += `

        <span>

            <strong>
                Roll Numbers:
            </strong>

            ${escapeHtml(formatRollNumberSummary(course))}

        </span>

    `;

    if (course.results_enabled && course.result_code) {
        detailsHTML += `
            <span>
                <strong>Student result code:</strong>
                ${escapeHtml(course.result_code)}
            </span>
        `;
    }


    courseHeader.innerHTML = `

        <h1>
            ${escapeHtml(courseName)}
        </h1>

        <div class="course-details">

            ${detailsHTML}

        </div>

    `;

}


// =========================
// ATTENDANCE ON/OFF
// =========================

function applyAttendanceSetting(course) {

    const attendanceEnabled =
        course.attendance_enabled !== false;


    if (attendanceBtn) {

        attendanceBtn.style.display =
            attendanceEnabled
                ? ""
                : "none";

    }


    if (!attendanceEnabled) {

        if (attendanceSection) {

            attendanceSection.classList.add(
                "hidden"
            );

        }

    }


    const historySection =
        document.querySelector(
            ".history-section"
        );


    if (historySection) {

        historySection.style.display =
            attendanceEnabled
                ? ""
                : "none";

    }

}


// =========================
// MARKS ON/OFF
// =========================

function applyMarksSetting(course) {

    const marksEnabled =
        course.class_type === "intermediate" ||
        course.assignments_enabled === true ||
        course.quizzes_enabled === true ||
        course.monthly_tests_enabled === true ||
        course.midterm_enabled === true ||
        course.final_enabled === true;


    if (marksBtn) {

        marksBtn.style.display =
            marksEnabled
                ? ""
                : "none";

    }


    if (!marksEnabled && marksSection) {

        marksSection.classList.add(
            "hidden"
        );

    }

}


// =========================
// DISPLAY STUDENTS
// =========================

function displayStudents(students) {

    studentCount.textContent =
        `${students.length} students`;


    if (students.length === 0) {

        studentsContainer.innerHTML = `
            <p>
                No students found.
            </p>
        `;

        return;
    }


    const showStudentName =
        currentCourse &&
        currentCourse.student_name_enabled === true;

    if (saveStudentNamesBtn) {
        saveStudentNamesBtn.classList.toggle("hidden", !showStudentName);
    }


    const showProgram =
        !currentCourse ||
        currentCourse.program_enabled !== false;


    const showSemester =
        !currentCourse ||
        currentCourse.semester_enabled !== false;


    let html = `

        <div class="student-table-wrapper">
        <table class="student-table">

            <thead>

                <tr>

                    <th>
                        Roll Number
                    </th>

    `;


    if (showStudentName) {

        html += `
                    <th>
                        Name
                    </th>
        `;

    }


    if (showProgram) {

        html += `
                    <th>
                        Program
                    </th>
        `;

    }


    if (showSemester) {

        html += `
                    <th>
                        Semester
                    </th>
        `;

    }


    html += `

                </tr>

            </thead>

            <tbody>

    `;


    students.forEach(student => {

        html += `

            <tr>

                <td>
                    ${escapeHtml(student.roll_number)}
                </td>

        `;


        if (showStudentName) {

            html += `

                <td>
                    <input
                        class="student-name-input"
                        data-student-id="${student.id}"
                        maxlength="150"
                        value="${escapeHtml(student.name || "")}"
                        placeholder="Enter student name"
                    >
                </td>

            `;

        }


        if (showProgram) {

            html += `

                <td>
                    ${escapeHtml(student.program || "-")}
                </td>

            `;

        }


        if (showSemester) {

            html += `

                <td>
                    ${escapeHtml(student.semester || "-")}
                </td>

            `;

        }


        html += `

            </tr>

        `;

    });


    html += `

            </tbody>

        </table>
        </div>

    `;


    studentsContainer.innerHTML =
        html;

}

function formatRollNumberSummary(course) {
    const rollNumbers = [...new Set(
        (Array.isArray(course.roll_numbers) ? course.roll_numbers : [])
            .map(Number)
            .filter(Number.isInteger)
    )].sort((first, second) => first - second);

    if (!rollNumbers.length) {
        return `${course.roll_start ?? ""} - ${course.roll_end ?? ""}`;
    }

    const ranges = [];
    let start = rollNumbers[0];
    let end = rollNumbers[0];

    for (let index = 1; index <= rollNumbers.length; index += 1) {
        const current = rollNumbers[index];
        if (current === end + 1) {
            end = current;
            continue;
        }
        ranges.push(start === end ? String(start) : `${start}–${end}`);
        start = current;
        end = current;
    }

    return ranges.join(", ");
}

if (saveStudentNamesBtn) {
    saveStudentNamesBtn.addEventListener("click", async () => {
        const inputs = [...document.querySelectorAll(".student-name-input")];
        saveStudentNamesBtn.disabled = true;
        saveStudentNamesBtn.textContent = "Saving…";
        try {
            for (const input of inputs) {
                const response = await fetch(`/api/courses/${courseId}/students/${input.dataset.studentId}`, {
                    method: "PUT",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: input.value })
                });
                const data = await response.json();
                if (!response.ok || !data.success) throw new Error(data.message || "Could not save student names");
                const student = students.find(item => String(item.id) === input.dataset.studentId);
                if (student) student.name = data.student.name;
            }
            alert("Student names saved successfully.");
        } catch (error) {
            alert(error.message);
        } finally {
            saveStudentNamesBtn.disabled = false;
            saveStudentNamesBtn.textContent = "Save Student Names";
        }
    });
}


// =========================
// OPEN ATTENDANCE
// =========================

if (attendanceBtn) {

    attendanceBtn.addEventListener(
        "click",
        () => {

            if (coursePageAction !== "attendance") {
                navigateFromCourseHub(coursePageUrl("take-attendance"));
                return;
            }

            if (
                currentCourse &&
                currentCourse.attendance_enabled === false
            ) {

                return;

            }


            attendanceSection.classList.remove(
                "hidden"
            );


            const today =
                getTodayDate();


            attendanceDate.textContent =
                formatDateForDisplay(today);


            renderAttendanceList();


            attendanceSection.scrollIntoView({
                behavior: "smooth"
            });

        }
    );

}


// =========================
// ATTENDANCE LIST
// =========================

function renderAttendanceList() {

    attendanceList.innerHTML = "";


    students.forEach((student, index) => {

        const row =
            document.createElement("div");

        row.className =
            "attendance-row";


        const showStudentName =
            currentCourse &&
            currentCourse.student_name_enabled === true;


        const studentDisplay =
            showStudentName
                ? (student.name || "Not added")
                : `Student ${student.roll_number}`;


        row.innerHTML = `

            <div class="roll-number">
                ${escapeHtml(student.roll_number)}
            </div>

            <div class="student-name">
                ${escapeHtml(studentDisplay)}
            </div>

            <div>

                <button
                    type="button"
                    class="attendance-status-btn absent"
                    data-student-id="${student.id}"
                    data-status="absent"
                >
                    Absent
                </button>

            </div>

        `;


        const button =
            row.querySelector(
                ".attendance-status-btn"
            );


        button.addEventListener(
            "click",
            () => {

                if (button.dataset.status === "leave") return;

                const isPresent =
                    button.dataset.status === "present";

                setAttendanceButtonStatus(button, isPresent ? "absent" : "present");

            }
        );


        attendanceList.appendChild(row);

        const completedCount = index + 1;
        if (
            currentCourse?.class_type === "intermediate" &&
            completedCount % 25 === 0 &&
            completedCount < students.length
        ) {
            const marker = document.createElement("div");
            marker.className = "attendance-count-marker";
            marker.innerHTML = `<span>${completedCount} students</span>`;
            attendanceList.appendChild(marker);
        }

    });

    restoreTodayAttendanceSummary();

}

function displaySavedAttendanceTotals(presentTotal, absentTotal, leaveTotal = 0) {
    const summary = document.getElementById("attendanceSavedSummary");
    if (!summary) return;
    summary.innerHTML = `
        <h3>Attendance Saved</h3>
        <div><strong>${presentTotal + absentTotal + leaveTotal}</strong><span>Students</span></div>
        <div class="present-total"><strong>${presentTotal}</strong><span>Present</span></div>
        <div class="absent-total"><strong>${absentTotal}</strong><span>Absent</span></div>
        <div class="leave-total"><strong>${leaveTotal}</strong><span>Leave</span></div>`;
    summary.classList.remove("hidden");
}

function restoreTodayAttendanceSummary(animateStudentId = null) {
    const summary = document.getElementById("attendanceSavedSummary");
    if (!summary) return;
    const todayRecords = currentAttendanceRecords.filter(record => record.attendance_date === getTodayDate());
    if (!todayRecords.length) {
        summary.classList.add("hidden");
        return;
    }
    const statusByStudent = new Map(todayRecords.map(record => [Number(record.student_id), record.status]));
    document.querySelectorAll(".attendance-status-btn").forEach(button => {
        const status = statusByStudent.get(Number(button.dataset.studentId));
        if (!status) return;
        setAttendanceButtonStatus(button, status, Number(button.dataset.studentId) === Number(animateStudentId));
    });
    const absentTotal = todayRecords.filter(record => record.status === "absent").length;
    const leaveTotal = todayRecords.filter(record => record.status === "leave").length;
    displaySavedAttendanceTotals(todayRecords.length - absentTotal - leaveTotal, absentTotal, leaveTotal);
}


// =========================
// SAVE ATTENDANCE
// =========================

if (saveAttendanceBtn) {

    saveAttendanceBtn.addEventListener(
        "click",
        saveAttendance
    );

}


async function saveAttendance() {

    const buttons =
        document.querySelectorAll(
            ".attendance-status-btn"
        );


    if (buttons.length === 0) {

        showAttendanceMessage(
            "No students found.",
            "error"
        );

        return;
    }


    const attendance =
        Array.from(buttons).map(button => {

            return {

                student_id:
                    Number(
                        button.dataset.studentId
                    ),

                status:
                    button.dataset.status

            };

        });


    const absentStudentIds =
        attendance
            .filter(
                student =>
                    student.status === "absent"
            )
            .map(
                student =>
                    student.student_id
            );


    const payload = {

        courseId:
            Number(courseId),

        date:
            getTodayDate(),

        absentStudentIds:
            absentStudentIds

    };


    saveAttendanceBtn.disabled =
        true;

    saveAttendanceBtn.textContent =
        "Saving...";


    try {

        const response =
            await fetch(
                "/api/attendance/mark",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials: "include",

                    body:
                        JSON.stringify(
                            payload
                        )

                }
            );


        const responseText =
            await response.text();


        let data;


        try {

            data =
                JSON.parse(
                    responseText
                );

        } catch (error) {

            showAttendanceMessage(
                `Server returned HTTP ${response.status}.`,
                "error"
            );

            return;

        }


        if (!data.success) {

            showAttendanceMessage(
                data.message ||
                "Failed to save attendance.",
                "error"
            );

            return;

        }


        showAttendanceMessage("Attendance saved successfully.", "success");

        const presentTotal = Number(data.presentStudents) || 0;
        const absentTotal = Number(data.absentStudents) || 0;
        const leaveTotal = Number(data.leaveStudents) || 0;
        displaySavedAttendanceTotals(presentTotal, absentTotal, leaveTotal);
        const savedSummary = document.getElementById("attendanceSavedSummary");
        if (savedSummary) {
            savedSummary.scrollIntoView({ behavior: "smooth", block: "start" });
        }


        loadAttendanceHistory();


    } catch (error) {

        console.error(
            "Attendance error:",
            error
        );


        showAttendanceMessage(
            "Could not connect to the server.",
            "error"
        );

    } finally {

        saveAttendanceBtn.disabled =
            false;

        saveAttendanceBtn.textContent =
            "Save Attendance";

    }

}


// =========================
// CANCEL ATTENDANCE
// =========================

if (cancelAttendanceBtn) {

    cancelAttendanceBtn.addEventListener(
        "click",
        () => {

            if (coursePageAction === "attendance") return returnToCourseHub();

            attendanceSection.classList.add(
                "hidden"
            );

            attendanceMessage.className =
                "message";

            attendanceMessage.textContent =
                "";

        }
    );

}


// =========================
// ATTENDANCE MESSAGE
// =========================

function showAttendanceMessage(
    text,
    type
) {

    if (!attendanceMessage) {
        return;
    }


    attendanceMessage.textContent =
        text;

    attendanceMessage.className =
        `message ${type}`;

}


// =========================
// MARKS BUTTON
// =========================

if (marksBtn) {

    marksBtn.addEventListener(
        "click",
        async () => {

            if (coursePageAction !== "marks") {
                navigateFromCourseHub(coursePageUrl("course-marks"));
                return;
            }

            if (!currentCourse) {
                return;
            }


            marksSection.classList.remove(
                "hidden"
            );


            marksSection.scrollIntoView({
                behavior: "smooth"
            });


            await loadCourseMarks();

        }
    );

}


// =========================
// LOAD MARKS
// =========================

async function loadCourseMarks() {

    if (!marksContainer) {
        return;
    }


    const marksLoadingEl =
        document.getElementById(
            "marksLoading"
        );


    if (marksLoadingEl) {

        marksLoadingEl.style.display =
            "none";

    }


    marksContainer.innerHTML = `
        <p class="loading">
            Loading marks...
        </p>
    `;


    try {

        const response =
            await fetch(
                `/api/courses/${courseId}/marks?refresh=${Date.now()}`,
                {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store"
                }
            );


        const data =
            await response.json();


        if (!response.ok || !data.success) {

            marksContainer.innerHTML = `
                <p class="error">
                    ${escapeHtml(
                        data.message ||
                        "Could not load marks."
                    )}
                </p>
            `;

            return;

        }


        currentCourse = {
            ...(currentCourse || {}),
            ...(data.course || {})
        };

        const courseMarksDescription = document.getElementById("courseMarksDescription");
        if (courseMarksDescription) {
            courseMarksDescription.textContent = currentCourse.class_type === "intermediate"
                ? "Enter monthly-test marks, December Test marks, and Preboard marks."
                : "Enter marks for each assignment and quiz.";
        }

        courseAssignments =
            data.assignments || [];

        courseQuizzes =
            data.quizzes || [];

        courseMonthlyTests =
            data.monthlyTests || [];

        assignmentMarks =
            data.assignmentMarks || [];

        quizMarks =
            data.quizMarks || [];

        monthlyTestMarks =
            data.monthlyTestMarks || [];

        students =
            data.students || students;


        renderMarksTable();


    } catch (error) {

        console.error(
            "Load marks error:",
            error
        );


        marksContainer.innerHTML = `
            <p class="error">
                Could not load marks: ${escapeHtml(error.message || "Unknown error")}
            </p>
        `;

    }

}


// =========================
// RENDER MARKS TABLE
// =========================

function renderMarksTable() {

    if (!marksContainer) {
        return;
    }


    if (students.length === 0) {

        marksContainer.innerHTML = `
            <p>
                No students found.
            </p>
        `;

        return;
    }


    const isIntermediate = currentCourse?.class_type === "intermediate";


    let html = `

        <div class="marks-table-wrapper">

            <table class="marks-table">

                <thead>

                    <tr>

                        <th>
                            Roll Number
                        </th>

    `;


    if (
        currentCourse &&
        currentCourse.student_name_enabled === true
    ) {

        html += `
                        <th>
                            Student
                        </th>
        `;

    }


    courseAssignments.forEach(
        assignment => {

            html += `

                        <th>
                            ${escapeHtml(
                                assignment.name
                            )}
                            <small>
                                / ${assignment.max_marks}
                            </small>
                        </th>

            `;

        }
    );


    courseQuizzes.forEach(
        quiz => {

            html += `

                        <th>
                            ${escapeHtml(
                                quiz.name
                            )}
                            <small>
                                / ${quiz.max_marks}
                            </small>
                        </th>

            `;

        }
    );

    courseMonthlyTests.forEach(test => {
        html += `
            <th>
                ${escapeHtml(test.name)}
                <small>/ ${test.max_marks}</small>
            </th>`;
    });

    if (isIntermediate) {
        html += `
            <th class="total-header">Monthly Total</th>
            <th class="total-header">Monthly %</th>
            <th>December Test <small>/ 100</small></th>
            <th>Preboard <small>/ 100</small></th>`;
    }


    if (
        currentCourse &&
        currentCourse.midterm_enabled === true
    ) {

        html += `

                        <th>
                            Midterm
                        </th>

        `;

    }


    if (
        currentCourse &&
        currentCourse.final_enabled === true
    ) {

        html += `

                        <th>
                            Final Exam
                        </th>

        `;

    }


    html += `

                        ${isIntermediate ? "" : `<th class="total-header">Total</th>`}

                    </tr>

                </thead>

                <tbody>

    `;


    students.forEach(student => {

        html += `

            <tr>

                <td>
                    ${escapeHtml(
                        String(
                            student.roll_number
                        )
                    )}
                </td>

        `;


        if (
            currentCourse &&
            currentCourse.student_name_enabled === true
        ) {

            html += `

                <td>
                    ${escapeHtml(
                        student.name ||
                        "Not added"
                    )}
                </td>

            `;

        }


        courseAssignments.forEach(
            assignment => {

                const existing =
                    findAssignmentMark(
                        assignment.id,
                        student.id
                    );


                html += `

                    <td>

                        <input
                            type="number"
                            class="mark-input assignment-mark"
                            data-assignment-id="${assignment.id}"
                            data-student-id="${student.id}"
                            data-max-marks="${assignment.max_marks}"
                            min="0"
                            max="${assignment.max_marks}"
                            step="0.01"
                            value="${
                                existing === null
                                    ? ""
                                    : existing
                            }"
                        >

                    </td>

                `;

            }
        );


        courseQuizzes.forEach(
            quiz => {

                const existing =
                    findQuizMark(
                        quiz.id,
                        student.id
                    );


                html += `

                    <td>

                        <input
                            type="number"
                            class="mark-input quiz-mark"
                            data-quiz-id="${quiz.id}"
                            data-student-id="${student.id}"
                            data-max-marks="${quiz.max_marks}"
                            min="0"
                            max="${quiz.max_marks}"
                            step="0.01"
                            value="${
                                existing === null
                                    ? ""
                                    : existing
                            }"
                        >

                    </td>

                `;

            }
        );

        courseMonthlyTests.forEach(test => {
            const existing = findMonthlyTestMark(test.id, student.id);
            html += `
                <td>
                    <input type="number" class="mark-input monthly-test-mark"
                        data-monthly-test-id="${test.id}"
                        data-student-id="${student.id}"
                        data-max-marks="${test.max_marks}"
                        min="0" max="${test.max_marks}" step="0.01"
                        value="${existing === null ? "" : existing}">
                </td>`;
        });

        if (isIntermediate) {
            html += `
                <td class="total-cell" data-monthly-total-student="${student.id}">0</td>
                <td class="total-cell" data-monthly-percentage-student="${student.id}">—</td>
                <td>
                    <input type="number" class="mark-input december-test-mark"
                        data-student-id="${student.id}" data-max-marks="100"
                        min="0" max="100" step="0.01"
                        value="${student.december_test_marks ?? ""}">
                </td>
                <td>
                    <input type="number" class="mark-input preboard-mark"
                        data-student-id="${student.id}" data-max-marks="100"
                        min="0" max="100" step="0.01"
                        value="${student.preboard_marks ?? ""}">
                </td>`;
        }


        if (
            currentCourse &&
            currentCourse.midterm_enabled === true
        ) {

            html += `

                <td>

                    <input
                        type="number"
                        class="mark-input midterm-mark"
                        data-student-id="${student.id}"
                        min="0"
                        max="${currentCourse.midterm_max_marks}"
                        step="0.01"
                        value="${
                            student.midterm_marks !== null &&
                            student.midterm_marks !== undefined
                                ? student.midterm_marks
                                : ""
                        }"
                    >

                </td>

            `;

        }


        if (
            currentCourse &&
            currentCourse.final_enabled === true
        ) {

            html += `

                <td>

                    <input
                        type="number"
                        class="mark-input final-mark"
                        data-student-id="${student.id}"
                        min="0"
                        max="${currentCourse.final_max_marks}"
                        step="0.01"
                        value="${
                            student.final_marks !== null &&
                            student.final_marks !== undefined
                                ? student.final_marks
                                : ""
                        }"
                    >

                </td>

            `;

        }


        html += `

                ${isIntermediate ? "" : `<td class="total-cell" data-total-student="${student.id}">0</td>`}

            </tr>
        `;

    });


    html += `

                </tbody>

            </table>

        </div>

    `;


    marksContainer.innerHTML =
        html;


    attachMarkValidation();

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


    return record
        ? record.marks
        : null;

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


    return record
        ? record.marks
        : null;

}


// =========================
// MARK VALIDATION
// =========================

function attachMarkValidation() {

    const inputs =
        document.querySelectorAll(
            ".mark-input"
        );


    inputs.forEach(input => {

        input.addEventListener(
            "input",
            () => {

                const max =
                    Number(
                        input.dataset.maxMarks
                    );


                const value =
                    Number(input.value);


                if (
                    input.value !== "" &&
                    (
                        Number.isNaN(value) ||
                        value < 0 ||
                        value > max
                    )
                ) {

                    input.classList.add(
                        "invalid"
                    );

                } else {

                    input.classList.remove(
                        "invalid"
                    );

                }


                updateStudentTotal(
                    input.dataset.studentId
                );

            }
        );

    });

}


// =========================
// UPDATE STUDENT TOTAL
// =========================

function updateStudentTotal(studentId) {

    if (currentCourse?.class_type === "intermediate") {
        const monthlyInputs = document.querySelectorAll(
            `.monthly-test-mark[data-student-id="${studentId}"]`
        );
        let monthlyTotal = 0;
        monthlyInputs.forEach(input => {
            const value = Number(input.value);
            if (input.value.trim() !== "" && Number.isFinite(value)) monthlyTotal += value;
        });
        const monthlyMaximum = courseMonthlyTests.reduce(
            (sum, test) => sum + Number(test.max_marks || 0),
            0
        );
        const totalCell = document.querySelector(`[data-monthly-total-student="${studentId}"]`);
        const percentageCell = document.querySelector(`[data-monthly-percentage-student="${studentId}"]`);
        if (totalCell) totalCell.textContent = formatTotal(monthlyTotal);
        if (percentageCell) {
            percentageCell.textContent = monthlyMaximum > 0
                ? `${formatTotal((monthlyTotal / monthlyMaximum) * 100)}%`
                : "—";
        }
        return;
    }

    const inputs =
        document.querySelectorAll(
            `.mark-input[data-student-id="${studentId}"]`
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
            formatTotal(total);

    }

}


// =========================
// UPDATE ALL TOTALS
// =========================

function updateAllTotals() {

    students.forEach(student => {

        updateStudentTotal(
            student.id
        );

    });

}


// =========================
// FORMAT TOTAL
// =========================

function formatTotal(number) {

    if (Number.isInteger(number)) {

        return String(number);

    }


    return number.toFixed(2);

}


// =========================
// SAVE MARKS
// =========================

if (saveMarksBtn) {

    saveMarksBtn.addEventListener(
        "click",
        saveCourseMarks
    );

}


async function saveCourseMarks() {

    const inputs =
        document.querySelectorAll(
            ".mark-input"
        );


    const assignmentPayload = [];

    const quizPayload = [];

    const monthlyTestPayload = [];

    const midtermPayload = [];

    const finalPayload = [];

    const decemberTestPayload = [];

    const preboardPayload = [];


    for (const input of inputs) {

        if (input.value === "") {
            continue;
        }


        const marks =
            Number(input.value);


        const maxMarks =
            Number(
                input.dataset.maxMarks
            );


        if (
            Number.isNaN(marks) ||
            marks < 0 ||
            marks > maxMarks
        ) {

            showMarksMessage(
                "Please enter valid marks. Marks cannot exceed the maximum.",
                "error"
            );

            input.focus();

            return;
        }


        const studentId =
            Number(
                input.dataset.studentId
            );


        if (input.classList.contains(
            "assignment-mark"
        )) {

            assignmentPayload.push({

                assignment_id:
                    Number(
                        input.dataset.assignmentId
                    ),

                student_id:
                    studentId,

                marks:
                    marks

            });

        }


        if (input.classList.contains(
            "quiz-mark"
        )) {

            quizPayload.push({

                quiz_id:
                    Number(
                        input.dataset.quizId
                    ),

                student_id:
                    studentId,

                marks:
                    marks

            });

        }


        if (input.classList.contains("monthly-test-mark")) {
            monthlyTestPayload.push({
                monthly_test_id: Number(input.dataset.monthlyTestId),
                student_id: studentId,
                marks: marks
            });
        }


        if (input.classList.contains(
            "midterm-mark"
        )) {

            midtermPayload.push({

                student_id:
                    studentId,

                marks:
                    marks

            });

        }


        if (input.classList.contains(
            "final-mark"
        )) {

            finalPayload.push({

                student_id:
                    studentId,

                marks:
                    marks

            });

        }

        if (input.classList.contains("december-test-mark")) {
            decemberTestPayload.push({ student_id: studentId, marks });
        }

        if (input.classList.contains("preboard-mark")) {
            preboardPayload.push({ student_id: studentId, marks });
        }

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

                    credentials: "include",

                    body:
                        JSON.stringify({

                            assignmentMarks:
                                assignmentPayload,

                            quizMarks:
                                quizPayload,

                            monthlyTestMarks:
                                monthlyTestPayload,

                            midtermMarks:
                                midtermPayload,

                            finalMarks:
                                finalPayload,

                            decemberTestMarks:
                                decemberTestPayload,

                            preboardMarks:
                                preboardPayload

                        })

                }
            );


        const data =
            await response.json();


        if (!response.ok || !data.success) {

            showMarksMessage(
                data.message ||
                "Could not save marks.",
                "error"
            );

            return;

        }


        showMarksMessage(
            "Marks saved successfully.",
            "success"
        );


        await loadCourseMarks();


    } catch (error) {

        console.error(
            "Save marks error:",
            error
        );


        showMarksMessage(
            "Could not connect to server.",
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
// MARKS MESSAGE
// =========================

function showMarksMessage(
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
// CANCEL MARKS
// =========================

if (cancelMarksBtn) {

    cancelMarksBtn.addEventListener(
        "click",
        () => {

            if (coursePageAction === "marks") return returnToCourseHub();

            marksSection.classList.add(
                "hidden"
            );


            if (marksMessage) {

                marksMessage.className =
                    "message";

                marksMessage.textContent =
                    "";

            }

        }
    );

}


// =========================
// ATTENDANCE HISTORY
// =========================

async function loadAttendanceHistory() {

    if (!attendanceSummary) {
        return;
    }


    if (
        currentCourse &&
        currentCourse.attendance_enabled === false
    ) {

        return;

    }


    attendanceSummary.innerHTML = `
        <p class="loading">
            Loading attendance history...
        </p>
    `;


    try {

        const response =
            await fetch(
                `/api/attendance/course/${courseId}`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );


        const data =
            await response.json();


        if (!response.ok || !data.success) {

            attendanceSummary.innerHTML = `
                <p class="error">
                    ${escapeHtml(
                        data.message ||
                        "Could not load attendance history."
                    )}
                </p>
            `;

            currentAttendanceRecords = [];

            return;
        }


        currentAttendanceRecords =
            data.attendance || [];

        syncAttendanceExportMonth();

        restoreTodayAttendanceSummary();


        displayAttendanceSummary(
            data.attendance || []
        );


    } catch (error) {

        console.error(
            "Attendance history error:",
            error
        );


        attendanceSummary.innerHTML = `
            <p class="error">
                Could not connect to server.
            </p>
        `;

        currentAttendanceRecords = [];

    }

}


// =========================
// DISPLAY ATTENDANCE SUMMARY
// =========================

function displayAttendanceSummary(
    attendance
) {

    if (!attendanceSummary) {
        return;
    }


    if (attendance.length === 0) {

        attendanceSummary.innerHTML = `
            <p>
                No attendance records found.
            </p>
        `;

        return;

    }


    const studentStats = {};


    attendance.forEach(record => {

        const key =
            record.roll_number;


        if (!studentStats[key]) {

            studentStats[key] = {

                roll_number:
                    record.roll_number,

                name:
                    record.student_name,

                present: 0,

                total: 0,

                records: []

            };

        }


        studentStats[key].total += 1;


        if (record.status === "present" || record.status === "leave") {

            studentStats[key].present += 1;

        }


        studentStats[key].records.push({

            date:
                record.attendance_date,

            status:
                record.status

        });

    });


    const rows =
        Object.values(studentStats)
            .sort(
                (a, b) =>
                    String(a.roll_number)
                        .localeCompare(
                            String(b.roll_number),
                            undefined,
                            {
                                numeric: true
                            }
                        )
            );


    const showStudentName =
        currentCourse &&
        currentCourse.student_name_enabled === true;


    const columnCount =
        showStudentName
            ? 6
            : 5;


    let html = `

        <div class="summary-table-wrapper">

            <table class="summary-table">

                <thead>

                    <tr>

                        <th>
                            Roll Number
                        </th>

    `;


    if (showStudentName) {

        html += `

                        <th>
                            Student
                        </th>

        `;

    }


    html += `

                        <th>
                            Present
                        </th>

                        <th>
                            Total Days
                        </th>

                        <th>
                            Percentage
                        </th>

                        <th></th>

                    </tr>

                </thead>

                <tbody>

    `;


    rows.forEach((student, index) => {

        const percentage =
            student.total > 0
                ? (
                    (student.present / student.total) * 100
                  ).toFixed(1)
                : "0.0";


        const percentClass =
            Number(percentage) >= 75
                ? "good"
                : Number(percentage) >= 50
                    ? "warning"
                    : "low";


        const detailsId =
            `summary-details-${index}`;


        const sortedRecords =
            student.records
                .slice()
                .sort(
                    (a, b) =>
                        b.date.localeCompare(a.date)
                );


        html += `

            <tr
                class="summary-row"
                data-target="${detailsId}"
            >

                <td>
                    ${escapeHtml(
                        String(
                            student.roll_number
                        )
                    )}
                </td>

        `;


        if (showStudentName) {

            html += `

                <td>
                    ${escapeHtml(
                        student.name ||
                        "Not added"
                    )}
                </td>

            `;

        }


        html += `

                <td>
                    ${student.present}
                </td>

                <td>
                    ${student.total}
                </td>

                <td>

                    <span
                        class="attendance-percentage ${percentClass}"
                    >
                        ${percentage}%
                    </span>

                </td>

                <td class="summary-arrow">
                    →
                </td>

            </tr>

            <tr
                id="${detailsId}"
                class="summary-details-row hidden"
            >

                <td colspan="${columnCount}">

                    <table class="student-log-table">

                        <thead>

                            <tr>

                                <th>
                                    Date
                                </th>

                                <th>
                                    Status
                                </th>

                            </tr>

                        </thead>

                        <tbody>

                            ${
                                sortedRecords
                                    .map(entry => `
                                        <tr>

                                            <td>
                                                ${formatDate(entry.date)}
                                            </td>

                                            <td>

                                                <span
                                                    class="attendance-status ${
                                                        entry.status === "present"
                                                            ? "present"
                                                            : "absent"
                                                    }"
                                                >
                                                    ${
                                                        entry.status === "present"
                                                            ? "Present"
                                                            : "Absent"
                                                    }
                                                </span>

                                            </td>

                                        </tr>
                                    `)
                                    .join("")
                            }

                        </tbody>

                    </table>

                </td>

            </tr>

        `;

    });


    html += `

                </tbody>

            </table>

        </div>

    `;


    attendanceSummary.innerHTML =
        html;


    const summaryRows =
        document.querySelectorAll(
            ".summary-row"
        );


    summaryRows.forEach(row => {

        row.addEventListener(
            "click",
            () => {

                const targetId =
                    row.dataset.target;


                const details =
                    document.getElementById(
                        targetId
                    );


                details.classList.toggle(
                    "hidden"
                );


                const arrowCell =
                    row.querySelector(
                        ".summary-arrow"
                    );


                if (arrowCell) {

                    arrowCell.textContent =
                        details.classList.contains(
                            "hidden"
                        )
                            ? "→"
                            : "↓";

                }

            }
        );

    });

}


// =========================
// DOWNLOAD ATTENDANCE EXCEL
// =========================

if (downloadExcelBtn) {

    downloadExcelBtn.addEventListener(
        "click",
        downloadMonthlyAttendanceRegister
    );

}


// =========================
// DOWNLOAD MARKS EXCEL
// =========================

if (downloadMarksExcelBtn) {

    downloadMarksExcelBtn.addEventListener(
        "click",
        downloadMarksExcel
    );

}


function downloadMarksExcel() {

    if (typeof XLSX === "undefined") {

        alert(
            "Excel export library failed to load. Check your internet connection."
        );

        return;

    }

    if (!students.length) {

        alert(
            "No students found for this course."
        );

        return;

    }

    const isIntermediate = currentCourse?.class_type === "intermediate";

    if (
        !isIntermediate &&
        !courseAssignments.length &&
        !courseQuizzes.length &&
        !courseMonthlyTests.length &&
        !(currentCourse && currentCourse.midterm_enabled) &&
        !(currentCourse && currentCourse.final_enabled)
    ) {

        alert(
            "No marks have been set up for this course yet."
        );

        return;

    }

    const showStudentName =
        currentCourse &&
        currentCourse.student_name_enabled === true;

    const showMidterm =
        currentCourse &&
        currentCourse.midterm_enabled === true;

    const showFinal =
        currentCourse &&
        currentCourse.final_enabled === true;

    // =========================
    // HEADER ROW
    // =========================

    const header = ["Roll Number"];

    if (showStudentName) {

        header.push("Student Name");

    }

    courseAssignments.forEach(assignment => {

        header.push(
            `${assignment.name || "Assignment"} (/${assignment.max_marks})`
        );

    });

    courseQuizzes.forEach(quiz => {

        header.push(
            `${quiz.name || "Quiz"} (/${quiz.max_marks})`
        );

    });

    courseMonthlyTests.forEach(test => {
        header.push(`${test.name || "Monthly Test"} (/${test.max_marks})`);
    });

    if (isIntermediate) {
        header.push("Monthly Total", "Monthly %", "December Test (/100)", "Preboard (/100)");
    }

    if (showMidterm) {

        header.push("Midterm");

    }

    if (showFinal) {

        header.push("Final Exam");

    }

    if (!isIntermediate) header.push("Total");

    const rows = [header];

    // =========================
    // DATA ROWS
    // =========================

    students
        .slice()
        .sort((a, b) =>
            String(a.roll_number).localeCompare(
                String(b.roll_number),
                undefined,
                { numeric: true }
            )
        )
        .forEach(student => {

            const row = [student.roll_number];

            if (showStudentName) {

                row.push(
                    student.name || "Not added"
                );

            }

            let total = 0;
            let monthlyTotal = 0;

            courseAssignments.forEach(assignment => {

                const marks =
                    findAssignmentMark(
                        assignment.id,
                        student.id
                    );

                row.push(
                    marks === null ? "" : marks
                );

                if (marks !== null) {

                    total += Number(marks);

                }

            });

            courseQuizzes.forEach(quiz => {

                const marks =
                    findQuizMark(
                        quiz.id,
                        student.id
                    );

                row.push(
                    marks === null ? "" : marks
                );

                if (marks !== null) {

                    total += Number(marks);

                }

            });

            courseMonthlyTests.forEach(test => {
                const marks = findMonthlyTestMark(test.id, student.id);
                row.push(marks === null ? "" : marks);
                if (marks !== null) {
                    total += Number(marks);
                    monthlyTotal += Number(marks);
                }
            });

            if (isIntermediate) {
                const monthlyMaximum = courseMonthlyTests.reduce(
                    (sum, test) => sum + Number(test.max_marks || 0),
                    0
                );
                row.push(
                    formatTotal(monthlyTotal),
                    monthlyMaximum > 0 ? Number(((monthlyTotal / monthlyMaximum) * 100).toFixed(2)) : "",
                    student.december_test_marks ?? "",
                    student.preboard_marks ?? ""
                );
            }

            if (showMidterm) {

                const marks =
                    student.midterm_marks;

                row.push(
                    marks === null || marks === undefined
                        ? ""
                        : marks
                );

                if (marks !== null && marks !== undefined) {

                    total += Number(marks);

                }

            }

            if (showFinal) {

                const marks =
                    student.final_marks;

                row.push(
                    marks === null || marks === undefined
                        ? ""
                        : marks
                );

                if (marks !== null && marks !== undefined) {

                    total += Number(marks);

                }

            }

            if (!isIntermediate) row.push(formatTotal(total));

            rows.push(row);

        });

    // =========================
    // BUILD WORKBOOK
    // =========================

    const worksheet =
        XLSX.utils.aoa_to_sheet(rows);

    worksheet["!cols"] =
        header.map(() => ({ wch: 16 }));

    const workbook =
        XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Marks"
    );

    const courseName =
        (currentCourse && currentCourse.name) ||
        "Course";

    XLSX.writeFile(
        workbook,
        `${courseName.replace(/[^a-z0-9]/gi, "_")}_Marks.xlsx`
    );

}


function downloadAttendanceExcel() {

    if (typeof XLSX === "undefined") {

        alert(
            "Excel export library failed to load. Check your internet connection."
        );

        return;

    }


    if (!students.length) {

        alert(
            "No students found for this course."
        );

        return;

    }


    if (!currentAttendanceRecords.length) {

        alert(
            "No attendance records to export yet."
        );

        return;

    }


    // =========================
    // UNIQUE SORTED DATES
    // =========================

    const dates =
        Array.from(
            new Set(
                currentAttendanceRecords.map(
                    record => record.attendance_date
                )
            )
        ).sort();


    // =========================
    // studentId -> { date: status }
    // =========================

    const byStudent = {};


    currentAttendanceRecords.forEach(record => {

        if (!byStudent[record.student_id]) {

            byStudent[record.student_id] = {};

        }


        byStudent[record.student_id][record.attendance_date] =
            record.status;

    });


    const showStudentName =
        currentCourse &&
        currentCourse.student_name_enabled === true;


    // =========================
    // HEADER ROW
    // =========================

    const header = ["Roll Number"];


    if (showStudentName) {

        header.push("Student Name");

    }


    dates.forEach(date => {

        header.push(
            formatDate(date)
        );

    });


    header.push(
        "Total Present",
        "Total Absent",
        "Percentage"
    );


    const rows = [header];


    // =========================
    // DATA ROWS
    // =========================

    students
        .slice()
        .sort((a, b) =>
            String(a.roll_number).localeCompare(
                String(b.roll_number),
                undefined,
                { numeric: true }
            )
        )
        .forEach(student => {

            const row = [student.roll_number];


            if (showStudentName) {

                row.push(
                    student.name || "Not added"
                );

            }


            let present = 0;

            let absent = 0;


            dates.forEach(date => {

                const status =
                    byStudent[student.id]
                        ? byStudent[student.id][date]
                        : undefined;


                if (status === "present") {

                    row.push("P");

                    present++;

                } else if (status === "absent") {
                } else if (status === "leave") {

                    row.push("L");
                    present++;


                    row.push("A");

                    absent++;

                } else {

                    row.push("-");

                }

            });


            const total =
                present + absent;

            const percentage =
                total > 0
                    ? (
                        (present / total) * 100
                      ).toFixed(1) + "%"
                    : "0.0%";


            row.push(
                present,
                absent,
                percentage
            );


            rows.push(row);

        });


    // =========================
    // BUILD WORKBOOK
    // =========================

    const worksheet =
        XLSX.utils.aoa_to_sheet(rows);


    worksheet["!cols"] =
        header.map(() => ({ wch: 14 }));


    const workbook =
        XLSX.utils.book_new();


    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Attendance"
    );


    const courseName =
        (currentCourse && currentCourse.name) ||
        "Course";


    XLSX.writeFile(
        workbook,
        `${courseName.replace(/[^a-z0-9]/gi, "_")}_Attendance.xlsx`
    );

}


// =========================
// FORMAT DATE
// =========================

function formatDate(dateString) {

    const date =
        new Date(
            `${dateString}T00:00:00`
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return dateString;

    }


    return date.toLocaleDateString(
        undefined,
        {
            year: "numeric",
            month: "long",
            day: "numeric"
        }
    );

}


// =========================
// TODAY
// =========================

function getTodayDate() {

    const now =
        new Date();


    const year =
        now.getFullYear();


    const month =
        String(
            now.getMonth() + 1
        ).padStart(2, "0");


    const day =
        String(
            now.getDate()
        ).padStart(2, "0");


    return `${year}-${month}-${day}`;

}

function formatDateForDisplay(dateValue) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || ""));
    if (!match) return String(dateValue || "");
    return `${match[3]}-${match[2]}-${match[1]}`;
}


// =========================
// HTML ESCAPE
// =========================

function escapeHtml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}

function findMonthlyTestMark(testId, studentId) {
    const record = monthlyTestMarks.find(item =>
        Number(item.monthly_test_id) === Number(testId) &&
        Number(item.student_id) === Number(studentId)
    );
    return record ? record.marks : null;
}

function syncAttendanceExportMonth() {
    if (!attendanceExportMonth) return;
    const months = [...new Set(currentAttendanceRecords
        .map(record => attendanceDateKey(record.attendance_date).slice(0, 7))
        .filter(month => /^\d{4}-\d{2}$/.test(month)))]
        .sort();
    if (!attendanceExportMonth.value) {
        const today = new Date();
        attendanceExportMonth.value = months.at(-1) || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    }
}

function attendanceRegisterCellValue(value) {
    if (!value || typeof value !== "object" || Array.isArray(value) || value instanceof Date) {
        return value ?? "";
    }
    if (value.f) return { formula: value.f, result: value.v };
    return value.v ?? "";
}

function applyAttendanceRegisterStyles(worksheet, spec) {
    const border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } }
    };
    const baseFont = { name: "Arial Narrow", size: 8, color: { argb: "FF000000" } };
    const centered = { horizontal: "center", vertical: "middle", wrapText: true };

    for (let row = 5; row <= spec.ranges.dataEnd + 1; row += 1) {
        for (let col = 1; col <= spec.ranges.lastColumn + 1; col += 1) {
            const cell = worksheet.getCell(row, col);
            cell.font = row <= 6 ? { name: "Arial Narrow", size: 8, bold: true, color: { argb: "FF000000" } } : baseFont;
            cell.alignment = centered;
            cell.border = border;
        }
    }

    for (let row = spec.ranges.dataStart + 1; row <= spec.ranges.dataEnd + 1; row += 1) {
        worksheet.getRow(row).height = 21;
        const name = spec.studentNames[row - spec.ranges.dataStart - 1];
        if (name) worksheet.getCell(row, 1).note = `Student: ${name}`;
    }

    const [year, month] = spec.selectedMonth.split("-").map(Number);
    for (let day = 1; day <= 31; day += 1) {
        const column = spec.ranges.dailyStart + day;
        const isInvalid = day > spec.daysInMonth;
        const isSunday = !isInvalid && new Date(year, month - 1, day).getDay() === 0;
        if (!isInvalid && !isSunday) continue;
        for (let row = 6; row <= spec.ranges.dataEnd + 1; row += 1) {
            const cell = worksheet.getCell(row, column);
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: isInvalid ? "FFE7E7E7" : "FFF2F2F2" }
            };
            cell.font = {
                name: "Arial Narrow",
                size: 8,
                bold: row === 6,
                color: { argb: isInvalid ? "FF777777" : "FF000000" }
            };
        }
    }

    for (let row = 1; row <= 4; row += 1) {
        for (let col = 1; col <= spec.ranges.lastColumn + 1; col += 1) {
    for (let row = spec.ranges.dataStart + 1; row <= spec.ranges.dataEnd + 1; row += 1) {
        for (let column = spec.ranges.dailyStart + 1; column <= spec.ranges.dailyEnd + 1; column += 1) {
            const cell = worksheet.getCell(row, column);
            const color = AttendanceRegister.attendanceStatusColor(cell.value);
            if (!color) continue;
            cell.font = {
                name: "Arial Narrow",
                size: 9,
                bold: true,
                color: { argb: color }
            };
        }
    }

            worksheet.getCell(row, col).font = { name: "Arial Narrow", size: row === 1 ? 10 : 9, bold: row === 1 };
            worksheet.getCell(row, col).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
        }
    }
    worksheet.getCell(1, 40).font = { name: "Arial Narrow", size: 11, bold: true };
    worksheet.getCell(1, 40).alignment = centered;
    for (let row = 2; row <= 4; row += 1) {
        for (let col = 40; col <= 45; col += 1) worksheet.getCell(row, col).alignment = centered;
    }
    worksheet.getCell(spec.ranges.signatureRow + 1, 39).font = { name: "Arial Narrow", size: 10 };
    worksheet.getCell(spec.ranges.signatureRow + 1, 39).alignment = { horizontal: "right", vertical: "middle" };
}

async function loadAttendanceRegisterLogo() {
    try {
        const response = await fetch("/assets/department-logo.png");
        if (!response.ok) return null;
        const blob = await response.blob();
        return await new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.warn("Attendance register logo could not be loaded:", error);
        return null;
    }
}

async function downloadMonthlyAttendanceRegister() {
    if (typeof ExcelJS === "undefined") {
        alert("The printable Excel export failed to load. Refresh the page and try again.");
        return;
    }
    if (typeof AttendanceRegister === "undefined") {
        alert("Attendance register export failed to load. Refresh the page and try again.");
        return;
    }
    if (!students.length) {
        alert("No students found for this course.");
        return;
    }
    if (!currentAttendanceRecords.length) {
        alert("No attendance records to export yet.");
        return;
    }

    syncAttendanceExportMonth();
    const originalButtonText = downloadExcelBtn?.textContent;
    if (downloadExcelBtn) {
        downloadExcelBtn.disabled = true;
        downloadExcelBtn.textContent = "Preparing Excel…";
    }

    try {
        const spec = AttendanceRegister.buildMonthlyAttendanceRegister({
            students,
            records: currentAttendanceRecords,
            course: currentCourse,
            teacherName: teacherName?.textContent || "",
            selectedMonth: attendanceExportMonth?.value
        });
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "Department of Mathematics Attendance Portal";
        workbook.created = new Date();
        workbook.calcProperties.fullCalcOnLoad = true;
        workbook.calcProperties.forceFullCalc = true;

        const worksheet = workbook.addWorksheet("Monthly Register", {
            views: [{ state: "frozen", xSplit: 1, ySplit: 6, topLeftCell: "B7", showGridLines: false }],
            pageSetup: {
                paperSize: 9,
                orientation: "landscape",
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 1,
                horizontalCentered: true,
                verticalCentered: false,
                printTitlesRow: "1:6",
                margins: { left: 0.15, right: 0.15, top: 0.2, bottom: 0.2, header: 0.05, footer: 0.05 }
            }
        });
        worksheet.pageSetup.printArea = `A1:${AttendanceRegister.columnName(spec.ranges.lastColumn)}${spec.ranges.signatureRow + 1}`;

        spec.rows.forEach(row => {
            const rowValues = Array.from(
                { length: spec.ranges.lastColumn + 1 },
                (_, index) => attendanceRegisterCellValue(row[index])
            );
            const excelRow = worksheet.addRow(rowValues);
            row.forEach((value, index) => {
                if (value && typeof value === "object" && value.z) excelRow.getCell(index + 1).numFmt = value.z;
            });
        });
        spec.merges.forEach(merge => worksheet.mergeCells(
            merge.s.r + 1,
            merge.s.c + 1,
            merge.e.r + 1,
            merge.e.c + 1
        ));
        spec.columns.forEach((column, index) => {
            worksheet.getColumn(index + 1).width = column.wch;
        });
        spec.rowHeights.forEach((row, index) => {
            worksheet.getRow(index + 1).height = row.hpt;
        });
        applyAttendanceRegisterStyles(worksheet, spec);

        const logoData = await loadAttendanceRegisterLogo();
        if (logoData) {
            const logoId = workbook.addImage({ base64: logoData, extension: "png" });
            worksheet.addImage(logoId, {
                tl: { col: 26.2, row: 0.05 },
                ext: { width: 64, height: 64 },
                editAs: "oneCell"
            });
        }

        const rawWorksheet = workbook.addWorksheet("_Attendance Data", {
            state: "veryHidden",
            views: [{ showGridLines: false }]
        });
        spec.rawRows.forEach(row => rawWorksheet.addRow(row));
        [11, 13, 24, 13, 11, 10].forEach((width, index) => {
            rawWorksheet.getColumn(index + 1).width = width;
        });
        rawWorksheet.autoFilter = {
            from: "A1",
            to: `F${Math.max(1, spec.rawRows.length)}`
        };
        rawWorksheet.getRow(1).font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        rawWorksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB80F18" } };
        rawWorksheet.getColumn(4).numFmt = "yyyy-mm-dd";

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = spec.filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
        console.error("Attendance register export error:", error);
        alert(error.message || "Could not create the attendance register.");
    } finally {
        if (downloadExcelBtn) {
            downloadExcelBtn.disabled = false;
            downloadExcelBtn.textContent = originalButtonText;
        }
    }
}

// =========================
// CLASS SETTINGS
// =========================

function setPanelMessage(elementId, text, type) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.textContent = text;
    element.className = text ? `message ${type}` : "message";
}

function settingsRollRowHtml(student = {}) {
    const studentId = Number(student.id) || "";
    const isExisting = Boolean(studentId);
    const showName = currentCourse?.student_name_enabled === true;
    return `<div class="settings-roll-row" data-student-id="${studentId}">
        <label>Roll Number
            <input class="settings-roll-number" type="number" min="0" max="2147483647" step="1" value="${escapeHtml(student.roll_number ?? "")}" placeholder="e.g. 101">
        </label>
        <label class="roll-name-field" ${showName ? "" : "hidden"}>Student Name
            <input class="settings-roll-name" type="text" maxlength="150" value="${escapeHtml(student.name || "")}" placeholder="Student name">
        </label>
        <button class="secondary-btn remove-settings-student" type="button">${isExisting ? "Remove Student" : "Remove"}</button>
    </div>`;
}

let settingsRemovedStudentIds = [];

function renderSettingsRollEditor() {
    const rows = document.getElementById("settingsRollRows");
    if (!rows) return;
    rows.innerHTML = students
        .slice()
        .sort((first, second) => Number(first.roll_number) - Number(second.roll_number))
        .map(settingsRollRowHtml)
        .join("");
    settingsRemovedStudentIds = [];
}

function readSettingsRollNumbers() {
    const rows = [...document.querySelectorAll("#settingsRollRows .settings-roll-row")];
    const entries = rows.map(row => ({
        student_id: row.dataset.studentId ? Number(row.dataset.studentId) : null,
        roll_number: Number(row.querySelector(".settings-roll-number").value),
        name: row.querySelector(".settings-roll-name").value.trim()
    }));
    if (!entries.length || entries.length > 500 || entries.some(entry =>
        !Number.isSafeInteger(entry.roll_number) || entry.roll_number < 0 || entry.roll_number > 2147483647
    )) {
        throw new Error("Enter between 1 and 500 valid whole roll numbers");
    }
    if (new Set(entries.map(entry => entry.roll_number)).size !== entries.length) {
        throw new Error("Each roll number must be unique");
    }
    if (currentCourse?.student_name_enabled === true && entries.some(entry => entry.student_id === null && !entry.name)) {
        throw new Error("Enter a student name for each new roll number");
    }
    return entries;
}

const COURSE_MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function settingsMonthlyTestRow(test = {}) {
    const month = Number(test.month_number || 1);
    return `<div class="settings-monthly-test-row">
        <label>Month<select class="settings-monthly-month">${COURSE_MONTH_NAMES.slice(0, 11).map((name, index) => `<option value="${index + 1}" ${month === index + 1 ? "selected" : ""}>${name}</option>`).join("")}</select></label>
        <label>Maximum Marks<input class="settings-monthly-max" type="number" min="0.01" step="0.01" value="${escapeHtml(test.max_marks || 25)}"></label>
        <button class="secondary-btn settings-remove-monthly" type="button">Remove</button>
    </div>`;
}

function renderSettingsMonthlyTests(tests = []) {
    document.getElementById("settingsMonthlyTestRows").innerHTML = (tests.length ? tests : [{ month_number: Math.min(new Date().getMonth() + 1, 11), max_marks: 25 }])
        .map(settingsMonthlyTestRow).join("");
}

function readSettingsMonthlyTests() {
    if (!document.getElementById("settingsMonthlyTestsEnabled").checked) return [];
    return [...document.querySelectorAll(".settings-monthly-test-row")].map(row => ({
        month: Number(row.querySelector(".settings-monthly-month").value),
        max_marks: Number(row.querySelector(".settings-monthly-max").value)
    }));
}

function syncSettingsInputs() {
    const intermediate = document.getElementById("settingsClassType").value === "intermediate";
    if (intermediate) {
        ["settingsAssignmentsEnabled", "settingsQuizzesEnabled", "settingsMidtermEnabled", "settingsFinalEnabled"]
            .forEach(id => { document.getElementById(id).checked = false; });
    }
    const pairs = [
        ["settingsAssignmentsEnabled", ["settingsAssignmentCount", "settingsAssignmentMax"]],
        ["settingsQuizzesEnabled", ["settingsQuizCount", "settingsQuizMax"]],
        ["settingsMidtermEnabled", ["settingsMidtermMax"]],
        ["settingsFinalEnabled", ["settingsFinalMax"]]
    ];
    pairs.forEach(([toggleId, inputIds]) => {
        const enabled = document.getElementById(toggleId).checked;
        inputIds.forEach(id => { document.getElementById(id).disabled = !enabled; });
    });
    document.getElementById("settingsIntermediateYearLabel").hidden = !intermediate;
    document.getElementById("settingsCourseCodeLabel").hidden = intermediate;
    document.getElementById("settingsProgramLabel").hidden = intermediate;
    document.getElementById("settingsSemesterLabel").hidden = intermediate;
    document.getElementById("settingsMonthlyTestsToggle").hidden = !intermediate;
    document.getElementById("settingsIntermediateFixedAssessments").hidden = !intermediate;
    [
        "settingsAssignmentsToggle", "settingsAssignmentCountLabel", "settingsAssignmentMaxLabel",
        "settingsQuizzesToggle", "settingsQuizCountLabel", "settingsQuizMaxLabel",
        "settingsMidtermToggle", "settingsMidtermMaxLabel", "settingsFinalToggle", "settingsFinalMaxLabel"
    ].forEach(id => { document.getElementById(id).hidden = intermediate; });
    if (!intermediate) document.getElementById("settingsMonthlyTestsEnabled").checked = false;
    document.getElementById("settingsMonthlyTestsPanel").hidden = !intermediate || !document.getElementById("settingsMonthlyTestsEnabled").checked;
}

async function openClassSettings() {
    if (!currentCourse) {
        alert("Please wait for the class to finish loading.");
        return;
    }
    const originalEditLabel = editClassBtn.textContent;
    editClassBtn.disabled = true;
    editClassBtn.textContent = "Loading Settings…";
    classSettingsSection.classList.add("hidden");
    studentImportSection.classList.add("hidden");
    setPanelMessage("classSettingsMessage", "", "");
    setPanelMessage("settingsRollMessage", "", "");
    renderSettingsRollEditor();
    document.getElementById("settingsCourseName").value = currentCourse.name || "";
    document.getElementById("settingsCourseCode").value = currentCourse.course_code || "";
    document.getElementById("settingsClassType").value = currentCourse.class_type || "bachelors";
    document.getElementById("settingsIntermediateYear").value = currentCourse.intermediate_year || "1st_year";
    document.getElementById("settingsClassShift").value = currentCourse.class_shift || "morning";
    document.getElementById("settingsProgram").value = currentCourse.program || "";
    document.getElementById("settingsSemester").value = currentCourse.semester || "";
    document.getElementById("settingsSection").value = currentCourse.section || "";
    document.getElementById("settingsResultsEnabled").checked = currentCourse.results_enabled === true;
    document.getElementById("settingsResultCode").value = currentCourse.result_code || "";
    document.getElementById("settingsAssignmentsEnabled").checked = currentCourse.assignments_enabled === true;
    document.getElementById("settingsQuizzesEnabled").checked = currentCourse.quizzes_enabled === true;
    document.getElementById("settingsMidtermEnabled").checked = currentCourse.midterm_enabled === true;
    document.getElementById("settingsFinalEnabled").checked = currentCourse.final_enabled === true;
    document.getElementById("settingsMonthlyTestsEnabled").checked = currentCourse.monthly_tests_enabled === true;
    document.getElementById("settingsAssignmentCount").value = currentCourse.assignment_count || 1;
    document.getElementById("settingsQuizCount").value = currentCourse.quiz_count || 1;
    document.getElementById("settingsMidtermMax").value = currentCourse.midterm_max_marks || 30;
    document.getElementById("settingsFinalMax").value = currentCourse.final_max_marks || 50;

    let assessmentLoadError = "";
    try {
        const [assignmentResponse, quizResponse, marksResponse] = await Promise.all([
            fetch(`/api/courses/${courseId}/assignments`, { credentials: "include" }),
            fetch(`/api/courses/${courseId}/quizzes`, { credentials: "include" }),
            fetch(`/api/courses/${courseId}/marks`, { credentials: "include" })
        ]);
        const [assignmentData, quizData, marksData] = await Promise.all([assignmentResponse.json(), quizResponse.json(), marksResponse.json()]);
        document.getElementById("settingsAssignmentMax").value = assignmentData.assignments?.[0]?.max_marks || 10;
        document.getElementById("settingsQuizMax").value = quizData.quizzes?.[0]?.max_marks || 10;
        renderSettingsMonthlyTests(marksData.monthlyTests || []);
    } catch (error) {
        assessmentLoadError = "Could not load all assessment settings.";
    } finally {
        syncSettingsInputs();
        classSettingsSection.classList.remove("hidden");
        if (assessmentLoadError) {
            setPanelMessage("classSettingsMessage", assessmentLoadError, "error");
        }
        classSettingsSection.scrollIntoView({ behavior: "smooth" });
        editClassBtn.disabled = false;
        editClassBtn.textContent = originalEditLabel;
    }
}

if (editClassBtn) editClassBtn.addEventListener("click", () => {
    if (coursePageAction === "edit") openClassSettings();
    else navigateFromCourseHub(coursePageUrl("edit-class"));
});
document.getElementById("cancelClassSettingsBtn")?.addEventListener("click", () => {
    if (coursePageAction === "edit") returnToCourseHub();
    else classSettingsSection.classList.add("hidden");
});
["settingsAssignmentsEnabled", "settingsQuizzesEnabled", "settingsMidtermEnabled", "settingsFinalEnabled"]
    .forEach(id => document.getElementById(id)?.addEventListener("change", syncSettingsInputs));
document.getElementById("settingsClassType")?.addEventListener("change", syncSettingsInputs);
document.getElementById("settingsMonthlyTestsEnabled")?.addEventListener("change", syncSettingsInputs);
document.getElementById("settingsAddMonthlyTestBtn")?.addEventListener("click", () => {
    const rows = document.getElementById("settingsMonthlyTestRows");
    const used = new Set([...rows.querySelectorAll(".settings-monthly-month")].map(select => Number(select.value)));
    const next = Array.from({length:11}, (_,index) => index + 1).find(month => !used.has(month));
    if (next) rows.insertAdjacentHTML("beforeend", settingsMonthlyTestRow({ month_number: next, max_marks: 25 }));
});
document.getElementById("settingsMonthlyTestRows")?.addEventListener("click", event => {
    const button = event.target.closest(".settings-remove-monthly");
    if (button) button.closest(".settings-monthly-test-row").remove();
});

document.getElementById("addSettingsRollBtn")?.addEventListener("click", () => {
    const rows = document.getElementById("settingsRollRows");
    rows.insertAdjacentHTML("beforeend", settingsRollRowHtml());
    rows.lastElementChild?.querySelector(".settings-roll-number")?.focus();
});

document.getElementById("settingsRollRows")?.addEventListener("click", event => {
    const removeButton = event.target.closest(".remove-settings-student");
    if (!removeButton) return;
    const row = removeButton.closest(".settings-roll-row");
    const studentId = Number(row.dataset.studentId);
    if (studentId) {
        const rollNumber = row.querySelector(".settings-roll-number")?.value || "";
        if (!window.confirm(`Remove student roll number ${rollNumber}? They will disappear from the class after saving, but can be restored later with attendance and marks intact.`)) return;
        settingsRemovedStudentIds.push(studentId);
    }
    row.remove();
    setPanelMessage("settingsRollMessage", studentId ? "Student marked for removal. Press Save Roll Numbers to confirm; they can be restored later." : "", studentId ? "error" : "");
});

async function loadRemovedStudents() {
    const list = document.getElementById("removedStudentsList");
    try {
        const response = await fetch(`/api/courses/${courseId}/students/deleted`, { credentials: "include", cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || "Could not load removed students");
        list.innerHTML = data.students.length ? data.students.map(student => `
            <div class="removed-student-row">
                <div><strong>Roll ${escapeHtml(student.roll_number)}</strong><span>${escapeHtml(student.name || "No name")}</span></div>
                <button class="secondary-btn restore-student-btn" type="button" data-student-id="${Number(student.id)}">Restore</button>
            </div>`).join("") : "<p>No removed students.</p>";
    } catch (error) {
        list.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
    }
}

document.getElementById("showRemovedStudentsBtn")?.addEventListener("click", async () => {
    const panel = document.getElementById("removedStudentsPanel");
    panel.classList.toggle("hidden");
    if (!panel.classList.contains("hidden")) await loadRemovedStudents();
});

document.getElementById("removedStudentsList")?.addEventListener("click", async event => {
    const button = event.target.closest(".restore-student-btn");
    if (!button) return;
    button.disabled = true;
    try {
        const response = await fetch(`/api/courses/${courseId}/students/${button.dataset.studentId}/restore`, {
            method: "POST", credentials: "include"
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || "Could not restore student");
        setPanelMessage("settingsRollMessage", data.message, "success");
        await loadCourse();
        renderSettingsRollEditor();
        await loadRemovedStudents();
    } catch (error) {
        setPanelMessage("settingsRollMessage", error.message, "error");
        button.disabled = false;
    }
});

document.getElementById("saveSettingsRollsBtn")?.addEventListener("click", async () => {
    const button = document.getElementById("saveSettingsRollsBtn");
    let editedStudents;
    try {
        editedStudents = readSettingsRollNumbers();
    } catch (error) {
        setPanelMessage("settingsRollMessage", error.message, "error");
        return;
    }

    button.disabled = true;
    button.textContent = "Saving…";
    setPanelMessage("settingsRollMessage", "", "");
    try {
        const response = await fetch(`/api/courses/${courseId}/students/roll-numbers`, {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ students: editedStudents, removed_student_ids: settingsRemovedStudentIds })
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || "Could not update roll numbers");
        currentCourse = data.course;
        students = data.students || [];
        displayCourse(currentCourse);
        displayStudents(students);
        renderSettingsRollEditor();
        setPanelMessage("settingsRollMessage", data.message, "success");
    } catch (error) {
        setPanelMessage("settingsRollMessage", error.message, "error");
    } finally {
        button.disabled = false;
        button.textContent = "Save Roll Numbers";
    }
});

document.getElementById("saveClassSettingsBtn")?.addEventListener("click", async () => {
    const button = document.getElementById("saveClassSettingsBtn");
    const value = id => document.getElementById(id).value;
    const checked = id => document.getElementById(id).checked;
    const payload = {
        name: value("settingsCourseName"),
        course_code: value("settingsClassType") === "intermediate" ? "" : value("settingsCourseCode").trim(),
        class_type: value("settingsClassType"),
        class_shift: value("settingsClassShift"),
        intermediate_year: value("settingsIntermediateYear"),
        program: value("settingsProgram").trim(),
        semester: value("settingsSemester").trim(),
        section: value("settingsSection"),
        results_enabled: checked("settingsResultsEnabled"),
        result_code: value("settingsResultCode").trim().toLowerCase(),
        assignments_enabled: checked("settingsAssignmentsEnabled"),
        assignment_count: Number(value("settingsAssignmentCount")),
        assignment_max_marks: Number(value("settingsAssignmentMax")),
        quizzes_enabled: checked("settingsQuizzesEnabled"),
        quiz_count: Number(value("settingsQuizCount")),
        quiz_max_marks: Number(value("settingsQuizMax")),
        monthly_tests_enabled: checked("settingsMonthlyTestsEnabled"),
        monthly_tests: readSettingsMonthlyTests(),
        midterm_enabled: checked("settingsMidtermEnabled"),
        midterm_max_marks: Number(value("settingsMidtermMax")),
        final_enabled: checked("settingsFinalEnabled"),
        final_max_marks: Number(value("settingsFinalMax"))
    };
    if (payload.monthly_tests_enabled && (
        !payload.monthly_tests.length ||
        payload.monthly_tests.some(test => !Number.isInteger(test.month) || test.month < 1 || test.month > 11 || !Number.isFinite(test.max_marks) || test.max_marks <= 0) ||
        new Set(payload.monthly_tests.map(test => test.month)).size !== payload.monthly_tests.length
    )) {
        setPanelMessage("classSettingsMessage", "Monthly tests need unique months and positive maximum marks.", "error");
        return;
    }
    button.disabled = true;
    try {
        const response = await fetch(`/api/courses/${courseId}/settings`, {
            method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || "Could not update class settings");
        currentCourse = data.course;
        setPanelMessage("classSettingsMessage", data.message, "success");
        await loadCourse();

        // Always rebuild the marks table after the assessment structure changes.
        // This also prepares the new columns while the Marks section is hidden.
        await loadCourseMarks();
    } catch (error) {
        setPanelMessage("classSettingsMessage", error.message, "error");
    } finally {
        button.disabled = false;
    }
});

// =========================
// STUDENT IMPORT
// =========================

if (importStudentsBtn) importStudentsBtn.addEventListener("click", () => {
    if (coursePageAction !== "import") {
        window.location.href = coursePageUrl("import-students");
        return;
    }
    studentImportSection.classList.remove("hidden");
    classSettingsSection.classList.add("hidden");
    studentImportSection.scrollIntoView({ behavior: "smooth" });
});
document.getElementById("cancelStudentImportBtn")?.addEventListener("click", () => {
    if (coursePageAction === "import") returnToCourseHub();
    else studentImportSection.classList.add("hidden");
});

document.getElementById("studentImportFile")?.addEventListener("change", async event => {
    const preview = document.getElementById("studentImportPreview");
    const saveButton = document.getElementById("saveStudentImportBtn");
    pendingStudentImport = [];
    saveButton.disabled = true;
    setPanelMessage("studentImportMessage", "", "");
    const file = event.target.files[0];
    if (!file) return;
    if (typeof XLSX === "undefined") {
        setPanelMessage("studentImportMessage", "Excel reader failed to load. Check your internet connection.", "error");
        return;
    }
    try {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const table = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        if (table.length < 2) throw new Error("The file must contain a header row and at least one student");
        const headers = table[0].map(header => String(header).toLowerCase().replace(/[^a-z0-9]/g, ""));
        const rollIndex = headers.findIndex(header => ["rollnumber", "rollno", "roll", "studentid"].includes(header));
        const nameIndex = headers.findIndex(header => ["name", "studentname", "fullname"].includes(header));
        if (rollIndex < 0 || nameIndex < 0) throw new Error('Use columns named "Roll Number" and "Name"');
        pendingStudentImport = table.slice(1)
            .map(row => ({ roll_number: String(row[rollIndex] ?? "").trim(), name: String(row[nameIndex] ?? "").trim() }))
            .filter(row => row.roll_number || row.name);
        if (!pendingStudentImport.length) throw new Error("No student rows were found");
        const seen = new Set();
        const validRows = [];
        const invalidRollRows = [];
        const duplicateRows = [];
        const missingNameRows = [];
        pendingStudentImport.forEach((row, index) => {
            const roll = Number(row.roll_number);
            const excelRow = index + 2;
            if (!Number.isInteger(roll) || roll < 0) invalidRollRows.push(excelRow);
            else if (seen.has(roll)) duplicateRows.push(excelRow);
            else if (!row.name) missingNameRows.push(excelRow);
            else { seen.add(roll); validRows.push(row); }
        });
        const issueCount = invalidRollRows.length + duplicateRows.length + missingNameRows.length;
        preview.innerHTML = `
            <div class="import-validation-summary ${issueCount ? "has-errors" : "is-valid"}">
                <strong>${validRows.length} valid students</strong><span>${pendingStudentImport.length} data rows found</span>
                ${invalidRollRows.length ? `<span>Invalid roll number rows: ${invalidRollRows.join(", ")}</span>` : ""}
                ${duplicateRows.length ? `<span>Duplicate roll number rows: ${duplicateRows.join(", ")}</span>` : ""}
                ${missingNameRows.length ? `<span>Missing name rows: ${missingNameRows.join(", ")}</span>` : ""}
                ${issueCount ? "<b>Fix the listed rows before importing.</b>" : "<b>File is ready to import.</b>"}
            </div>
            <div class="summary-table-wrapper"><table class="summary-table"><thead><tr><th>Roll Number</th><th>Name</th></tr></thead><tbody>${pendingStudentImport.slice(0, 8).map(row => `<tr><td>${escapeHtml(row.roll_number)}</td><td>${escapeHtml(row.name)}</td></tr>`).join("")}</tbody></table></div>
            ${pendingStudentImport.length > 8 ? `<p>…and ${pendingStudentImport.length - 8} more rows</p>` : ""}`;
        saveButton.disabled = issueCount > 0;
    } catch (error) {
        preview.innerHTML = "<p>Could not preview this file.</p>";
        setPanelMessage("studentImportMessage", error.message, "error");
    }
});

document.getElementById("saveStudentImportBtn")?.addEventListener("click", async () => {
    const button = document.getElementById("saveStudentImportBtn");
    button.disabled = true;
    try {
        const response = await fetch(`/api/courses/${courseId}/students/import`, {
            method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ students: pendingStudentImport })
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || "Student import failed");
        setPanelMessage("studentImportMessage", data.message, "success");
        await loadCourse();
    } catch (error) {
        setPanelMessage("studentImportMessage", error.message, "error");
    } finally {
        button.disabled = pendingStudentImport.length === 0;
    }
});

// =========================
// ATTENDANCE CORRECTIONS
// =========================

function attendanceDateKey(value) { return String(value || "").slice(0, 10); }

function renderAttendanceEditor() {
    const date = document.getElementById("attendanceEditDate").value;
    const records = currentAttendanceRecords.filter(record => attendanceDateKey(record.attendance_date) === date);
    document.getElementById("attendanceEditList").innerHTML = records.map(record => `
        <div class="attendance-row">
            <div class="roll-number">${escapeHtml(record.roll_number)}</div>
            <div class="student-name">${escapeHtml(record.student_name || `Student ${record.roll_number}`)}</div>
            <button type="button" class="attendance-status-btn edit-attendance-status ${record.status}" data-student-id="${record.student_id}" data-status="${record.status}">${record.status === "present" ? "Present" : (record.status === "leave" ? "Leave" : "Absent")}</button>
        </div>`).join("");
    document.querySelectorAll(".edit-attendance-status").forEach(button => button.addEventListener("click", () => {
        const statuses = ["present", "absent", "leave"];
        const next = statuses[(statuses.indexOf(button.dataset.status) + 1) % statuses.length];
        setAttendanceButtonStatus(button, next);
    }));
}

async function loadAttendanceAudit() {
    const container = document.getElementById("attendanceAuditList");
    try {
        const response = await fetch(`/api/attendance/course/${courseId}/audit/log`, { credentials: "include" });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || "Could not load change history");
        container.innerHTML = data.audit.length ? `<div class="summary-table-wrapper"><table class="summary-table"><thead><tr><th>When</th><th>Date</th><th>Student</th><th>Change</th><th>Changed By</th></tr></thead><tbody>${data.audit.map(entry => `<tr><td>${escapeHtml(new Date(entry.changed_at).toLocaleString())}</td><td>${escapeHtml(attendanceDateKey(entry.attendance_date))}</td><td>${escapeHtml(entry.student_name || `Roll ${entry.roll_number}`)}</td><td>${escapeHtml(entry.old_status)} → ${escapeHtml(entry.new_status)}</td><td>${escapeHtml(entry.changed_by_name)}</td></tr>`).join("")}</tbody></table></div>` : "<p>No attendance corrections have been made.</p>";
    } catch (error) {
        container.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
    }
}

if (editAttendanceBtn) editAttendanceBtn.addEventListener("click", async () => {
    if (!currentAttendanceRecords.length) await loadAttendanceHistory();
    const dates = [...new Set(currentAttendanceRecords.map(record => attendanceDateKey(record.attendance_date)))].sort().reverse();
    if (!dates.length) {
        alert("No saved attendance is available to edit.");
        return;
    }
    const select = document.getElementById("attendanceEditDate");
    select.innerHTML = dates.map(date => `<option value="${date}">${formatDate(date)}</option>`).join("");
    attendanceEditor.classList.remove("hidden");
    renderAttendanceEditor();
    loadAttendanceAudit();
    attendanceEditor.scrollIntoView({ behavior: "smooth" });
});
document.getElementById("attendanceEditDate")?.addEventListener("change", renderAttendanceEditor);
document.getElementById("cancelAttendanceEditBtn")?.addEventListener("click", () => attendanceEditor.classList.add("hidden"));

document.getElementById("saveAttendanceEditBtn")?.addEventListener("click", async () => {
    const button = document.getElementById("saveAttendanceEditBtn");
    const date = document.getElementById("attendanceEditDate").value;
    const studentStatuses = [...document.querySelectorAll(".edit-attendance-status")]
        .map(item => ({ student_id: Number(item.dataset.studentId), status: item.dataset.status }));
    button.disabled = true;
    try {
        const response = await fetch(`/api/attendance/course/${courseId}/${date}`, {
            method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentStatuses })
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || "Could not update attendance");
        setPanelMessage("attendanceEditMessage", `${data.message} (${data.changed} changes)`, "success");
        await loadAttendanceHistory();
        renderAttendanceEditor();
        await loadAttendanceAudit();
    } catch (error) {
        setPanelMessage("attendanceEditMessage", error.message, "error");
    } finally {
        button.disabled = false;
    }
});


// =========================

// =========================
// STUDENT LEAVE
// =========================

const studentLeaveForm = document.getElementById("studentLeaveForm");
const openLeaveBtn = document.getElementById("openLeaveBtn");
openLeaveBtn?.addEventListener("click", () => {
    const today = getTodayDate();
    document.getElementById("leaveStartDate").value = today;
    document.getElementById("leaveEndDate").value = today;
    studentLeaveForm.classList.remove("hidden");
    openLeaveBtn.classList.add("hidden");
    studentLeaveForm.scrollIntoView({ behavior: "smooth", block: "center" });
});
document.getElementById("cancelLeaveBtn")?.addEventListener("click", () => {
    studentLeaveForm.classList.add("hidden");
    openLeaveBtn?.classList.remove("hidden");
});
document.getElementById("leaveStartDate")?.addEventListener("change", event => {
    const end = document.getElementById("leaveEndDate");
    end.min = event.target.value;
    if (!end.value || end.value < event.target.value) end.value = event.target.value;
});
studentLeaveForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const submit = studentLeaveForm.querySelector("button[type='submit']");
    const originalSubmitText = submit.textContent;
    const leaveRollNumber = document.getElementById("leaveRollNumber").value.trim();
    submit.disabled = true;
    submit.textContent = "Saving Leave…";
    try {
        const response = await fetch(`/api/attendance/course/${courseId}/leave`, {
            method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                roll_number: leaveRollNumber,
                start_date: document.getElementById("leaveStartDate").value,
                end_date: document.getElementById("leaveEndDate").value
            })
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || "Could not save student leave");
        setPanelMessage("leaveMessage", data.message, "success");
        await loadAttendanceHistory();
        const leaveStudent = students.find(student => String(student.roll_number) === leaveRollNumber);
        restoreTodayAttendanceSummary(leaveStudent?.id ?? null);
    } catch (error) {
        setPanelMessage("leaveMessage", error.message, "error");
    } finally {
        submit.disabled = false;
        submit.textContent = originalSubmitText;
    }
});
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

                console.error(error);

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

async function initializeCoursePage() {
    await loadTeacher();
    await loadCourse();

    const studentsSection = document.querySelector(".students-section");
    const historySection = document.getElementById("attendanceHistorySection");
    const backButton = document.querySelector(".back-btn");
    const workflowSections = [classSettingsSection, studentImportSection, attendanceSection, marksSection, historySection];

    if (coursePageAction === "hub") {
        document.body.classList.add("course-hub");
        document.getElementById("studentsContainer")?.classList.add("hidden");
        historySection?.classList.add("hidden");
        if (attendanceHistoryBtn && currentCourse?.attendance_enabled === false) attendanceHistoryBtn.style.display = "none";
        return;
    }

    document.body.classList.add("course-workflow");
    courseHeader?.classList.add("hidden");
    studentsSection?.classList.add("hidden");
    workflowSections.forEach(section => section?.classList.add("hidden"));
    if (backButton) {
        backButton.href = `/course.html?id=${encodeURIComponent(courseId || "")}`;
        backButton.textContent = "← Back to Class";
    }

    if (coursePageAction === "edit") await openClassSettings();
    if (coursePageAction === "import") studentImportSection?.classList.remove("hidden");
    if (coursePageAction === "attendance" && currentCourse?.attendance_enabled !== false) {
        attendanceSection?.classList.remove("hidden");
        attendanceDate.textContent = formatDateForDisplay(getTodayDate());
        renderAttendanceList();
    }
    if (coursePageAction === "marks") {
        marksSection?.classList.remove("hidden");
        await loadCourseMarks();
    }
    if (coursePageAction === "history") historySection?.classList.remove("hidden");
}

attendanceHistoryBtn?.addEventListener("click", () => {
    navigateFromCourseHub(coursePageUrl("attendance-history"));
});

downloadClassBackupBtn?.addEventListener("click", async () => {
    const originalText = downloadClassBackupBtn.textContent;
    downloadClassBackupBtn.disabled = true;
    downloadClassBackupBtn.textContent = "Preparing Backup…";
    try {
        const response = await fetch(`/api/courses/${courseId}/backup`, { credentials: "include", cache: "no-store" });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || "Could not export class backup");
        }
        const blob = await response.blob();
        const disposition = response.headers.get("Content-Disposition") || "";
        const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `class_${courseId}_backup.json`;
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    } catch (error) {
        alert(error.message);
    } finally {
        downloadClassBackupBtn.disabled = false;
        downloadClassBackupBtn.textContent = originalText;
    }
});

initializeCoursePage();
