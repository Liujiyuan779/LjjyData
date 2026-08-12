"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const FileService = require("../electron/fileService.js");

let failed = false;

function test(name, fn) {
  try {
    fn();
    console.log("PASS " + name);
  } catch (err) {
    failed = true;
    console.error("FAIL " + name);
    console.error(err && err.stack ? err.stack : err);
  }
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "kaoyan-fs-"));

test("writeDataFile 写入 data.json 并清理临时文件", function () {
  const dataDir = path.join(root, "data");
  FileService.writeDataFile(dataDir, '{"version":1}');
  assert.strictEqual(FileService.readDataFile(dataDir), '{"version":1}');
  assert.strictEqual(fs.existsSync(path.join(dataDir, "data.json.tmp")), false);
});

test("writeBytes/readBytes 二进制往返", function () {
  const filePath = path.join(root, "a.pdf");
  FileService.writeBytes(filePath, new Uint8Array([1, 2, 3]));
  assert.deepStrictEqual(Array.from(FileService.readBytes(filePath)), [1, 2, 3]);
});

test("copyDir 递归复制目录", function () {
  const src = path.join(root, "src");
  FileService.writeText(path.join(src, "a.txt"), "A");
  const dest = path.join(root, "dest");
  FileService.copyDir(src, dest);
  assert.strictEqual(FileService.readText(path.join(dest, "a.txt")), "A");
});

test("backupData 和 restoreFromDir 备份恢复", function () {
  const dataDir = path.join(root, "backup-data");
  FileService.writeDataFile(dataDir, '{"version":1}');
  FileService.writeText(path.join(dataDir, "resources", "f1.pdf"), "pdf");
  const destRoot = path.join(root, "backup-dest");
  const state = { version: 1 };
  const manifest = { createdAt: "2026-08-12T10:00:00.000Z" };
  const stamp = FileService.backupData(dataDir, destRoot, "20260812-100000", state, manifest);
  assert.strictEqual(FileService.readText(path.join(stamp, "data.json")), JSON.stringify(state, null, 2));

  const restoreDir = path.join(root, "restored");
  const text = FileService.restoreFromDir(stamp, restoreDir);
  assert.strictEqual(text, JSON.stringify(state, null, 2));
  assert.strictEqual(FileService.readText(path.join(restoreDir, "resources", "f1.pdf")), "pdf");
});

test("removePath 删除文件", function () {
  const filePath = path.join(root, "delete-me.txt");
  FileService.writeText(filePath, "x");
  FileService.removePath(filePath);
  assert.strictEqual(fs.existsSync(filePath), false);
});

try {
  fs.rmSync(root, { recursive: true, force: true });
} catch (err) {
  // cleanup failure should not fail tests
}

if (failed) {
  process.exit(1);
}
console.log("ALL ELECTRON FILE SERVICE TESTS PASSED");
