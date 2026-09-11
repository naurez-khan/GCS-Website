let currentAdmin = JSON.parse(localStorage.getItem("teacher") || "null");

const teacherForm = document.getElementById("teacherForm");
const teacherRows = document.getElementById("teacherRows");
const message = document.getElementById("message");
const transferMessage = document.getElementById("transferMessage");
const transferClassForm = document.getElementById("transferClassForm");
const transferFromTeacher = document.getElementById("transferFromTeacher");
const transferCourse = document.getElementById("transferCourse");
const transferToTeacher = document.getElementById("transferToTeacher");
const restoreBackupForm = document.getElementById("restoreBackupForm");
const restoreBackupFile = document.getElementById("restoreBackupFile");
const restoreBackupPreview = document.getElementById("restoreBackupPreview");
const restoreBackupTeacher = document.getElementById("restoreBackupTeacher");
const restoreBackupBtn = document.getElementById("restoreBackupBtn");
const restoreBackupMessage = document.getElementById("restoreBackupMessage");
const resetPasswordForm = document.getElementById("resetPasswordForm");
const resetPasswordAccount = document.getElementById("resetPasswordAccount");
const resetPasswordMessage = document.getElementById("resetPasswordMessage");
const teacherAccountPanel = document.getElementById("teacherAccountPanel");
const teacherAccountSelect = document.getElementById("teacherAccountSelect");
const confirmTeacherAccountBtn = document.getElementById("confirmTeacherAccountBtn");
const approvalRows = document.getElementById("approvalRows");
const approvalMessage = document.getElementById("approvalMessage");
let currentTeachers = [];
let currentAdmins = [];
let transferableCourses = [];
let pendingClassBackup = null;
let teacherAccountMode = "remove";

const escapeHtml = value => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

function showMessage(element, text, type) {
    element.textContent = text;
    element.className = `notice ${type}`;
}

async function api(url, options = {}) {
    const response = await fetch(url, { credentials: "include", cache: "no-store", ...options });
    const data = await response.json();
    if (response.status === 401) {
        localStorage.removeItem("teacher");
        localStorage.removeItem("adminSession");
        window.location.replace("/test-login.html");
        throw new Error("Authentication required");
    }
    if (!response.ok || !data.success) throw new Error(data.message || "Request failed");
    return data;
}

async function loadTeachers() {
    try {
        const data = await api("/api/admin/teachers");
        currentTeachers = data.teachers;
        teacherRows.innerHTML = data.teachers.length ? data.teachers.map(teacher => `
            <tr>
                <td><button class="teacher-name-button" data-teacher-id="${Number(teacher.id)}" ${teacher.is_active ? "" : "disabled"}>${escapeHtml(teacher.name)}</button></td>
                <td>${escapeHtml(teacher.email)}</td>
                <td><span class="status ${teacher.is_active ? "active" : "inactive"}">${teacher.is_active ? "Active" : "Inactive"}</span></td>
                <td><span class="status ${teacher.can_admin ? "active" : "inactive"}">${teacher.can_admin ? "Granted" : "Not granted"}</span></td>
                <td>${escapeHtml(new Date(teacher.created_at).toLocaleDateString())}</td>
                <td><button class="account-action ${teacher.can_admin ? "" : "restore"}" data-admin-access="${Number(teacher.id)}" data-grant="${teacher.can_admin ? "false" : "true"}"
                    ${!teacher.is_active || (teacher.can_admin && Number(teacher.id) === Number(currentAdmin?.id)) ? "disabled" : ""}>
                    ${teacher.can_admin ? "Revoke Admin" : "Make Admin"}
                </button></td>
            </tr>`).join("") : '<tr><td colspan="6">No teachers have been added.</td></tr>';
        document.getElementById("removeTeacherBtn").disabled = !currentTeachers.some(teacher => teacher.is_active);
        document.getElementById("restoreTeacherBtn").disabled = !currentTeachers.some(teacher => !teacher.is_active);
        updateRestoreTeacherChoices();
    } catch (error) {
        teacherRows.innerHTML = `<tr><td colspan="6">${escapeHtml(error.message)}</td></tr>`;
    }
}

