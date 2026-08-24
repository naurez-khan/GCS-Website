let currentAdmin = JSON.parse(localStorage.getItem("teacher") || "null");

const teacherForm = document.getElementById("teacherForm");
const adminForm = document.getElementById("adminForm");
const teacherRows = document.getElementById("teacherRows");
const adminRows = document.getElementById("adminRows");
const message = document.getElementById("message");
const adminMessage = document.getElementById("adminMessage");
const transferMessage = document.getElementById("transferMessage");
const transferClassForm = document.getElementById("transferClassForm");
const transferFromTeacher = document.getElementById("transferFromTeacher");
const transferCourse = document.getElementById("transferCourse");
const transferToTeacher = document.getElementById("transferToTeacher");
const resetPasswordForm = document.getElementById("resetPasswordForm");
const resetPasswordAccount = document.getElementById("resetPasswordAccount");
const resetPasswordMessage = document.getElementById("resetPasswordMessage");
const teacherAccountPanel = document.getElementById("teacherAccountPanel");
const teacherAccountSelect = document.getElementById("teacherAccountSelect");
const confirmTeacherAccountBtn = document.getElementById("confirmTeacherAccountBtn");
const adminAccountPanel = document.getElementById("adminAccountPanel");
const adminAccountSelect = document.getElementById("adminAccountSelect");
const confirmAdminAccountBtn = document.getElementById("confirmAdminAccountBtn");
let currentTeachers = [];
let currentAdmins = [];
let transferableCourses = [];
let teacherAccountMode = "remove";
let adminAccountMode = "remove";

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
                <td>${escapeHtml(new Date(teacher.created_at).toLocaleDateString())}</td>
            </tr>`).join("") : '<tr><td colspan="4">No teachers have been added.</td></tr>';
        document.getElementById("removeTeacherBtn").disabled = !currentTeachers.some(teacher => teacher.is_active);
        document.getElementById("restoreTeacherBtn").disabled = !currentTeachers.some(teacher => !teacher.is_active);
    } catch (error) {
        teacherRows.innerHTML = `<tr><td colspan="4">${escapeHtml(error.message)}</td></tr>`;
    }
}

async function loadAdmins() {
    try {
        const data = await api("/api/admin/admins");
        currentAdmins = data.admins;
        adminRows.innerHTML = data.admins.length ? data.admins.map(admin => `
            <tr>
                <td>${escapeHtml(admin.name)}</td>
                <td>${escapeHtml(admin.email)}</td>
                <td><span class="status ${admin.is_active ? "active" : "inactive"}">${admin.is_active ? "Active" : "Inactive"}</span></td>
                <td>${escapeHtml(new Date(admin.created_at).toLocaleDateString())}</td>
            </tr>`).join("") : '<tr><td colspan="4">No administrators found.</td></tr>';
        document.getElementById("removeAdminBtn").disabled = !currentAdmins.some(admin =>
            admin.is_active && Number(admin.id) !== Number(currentAdmin?.id)
        );
        document.getElementById("restoreAdminBtn").disabled = !currentAdmins.some(admin => !admin.is_active);
    } catch (error) {
        adminRows.innerHTML = `<tr><td colspan="4">${escapeHtml(error.message)}</td></tr>`;
    }
}

function courseLabel(course) {
    const details = [course.course_code, course.section].filter(Boolean).join(" · ");
    return `${course.name}${details ? ` — ${details}` : ""}`;
}

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

function openAdminAccountPanel(mode) {
    adminAccountMode = mode;
    const removing = mode === "remove";
    const candidates = currentAdmins.filter(admin =>
        admin.is_active === removing && (!removing || Number(admin.id) !== Number(currentAdmin?.id))
    );

    document.getElementById("adminAccountTitle").textContent = removing ? "Remove Administrator" : "Restore Administrator";
    document.getElementById("adminAccountHelp").textContent = removing
        ? "Choose which administrator should lose sign-in access. The account records will be preserved."
        : "Choose which administrator should regain sign-in access.";
    confirmAdminAccountBtn.textContent = removing ? "Remove Administrator" : "Restore Administrator";
    confirmAdminAccountBtn.classList.toggle("danger", removing);
    adminAccountSelect.innerHTML = candidates.map(admin =>
        `<option value="${Number(admin.id)}">${escapeHtml(admin.name)} — ${escapeHtml(admin.email)}</option>`
    ).join("");
    confirmAdminAccountBtn.disabled = candidates.length === 0;
    adminAccountPanel.classList.remove("hidden");
    adminAccountPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

document.getElementById("removeAdminBtn").addEventListener("click", () => openAdminAccountPanel("remove"));
document.getElementById("restoreAdminBtn").addEventListener("click", () => openAdminAccountPanel("restore"));
document.getElementById("cancelAdminAccountBtn").addEventListener("click", () => adminAccountPanel.classList.add("hidden"));

confirmAdminAccountBtn.addEventListener("click", async () => {
    const adminId = Number(adminAccountSelect.value);
    const admin = currentAdmins.find(item => Number(item.id) === adminId);
    const removing = adminAccountMode === "remove";
    if (!admin) {
        showMessage(adminMessage, "Choose an administrator first.", "error");
        return;
    }
    if (removing && !window.confirm(`Remove ${admin.name}? They will no longer be able to sign in, but their account records will be preserved.`)) {
        return;
    }

    confirmAdminAccountBtn.disabled = true;
    try {
        const data = await api(`/api/admin/admins/${adminId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_active: !removing })
        });
        showMessage(adminMessage, data.message, "success");
        adminAccountPanel.classList.add("hidden");
        await loadAdmins();
    } catch (error) {
        showMessage(adminMessage, error.message, "error");
        confirmAdminAccountBtn.disabled = false;
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

adminForm.addEventListener("submit", async event => {
    event.preventDefault();
    const submit = adminForm.querySelector("button[type=submit]");
    submit.disabled = true;
    try {
        await api("/api/admin/admins", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: document.getElementById("newAdminName").value,
                email: document.getElementById("newAdminEmail").value,
                password: document.getElementById("newAdminPassword").value
            })
        });
        adminForm.reset();
        showMessage(adminMessage, "Administrator created successfully.", "success");
        await loadAdmins();
    } catch (error) {
        showMessage(adminMessage, error.message, "error");
    } finally {
        submit.disabled = false;
    }
});

document.getElementById("refreshBtn").addEventListener("click", () => Promise.all([loadTeachers(), loadAdmins()]));
document.getElementById("logoutBtn").addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    localStorage.removeItem("teacher");
    localStorage.removeItem("adminSession");
    window.location.replace("/test-login.html");
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
        await Promise.all([loadTeachers(), loadAdmins()]);
        updateResetPasswordAccounts();
        await loadTransferableCourses();
    } catch (error) {
        if (!document.hidden) showMessage(message, error.message, "error");
    }
}

initializeAdminPage();
