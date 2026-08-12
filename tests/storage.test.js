"use strict";

const assert = require("assert");
const Storage = require("../storage.js");

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

function mockDir(name) {
  const files = new Map();
  const dirs = new Map();

  function makeFileHandle(fileName, initial) {
    if (initial) {
      files.set(fileName, initial);
    }
    return {
      kind: "file",
      name: fileName,
      async createWritable() {
        return {
          async write(data) {
            if (typeof data === "string") {
              files.set(fileName, data);
            } else if (data && typeof data.text === "function") {
              files.set(fileName, await data.text());
            } else {
              files.set(fileName, String(data));
            }
          },
          async close() {}
        };
      },
      async getFile() {
        return new Blob([files.get(fileName) || ""], { type: "text/plain" });
      }
    };
  }

  return {
    kind: "directory",
    name: name,
    files: files,
    dirs: dirs,
    async getFileHandle(fileName, opts) {
      if (!files.has(fileName)) {
        if (!opts || !opts.create) {
          throw new Error("File not found: " + fileName);
        }
        files.set(fileName, "");
      }
      return makeFileHandle(fileName);
    },
    async getDirectoryHandle(dirName, opts) {
      if (!dirs.has(dirName)) {
        if (!opts || !opts.create) {
          throw new Error("Directory not found: " + dirName);
        }
        dirs.set(dirName, mockDir(dirName));
      }
      return dirs.get(dirName);
    },
    async removeEntry(name) {
      files.delete(name);
      dirs.delete(name);
      return true;
    },
    async *entries() {
      for (const [key] of files) {
        yield [key, makeFileHandle(key)];
      }
      for (const [key, value] of dirs) {
        yield [key, value];
      }
    }
  };
}

const tests = [];
function test(name, fn) {
  tests.push({ name: name, fn: fn });
}

test("写入 data.json 会清理临时文件", async function () {
  const dir = mockDir("data");
  await Storage.writeDataFile(dir, '{"a":1}');
  assert.strictEqual(await Storage.readDataFile(dir), '{"a":1}');
  assert.ok(!dir.files.has("data.json.tmp"));
});

test("读写文本与二进制文件", async function () {
  const dir = mockDir("resources");
  await Storage.writeText(dir, "note.txt", "hello");
  assert.strictEqual(await Storage.readText(dir, "note.txt"), "hello");
  await Storage.writeBlob(dir, "a.pdf", new Blob(["pdf-body"], { type: "application/pdf" }));
  const blob = await Storage.readBlob(dir, "a.pdf");
  assert.strictEqual(await blob.text(), "pdf-body");
});

test("copyDirectory 递归复制文件", async function () {
  const src = mockDir("src");
  await Storage.writeText(src, "a.txt", "A");
  const sub = await src.getDirectoryHandle("sub", { create: true });
  await Storage.writeText(sub, "b.txt", "B");
  const dest = mockDir("dest");
  await Storage.copyDirectory(src, dest);
  assert.strictEqual(await Storage.readText(dest, "a.txt"), "A");
  const destSub = await dest.getDirectoryHandle("sub");
  assert.strictEqual(await Storage.readText(destSub, "b.txt"), "B");
});

test("backupData 生成带时间戳的备份目录", async function () {
  const dataDir = mockDir("data");
  const state = { version: 1, resources: [{ fileId: "f1.pdf" }] };
  const manifest = { createdAt: "2026-08-12T10:00:00.000Z", fileCount: 1 };
  const resources = await dataDir.getDirectoryHandle("resources", { create: true });
  await Storage.writeText(resources, "f1.pdf", "pdf");
  const destRoot = mockDir("dest");

  await Storage.backupData(dataDir, destRoot, "20260812-100000", state, manifest);

  const backups = await destRoot.getDirectoryHandle("backups");
  const stamp = await backups.getDirectoryHandle("20260812-100000");
  assert.strictEqual(await Storage.readText(stamp, "data.json"), JSON.stringify(state, null, 2));
  assert.ok(await Storage.readText(stamp, "manifest.json"));
  const backupRes = await stamp.getDirectoryHandle("resources");
  assert.strictEqual(await Storage.readText(backupRes, "f1.pdf"), "pdf");
});

test("restoreFromDir 恢复数据并复制资源", async function () {
  const backupDir = mockDir("backup");
  await Storage.writeText(backupDir, "data.json", '{"version":1}');
  const backupRes = await backupDir.getDirectoryHandle("resources", { create: true });
  await Storage.writeText(backupRes, "f1.pdf", "pdf");
  const dataDir = mockDir("data");

  const text = await Storage.restoreFromDir(backupDir, dataDir);
  assert.strictEqual(text, '{"version":1}');
  const destRes = await dataDir.getDirectoryHandle("resources");
  assert.strictEqual(await Storage.readText(destRes, "f1.pdf"), "pdf");
});

test("removeEntry 删除文件和目录", async function () {
  const dir = mockDir("data");
  await Storage.writeText(dir, "old.txt", "old");
  await Storage.writeText(dir, "data.json", "{}");
  assert.strictEqual(await Storage.removeEntry(dir, "old.txt"), true);
  assert.ok(!dir.files.has("old.txt"));
  assert.strictEqual(await Storage.removeEntry(dir, "data.json"), true);
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
  console.log("ALL STORAGE TESTS PASSED");
})();