function updateRestoreTeacherChoices() {
    if (!restoreBackupTeacher) return;
    const activeTeachers = currentTeachers.filter(teacher => teacher.is_active);
    restoreBackupTeacher.innerHTML = activeTeachers.length
        ? activeTeachers.map(teacher => `<option value="${Number(teacher.id)}">${escapeHtml(teacher.name)} — ${escapeHtml(teacher.email)}</option>`).join("")
        : '<option value="">No active teachers available</option>';
    restoreBackupBtn.disabled = !pendingClassBackup || !activeTeachers.length;
}

function resetBackupPreview(message = "") {
    pendingClassBackup = null;
    restoreBackupPreview.innerHTML = "";
    restoreBackupPreview.classList.add("hidden");
    restoreBackupBtn.disabled = true;
    if (message) showMessage(restoreBackupMessage, message, "error");
}

restoreBackupFile.addEventListener("change", async () => {
    restoreBackupMessage.className = "notice hidden";
    const file = restoreBackupFile.files[0];
    if (!file) return resetBackupPreview();
    if (file.size > 10 * 1024 * 1024) return resetBackupPreview("The backup file must be 10 MB or smaller.");
    try {
        const backup = JSON.parse(await file.text());
        if (backup?.format !== "math-department-class-backup" || Number(backup?.version) !== 1) {
            throw new Error("This is not a supported class backup file.");
        }
        if (!backup.course || !Array.isArray(backup.students)) throw new Error("The backup is missing class or student data.");
        pendingClassBackup = backup;
        const activeStudents = backup.students.filter(student => !student.deleted_at).length;
        restoreBackupPreview.innerHTML = `<div class="backup-preview-card">
            <strong>${escapeHtml(backup.course.name || "Unnamed class")}</strong>
            <span>${activeStudents} active student${activeStudents === 1 ? "" : "s"} · ${backup.students.length - activeStudents} removed</span>
            <span>${Array.isArray(backup.attendance) ? backup.attendance.length : 0} attendance records · ${(backup.assignments?.length || 0) + (backup.quizzes?.length || 0)} assessments</span>
            <small>Exported ${backup.exported_at ? escapeHtml(new Date(backup.exported_at).toLocaleString()) : "date unavailable"}</small>
        </div>`;
        restoreBackupPreview.classList.remove("hidden");
        updateRestoreTeacherChoices();
    } catch (error) {
        resetBackupPreview(error instanceof SyntaxError ? "The selected file is not valid JSON." : error.message);
    }
});

restoreBackupForm.addEventListener("submit", async event => {
    event.preventDefault();
    const teacherId = Number(restoreBackupTeacher.value);
    if (!pendingClassBackup || !teacherId) return showMessage(restoreBackupMessage, "Choose a valid backup and receiving teacher.", "error");
    const teacher = currentTeachers.find(item => Number(item.id) === teacherId);
    if (!window.confirm(`Restore “${pendingClassBackup.course.name}” as a new class for ${teacher?.name || "this teacher"}?`)) return;
    restoreBackupBtn.disabled = true;
    try {
        const data = await api("/api/admin/backups/restore", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teacher_id: teacherId, backup: pendingClassBackup })
        });
        showMessage(restoreBackupMessage, data.message || "Class restored successfully.", "success");
        restoreBackupForm.reset();
        resetBackupPreview();
        showMessage(restoreBackupMessage, data.message || "Class restored successfully.", "success");
        await loadTransferableCourses();
    } catch (error) {
        showMessage(restoreBackupMessage, error.message, "error");
        restoreBackupBtn.disabled = false;
    }
});

async function loadAdmins() {
    try {
        const data = await api("/api/admin/admins");
        currentAdmins = data.admins;
    } catch (error) {
        currentAdmins = [];
    }
}

function courseLabel(course) {
    const details = [course.course_code, course.section].filter(Boolean).join(" · ");
    return `${course.name}${details ? ` — ${details}` : ""}`;
}

