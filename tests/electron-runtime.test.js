"use strict";

const assert = require("assert");
const { execFileSync } = require("child_process");

const electronPath = require("electron");
const output = execFileSync(electronPath, ["--version"], { encoding: "utf8" }).trim();
assert.match(output, /^v\d+\.\d+\.\d+/, "Electron version should be valid");
console.log("PASS electron runtime test (" + output + ")");
