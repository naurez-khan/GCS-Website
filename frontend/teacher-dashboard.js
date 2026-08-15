const coursesContainer =
    document.getElementById("coursesContainer");

const teacherName =
    document.getElementById("teacherName");

const welcomeName =
    document.getElementById("welcomeName");

const logoutBtn =
    document.getElementById("logoutBtn");

const returnAdminBtn =
    document.getElementById("returnAdminBtn");

const changePasswordBtn =
    document.getElementById("changePasswordBtn");

const passwordPanel =
    document.getElementById("passwordPanel");

const changePasswordForm =
    document.getElementById("changePasswordForm");

const passwordMessage =
    document.getElementById("passwordMessage");

const adminViewNotice =
    document.getElementById("adminViewNotice");

const addCourseBtn =
    document.getElementById("addCourseBtn");

const deleteCourseBtn =
    document.getElementById("deleteCourseBtn");


// =========================
// GLOBAL DATA
// =========================

let loadedCourses = [];


// =========================
// LOAD TEACHER INFORMATION
// =========================

function loadTeacherInfo() {

    const teacher =
        JSON.parse(
            localStorage.getItem("teacher")
        );

    if (!teacher) {

        window.location.href =
            "/test-login.html";

        return;
    }

    teacherName.textContent =
        teacher.name;

    welcomeName.textContent =
        teacher.name;

    if (teacher.adminView === true && localStorage.getItem("adminSession")) {
        returnAdminBtn.hidden = false;
        changePasswordBtn.hidden = true;
        adminViewNotice.hidden = false;
        adminViewNotice.textContent = `Administrator view: you are managing ${teacher.name}'s dashboard.`;
    }
}


// =========================
// LOAD COURSES
// =========================

async function loadCourses() {

    try {

        const response =
            await fetch(
                "/api/courses/my",
                {
                    method: "GET",
                    credentials: "include"
                }
            );

        const data =
            await response.json();

        if (!data.success) {

            coursesContainer.innerHTML = `
                <p class="error">
                    ${escapeHtml(data.message || "Could not load classes.")}
                </p>
            `;

            loadedCourses = [];

            return;
        }

        loadedCourses =
            data.courses || [];

        displayCourses(loadedCourses);

    } catch (error) {

        console.error(
            "Load courses error:",
            error
        );

        coursesContainer.innerHTML = `
            <p class="error">
                Could not connect to the server.
            </p>
        `;

        loadedCourses = [];
    }
}


// =========================
// DISPLAY COURSES
// =========================

function displayCourses(courses) {

    if (!courses || courses.length === 0) {

        coursesContainer.innerHTML = `
            <p>
                You haven't created any classes yet.
            </p>
        `;

        return;
    }

    coursesContainer.innerHTML = "";


    courses.forEach(course => {

        const card =
            document.createElement("div");

        card.className =
            "course-card";


        const courseName =
            course.name || "Unnamed Course";

        const courseCode =
            course.course_code || "";

        const program =
            course.program || "N/A";

        const semester =
            course.semester || "N/A";

        const section =
            course.section || "N/A";

        const rollNumberSummary =
            formatRollNumberSummary(course);


        const infoItems = [];


        // =========================
        // PROGRAM
        // =========================

        if (course.program_enabled) {

            infoItems.push(`
                <div>
                    <strong>Program:</strong>
                    ${escapeHtml(program)}
                </div>
            `);

        }


        // =========================
        // SEMESTER
        // =========================

        if (course.semester_enabled) {

            infoItems.push(`
                <div>
                    <strong>Semester:</strong>
                    ${escapeHtml(semester)}
                </div>
            `);

        }


        // =========================
        // SECTION
        // =========================

        if (course.section_enabled) {

            infoItems.push(`
                <div>
                    <strong>Section:</strong>
                    ${escapeHtml(section)}
                </div>
            `);

        }


        // =========================
        // STUDENT NAME
        // =========================

        if (course.student_name_enabled) {

            infoItems.push(`
                <div>
                    <strong>Student Name:</strong>
                    Enabled
                </div>
            `);

        }


        // =========================
        // ROLL NUMBERS
        // ALWAYS REQUIRED
        // =========================

        infoItems.push(`
            <div>
                <strong>Roll Numbers:</strong>
                ${escapeHtml(rollNumberSummary)}
            </div>
        `);


        // =========================
        // COURSE CARD
        // (delete button removed —
        // deletion now happens from
        // the single Delete Class
        // button above)
        // =========================

        card.innerHTML = `

            <h3>
                ${escapeHtml(courseName)}
            </h3>

            ${courseCode ? `<p class="course-code">${escapeHtml(courseCode)}</p>` : ""}

            <div class="course-info">

                ${infoItems.join("")}

            </div>

            <div class="card-actions">

                <button
                    class="open-course-btn"
                    onclick="openCourse(${course.id})"
                >
                    Open Class
                </button>

            </div>

        `;


        coursesContainer.appendChild(card);

    });

}


