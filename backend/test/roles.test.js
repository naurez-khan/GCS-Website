const test = require("node:test");
const assert = require("node:assert/strict");
const { getAvailableRoles, canUseRole } = require("../lib/roles");

test("ordinary teachers only receive teacher access", () => {
    const account = { role: "teacher", can_admin: false };
    assert.deepEqual(getAvailableRoles(account), ["teacher"]);
    assert.equal(canUseRole(account, "admin"), false);
});

test("teacher administrators receive both portal roles", () => {
    const account = { role: "teacher", can_admin: true };
    assert.deepEqual(getAvailableRoles(account), ["teacher", "admin"]);
    assert.equal(canUseRole(account, "admin"), true);
});

test("legacy administrator accounts retain admin access", () => {
    assert.deepEqual(getAvailableRoles({ role: "admin", can_admin: true }), ["admin"]);
});
