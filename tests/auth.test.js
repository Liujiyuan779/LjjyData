"use strict";

const assert = require("assert");
const Auth = require("../auth.js");

const tests = [];
let failed = false;

function test(name, fn) {
  tests.push({ name: name, fn: fn });
}

test("注册需要有效邮箱和至少 6 位密码", async function () {
  const users = [];
  let result = await Auth.registerUser(users, {
    email: "bad-email",
    password: "123456"
  });
  assert.strictEqual(result.ok, false);

  result = await Auth.registerUser(users, {
    email: "user@example.com",
    password: "123"
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error, "密码至少 6 位");
});

test("注册成功后可以登录且邮箱不区分大小写", async function () {
  const users = [];
  const reg = await Auth.registerUser(users, {
    email: "User@Example.com",
    password: "abc123"
  });
  assert.strictEqual(reg.ok, true);
  assert.strictEqual(users.length, 1);
  assert.strictEqual(users[0].email, "user@example.com");

  const login = await Auth.loginUser(users, {
    email: "USER@example.com",
    password: "abc123"
  });
  assert.strictEqual(login.ok, true);
  assert.strictEqual(login.user.email, "user@example.com");
});

test("重复邮箱注册失败", async function () {
  const users = [];
  await Auth.registerUser(users, {
    email: "user@example.com",
    password: "abc123"
  });
  const result = await Auth.registerUser(users, {
    email: "user@example.com",
    password: "xyz789"
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error, "该邮箱已注册");
});

test("错误密码和未注册邮箱登录失败", async function () {
  const users = [];
  await Auth.registerUser(users, {
    email: "user@example.com",
    password: "abc123"
  });

  let login = await Auth.loginUser(users, { email: "user@example.com", password: "wrong" });
  assert.strictEqual(login.ok, false);

  login = await Auth.loginUser(users, { email: "nobody@example.com", password: "abc123" });
  assert.strictEqual(login.ok, false);
});

test("session 在没有退出时保持有效", function () {
  const users = [{ id: "u1", email: "user@example.com" }];
  const session = Auth.createSession(users[0]);
  assert.strictEqual(Auth.isValidSession(session, users), true);
  assert.strictEqual(Auth.isValidSession(null, users), false);
  assert.strictEqual(Auth.isValidSession(session, []), false);
});

(async function run() {
  for (const t of tests) {
    try {
      await t.fn();
      console.log("PASS " + t.name);
    } catch (err) {
      failed = true;
      console.error("FAIL " + t.name);
      console.error(err && err.stack ? err.stack : err);
    }
  }
  if (failed) {
    process.exit(1);
  }
  console.log("ALL AUTH TESTS PASSED");
})();