// =========================
// OPEN COURSE
// =========================

function openCourse(courseId) {

    window.location.href =
        `/course.html?id=${courseId}`;

}

function formatRollNumberSummary(course) {
    const rollNumbers = [...new Set(
        (Array.isArray(course.roll_numbers) ? course.roll_numbers : [])
            .map(Number)
            .filter(Number.isInteger)
    )].sort((first, second) => first - second);

    if (!rollNumbers.length) {
        return `${course.roll_start ?? "N/A"} - ${course.roll_end ?? "N/A"}`;
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

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// =========================
// DELETE CLASS (performs the
// actual API call + confirm)
// =========================

async function deleteClass(courseId) {

    const confirmed =
        window.confirm(
            "Are you sure you want to permanently delete this class? " +
            "This will remove all students, attendance records, and marks. " +
            "This cannot be undone."
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                `/api/courses/${courseId}`,
                {
                    method: "DELETE",
                    credentials: "include"
                }
            );


        const data =
            await response.json();


        if (!data.success) {

            alert(
                data.message ||
                "Could not delete class."
            );

            return;

        }


        const form =
            document.getElementById(
                "deleteCourseForm"
            );


        if (form) {

            form.remove();

        }


        loadCourses();


    } catch (error) {

        console.error(
            "Delete course error:",
            error
        );


        alert(
            "Could not connect to the server."
        );

    }

}


// =========================
// LOGOUT
// =========================

function showPasswordMessage(text, type) {
    passwordMessage.textContent = text;
    passwordMessage.className = `form-message ${type}`;
    passwordMessage.hidden = false;
}

changePasswordBtn?.addEventListener("click", () => {
    passwordPanel.hidden = false;
    passwordMessage.hidden = true;
    document.getElementById("currentPassword").focus();
    passwordPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

document.getElementById("cancelPasswordBtn")?.addEventListener("click", () => {
    changePasswordForm.reset();
    passwordMessage.hidden = true;
    passwordPanel.hidden = true;
});

changePasswordForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const submit = changePasswordForm.querySelector("button[type='submit']");
    const currentPassword = document.getElementById("currentPassword").value;
    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (newPassword.length < 8) {
        showPasswordMessage("New password must be at least 8 characters", "error");
        return;
    }
    if (newPassword !== confirmPassword) {
        showPasswordMessage("New password and confirmation do not match", "error");
        return;
    }

    submit.disabled = true;
    try {
        const response = await fetch("/api/auth/change-password", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            })
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || "Could not change password");
        changePasswordForm.reset();
        showPasswordMessage(data.message, "success");
    } catch (error) {
        showPasswordMessage(error.message, "error");
    } finally {
        submit.disabled = false;
    }
});

returnAdminBtn?.addEventListener("click", async () => {
    returnAdminBtn.disabled = true;
    try {
        const response = await fetch("/api/admin/stop-viewing-teacher", {
            method: "POST",
            credentials: "include"
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || "Could not return to administration");
        const admin = JSON.parse(localStorage.getItem("adminSession") || "null") || data.user;
        localStorage.setItem("teacher", JSON.stringify(admin));
        localStorage.removeItem("adminSession");
        window.location.href = "/admin.html";
    } catch (error) {
        returnAdminBtn.disabled = false;
        alert(error.message);
    }
});

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

        localStorage.removeItem(
            "adminSession"
        );


        window.location.href =
            "/test-login.html";

    }
);


// =========================
// ADD COURSE
// =========================

addCourseBtn.addEventListener(
    "click",
    showAddCourseForm
);


// =========================
// DELETE COURSE BUTTON
// =========================

