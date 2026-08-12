"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  selectDataDirectory: function () {
    return ipcRenderer.invoke("select-data-directory");
  },
  selectDataFile: function () {
    return ipcRenderer.invoke("select-data-file");
  },
  readText: function (filePath) {
    return ipcRenderer.invoke("file:read-text", filePath);
  },
  writeText: function (filePath, text) {
    return ipcRenderer.invoke("file:write-text", filePath, text);
  },
  writeDataFile: function (dataDir, text) {
    return ipcRenderer.invoke("file:write-data", dataDir, text);
  },
  readDataFile: function (dataDir) {
    return ipcRenderer.invoke("file:read-data", dataDir);
  },
  writeBlob: function (filePath, bytes) {
    return ipcRenderer.invoke("file:write-blob", filePath, bytes);
  },
  readBlob: function (filePath) {
    return ipcRenderer.invoke("file:read-blob", filePath);
  },
  remove: function (targetPath) {
    return ipcRenderer.invoke("file:remove", targetPath);
  },
  exists: function (targetPath) {
    return ipcRenderer.invoke("file:exists", targetPath);
  },
  copyDir: function (srcDir, destDir) {
    return ipcRenderer.invoke("file:copy-dir", srcDir, destDir);
  },
  ensureDir: function (dirPath) {
    return ipcRenderer.invoke("file:ensure-dir", dirPath);
  },
  list: function (dirPath) {
    return ipcRenderer.invoke("file:list", dirPath);
  },
  backup: function (dataDir, destRoot, timestamp, state, manifest) {
    return ipcRenderer.invoke("file:backup", dataDir, destRoot, timestamp, state, manifest);
  },
  restore: function (sourceDir, dataDir) {
    return ipcRenderer.invoke("file:restore", sourceDir, dataDir);
  }
});
