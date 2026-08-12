"use strict";

const fs = require("fs");
const path = require("path");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeText(filePath, text) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, text, "utf8");
}

function writeDataFile(dataDir, text) {
  ensureDir(dataDir);
  const tmpPath = path.join(dataDir, "data.json.tmp");
  const finalPath = path.join(dataDir, "data.json");
  fs.writeFileSync(tmpPath, text, "utf8");
  fs.writeFileSync(finalPath, text, "utf8");
  if (fs.existsSync(tmpPath)) {
    fs.unlinkSync(tmpPath);
  }
}

function readDataFile(dataDir) {
  return readText(path.join(dataDir, "data.json"));
}

function writeBytes(filePath, bytes) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, Buffer.from(bytes));
}

function readBytes(filePath) {
  return new Uint8Array(fs.readFileSync(filePath));
}

function removePath(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function exists(targetPath) {
  return fs.existsSync(targetPath);
}

function copyDir(srcDir, destDir) {
  fs.cpSync(srcDir, destDir, { recursive: true, force: true });
}

function listFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath);
}

function backupData(dataDir, destRoot, timestamp, state, manifest) {
  const backupsDir = ensureDir(path.join(destRoot, "backups"));
  const stampDir = ensureDir(path.join(backupsDir, timestamp));
  writeText(path.join(stampDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  writeText(path.join(stampDir, "data.json"), JSON.stringify(state, null, 2));
  const srcResources = path.join(dataDir, "resources");
  if (fs.existsSync(srcResources)) {
    copyDir(srcResources, path.join(stampDir, "resources"));
  }
  return stampDir;
}

function restoreFromDir(sourceDir, dataDir) {
  const text = readDataFile(sourceDir);
  ensureDir(dataDir);
  const srcResources = path.join(sourceDir, "resources");
  if (fs.existsSync(srcResources)) {
    copyDir(srcResources, path.join(dataDir, "resources"));
  }
  return text;
}

module.exports = {
  backupData: backupData,
  copyDir: copyDir,
  ensureDir: ensureDir,
  exists: exists,
  listFiles: listFiles,
  readBytes: readBytes,
  readDataFile: readDataFile,
  readText: readText,
  removePath: removePath,
  restoreFromDir: restoreFromDir,
  writeBytes: writeBytes,
  writeDataFile: writeDataFile,
  writeText: writeText
};
