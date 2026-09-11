const test = require("node:test");
const assert = require("node:assert/strict");
const pool = require("../config/db");
const { getPendingApprovalCount } = require("../controllers/authController");

function responseRecorder() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

test("teacher administrators can read the pending class count", async () => {
    const previousQuery = pool.query;
    const queries = [];
    pool.query = async sql => {
        queries.push(sql);
        if (queries.length === 1) {
            return { rows: [{ role: "teacher", can_admin: true, is_active: true }] };
        }
        return { rows: [{ count: 4 }] };
    };

    const res = responseRecorder();
    try {
        await getPendingApprovalCount({ user: { id: 12, role: "teacher" } }, res);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, { success: true, count: 4 });
        assert.equal(queries.length, 2);
    } finally {
        pool.query = previousQuery;
    }
});

test("ordinary teachers cannot read approval notifications", async () => {
    const previousQuery = pool.query;
    pool.query = async () => ({
        rows: [{ role: "teacher", can_admin: false, is_active: true }]
    });

    const res = responseRecorder();
    try {
        await getPendingApprovalCount({ user: { id: 13, role: "teacher" } }, res);
        assert.equal(res.statusCode, 403);
        assert.match(res.body.message, /administrator access required/i);
    } finally {
        pool.query = previousQuery;
    }
});