if (deleteCourseBtn) {

    deleteCourseBtn.addEventListener(
        "click",
        showDeleteCourseForm
    );

}


// =========================
// SHOW DELETE COURSE FORM
// =========================

function showDeleteCourseForm() {

    // Close the add-course form if it's open

    const existingAddForm =
        document.getElementById(
            "addCourseForm"
        );


    if (existingAddForm) {

        existingAddForm.remove();

    }


    const existingForm =
        document.getElementById(
            "deleteCourseForm"
        );


    if (existingForm) {

        existingForm.remove();

        return;
    }


    if (
        !loadedCourses ||
        loadedCourses.length === 0
    ) {

        alert(
            "You don't have any classes to delete."
        );

        return;
    }


    const formContainer =
        document.createElement("section");


    formContainer.id =
        "deleteCourseForm";


    formContainer.className =
        "delete-course-form";


    const optionsHTML =
        loadedCourses
            .map(
                course => `
                    <option value="${course.id}">
                        ${course.name || "Unnamed Course"}
                    </option>
                `
            )
            .join("");


    formContainer.innerHTML = `

        <div class="form-header">

            <div>

                <h2>
                    Delete a Class
                </h2>

                <p>
                    Choose which class to permanently delete.
                </p>

            </div>

        </div>


        <div class="conditional-field">

            <label>
                Class
            </label>

            <select id="deleteCourseSelect">

                ${optionsHTML}

            </select>

        </div>


        <div class="form-actions">

            <button
                type="button"
                id="confirmDeleteCourseBtn"
                class="delete-btn"
            >
                Delete Class
            </button>


            <button
                type="button"
                id="cancelDeleteCourseBtn"
                class="cancel-course-btn"
            >
                Cancel
            </button>

        </div>


        <div
            id="deleteCourseMessage"
            class="form-message"
        ></div>

    `;


    document
        .querySelector(".courses-section")
        .prepend(formContainer);


    document
        .getElementById("confirmDeleteCourseBtn")
        .addEventListener(
            "click",
            () => {

                const select =
                    document.getElementById(
                        "deleteCourseSelect"
                    );


                const courseId =
                    Number(select.value);


                if (!courseId) {

                    return;

                }


                deleteClass(courseId);

            }
        );


    document
        .getElementById("cancelDeleteCourseBtn")
        .addEventListener(
            "click",
            () => {

                formContainer.remove();

            }
        );


    formContainer.scrollIntoView({
        behavior: "smooth"
    });

}


// =========================
// SHOW ADD COURSE FORM
// =========================

