"use strict";

const assert = require("assert");
const Cloud = require("../cloud.js");

const tests = [];
let failed = false;
let capturedRequests = [];

function test(name, fn) {
  tests.push({ name: name, fn: fn });
}

function fakeResponse(status, body, type) {
  return {
    ok: status >= 200 && status < 300,
    status: status,
    text: async function () { return body || ""; },
    json: async function () { return JSON.parse(body || "null"); },
    blob: async function () { return new Blob([body || ""], { type: type || "text/plain" }); }
  };
}

function mockFetch(handler) {
  capturedRequests = [];
  global.fetch = async function (url, options) {
    capturedRequests.push({ url: url, options: options });
    return handler(url, options);
  };
}

const config = {
  url: "https://abc.supabase.co/rest/v1/",
  anonKey: "sb_publishable_test",
  bucket: "resources"
};

test("normalizeUrl 去掉 /rest/v1", function () {
  assert.strictEqual(Cloud.normalizeUrl("https://abc.supabase.co/rest/v1/"), "https://abc.supabase.co");
  assert.strictEqual(Cloud.isConfigured(config), true);
});

test("saveState 使用 upsert 保存 jsonb", async function () {
  mockFetch(function (url, options) {
    assert.ok(url.indexOf("/rest/v1/app_data?on_conflict=user_key") >= 0);
    assert.strictEqual(options.method, "POST");
    assert.ok(options.headers["Prefer"].indexOf("merge-duplicates") >= 0);
    return Promise.resolve(fakeResponse(201, ""));
  });
  await Cloud.saveState(config, "user@example.com", { version: 1 });
  assert.strictEqual(capturedRequests.length, 1);
});

test("loadState 返回第一条数据的 data", async function () {
  mockFetch(function () {
    return Promise.resolve(fakeResponse(200, JSON.stringify([{ data: { version: 2 } }])));
  });
  const data = await Cloud.loadState(config, "user@example.com");
  assert.strictEqual(data.version, 2);
});

test("resourcePath 包含用户和文件名", function () {
  assert.strictEqual(Cloud.resourcePath("user@example.com", "a/b.pdf"), "user%40example.com/a_b.pdf");
});

test("uploadResource 上传文件到 Storage", async function () {
  mockFetch(function (url, options) {
    assert.ok(url.indexOf("/storage/v1/object/resources/") >= 0);
    assert.strictEqual(options.method, "POST");
    assert.strictEqual(options.headers["x-upsert"], "true");
    return Promise.resolve(fakeResponse(200, ""));
  });
  await Cloud.uploadResource(config, "user/a.pdf", new Blob(["x"], { type: "application/pdf" }));
});

test("downloadResource 和 deleteResource 调用对应方法", async function () {
  mockFetch(function (url, options) {
    if (options.method === "GET") {
      return Promise.resolve(fakeResponse(200, "pdf", "application/pdf"));
    }
    return Promise.resolve(fakeResponse(200, ""));
  });
  const blob = await Cloud.downloadResource(config, "user/a.pdf");
  assert.strictEqual(await blob.text(), "pdf");

  mockFetch(function (url, options) {
    assert.strictEqual(options.method, "DELETE");
    return Promise.resolve(fakeResponse(200, ""));
  });
  await Cloud.deleteResource(config, "user/a.pdf");
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
  console.log("ALL CLOUD TESTS PASSED");
})();