async function loadCourseApprovals() {
    try {
        const data = await api("/api/admin/course-approvals");
        approvalRows.innerHTML = data.courses.length ? data.courses.map(course => {
            const level = course.class_type === "intermediate" ? "Intermediate" : "Bachelors";
            const details = [level, course.program, course.semester, course.section, course.class_shift]
                .filter(Boolean).join(" · ");
            return `<tr>
                <td><span class="approval-class"><strong>${escapeHtml(course.name)}</strong><small>${escapeHtml(course.course_code || "No course code")}</small></span></td>
                <td>${escapeHtml(course.teacher_name)}<br><span class="approval-details">${escapeHtml(course.teacher_email)}</span></td>
                <td><span class="approval-details">${escapeHtml(details)}</span></td>
                <td>${Number(course.student_count)}</td>
                <td>${escapeHtml(new Date(course.created_at).toLocaleDateString())}</td>
                <td><div class="approval-actions">
                    <button type="button" class="approve" data-course-approval="${Number(course.id)}" data-status="approved">Approve</button>
                    <button type="button" class="danger" data-course-approval="${Number(course.id)}" data-status="rejected">Reject</button>
                </div></td>
            </tr>`;
        }).join("") : '<tr><td colspan="6">No classes are waiting for approval.</td></tr>';
    } catch (error) {
        approvalRows.innerHTML = `<tr><td colspan="6">${escapeHtml(error.message)}</td></tr>`;
    }
}

approvalRows.addEventListener("click", async event => {
    const button = event.target.closest("[data-course-approval]");
    if (!button) return;
    const status = button.dataset.status;
    const action = status === "approved" ? "approve" : "reject";
    if (!window.confirm(`${action === "approve" ? "Approve" : "Reject"} this class request?`)) return;
    button.disabled = true;
    try {
        const data = await api(`/api/admin/courses/${button.dataset.courseApproval}/approval`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status })
        });
        showMessage(approvalMessage, data.message, "success");
        if ("BroadcastChannel" in window) {
            const approvalUpdates = new BroadcastChannel("course-approval-updates");
            approvalUpdates.postMessage({ courseId: Number(button.dataset.courseApproval), status });
            approvalUpdates.close();
        }
        await loadCourseApprovals();
        await loadTransferableCourses();
    } catch (error) {
        showMessage(approvalMessage, error.message, "error");
        button.disabled = false;
    }
});

document.getElementById("refreshApprovalsBtn").addEventListener("click", loadCourseApprovals);

function updateTransferChoices() {
    const sourceId = Number(transferFromTeacher.value);
    const courses = transferableCourses.filter(course => Number(course.teacher_id) === sourceId);
    transferCourse.innerHTML = courses.length
        ? courses.map(course => `<option value="${Number(course.id)}">${escapeHtml(courseLabel(course))}</option>`).join("")
        : '<option value="">No classes for this teacher</option>';
    const destinations = currentTeachers.filter(teacher => teacher.is_active && Number(teacher.id) !== sourceId);
    transferToTeacher.innerHTML = destinations.length
        ? destinations.map(teacher => `<option value="${Number(teacher.id)}">${escapeHtml(teacher.name)} — ${escapeHtml(teacher.email)}</option>`).join("")
        : '<option value="">No other active teacher</option>';
    document.getElementById("transferClassBtn").disabled = !courses.length || !destinations.length;
}

async function loadTransferableCourses() {
    try {
        const data = await api("/api/admin/courses");
        transferableCourses = data.courses;
        const sourceTeachers = currentTeachers.filter(teacher =>
            transferableCourses.some(course => Number(course.teacher_id) === Number(teacher.id))
        );
        transferFromTeacher.innerHTML = sourceTeachers.length
            ? sourceTeachers.map(teacher => `<option value="${Number(teacher.id)}">${escapeHtml(teacher.name)}</option>`).join("")
            : '<option value="">No classes available</option>';
        updateTransferChoices();
    } catch (error) {
        showMessage(transferMessage, error.message, "error");
    }
}

function updateResetPasswordAccounts() {
    const accounts = [
        ...currentTeachers.map(user => ({ ...user, accountType: "Teacher" })),
        ...currentAdmins.map(user => ({ ...user, accountType: "Administrator" }))
    ];
    resetPasswordAccount.innerHTML = accounts.map(user =>
        `<option value="${Number(user.id)}">${escapeHtml(user.accountType)}: ${escapeHtml(user.name)} — ${escapeHtml(user.email)}</option>`
    ).join("");
    document.getElementById("resetPasswordBtn").disabled = accounts.length === 0;
}

