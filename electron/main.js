"use strict";

const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fileService = require("./fileService");

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    autoHideMenuBar: true,
    backgroundColor: "#f3efe4",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, "..", "index.html"));
}

function registerIpc() {
  ipcMain.handle("select-data-directory", async function () {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "选择数据文件夹",
      properties: ["openDirectory", "createDirectory"]
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("select-data-file", async function () {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "选择 data.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
      properties: ["openFile"]
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("file:read-text", function (_event, filePath) {
    return fileService.readText(filePath);
  });

  ipcMain.handle("file:write-text", function (_event, filePath, text) {
    fileService.writeText(filePath, text);
  });

  ipcMain.handle("file:write-data", function (_event, dataDir, text) {
    fileService.writeDataFile(dataDir, text);
  });

  ipcMain.handle("file:read-data", function (_event, dataDir) {
    return fileService.readDataFile(dataDir);
  });

  ipcMain.handle("file:write-blob", function (_event, filePath, bytes) {
    fileService.writeBytes(filePath, bytes);
  });

  ipcMain.handle("file:read-blob", function (_event, filePath) {
    return fileService.readBytes(filePath);
  });

  ipcMain.handle("file:remove", function (_event, targetPath) {
    fileService.removePath(targetPath);
  });

  ipcMain.handle("file:exists", function (_event, targetPath) {
    return fileService.exists(targetPath);
  });

  ipcMain.handle("file:copy-dir", function (_event, srcDir, destDir) {
    fileService.copyDir(srcDir, destDir);
  });

  ipcMain.handle("file:ensure-dir", function (_event, dirPath) {
    return fileService.ensureDir(dirPath);
  });

  ipcMain.handle("file:list", function (_event, dirPath) {
    return fileService.listFiles(dirPath);
  });

  ipcMain.handle("file:backup", function (_event, dataDir, destRoot, timestamp, state, manifest) {
    return fileService.backupData(dataDir, destRoot, timestamp, state, manifest);
  });

  ipcMain.handle("file:restore", function (_event, sourceDir, dataDir) {
    return fileService.restoreFromDir(sourceDir, dataDir);
  });
}

app.whenReady().then(function () {
  registerIpc();
  createWindow();
  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
