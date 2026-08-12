(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.KaoYanStorage = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function isElectronMode() {
    return typeof window !== "undefined" && !!window.electronAPI;
  }

  function joinPath(dir, name) {
    if (!dir) return String(name || "");
    const base = String(dir).replace(/[\\/]+$/, "");
    const sep = base.indexOf("\\") >= 0 ? "\\" : "/";
    return base + sep + String(name || "");
  }

  function isSupported() {
    if (isElectronMode()) return true;
    return typeof window !== "undefined" &&
      typeof window.showDirectoryPicker === "function";
  }

  async function pickDirectory() {
    if (isElectronMode()) {
      return await window.electronAPI.selectDataDirectory();
    }
    if (typeof window !== "undefined" && typeof window.showDirectoryPicker === "function") {
      return await window.showDirectoryPicker({ mode: "readwrite" });
    }
    return null;
  }

  async function pickDataFile() {
    if (isElectronMode()) {
      return await window.electronAPI.selectDataFile();
    }
    if (typeof window !== "undefined" && typeof window.showOpenFilePicker === "function") {
      const handles = await window.showOpenFilePicker({
        types: [{ description: "data.json", accept: { "application/json": [".json"] } }],
        multiple: false
      });
      return handles[0];
    }
    return null;
  }

  function displayName(handle) {
    if (isElectronMode()) {
      return String(handle || "").split(/[\\/]/).pop() || "本地数据文件夹";
    }
    return handle && handle.name ? handle.name : "本地数据文件夹";
  }

  async function requestPermission(handle) {
    if (isElectronMode()) return "granted";
    if (handle && typeof handle.requestPermission === "function") {
      return await handle.requestPermission({ mode: "readwrite" });
    }
    return "denied";
  }

  async function getSubdir(dir, name, create) {
    if (isElectronMode()) {
      const target = joinPath(dir, name);
      if (create) {
        await window.electronAPI.ensureDir(target);
        return target;
      }
      if (!(await window.electronAPI.exists(target))) {
        return null;
      }
      return target;
    }
    if (create) {
      return await dir.getDirectoryHandle(name, { create: true });
    }
    try {
      return await dir.getDirectoryHandle(name);
    } catch (err) {
      return null;
    }
  }

  async function listEntries(dir) {
    if (isElectronMode()) {
      return (await window.electronAPI.list(dir)).sort();
    }
    const names = [];
    for await (const entry of dir.entries()) {
      names.push(entry[0]);
    }
    return names.sort();
  }

  async function readText(dir, name) {
    if (isElectronMode()) {
      return await window.electronAPI.readText(joinPath(dir, name));
    }
    const handle = await dir.getFileHandle(name);
    const file = await handle.getFile();
    return await file.text();
  }

  async function writeText(dir, name, text) {
    if (isElectronMode()) {
      return await window.electronAPI.writeText(joinPath(dir, name), text);
    }
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
  }

  async function readBlob(dir, name) {
    if (isElectronMode()) {
      const bytes = await window.electronAPI.readBlob(joinPath(dir, name));
      return new Blob([bytes]);
    }
    const handle = await dir.getFileHandle(name);
    return await handle.getFile();
  }

  async function writeBlob(dir, name, blob) {
    if (isElectronMode()) {
      const buffer = await blob.arrayBuffer();
      return await window.electronAPI.writeBlob(joinPath(dir, name), new Uint8Array(buffer));
    }
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  }

  async function removeEntry(dir, name) {
    if (isElectronMode()) {
      await window.electronAPI.remove(joinPath(dir, name));
      return true;
    }
    try {
      await dir.removeEntry(name, { recursive: true });
      return true;
    } catch (err) {
      return false;
    }
  }

  async function copyFile(handle, destDir, name) {
    const file = await handle.getFile();
    await writeBlob(destDir, name, file);
  }

  async function copyDirectory(srcDir, destDir) {
    if (isElectronMode()) {
      return await window.electronAPI.copyDir(srcDir, destDir);
    }
    for await (const entry of srcDir.entries()) {
      const name = entry[0];
      const handle = entry[1];
      if (handle.kind === "file") {
        await copyFile(handle, destDir, name);
      } else {
        const sub = await destDir.getDirectoryHandle(name, { create: true });
        await copyDirectory(handle, sub);
      }
    }
  }

  async function writeDataFile(dataDir, text) {
    if (isElectronMode()) {
      return await window.electronAPI.writeDataFile(dataDir, text);
    }
    await writeText(dataDir, "data.json.tmp", text);
    await writeText(dataDir, "data.json", text);
    await removeEntry(dataDir, "data.json.tmp");
  }

  async function readDataFile(dataDir) {
    if (isElectronMode()) {
      return await window.electronAPI.readDataFile(dataDir);
    }
    return await readText(dataDir, "data.json");
  }

  async function backupData(dataDir, destRoot, timestamp, state, manifest) {
    if (isElectronMode()) {
      return await window.electronAPI.backup(dataDir, destRoot, timestamp, state, manifest);
    }
    const backupsDir = await getSubdir(destRoot, "backups", true);
    const stampDir = await backupsDir.getDirectoryHandle(timestamp, { create: true });
    await writeText(stampDir, "manifest.json", JSON.stringify(manifest, null, 2));
    await writeText(stampDir, "data.json", JSON.stringify(state, null, 2));
    const srcRes = await getSubdir(dataDir, "resources", false);
    if (srcRes) {
      const destRes = await stampDir.getDirectoryHandle("resources", { create: true });
      await copyDirectory(srcRes, destRes);
    }
    return stampDir;
  }

  async function restoreFromDir(sourceDir, dataDir) {
    if (isElectronMode()) {
      return await window.electronAPI.restore(sourceDir, dataDir);
    }
    const text = await readDataFile(sourceDir);
    const srcRes = await getSubdir(sourceDir, "resources", false);
    if (srcRes) {
      const destRes = await getSubdir(dataDir, "resources", true);
      await copyDirectory(srcRes, destRes);
    }
    return text;
  }

  async function clearBackupDir(dataDir) {
    await removeEntry(dataDir, "backups");
  }

  async function readFileText(fullPath) {
    if (isElectronMode()) {
      return await window.electronAPI.readText(fullPath);
    }
    throw new Error("readFileText 仅用于 Electron 模式");
  }

  return {
    backupData: backupData,
    clearBackupDir: clearBackupDir,
    copyDirectory: copyDirectory,
    displayName: displayName,
    getSubdir: getSubdir,
    isElectronMode: isElectronMode,
    isSupported: isSupported,
    listEntries: listEntries,
    pickDataFile: pickDataFile,
    pickDirectory: pickDirectory,
    readBlob: readBlob,
    readDataFile: readDataFile,
    readFileText: readFileText,
    readText: readText,
    removeEntry: removeEntry,
    requestPermission: requestPermission,
    restoreFromDir: restoreFromDir,
    writeBlob: writeBlob,
    writeDataFile: writeDataFile,
    writeText: writeText
  };
});