resetPasswordForm.addEventListener("submit", async event => {
    event.preventDefault();
    const userId = Number(resetPasswordAccount.value);
    const password = document.getElementById("resetTemporaryPassword").value;
    const confirmation = document.getElementById("resetTemporaryPasswordConfirm").value;
    const account = [...currentTeachers, ...currentAdmins].find(user => Number(user.id) === userId);
    if (!account) return showMessage(resetPasswordMessage, "Choose an account.", "error");
    if (password.length < 8) return showMessage(resetPasswordMessage, "Temporary password must be at least 8 characters.", "error");
    if (password !== confirmation) return showMessage(resetPasswordMessage, "The two passwords do not match.", "error");
    if (!window.confirm(`Reset the password for ${account.name}? Their old password will immediately stop working.`)) return;

    const button = document.getElementById("resetPasswordBtn");
    button.disabled = true;
    try {
        const data = await api(`/api/admin/users/${userId}/password`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password })
        });
        resetPasswordForm.reset();
        updateResetPasswordAccounts();
        showMessage(resetPasswordMessage, data.message, "success");
    } catch (error) {
        showMessage(resetPasswordMessage, error.message, "error");
    } finally {
        button.disabled = false;
    }
});

transferFromTeacher.addEventListener("change", updateTransferChoices);
transferClassForm.addEventListener("submit", async event => {
    event.preventDefault();
    const courseId = Number(transferCourse.value);
    const teacherId = Number(transferToTeacher.value);
    const course = transferableCourses.find(item => Number(item.id) === courseId);
    const teacher = currentTeachers.find(item => Number(item.id) === teacherId);
    if (!course || !teacher) return showMessage(transferMessage, "Choose a class and receiving teacher.", "error");
    if (!window.confirm(`Transfer ${courseLabel(course)} to ${teacher.name}? All existing class records will move with it.`)) return;
    const button = document.getElementById("transferClassBtn");
    button.disabled = true;
    try {
        const data = await api(`/api/admin/courses/${courseId}/transfer`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ new_teacher_id: teacherId })
        });
        await loadTransferableCourses();
        transferFromTeacher.value = String(teacherId);
        updateTransferChoices();
        showMessage(transferMessage, data.message, "success");
        transferMessage.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
        showMessage(transferMessage, error.message, "error");
        button.disabled = false;
    }
});

teacherRows.addEventListener("click", async event => {
    const accessButton = event.target.closest("[data-admin-access]");
    if (accessButton) {
        const teacherId = Number(accessButton.dataset.adminAccess);
        const grant = accessButton.dataset.grant === "true";
        const teacher = currentTeachers.find(item => Number(item.id) === teacherId);
        if (!teacher) return;
        const action = grant ? "grant administrator access to" : "remove administrator access from";
        if (!window.confirm(`Are you sure you want to ${action} ${teacher.name}?`)) return;
        accessButton.disabled = true;
        try {
            const data = await api(`/api/admin/teachers/${teacherId}/admin-access`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ can_admin: grant })
            });
            showMessage(message, data.message, "success");
            await loadTeachers();
        } catch (error) {
            showMessage(message, error.message, "error");
            accessButton.disabled = false;
        }
        return;
    }

    const button = event.target.closest("[data-teacher-id]");
    if (!button) return;
    button.disabled = true;
    try {
        const data = await api(`/api/admin/teachers/${button.dataset.teacherId}/view`, { method: "POST" });
        localStorage.setItem("adminSession", JSON.stringify(currentAdmin));
        localStorage.setItem("teacher", JSON.stringify({ ...data.teacher, role: "teacher", adminView: true }));
        window.location.href = "/teacher-dashboard.html";
    } catch (error) {
        showMessage(message, error.message, "error");
        button.disabled = false;
    }
});