function showAddCourseForm() {

    // Close the delete-course form if it's open

    const existingDeleteForm =
        document.getElementById(
            "deleteCourseForm"
        );


    if (existingDeleteForm) {

        existingDeleteForm.remove();

    }


    const existingForm =
        document.getElementById(
            "addCourseForm"
        );


    if (existingForm) {

        existingForm.remove();

        return;
    }


    const formContainer =
        document.createElement("section");


    formContainer.id =
        "addCourseForm";


    formContainer.className =
        "add-course-form";


    formContainer.innerHTML = `

        <!-- =========================
             FORM HEADER
        ========================== -->

        <div class="form-header">

            <div>

                <h2>
                    Create New Class
                </h2>

                <p>
                    Choose the information and
                    features for this class.
                </p>

            </div>

        </div>


        <!-- =========================
             COURSE INFORMATION
        ========================== -->

        <div class="settings-group">

            <h3>
                Course Information
            </h3>


            <!-- COURSE NAME - REQUIRED -->

            <div class="setting-row required-row">

                <div>

                    <span>
                        Course Name
                    </span>

                    <small>
                        Required
                    </small>

                </div>

                <strong>
                    Required
                </strong>

            </div>


            <div
                id="courseNameField"
                class="conditional-field"
            >

                <label>
                    Course Name
                </label>

                <input
                    type="text"
                    id="courseName"
                    maxlength="150"
                    placeholder="e.g. Calculus-I"
                >

                <label>
                    Course Code <small>Optional</small>
                </label>

                <input
                    type="text"
                    id="courseCode"
                    maxlength="50"
                    placeholder="e.g. MATH-101"
                >

            </div>


            <!-- PROGRAM -->

            ${createSwitch(
                "program_enabled",
                "Program",
                true
            )}


            <div
                id="programField"
                class="conditional-field"
            >

                <label>
                    Program
                </label>

                <input
                    type="text"
                    id="program"
                    placeholder="e.g. BS Mathematics"
                >

            </div>


            <!-- SEMESTER -->

            ${createSwitch(
                "semester_enabled",
                "Semester",
                true
            )}


            <div
                id="semesterField"
                class="conditional-field"
            >

                <label>
                    Semester
                </label>

                <input
                    type="text"
                    id="semester"
                    placeholder="e.g. 3rd"
                >

            </div>


            <!-- SECTION -->

            ${createSwitch(
                "section_enabled",
                "Section",
                true
            )}


            <div
                id="sectionField"
                class="conditional-field"
            >

                <label>
                    Section
                </label>

                <input
                    type="text"
                    id="section"
                    placeholder="e.g. A"
                >

            </div>


            <!-- ROLL NUMBER - REQUIRED -->

            <div class="setting-row required-row">

                <div>

                    <span>
                        Roll Number Range
                    </span>

                    <small>
                        Required
                    </small>

                </div>

                <strong>
                    Required
                </strong>

            </div>


            <div
                id="rollNumberField"
                class="conditional-field"
            >

                <div id="rollRanges" class="roll-ranges">
                    <div class="roll-range-row">
                        <strong class="roll-range-label">Range 1</strong>

                        <label>
                            <span>Start</span>
                            <input
                                type="number"
                                id="rollStart"
                                class="roll-start"
                                min="0"
                                step="1"
                                placeholder="e.g. 101"
                            >
                        </label>

                        <label>
                            <span>End</span>
                            <input
                                type="number"
                                id="rollEnd"
                                class="roll-end"
                                min="0"
                                step="1"
                                placeholder="e.g. 110"
                            >
                        </label>

                        <button type="button" class="remove-roll-range" hidden>
                            Remove
                        </button>
                    </div>
                </div>

                <div class="roll-range-actions">
                    <button type="button" id="addRollRangeBtn" class="add-roll-range-btn">
                        + Add another range
                    </button>
                    <small>Add separate groups such as 101–110 and 201–210.</small>
                </div>

            </div>


            <!-- STUDENT NAME -->

            ${createSwitch(
                "student_name_enabled",
                "Student Name",
                false
            )}

            <div
                id="studentNamesField"
                class="conditional-field student-names-field"
                style="display: none;"
            >
                <div class="student-names-heading">
                    <div>
                        <label>Student Names</label>
                        <small>Enter a name for every roll number in this class.</small>
                    </div>
                    <strong id="studentNamesCount"></strong>
                </div>
                <div id="studentNameInputs" class="student-name-grid">
                    <p class="student-names-hint">Enter the roll number range above.</p>
                </div>
            </div>

        </div>


        <!-- =========================
             COURSE FEATURES
        ========================== -->

        <div class="settings-group">

            <h3>
                Course Features
            </h3>


            <!-- ATTENDANCE IS NOT SHOWN HERE -->

            <!-- ASSIGNMENTS -->

            ${createSwitch(
                "assignments_enabled",
                "Assignments",
                false
            )}


            <div
                id="assignmentCountField"
                class="conditional-field"
                style="display: none;"
            >

                <label>
                    Number of Assignments
                </label>

                <input
                    type="number"
                    id="assignmentCount"
                    min="1"
                    max="100"
                    value="1"
                    placeholder="e.g. 5"
                >

                <small>
                    How many assignments will this class have?
                </small>

                <label>
                    Maximum Marks per Assignment
                </label>

                <input
                    type="number"
                    id="assignmentMaxMarks"
                    min="0.01"
                    step="0.01"
                    value="10"
                    placeholder="e.g. 10"
                >

            </div>


            <!-- QUIZZES -->

            ${createSwitch(
                "quizzes_enabled",
                "Quizzes",
                false
            )}


            <div
                id="quizCountField"
                class="conditional-field"
                style="display: none;"
            >

                <label>
                    Number of Quizzes
                </label>

                <input
                    type="number"
                    id="quizCount"
                    min="1"
                    max="100"
                    value="1"
                    placeholder="e.g. 3"
                >

                <small>
                    How many quizzes will this class have?
                </small>

                <label>
                    Maximum Marks per Quiz
                </label>

                <input
                    type="number"
                    id="quizMaxMarks"
                    min="0.01"
                    step="0.01"
                    value="10"
                    placeholder="e.g. 10"
                >

            </div>


            <!-- MIDTERM -->

            ${createSwitch(
                "midterm_enabled",
                "Midterm",
                false
            )}

            <div
                id="midtermMarksField"
                class="conditional-field"
                style="display: none;"
            >
                <label>Midterm Maximum Marks</label>
                <input
                    type="number"
                    id="midtermMaxMarks"
                    min="0.01"
                    step="0.01"
                    value="30"
                    placeholder="e.g. 30"
                >
            </div>


            <!-- FINAL EXAM -->

            ${createSwitch(
                "final_enabled",
                "Final Exam",
                false
            )}

            <div
                id="finalMarksField"
                class="conditional-field"
                style="display: none;"
            >
                <label>Final Exam Maximum Marks</label>
                <input
                    type="number"
                    id="finalMaxMarks"
                    min="0.01"
                    step="0.01"
                    value="50"
                    placeholder="e.g. 50"
                >
            </div>


            <!-- RESULTS -->

            ${createSwitch(
                "results_enabled",
                "Results",
                false
            )}

            <div
                id="resultCodeField"
                class="conditional-field"
                style="display: none;"
            >
                <label>Student Result Code</label>
                <input
                    type="text"
                    id="resultCode"
                    minlength="4"
                    maxlength="24"
                    pattern="[A-Za-z0-9-]+"
                    placeholder="e.g. calculus-2026"
                >
                <small>Students will use this code with their roll number.</small>
            </div>

        </div>


        <!-- =========================
             ACTION BUTTONS
        ========================== -->

        <div class="form-actions">

            <button
                type="button"
                id="createCourseBtn"
                class="create-course-btn"
            >
                Create Class
            </button>


            <button
                type="button"
                id="cancelCourseBtn"
                class="cancel-course-btn"
            >
                Cancel
            </button>

        </div>


        <!-- =========================
             MESSAGE
        ========================== -->

        <div
            id="courseFormMessage"
            class="form-message"
        ></div>

    `;


    document
        .querySelector(".courses-section")
        .prepend(formContainer);


    setupCourseSwitches();

    setupRollRangeFields();

    setupStudentNameFields();


    document
        .getElementById("createCourseBtn")
        .addEventListener(
            "click",
            createCourse
        );


    document
        .getElementById("cancelCourseBtn")
        .addEventListener(
            "click",
            () => {

                formContainer.remove();

            }
        );


    formContainer.scrollIntoView({
        behavior: "smooth"
    });

}


