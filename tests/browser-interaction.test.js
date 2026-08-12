"use strict";

const { spawn, execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.resolve(__dirname, "..");
const serverPort = 8794;
const debugPort = 9224;
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const profile = path.join(os.tmpdir(), "kaoyan-interact-" + Date.now());

let serverProc = null;
let edgeProc = null;

function killTree(proc) {
  if (!proc || proc.pid == null) return;
  try {
    execSync("taskkill /PID " + proc.pid + " /T /F", { stdio: "ignore" });
  } catch (err) {
    // process already exited
  }
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch (err) {
      // retry
    }
    await sleep(300);
  }
  throw new Error("Timed out waiting for " + url);
}

async function waitForJson(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (err) {
      // retry
    }
    await sleep(300);
  }
  throw new Error("Timed out waiting for JSON at " + url);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

async function main() {
  serverProc = spawn("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.join(root, "server.ps1"),
    "-NoBrowser",
    "-Port",
    String(serverPort)
  ], { stdio: "ignore" });

  await waitForHttp("http://127.0.0.1:" + serverPort + "/", 15000);

  edgeProc = spawn(edge, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--remote-allow-origins=*",
    "--remote-debugging-port=" + debugPort,
    "--user-data-dir=" + profile,
    "http://127.0.0.1:" + serverPort + "/"
  ], { stdio: "ignore" });

  const list = await waitForJson("http://127.0.0.1:" + debugPort + "/json/list", 15000);
  const page = list.find(function (target) {
    return target.type === "page" && target.url.indexOf("127.0.0.1:" + serverPort) >= 0;
  });
  assert(page, "No page target found");

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(function (resolve, reject) {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let msgId = 0;
  const pending = new Map();
  ws.onmessage = function (event) {
    const data = JSON.parse(event.data);
    if (!data.id || !pending.has(data.id)) return;
    const handlers = pending.get(data.id);
    pending.delete(data.id);
    if (data.error) {
      handlers.reject(new Error(JSON.stringify(data.error)));
    } else {
      handlers.resolve(data.result);
    }
  };

  function command(method, params) {
    return new Promise(function (resolve, reject) {
      const id = ++msgId;
      pending.set(id, { resolve: resolve, reject: reject });
      ws.send(JSON.stringify({ id: id, method: method, params: params || {} }));
    });
  }

  async function evaluate(expression) {
    const result = await command("Runtime.evaluate", {
      expression: expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (result.exceptionDetails) {
      throw new Error(JSON.stringify(result.exceptionDetails));
    }
    return result.result.value;
  }

  async function waitForTrue(expression, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        if (await evaluate(expression)) return;
      } catch (err) {
        // retry
      }
      await sleep(200);
    }
    throw new Error("Timed out waiting for expression: " + expression);
  }

  await command("Runtime.enable");
  await waitForTrue("typeof window.KaoYanApp === 'object'", 8000);

  assert(await evaluate("typeof window.KaoYanApp") === "object", "KaoYanApp should exist");
  assert(await evaluate("typeof window.App") === "object", "window.App should exist");
  assert(await evaluate("'App' in window"), "App should be a window property");
  assert(await evaluate("typeof App.useLocalFallback") === "function", "useLocalFallback should exist");
  assert(await evaluate("typeof App.chooseDataFolder") === "function", "chooseDataFolder should exist");

  await evaluate("App.openSetupModal()");
  assert(
    await evaluate("!!document.querySelector('[onclick=\"App.useLocalFallback()\"]')"),
    "Setup modal button should be clickable"
  );

  await evaluate("document.querySelector('[onclick=\"App.useLocalFallback()\"]').click()");
  await sleep(400);

  assert(
    await evaluate("document.getElementById('modal-root').innerHTML === ''"),
    "Modal should close after clicking fallback"
  );
  assert(
    await evaluate("!!localStorage.getItem('kaoyan_app_local_fallback_v1')"),
    "Fallback storage should be written"
  );

  await evaluate(
    "document.getElementById('gen-subject').value='math';" +
    "document.getElementById('gen-year').value='2024';" +
    "document.getElementById('gen-count').value='2';" +
    "App.generateMockTest({preventDefault:function(){}});"
  );
  await sleep(500);
  const savedAfterGenerate = await evaluate("localStorage.getItem('kaoyan_app_local_fallback_v1') || ''");
  assert(savedAfterGenerate.indexOf('"generated": true') >= 0, "Generated test should be saved");
  assert(savedAfterGenerate.indexOf('"questions":') >= 0, "Generated test should contain questions");

  await evaluate(
    "document.getElementById('import-questions').value=" +
    "'科目：数学\\n年份：2024\\n题型：单选\\n题干：Q\\n选项A：a\\n选项B：b\\n答案：B\\n解析：x';" +
    "App.importMockTest({preventDefault:function(){}});"
  );
  await sleep(500);
  const savedAfterImport = await evaluate("localStorage.getItem('kaoyan_app_local_fallback_v1') || ''");
  assert(savedAfterImport.indexOf("导入真题模拟卷") >= 0, "Imported test should be saved");

  console.log("PASS browser interaction test");
}

main().catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exitCode = 1;
}).finally(function () {
  killTree(edgeProc);
  killTree(serverProc);
  try {
    fs.rmSync(profile, { recursive: true, force: true });
  } catch (err) {
    // ignore cleanup error
  }
});
