const test = require("node:test");
const assert = require("node:assert/strict");
const { createRequireApprovedCourse } = require("../middleware/courseApprovalMiddleware");

function responseRecorder() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

async function run(status, options = {}) {
    const database = {
        async query(_sql, values) {
            assert.deepEqual(values, [47, 2]);
            return { rows: options.missing ? [] : [{ approval_status: status }] };
        }
    };
    const middleware = createRequireApprovedCourse(database);
    const req = { params: { courseId: "47" }, body: {}, user: { id: 2, role: "teacher" } };
    const res = responseRecorder();
    let continued = false;
    await middleware(req, res, () => { continued = true; });
    return { res, continued };
}

test("approved classes may use protected class features", async () => {
    const result = await run("approved");
    assert.equal(result.continued, true);
    assert.equal(result.res.body, null);
});

test("pending classes are blocked until an administrator approves them", async () => {
    const result = await run("pending");
    assert.equal(result.continued, false);
    assert.equal(result.res.statusCode, 403);
    assert.equal(result.res.body.code, "COURSE_APPROVAL_REQUIRED");
    assert.match(result.res.body.message, /waiting for administrator approval/i);
});

test("rejected and inaccessible classes remain blocked", async () => {
    const rejected = await run("rejected");
    assert.equal(rejected.res.statusCode, 403);
    assert.match(rejected.res.body.message, /rejected/i);

    const missing = await run("approved", { missing: true });
    assert.equal(missing.res.statusCode, 404);
});