function openTeacherAccountPanel(mode) {
    teacherAccountMode = mode;
    const removing = mode === "remove";
    const candidates = currentTeachers.filter(teacher => teacher.is_active === removing);

    document.getElementById("teacherAccountTitle").textContent = removing ? "Remove Teacher" : "Restore Teacher";
    document.getElementById("teacherAccountHelp").textContent = removing
        ? "Choose which teacher should lose sign-in access. Their classes and records will be preserved."
        : "Choose which teacher should regain sign-in access.";
    confirmTeacherAccountBtn.textContent = removing ? "Remove Teacher" : "Restore Teacher";
    confirmTeacherAccountBtn.classList.toggle("danger", removing);
    teacherAccountSelect.innerHTML = candidates.map(teacher =>
        `<option value="${Number(teacher.id)}">${escapeHtml(teacher.name)} — ${escapeHtml(teacher.email)}</option>`
    ).join("");
    confirmTeacherAccountBtn.disabled = candidates.length === 0;
    teacherAccountPanel.classList.remove("hidden");
    teacherAccountPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

document.getElementById("removeTeacherBtn").addEventListener("click", () => openTeacherAccountPanel("remove"));
document.getElementById("restoreTeacherBtn").addEventListener("click", () => openTeacherAccountPanel("restore"));
document.getElementById("cancelTeacherAccountBtn").addEventListener("click", () => teacherAccountPanel.classList.add("hidden"));

confirmTeacherAccountBtn.addEventListener("click", async () => {
    const teacherId = Number(teacherAccountSelect.value);
    const teacher = currentTeachers.find(item => Number(item.id) === teacherId);
    const removing = teacherAccountMode === "remove";
    if (!teacher) {
        showMessage(message, "Choose a teacher first.", "error");
        return;
    }
    if (removing && !window.confirm(`Remove ${teacher.name}? They will no longer be able to sign in, but their records will be preserved.`)) {
        return;
    }

    confirmTeacherAccountBtn.disabled = true;
    try {
        const data = await api(`/api/admin/teachers/${teacherId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_active: !removing })
        });
        showMessage(message, data.message, "success");
        teacherAccountPanel.classList.add("hidden");
        await loadTeachers();
    } catch (error) {
        showMessage(message, error.message, "error");
        confirmTeacherAccountBtn.disabled = false;
    }
});

teacherForm.addEventListener("submit", async event => {
    event.preventDefault();
    const submit = teacherForm.querySelector("button[type=submit]");
    submit.disabled = true;
    try {
        await api("/api/admin/teachers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: document.getElementById("name").value,
                email: document.getElementById("email").value,
                password: document.getElementById("password").value
            })
        });
        teacherForm.reset();
        showMessage(message, "Teacher created successfully.", "success");
        await loadTeachers();
    } catch (error) {
        showMessage(message, error.message, "error");
    } finally {
        submit.disabled = false;
    }
});

document.getElementById("refreshBtn").addEventListener("click", () => Promise.all([loadTeachers(), loadAdmins(), loadCourseApprovals()]));
document.getElementById("logoutBtn").addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    localStorage.removeItem("teacher");
    localStorage.removeItem("adminSession");
    window.location.replace("/test-login.html");
});

document.getElementById("switchTeacherBtn").addEventListener("click", async () => {
    const button = document.getElementById("switchTeacherBtn");
    button.disabled = true;
    try {
        const data = await api("/api/auth/select-role", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: "teacher" })
        });
        localStorage.setItem("teacher", JSON.stringify(data.user));
        window.location.href = "/teacher-dashboard.html";
    } catch (error) {
        showMessage(message, error.message, "error");
        button.disabled = false;
    }
});

async function initializeAdminPage() {
    try {
        if (localStorage.getItem("adminSession")) {
            await api("/api/admin/stop-viewing-teacher", { method: "POST" });
        }
        const data = await api("/api/auth/me");
        if (data.user.role !== "admin") {
            window.location.replace("/test-login.html");
            return;
        }
        currentAdmin = data.user;
        localStorage.setItem("teacher", JSON.stringify(currentAdmin));
        localStorage.removeItem("adminSession");
        document.getElementById("adminName").textContent = currentAdmin.name || "Administrator";
        document.getElementById("switchTeacherBtn").hidden = !currentAdmin.roles?.includes("teacher");
        await Promise.all([loadTeachers(), loadAdmins(), loadCourseApprovals()]);
        updateResetPasswordAccounts();
        await loadTransferableCourses();
    } catch (error) {
        if (!document.hidden) showMessage(message, error.message, "error");
    }
}

initializeAdminPage();
