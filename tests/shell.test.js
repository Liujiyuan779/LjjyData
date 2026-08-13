"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const navViews = html.match(/data-view="([a-z]+)"/g) || [];
const viewSections = html.match(/id="view-(home|plan|tests|resources|wrong)"/g) || [];

assert.strictEqual(navViews.length, 5, "sidebar should have 5 nav items");
assert.strictEqual(viewSections.length, 5, "app should have 5 view sections");
assert.ok(html.includes("core.js"), "core.js should be loaded");
assert.ok(html.includes("storage.js"), "storage.js should be loaded");
assert.ok(html.includes("questionBank.js"), "questionBank.js should be loaded");
assert.ok(html.includes("auth.js"), "auth.js should be loaded");
assert.ok(html.includes("cloud.js"), "cloud.js should be loaded");
assert.ok(html.includes("app.js"), "app.js should be loaded");
assert.ok(appJs.includes("window.KaoYanApp"), "app.js should expose KaoYanApp");
assert.ok(appJs.includes("window.App = window.KaoYanApp"), "app.js should expose global App alias");
assert.ok(appJs.includes("VIEW_TITLES"), "app.js should define view titles");
assert.ok(appJs.includes("renderSidebar"), "app.js should render sidebar");
assert.strictEqual(pkg.main, "electron/main.js", "package.json should point to Electron main");
assert.ok(fs.existsSync(path.join(root, "electron/main.js")), "electron main should exist");
assert.ok(fs.existsSync(path.join(root, "electron/preload.js")), "electron preload should exist");
assert.ok(fs.existsSync(path.join(root, "electron/fileService.js")), "electron file service should exist");
assert.ok(!appJs.includes("暂用浏览器存储"), "browser fallback option should be removed from UI");
assert.ok(!appJs.includes("toggleTheme"), "dark theme toggle should be removed");
assert.ok(!html.includes('id="theme-toggle"'), "theme toggle button should be removed");

console.log("ALL SHELL TESTS PASSED");
