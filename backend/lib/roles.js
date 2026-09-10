function getAvailableRoles(account) {
    if (!account) return [];

    const roles = [];
    if (account.role === "teacher") roles.push("teacher");
    if (account.role === "admin" || account.can_admin === true) roles.push("admin");
    return roles;
}

function canUseRole(account, role) {
    return getAvailableRoles(account).includes(role);
}

module.exports = { getAvailableRoles, canUseRole };
