(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.KaoYanStorage = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function isSupported() {
    return typeof window !== "undefined" &&
      typeof window.showDirectoryPicker === "function";
  }

  async function getSubdir(dir, name, create) {
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
    const names = [];
    for await (const entry of dir.entries()) {
      names.push(entry[0]);
    }
    return names.sort();
  }

  async function readText(dir, name) {
    const handle = await dir.getFileHandle(name);
    const file = await handle.getFile();
    return await file.text();
  }

  async function writeText(dir, name, text) {
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
  }

  async function readBlob(dir, name) {
    const handle = await dir.getFileHandle(name);
    return await handle.getFile();
  }

  async function writeBlob(dir, name, blob) {
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  }

  async function removeEntry(dir, name) {
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
    await writeText(dataDir, "data.json.tmp", text);
    await writeText(dataDir, "data.json", text);
    await removeEntry(dataDir, "data.json.tmp");
  }

  async function readDataFile(dataDir) {
    return await readText(dataDir, "data.json");
  }

  async function backupData(dataDir, destRoot, timestamp, state, manifest) {
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

  return {
    backupData: backupData,
    clearBackupDir: clearBackupDir,
    copyDirectory: copyDirectory,
    getSubdir: getSubdir,
    isSupported: isSupported,
    listEntries: listEntries,
    readBlob: readBlob,
    readDataFile: readDataFile,
    readText: readText,
    removeEntry: removeEntry,
    restoreFromDir: restoreFromDir,
    writeBlob: writeBlob,
    writeDataFile: writeDataFile,
    writeText: writeText
  };
});
