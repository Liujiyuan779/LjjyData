"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const FileService = require("../electron/fileService.js");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "kaoyan-electron-storage-"));
const api = {
  isElectron: true,
  ensureDir: function (p) { return FileService.ensureDir(p); },
  exists: function (p) { return FileService.exists(p); },
  readText: function (p) { return FileService.readText(p); },
  writeText: function (p, t) { return FileService.writeText(p, t); },
  writeDataFile: function (d, t) { return FileService.writeDataFile(d, t); },
  readDataFile: function (d) { return FileService.readDataFile(d); },
  writeBlob: function (p, b) { return FileService.writeBytes(p, b); },
  readBlob: function (p) { return FileService.readBytes(p); },
  remove: function (p) { return FileService.removePath(p); },
  copyDir: function (s, d) { return FileService.copyDir(s, d); },
  list: function (d) { return FileService.listFiles(d); },
  backup: function () { return FileService.backupData.apply(null, arguments); },
  restore: function () { return FileService.restoreFromDir.apply(null, arguments); },
  selectDataDirectory: async function () { return null; },
  selectDataFile: async function () { return null; }
};

global.window = { electronAPI: api };
const Storage = require("../storage.js");

let failed = false;
const tests = [];
function test(name, fn) {
  tests.push({ name: name, fn: fn });
}

test("Electron 模式下 Storage 使用原生文件接口", async function () {
  assert.strictEqual(Storage.isElectronMode(), true);
  assert.strictEqual(await Storage.requestPermission("C:\\data"), "granted");
  assert.strictEqual(Storage.displayName("C:\\data\\我的数据"), "我的数据");
});

test("Electron 模式下写入和读取 data.json", async function () {
  const dir = path.join(root, "data");
  await Storage.writeDataFile(dir, '{"version":1}');
  assert.strictEqual(await Storage.readDataFile(dir), '{"version":1}');
});

test("Electron 模式下保存和读取资源文件", async function () {
  const dir = await Storage.getSubdir(path.join(root, "resources"), "pdf", true);
  await Storage.writeBlob(dir, "a.pdf", new Blob(["pdf-body"], { type: "application/pdf" }));
  const blob = await Storage.readBlob(dir, "a.pdf");
  assert.strictEqual(await blob.text(), "pdf-body");
});

test("Electron 模式下备份与恢复", async function () {
  const dataDir = path.join(root, "backup-data");
  await Storage.writeDataFile(dataDir, '{"version":1}');
  const resDir = await Storage.getSubdir(dataDir, "resources", true);
  await Storage.writeText(resDir, "f1.pdf", "pdf");
  const destRoot = path.join(root, "backup-dest");
  await Storage.backupData(dataDir, destRoot, "20260812-100000", { version: 1 }, { createdAt: "x" });
  const restoreDir = path.join(root, "restored");
  const text = await Storage.restoreFromDir(path.join(destRoot, "backups", "20260812-100000"), restoreDir);
  assert.strictEqual(JSON.parse(text).version, 1);
  assert.strictEqual(await Storage.readText(path.join(restoreDir, "resources"), "f1.pdf"), "pdf");
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
  try {
    fs.rmSync(root, { recursive: true, force: true });
  } catch (err) {
    // ignore cleanup failure
  }
  if (failed) {
    process.exit(1);
  }
  console.log("ALL ELECTRON STORAGE TESTS PASSED");
})();
