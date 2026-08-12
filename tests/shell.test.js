"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");

const navViews = html.match(/data-view="([a-z]+)"/g) || [];
const viewSections = html.match(/id="view-(home|plan|tests|resources|wrong)"/g) || [];

assert.strictEqual(navViews.length, 5, "sidebar should have 5 nav items");
assert.strictEqual(viewSections.length, 5, "app should have 5 view sections");
assert.ok(html.includes("core.js"), "core.js should be loaded");
assert.ok(html.includes("storage.js"), "storage.js should be loaded");
assert.ok(html.includes("questionBank.js"), "questionBank.js should be loaded");
assert.ok(html.includes("app.js"), "app.js should be loaded");
assert.ok(appJs.includes("window.KaoYanApp"), "app.js should expose KaoYanApp");
assert.ok(appJs.includes("window.App = window.KaoYanApp"), "app.js should expose global App alias");
assert.ok(appJs.includes("VIEW_TITLES"), "app.js should define view titles");
assert.ok(appJs.includes("renderSidebar"), "app.js should render sidebar");

console.log("ALL SHELL TESTS PASSED");
