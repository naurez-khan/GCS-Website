const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = "test-only-secret-that-is-at-least-32-characters";
const app = require("../server");

async function withServer(run) {
    const server = app.listen(0);
    await new Promise(resolve => server.once("listening", resolve));
    try {
        const { port } = server.address();
        await run(`http://127.0.0.1:${port}`);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
}

test("serves the student result page", async () => {
    await withServer(async origin => {
        const response = await fetch(`${origin}/results.html`);
        assert.equal(response.status, 200);
        assert.match(await response.text(), /View your published result/);
    });
});

test("logout clears the authentication cookie", async () => {
    await withServer(async origin => {
        const response = await fetch(`${origin}/api/auth/logout`, { method: "POST" });
        assert.equal(response.status, 200);
        assert.match(response.headers.get("set-cookie") || "", /token=/);
        assert.deepEqual(await response.json(), { success: true, message: "Logged out successfully" });
    });
});