// =========================
// CREATE SWITCH
// =========================

function createSwitch(
    id,
    label,
    enabled
) {

    return `

        <div class="setting-row">

            <span>
                ${label}
            </span>


            <label class="switch">

                <input
                    type="checkbox"
                    id="${id}"
                    ${enabled ? "checked" : ""}
                >

                <span class="slider"></span>

            </label>

        </div>

    `;

}


// =========================
// SETUP COURSE SWITCHES
// =========================

function setupCourseSwitches() {

    setupConditionalField(
        "program_enabled",
        "programField"
    );


    setupConditionalField(
        "semester_enabled",
        "semesterField"
    );


    setupConditionalField(
        "section_enabled",
        "sectionField"
    );


    setupConditionalField(
        "assignments_enabled",
        "assignmentCountField"
    );


    setupConditionalField(
        "quizzes_enabled",
        "quizCountField"
    );

    setupConditionalField(
        "midterm_enabled",
        "midtermMarksField"
    );

    setupConditionalField(
        "final_enabled",
        "finalMarksField"
    );

    setupConditionalField(
        "results_enabled",
        "resultCodeField"
    );

}

function setupStudentNameFields() {
    const toggle = document.getElementById("student_name_enabled");

    const update = () => {
        const field = document.getElementById("studentNamesField");
        field.style.display = toggle.checked ? "block" : "none";
        if (toggle.checked) renderStudentNameInputs();
    };

    toggle.addEventListener("change", update);
    update();
}

