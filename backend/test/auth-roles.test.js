const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { authenticate } = require("../middleware/authMiddleware");

function responseRecorder() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

async function runAuthentication(account, role) {
    const secret = "role-test-secret";
    const previousSecret = process.env.JWT_SECRET;
    const previousQuery = pool.query;
    process.env.JWT_SECRET = secret;
    pool.query = async () => ({ rows: account ? [account] : [] });

    const req = { cookies: { token: jwt.sign({ id: 12, role }, secret) } };
    const res = responseRecorder();
    let continued = false;
    try {
        await authenticate(req, res, () => { continued = true; });
        return { res, continued };
    } finally {
        pool.query = previousQuery;
        if (previousSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = previousSecret;
    }
}

test("teacher administrator sessions may enter either permitted portal", async () => {
    const account = { role: "teacher", can_admin: true, is_active: true };
    assert.equal((await runAuthentication(account, "teacher")).continued, true);
    assert.equal((await runAuthentication(account, "admin")).continued, true);
    assert.equal((await runAuthentication(account, "pending")).continued, true);
});

test("ordinary teacher sessions cannot claim administrator access", async () => {
    const result = await runAuthentication({ role: "teacher", can_admin: false, is_active: true }, "admin");
    assert.equal(result.continued, false);
    assert.equal(result.res.statusCode, 401);
});

test("revoked administrator access invalidates an existing admin session", async () => {
    const result = await runAuthentication({ role: "teacher", can_admin: false, is_active: true }, "admin");
    assert.equal(result.continued, false);
    assert.match(result.res.body.message, /inactive or unavailable/i);
});
