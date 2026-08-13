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
  assert(
    await evaluate("!document.getElementById('theme-toggle')"),
    "Theme toggle should be removed"
  );
  assert(
    await evaluate("typeof App.toggleTheme === 'undefined'"),
    "toggleTheme should be removed"
  );

  assert(await evaluate("typeof window.KaoYanApp") === "object", "KaoYanApp should exist");
  assert(await evaluate("typeof window.App") === "object", "window.App should exist");
  assert(await evaluate("'App' in window"), "App should be a window property");
  assert(await evaluate("typeof App.useLocalFallback") === "function", "useLocalFallback should exist");
  assert(await evaluate("typeof App.chooseDataFolder") === "function", "chooseDataFolder should exist");

  assert(
    await evaluate("!document.getElementById('auth-screen').classList.contains('hidden')"),
    "Auth screen should show before login"
  );
  assert(
    await evaluate("!!document.getElementById('auth-forgot-password')"),
    "Forgot password link should exist on login screen"
  );
  await evaluate("document.getElementById('auth-forgot-password').click()");
  assert(
    await evaluate("!!document.getElementById('reset-email')"),
    "Forgot password modal should open"
  );
  await evaluate("App.closeModal()");
  await evaluate("App.showRegister()");
  await evaluate(
    "document.getElementById('auth-register-email').value='user@example.com';" +
    "document.getElementById('auth-register-password').value='abc123';" +
    "document.getElementById('auth-register-secondary').value='246810';" +
    "App.register({preventDefault:function(){}});"
  );
  await sleep(600);
  assert(await evaluate("App.isLoggedIn()"), "User should stay logged in after register");
  assert(
    await evaluate("document.getElementById('auth-screen').classList.contains('hidden')"),
    "Auth screen should hide after login"
  );
  assert(
    await evaluate("!!localStorage.getItem('kaoyan_auth_session_v1')"),
    "Login session should be persisted"
  );

  await evaluate("App.openSetupModal()");
  assert(
    await evaluate("!document.querySelector('[onclick=\"App.useLocalFallback()\"]')"),
    "Setup modal should not contain browser fallback button"
  );

  await evaluate("App.closeModal()");
  await evaluate("App.useLocalFallback()");
  await sleep(400);

  assert(
    await evaluate("document.getElementById('modal-root').innerHTML === ''"),
    "Modal should close after using browser fallback in browser test mode"
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

  const labelsAfterGenerate = await evaluate(
    "Array.from(document.querySelectorAll('.card')).map(function(card){" +
    "var h=card.querySelector('h3'); return h?h.textContent:'';}).join('|')"
  );
  const autoCardLabels = await evaluate(
    "(function(){" +
    "var card=Array.from(document.querySelectorAll('.card')).find(function(c){return c.textContent.indexOf('自动生成模拟卷')>=0;});" +
    "return card?Array.from(card.querySelectorAll('label')).map(function(l){return l.textContent.trim();}).join(','):'';" +
    "})()"
  );
  assert(autoCardLabels.indexOf("题目数量") >= 0, "Auto generate form should keep question count field");
  assert(labelsAfterGenerate.indexOf("联网搜索真题") >= 0, "Search card should stay separate");
  assert(
    await evaluate("document.getElementById('gen-count').value === '3'"),
    "Question count input should keep its value"
  );
  assert(
    await evaluate("document.getElementById('search-keyword').value === '真题 下载'"),
    "Search keyword input should stay in its own card"
  );

  await evaluate(
    "document.getElementById('import-questions').value=" +
    "'科目：数学\\n年份：2024\\n题型：单选\\n题干：Q\\n选项A：a\\n选项B：b\\n答案：B\\n解析：x';" +
    "App.importMockTest({preventDefault:function(){}});"
  );
  await sleep(500);
  const savedAfterImport = await evaluate("localStorage.getItem('kaoyan_app_local_fallback_v1') || ''");
  assert(savedAfterImport.indexOf("导入真题模拟卷") >= 0, "Imported test should be saved");

  await evaluate(
    "document.getElementById('resource-name').value='在线讲义';" +
    "document.getElementById('resource-subject').value='math';" +
    "document.getElementById('resource-type').value='讲义';" +
    "document.getElementById('resource-tags').value='导数';" +
    "document.getElementById('resource-url').value='https://example.com/kaoyan.pdf';" +
    "App.addResource({preventDefault:function(){}});"
  );
  await sleep(500);
  const savedAfterUrl = await evaluate("localStorage.getItem('kaoyan_app_local_fallback_v1') || ''");
  assert(savedAfterUrl.indexOf('"url": "https://example.com/kaoyan.pdf"') >= 0, "URL resource should be saved");
  assert(await evaluate("typeof App.openResourceUrl") === "function", "openResourceUrl should exist");

  assert(await evaluate("typeof App.searchMockTest") === "function", "searchMockTest should exist");
  await evaluate(
    "window.__openedUrl='';" +
    "window.open=function(url){window.__openedUrl=url; return null;};" +
    "App.searchOnline('2024 考研 数学 真题');"
  );
  const openedUrl = await evaluate("window.__openedUrl || ''");
  assert(openedUrl.indexOf("https://www.bing.com/search?q=") === 0, "Search should open Bing URL");

  await evaluate("App.logout()");
  await sleep(200);
  assert(
    await evaluate("!document.getElementById('auth-screen').classList.contains('hidden')"),
    "Auth screen should show after logout"
  );
  assert(await evaluate("App.isLoggedIn() === false"), "User should be logged out");
  assert(
    await evaluate("!localStorage.getItem('kaoyan_auth_session_v1')"),
    "Session should be cleared after logout"
  );

  await evaluate("App.openResetPassword()");
  await evaluate(
    "document.getElementById('reset-email').value='user@example.com';" +
    "document.getElementById('reset-secondary').value='246810';" +
    "document.getElementById('reset-new-password').value='newpass1';" +
    "App.resetPassword({preventDefault:function(){}});"
  );
  await sleep(400);
  await evaluate(
    "document.getElementById('auth-login-email').value='user@example.com';" +
    "document.getElementById('auth-login-password').value='newpass1';" +
    "App.login({preventDefault:function(){}});"
  );
  await sleep(600);
  assert(await evaluate("App.isLoggedIn()"), "User should log in with reset password");

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