function setupRollRangeFields() {
    const container = document.getElementById("rollRanges");
    const addButton = document.getElementById("addRollRangeBtn");

    const refreshRows = () => {
        const rows = [...container.querySelectorAll(".roll-range-row")];

        rows.forEach((row, index) => {
            row.querySelector(".roll-range-label").textContent = `Range ${index + 1}`;
            row.querySelector(".remove-roll-range").hidden = rows.length === 1;
        });

        if (document.getElementById("student_name_enabled")?.checked) {
            renderStudentNameInputs();
        }
    };

    addButton.addEventListener("click", () => {
        const row = document.createElement("div");
        row.className = "roll-range-row";
        row.innerHTML = `
            <strong class="roll-range-label"></strong>
            <label>
                <span>Start</span>
                <input type="number" class="roll-start" min="0" step="1" placeholder="e.g. 201">
            </label>
            <label>
                <span>End</span>
                <input type="number" class="roll-end" min="0" step="1" placeholder="e.g. 210">
            </label>
            <button type="button" class="remove-roll-range">Remove</button>
        `;
        container.appendChild(row);
        refreshRows();
        row.querySelector(".roll-start").focus();
    });

    container.addEventListener("click", event => {
        const removeButton = event.target.closest(".remove-roll-range");
        if (!removeButton) return;

        removeButton.closest(".roll-range-row").remove();
        refreshRows();
    });

    container.addEventListener("input", () => {
        if (document.getElementById("student_name_enabled")?.checked) {
            renderStudentNameInputs();
        }
    });

    refreshRows();
}

function readRollRanges() {
    const rows = [...document.querySelectorAll(".roll-range-row")];

    if (!rows.length) {
        return { error: "Add at least one roll number range." };
    }

    const ranges = [];

    for (let index = 0; index < rows.length; index += 1) {
        const startValue = rows[index].querySelector(".roll-start").value.trim();
        const endValue = rows[index].querySelector(".roll-end").value.trim();

        if (!startValue || !endValue) {
            return { error: `Enter both limits for range ${index + 1}.` };
        }

        const start = Number(startValue);
        const end = Number(endValue);

        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < 0) {
            return { error: `Range ${index + 1} must use whole, non-negative roll numbers.` };
        }

        if (start > end) {
            return { error: `Range ${index + 1} start cannot be greater than its end.` };
        }

        ranges.push({ start, end });
    }

    ranges.sort((first, second) => first.start - second.start || first.end - second.end);

    for (let index = 1; index < ranges.length; index += 1) {
        if (ranges[index].start <= ranges[index - 1].end) {
            return { error: "Roll number ranges cannot overlap or contain duplicate numbers." };
        }
    }

    const studentCount = ranges.reduce(
        (total, range) => total + range.end - range.start + 1,
        0
    );

    if (studentCount > 500) {
        return { error: "A class can contain at most 500 students across all ranges." };
    }

    const rollNumbers = ranges.flatMap(range =>
        Array.from({ length: range.end - range.start + 1 }, (_, index) => range.start + index)
    );

    return { ranges, rollNumbers, error: null };
}

function renderStudentNameInputs() {
    const container = document.getElementById("studentNameInputs");
    const count = document.getElementById("studentNamesCount");
    const rangeResult = readRollRanges();
    const savedNames = new Map(
        [...container.querySelectorAll(".student-name-entry")]
            .map(input => [input.dataset.rollNumber, input.value])
    );

    if (rangeResult.error) {
        container.innerHTML = `<p class="student-names-hint">${escapeHtml(rangeResult.error)}</p>`;
        count.textContent = "";
        return;
    }

    const nameRows = rangeResult.rollNumbers.map(roll => `
            <label class="student-name-row">
                <span>Roll ${roll}</span>
                <input
                    class="student-name-entry"
                    data-roll-number="${roll}"
                    maxlength="150"
                    value="${escapeHtml(savedNames.get(String(roll)) || "")}"
                    placeholder="Student name"
                    required
                >
            </label>
        `);

    container.innerHTML = nameRows.join("");
    count.textContent = `${nameRows.length} students`;
}


// =========================
// CONDITIONAL FIELD
// =========================

function setupConditionalField(
    switchId,
    fieldId
) {

    const checkbox =
        document.getElementById(
            switchId
        );


    const field =
        document.getElementById(
            fieldId
        );


    if (!checkbox || !field) {

        return;
    }


    function update() {

        if (checkbox.checked) {

            field.style.display =
                "block";

        } else {

            field.style.display =
                "none";

        }

    }


    checkbox.addEventListener(
        "change",
        update
    );


    update();

}


// =========================
// CREATE COURSE
// =========================

async function createCourse() {

    const message =
        document.getElementById(
            "courseFormMessage"
        );


    function checked(id) {

        const element =
            document.getElementById(id);


        return element
            ? element.checked
            : false;

    }


    // =========================
    // SETTINGS
    // =========================

    const programEnabled =
        checked("program_enabled");

    const semesterEnabled =
        checked("semester_enabled");

    const sectionEnabled =
        checked("section_enabled");

    const studentNameEnabled =
        checked("student_name_enabled");


    // Attendance is always enabled.
    // There is no Attendance switch on the page.

    const assignmentsEnabled =
        checked("assignments_enabled");

    const quizzesEnabled =
        checked("quizzes_enabled");

    const midtermEnabled =
        checked("midterm_enabled");

    const finalEnabled =
        checked("final_enabled");

    const resultsEnabled =
        checked("results_enabled");


    // =========================
    // INPUT VALUES
    // =========================

    const name =
        document
            .getElementById("courseName")
            .value
            .trim();

    const courseCode =
        document
            .getElementById("courseCode")
            .value
            .trim();


    const program =
        document
            .getElementById("program")
            .value
            .trim();


    const semester =
        document
            .getElementById("semester")
            .value
            .trim();


    const section =
        document
            .getElementById("section")
            .value
            .trim();


    const assignmentCount =
        parseInt(
            document
                .getElementById("assignmentCount")
                .value,
            10
        ) || 0;


    const quizCount =
        parseInt(
            document
                .getElementById("quizCount")
                .value,
            10
        ) || 0;

    const assignmentMaxMarks =
        Number(document.getElementById("assignmentMaxMarks").value);

    const quizMaxMarks =
        Number(document.getElementById("quizMaxMarks").value);

    const midtermMaxMarks =
        Number(document.getElementById("midtermMaxMarks").value);

    const finalMaxMarks =
        Number(document.getElementById("finalMaxMarks").value);

    const resultCode =
        document.getElementById("resultCode").value.trim().toLowerCase();


    // =========================
    // REQUIRED COURSE NAME
    // =========================

    if (!name) {

        message.textContent =
            "Please enter the course name.";

        message.className =
            "form-message error";

        return;
    }


    // =========================
    // REQUIRED ROLL RANGE
    // =========================

    const rollRangeResult = readRollRanges();

    if (rollRangeResult.error) {
        message.textContent = rollRangeResult.error;
        message.className = "form-message error";
        return;
    }

    if (courseCode.length > 50) {
        message.textContent = "Course code cannot exceed 50 characters.";
        message.className = "form-message error";
        return;
    }

    const { ranges: rollRanges, rollNumbers } = rollRangeResult;
    const startNumber = rollRanges[0].start;
    const endNumber = rollRanges[rollRanges.length - 1].end;


    // =========================
    // ASSIGNMENT VALIDATION
    // =========================

    if (
        assignmentsEnabled &&
        (
            assignmentCount < 1 ||
            assignmentCount > 100
        )
    ) {

        message.textContent =
            "Please enter a valid number of assignments (1-100).";

        message.className =
            "form-message error";

        return;
    }

    const studentNames = [];

    if (studentNameEnabled) {
        const nameInputs = [...document.querySelectorAll(".student-name-entry")];

        if (nameInputs.length !== rollNumbers.length) {
            message.textContent = "Please provide a name field for every roll number.";
            message.className = "form-message error";
            return;
        }

        const missingName = nameInputs.find(input => !input.value.trim());
        if (missingName) {
            message.textContent = `Please enter the student name for roll ${missingName.dataset.rollNumber}.`;
            message.className = "form-message error";
            missingName.focus();
            return;
        }

        nameInputs.forEach(input => {
            studentNames.push({
                roll_number: input.dataset.rollNumber,
                name: input.value.trim()
            });
        });
    }

    if (assignmentsEnabled && (!Number.isFinite(assignmentMaxMarks) || assignmentMaxMarks <= 0)) {
        message.textContent = "Please enter positive maximum marks for assignments.";
        message.className = "form-message error";
        return;
    }


    // =========================
    // QUIZ VALIDATION
    // =========================

    if (
        quizzesEnabled &&
        (
            quizCount < 1 ||
            quizCount > 100
        )
    ) {

        message.textContent =
            "Please enter a valid number of quizzes (1-100).";

        message.className =
            "form-message error";

        return;
    }

    if (quizzesEnabled && (!Number.isFinite(quizMaxMarks) || quizMaxMarks <= 0)) {
        message.textContent = "Please enter positive maximum marks for quizzes.";
        message.className = "form-message error";
        return;
    }

    if (midtermEnabled && (!Number.isFinite(midtermMaxMarks) || midtermMaxMarks <= 0)) {
        message.textContent = "Please enter positive maximum marks for the midterm.";
        message.className = "form-message error";
        return;
    }

    if (finalEnabled && (!Number.isFinite(finalMaxMarks) || finalMaxMarks <= 0)) {
        message.textContent = "Please enter positive maximum marks for the final exam.";
        message.className = "form-message error";
        return;
    }

    if (resultsEnabled && !/^[a-z0-9-]{4,24}$/.test(resultCode)) {
        message.textContent = "Result code must be 4-24 letters, numbers, or hyphens.";
        message.className = "form-message error";
        return;
    }


    // =========================
    // PAYLOAD
    // =========================

    const payload = {

        // REQUIRED

        name:
            name,

        course_code:
            courseCode || null,

        rollStart:
            startNumber,

        rollEnd:
            endNumber,

        rollRanges:
            rollRanges,


        // OPTIONAL INFORMATION

        program:
            programEnabled
                ? program
                : null,

        semester:
            semesterEnabled
                ? semester
                : null,

        section:
            sectionEnabled
                ? section
                : null,


        // SETTINGS

        course_name_enabled:
            true,

        roll_number_enabled:
            true,

        program_enabled:
            programEnabled,

        semester_enabled:
            semesterEnabled,

        section_enabled:
            sectionEnabled,

        student_name_enabled:
            studentNameEnabled,

        student_names:
            studentNameEnabled
                ? studentNames
                : [],


        // =========================
        // FEATURES
        // =========================

        // Attendance remains mandatory.
        // No toggle is shown to the teacher.
        attendance_enabled:
            true,

        assignments_enabled:
            assignmentsEnabled,

        quizzes_enabled:
            quizzesEnabled,

        midterm_enabled:
            midtermEnabled,

        final_enabled:
            finalEnabled,

        results_enabled:
            resultsEnabled,

        result_code:
            resultsEnabled
                ? resultCode
                : null,


        // =========================
        // COUNTS
        // =========================

        assignment_count:
            assignmentsEnabled
                ? assignmentCount
                : 0,

        assignment_max_marks:
            assignmentsEnabled
                ? assignmentMaxMarks
                : null,

        quiz_count:
            quizzesEnabled
                ? quizCount
                : 0,

        quiz_max_marks:
            quizzesEnabled
                ? quizMaxMarks
                : null,

        midterm_max_marks:
            midtermEnabled
                ? midtermMaxMarks
                : null,

        final_max_marks:
            finalEnabled
                ? finalMaxMarks
                : null

    };


    console.log(
        "Create course payload:",
        payload
    );


    // =========================
    // BUTTON
    // =========================

    const createButton =
        document.getElementById(
            "createCourseBtn"
        );


    createButton.disabled =
        true;


    createButton.textContent =
        "Creating...";


    // =========================
    // SEND REQUEST
    // =========================

    try {

        const response =
            await fetch(
                "/api/courses",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials:
                        "include",

                    body:
                        JSON.stringify(
                            payload
                        )
                }
            );


        const data =
            await response.json();


        console.log(
            "Create course response:",
            data
        );


        if (!data.success) {

            message.textContent =
                data.message ||
                "Could not create class.";

            message.className =
                "form-message error";

            return;
        }


        message.textContent =
            "Class created successfully!";

        message.className =
            "form-message success";


        setTimeout(
            () => {

                const form =
                    document.getElementById(
                        "addCourseForm"
                    );


                if (form) {

                    form.remove();

                }


                loadCourses();

            },
            700
        );


    } catch (error) {

        console.error(
            "Create course error:",
            error
        );


        message.textContent =
            "Could not connect to the server.";

        message.className =
            "form-message error";


    } finally {

        createButton.disabled =
            false;


        createButton.textContent =
            "Create Class";

    }

}


// =========================
// START
// =========================

loadTeacherInfo();

loadCourses();
