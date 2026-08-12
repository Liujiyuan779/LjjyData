(function () {
  "use strict";

  const Core = window.KaoYanCore;
  const Storage = window.KaoYanStorage;
  const QuestionBank = window.KaoYanQuestionBank;
  const SAVE_KEY = "kaoyan_app_local_fallback_v1";
  const HANDLE_DB = "kaoyan_handle_db";
  const HANDLE_STORE = "handles";

  let state = loadFallbackState();
  let currentView = "home";
  let dataDirHandle = null;
  let storageMode = "local";
  let saveTimer = null;
  let saveQueue = Promise.resolve();
  let selectedPlanDate = Core.todayISO();
  let testTimerInterval = null;
  let testRemaining = 0;
  let activeTestId = null;
  let currentQuestionIndex = 0;
  let resourceQuery = "";
  let resourceSubjectFilter = "all";
  let resourceTypeFilter = "all";
  let wrongQuery = "";
  let wrongSubjectFilter = "all";
  let wrongStatusFilter = "all";
  let reviewQueue = [];
  let reviewIndex = 0;

  const VIEW_TITLES = {
    home: "首页总览",
    plan: "今日计划",
    tests: "模拟测试",
    resources: "电子资料",
    wrong: "错题本"
  };

  function loadFallbackState() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = Core.parseState(raw);
        if (parsed.ok) {
          return parsed.state;
        }
      }
    } catch (err) {
      // fall through to defaults
    }
    const fresh = Core.defaultState();
    saveFallback(fresh);
    return fresh;
  }

  function saveFallback(s) {
    try {
      localStorage.setItem(SAVE_KEY, Core.serializeState(s));
    } catch (err) {
      // storage may be unavailable
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 250);
  }

  async function saveNow() {
    const task = saveQueue.then(async function () {
      try {
        if (dataDirHandle) {
          await Storage.writeDataFile(dataDirHandle, Core.serializeState(state));
        } else {
          saveFallback(state);
        }
      } catch (err) {
        toast("保存失败：" + err.message);
      }
    });
    saveQueue = task.catch(function () {});
    await task;
  }

  function commit() {
    state.updatedAt = Core.nowISO();
    scheduleSave();
    render();
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toast(message) {
    const el = document.getElementById("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      el.classList.remove("show");
    }, 2200);
  }

  function openModal(title, body, canClose) {
    const root = document.getElementById("modal-root");
    const closeBtn = canClose === false ? "" :
      '<button class="icon-btn" onclick="App.closeModal()" title="关闭">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M6 6l12 12"/><path d="M18 6 6 18"/></svg></button>';
    root.innerHTML = '<div class="modal-backdrop"><div class="modal">' +
      '<div class="modal-head"><h2 class="modal-title">' + esc(title) + "</h2>" + closeBtn + "</div>" +
      body + "</div></div>";
  }

  function closeModal() {
    document.getElementById("modal-root").innerHTML = "";
  }

  function openHandleDb() {
    return new Promise(function (resolve, reject) {
      if (!("indexedDB" in window)) {
        reject(new Error("IndexedDB unavailable"));
        return;
      }
      const req = indexedDB.open(HANDLE_DB, 1);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains(HANDLE_STORE)) {
          req.result.createObjectStore(HANDLE_STORE);
        }
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  }

  async function saveHandle(handle) {
    const db = await openHandleDb();
    await new Promise(function (resolve, reject) {
      const tx = db.transaction(HANDLE_STORE, "readwrite");
      tx.objectStore(HANDLE_STORE).put(handle, "dataDir");
      tx.oncomplete = resolve;
      tx.onerror = function () {
        reject(tx.error);
      };
    });
  }

  async function loadHandle() {
    const db = await openHandleDb();
    return await new Promise(function (resolve, reject) {
      const tx = db.transaction(HANDLE_STORE, "readonly");
      const req = tx.objectStore(HANDLE_STORE).get("dataDir");
      req.onsuccess = function () {
        resolve(req.result || null);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  }

  async function clearHandle() {
    const db = await openHandleDb();
    await new Promise(function (resolve, reject) {
      const tx = db.transaction(HANDLE_STORE, "readwrite");
      tx.objectStore(HANDLE_STORE).delete("dataDir");
      tx.oncomplete = resolve;
      tx.onerror = function () {
        reject(tx.error);
      };
    });
  }

  async function connectToHandle(handle) {
    try {
      const permission = await handle.requestPermission({ mode: "readwrite" });
      if (permission !== "granted") {
        openSetupModal();
        return;
      }
      dataDirHandle = handle;
      storageMode = "file";
      await saveHandle(handle);
      await loadDataFromDir();
      closeModal();
      render();
      toast("数据已连接到本地文件夹");
    } catch (err) {
      toast("无法使用该文件夹：" + err.message);
    }
  }

  async function loadDataFromDir() {
    try {
      const text = await Storage.readDataFile(dataDirHandle);
      const parsed = Core.parseState(text);
      if (parsed.ok) {
        state = parsed.state;
        return;
      }
    } catch (err) {
      // no data.json yet, create it below
    }
    state = Core.defaultState();
    await Storage.writeDataFile(dataDirHandle, Core.serializeState(state));
  }

  function openSetupModal() {
    openModal(
      "选择数据文件夹",
      '<p class="muted">首次使用请选择一个本地文件夹，APP 会把数据和资料保存在里面。</p>' +
      '<div class="modal-actions">' +
      '<button class="btn" onclick="App.useLocalFallback()">暂用浏览器存储</button>' +
      '<button class="btn primary" onclick="App.chooseDataFolder()">选择数据文件夹</button>' +
      "</div>",
      false
    );
  }

  function render() {
    document.querySelectorAll(".nav-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.view === currentView);
    });
    document.querySelectorAll(".view").forEach(function (view) {
      view.classList.toggle("active", view.id === "view-" + currentView);
    });
    document.getElementById("view-title").textContent = VIEW_TITLES[currentView];
    document.getElementById("top-date").textContent = new Date().toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long"
    });
    renderSidebar();
    renderHome();
    renderPlan();
    renderTests();
    renderResources();
    renderWrong();
  }

  function renderSidebar() {
    const days = Core.daysUntil(state.settings.examDate);
    const location = dataDirHandle ? dataDirHandle.name : "浏览器内置存储";
    document.getElementById("sidebar-countdown").innerHTML =
      '<div>距 ' + esc(state.settings.examName) + '</div>' +
      '<strong>' + Math.max(0, days) + ' 天</strong>' +
      '<div>数据位置：' + esc(location) + "</div>";
  }

  function placeholder(title) {
    return '<div class="empty">' + esc(title) + " 模块开发中</div>";
  }

  function subjectById(id) {
    return state.subjects.find(function (s) {
      return s.id === id;
    }) || null;
  }

  function subjectOptions(selected) {
    return state.subjects.map(function (s) {
      return '<option value="' + esc(s.id) + '"' + (s.id === selected ? " selected" : "") + ">" +
        esc(s.name) + "</option>";
    }).join("");
  }

  function priorityName(priority) {
    return priority === "high" ? "高" : priority === "low" ? "低" : "中";
  }

  function taskRow(plan) {
    const subject = subjectById(plan.subjectId);
    return '<div class="task-row' + (plan.done ? " done" : "") + '">' +
      '<input type="checkbox" class="task-check" ' + (plan.done ? "checked" : "") +
        " onchange=\"App.togglePlan('" + plan.id + "')\">" +
      '<div class="task-main">' +
        '<div class="task-title">' + esc(plan.title) + "</div>" +
        '<div class="task-meta">' +
          (subject
            ? '<span class="tag solid" style="background:' + subject.color + '">' + esc(subject.name) + "</span>"
            : "") +
          '<span class="tag priority-' + plan.priority + '">' + priorityName(plan.priority) + "</span>" +
          (plan.time ? "<span>" + esc(plan.time) + "</span>" : "") +
        "</div>" +
      "</div>" +
      '<button class="icon-btn danger" onclick="App.deletePlan(\'' + plan.id + '\')" title="删除">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 15H6L5 6"/></svg>' +
      "</button>" +
    "</div>";
  }

  function statItem(label, value) {
    return '<div class="stat"><div class="stat-label">' + esc(label) + '</div><div class="stat-value">' +
      esc(String(value)) + "</div></div>";
  }

  function scoreRate(test) {
    if (test.target > 0) {
      return Math.round((Number(test.score) / Number(test.target)) * 100);
    }
    return test.total > 0 ? Math.round((Number(test.score) / Number(test.total)) * 100) : 0;
  }

  function shortName(name, max) {
    const text = String(name || "");
    return text.length > max ? text.slice(0, max) + "…" : text;
  }

  function testRow(test) {
    const subject = subjectById(test.subjectId);
    const color = subject ? subject.color : "var(--accent)";
    return '<div class="test-row">' +
      '<div class="test-icon" style="background:' + color + "22;color:" + color + '">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M4 8h16"/><path d="m9 13 2 2 4-5"/></svg>' +
      "</div>" +
      '<div class="test-main">' +
        '<div class="test-name">' + esc(test.name) +
          (test.generated
            ? ' <span class="tag solid" style="background:var(--accent)">' + esc(test.sourceLabel || "自动组卷") + "</span>"
            : "") +
        "</div>" +
        '<div class="test-meta">' +
          (subject ? esc(subject.name) + " · " : "") +
          esc(Core.formatDateCN(test.date)) + " · " + test.duration + " 分钟 · 满分 " + test.total +
          (test.questions ? " · " + test.questions.length + " 题" : "") +
        "</div>" +
        (test.notes ? '<div class="test-meta">' + esc(test.notes) + "</div>" : "") +
      "</div>" +
      '<div class="test-actions">' +
        (test.status === "planned"
          ? '<button class="btn primary" onclick="App.startTest(\'' + test.id + '\')">' +
            (test.questions ? "开始答题" : "开始模拟") + "</button>"
          : '<div style="text-align:right">' +
              '<div class="score-badge">' + esc(String(test.score)) + '<span class="muted"> / ' + test.total + "</span></div>" +
              '<div class="score-line"><span>目标 ' + test.target + "</span><span>达成率 " + scoreRate(test) + "%</span></div>" +
              (test.questions
                ? '<button class="btn small" style="margin-top:6px" onclick="App.viewTestResult(\'' + test.id + '\')">查看结果</button>'
                : "") +
            "</div>") +
        '<button class="icon-btn danger" onclick="App.deleteTest(\'' + test.id + '\')" title="删除">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 15H6L5 6"/></svg>' +
        "</button>" +
      "</div>" +
    "</div>";
  }

  function testChart(recent) {
    const max = Math.max.apply(null, recent.map(function (t) {
      return Number(t.score) || 0;
    }).concat([1]));
    return '<div class="bar-chart">' +
      recent.map(function (t) {
        const subject = subjectById(t.subjectId);
        const color = subject ? subject.color : "var(--accent)";
        const height = Math.max(5, Math.round((Number(t.score) / max) * 100));
        return '<div class="bar-col">' +
          '<div class="bar-track"><div class="bar" style="height:' + height + '%;background:' + color + '"></div></div>' +
          '<span class="bar-label">' + esc(shortName(t.name, 6)) + "</span>" +
          '<span class="bar-score">' + esc(String(t.score)) + "</span>" +
        "</div>";
      }).join("") +
    "</div>";
  }

  function resourceTypeOptions(selected) {
    return ["教材", "真题", "网课", "讲义", "笔记", "其他"].map(function (type) {
      return '<option value="' + type + '"' + (type === selected ? " selected" : "") + ">" + type + "</option>";
    }).join("");
  }

  function resourceRow(resource) {
    const subject = subjectById(resource.subjectId);
    const color = subject ? subject.color : "var(--accent)";
    return '<div class="resource-row">' +
      '<div class="file-icon" style="background:' + color + "22;color:" + color + '">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M13 2v7h7"/></svg>' +
      "</div>" +
      '<div class="resource-main">' +
        '<div class="resource-name">' + esc(resource.name) + " " +
          (resource.fileId
            ? '<span class="tag solid" style="background:var(--accent)">有文件</span>'
            : '<span class="tag">纯登记</span>') +
        "</div>" +
        '<div class="resource-meta">' +
          (subject ? esc(subject.name) + " · " : "") +
          esc(resource.type) + " · " +
          (resource.size ? Core.formatBytes(resource.size) + " · " : "") +
          esc(Core.formatDateCN(resource.createdAt.slice(0, 10))) +
          (resource.tags ? " · " + esc(resource.tags) : "") +
          (resource.url ? " · " + esc(shortName(resource.url, 40)) : "") +
        "</div>" +
      "</div>" +
      '<div class="resource-actions">' +
        (resource.url
          ? '<button class="btn" onclick="App.openResourceUrl(\'' + resource.id + '\')">打开链接</button>'
          : "") +
        (resource.fileId
          ? '<button class="btn" onclick="App.openResource(\'' + resource.id + '\')">打开</button>'
          : "") +
        '<button class="icon-btn danger" onclick="App.deleteResource(\'' + resource.id + '\')" title="删除">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 15H6L5 6"/></svg>' +
        "</button>" +
      "</div>" +
    "</div>";
  }

  function wrongStatusName(status) {
    return status === "todo" ? "待复习" : status === "reviewing" ? "复习中" : "已掌握";
  }

  function wrongDueText(question) {
    if (question.status === "mastered") return "已掌握";
    const today = Core.todayISO();
    if (question.dueDate <= today) return "今天待复习";
    return "下次 " + Core.formatDateCN(question.dueDate);
  }

  function wrongRow(question) {
    const subject = subjectById(question.subjectId);
    const color = subject ? subject.color : "var(--accent)";
    return '<div class="wrong-card">' +
      '<div class="wrong-top">' +
        '<div class="wrong-tags">' +
          (subject
            ? '<span class="tag solid" style="background:' + color + '">' + esc(subject.name) + "</span>"
            : "") +
          '<span class="tag priority-' + (question.status === "mastered" ? "low" : "medium") + '">' +
            wrongStatusName(question.status) + "</span>" +
          '<span class="tag">难度 ' + question.difficulty + "</span>" +
        "</div>" +
        '<button class="icon-btn danger" onclick="App.deleteWrong(\'' + question.id + '\')" title="删除">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 15H6L5 6"/></svg>' +
        "</button>" +
      "</div>" +
      '<div class="wrong-question">' + esc(question.question) + "</div>" +
      '<div class="wrong-meta">' +
        (question.source ? esc(question.source) + " · " : "") +
        wrongDueText(question) +
        (question.tags ? " · " + esc(question.tags) : "") +
      "</div>" +
      '<button class="link-btn" id="wrong-toggle-' + question.id + '" onclick="App.toggleWrongDetail(\'' + question.id + '\')">查看解析</button>' +
      '<div class="hidden" id="wrong-detail-' + question.id + '">' +
        '<div class="answer-box"><b>我的答案：</b>' + esc(question.myAnswer || "未填写") + "</div>" +
        '<div class="answer-box"><b>正确答案：</b>' + esc(question.correctAnswer || "未填写") + "</div>" +
        (question.analysis
          ? '<div class="answer-box"><b>解析：</b>' + esc(question.analysis) + "</div>"
          : "") +
      "</div>" +
    "</div>";
  }

  function renderHome() {
    const digest = Core.homeDigest(state);
    const hour = new Date().getHours();
    const greeting = hour < 6 ? "夜深了" : hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好";
    const nextTask = digest.plan.next;
    const latestMemo = digest.memos[0];
    const location = dataDirHandle ? dataDirHandle.name : "浏览器内置存储";

    document.getElementById("view-home").innerHTML =
      '<div class="countdown-card">' +
        "<div>" +
          '<div class="countdown-label">距 ' + esc(digest.examName) + "</div>" +
          '<div class="countdown-num">' + Math.max(0, digest.days) + ' <span>天</span></div>' +
          '<div class="countdown-sub">' + esc(Core.formatDateCN(digest.examDate)) + " · 数据位置 " + esc(location) + "</div>" +
        "</div>" +
        '<div class="countdown-side">' +
          "<div>今日计划</div>" +
          "<b>" + digest.plan.done + " / " + digest.plan.total + "</b>" +
          "<div>待复习错题</div>" +
          "<b>" + digest.wrongDue + " 道</b>" +
        "</div>" +
      "</div>" +
      '<div class="grid grid-3">' +
        '<div class="card">' +
          '<div class="card-head"><h3>今日计划</h3>' +
            '<button class="btn small" onclick="App.setView(\'plan\')">查看全部</button></div>' +
          '<div class="big-number">' + digest.plan.done + '<span> / ' + digest.plan.total + ' 完成</span></div>' +
          '<div class="progress"><span style="width:' + digest.plan.rate + '%"></span></div>' +
          "<div class=\"muted\">" +
            (nextTask
              ? "下一个：" + esc(nextTask.time || "自由时间") + " " + esc(nextTask.title)
              : "今天没有未完成任务") +
          "</div>" +
        "</div>" +
        '<div class="card">' +
          '<div class="card-head"><h3>快速备忘</h3></div>' +
          '<div class="memo-input-row">' +
            '<input id="memo-input" class="input" placeholder="写一条备忘" maxlength="120">' +
            '<button class="icon-btn primary" onclick="App.addMemo()" title="添加">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>' +
            "</button>" +
          "</div>" +
          '<div class="memo-list">' +
            (digest.memos.slice(0, 3).map(function (memo) {
              return '<div class="memo-item"><span>' + esc(memo.text) + "</span>" +
                '<button class="icon-btn danger" style="width:28px;height:28px;flex-basis:28px" onclick="App.deleteMemo(\'' + memo.id + '\')" title="删除">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 15H6L5 6"/></svg>' +
                "</button></div>";
            }).join("") || '<div class="muted">还没有备忘</div>') +
          "</div>" +
        "</div>" +
        '<div class="card">' +
          '<div class="card-head"><h3>模块摘要</h3></div>' +
          '<div class="digest-list">' +
            '<div class="digest-row" onclick="App.setView(\'tests\')"><span>模拟测试</span><b>' +
              esc(digest.nextTest ? digest.nextTest.name : "暂无安排") + "</b></div>" +
            '<div class="digest-row" onclick="App.setView(\'resources\')"><span>电子资料</span><b>' +
              digest.resourceCount + " 份</b></div>" +
            '<div class="digest-row" onclick="App.setView(\'wrong\')"><span>错题本</span><b>' +
              digest.wrongDue + " 道待复习</b></div>" +
          "</div>" +
        "</div>" +
      "</div>" +
      '<div class="section-head"><h2 class="section-title">' + esc(greeting) + "，" + esc(state.settings.userName || "同学") + "</h2></div>";
  }

  function renderPlan() {
    const date = selectedPlanDate;
    const dayPlans = state.plans.filter(function (p) {
      return p.date === date;
    });
    const summary = Core.planSummary(dayPlans, date);
    const scheduled = Core.sortPlans(dayPlans.filter(function (p) {
      return !p.done && p.time;
    }));
    const free = dayPlans.filter(function (p) {
      return !p.done && !p.time;
    });
    const completed = Core.sortPlans(dayPlans.filter(function (p) {
      return p.done;
    }));

    document.getElementById("view-plan").innerHTML =
      '<div class="page-toolbar">' +
        "<div>" +
          '<div class="page-title">' + esc(Core.formatDateCN(date)) + "</div>" +
          '<div class="muted">已完成 ' + summary.done + " / " + summary.total + " 项 · 目标 " +
            Number(state.settings.dailyGoal || 5) + " 项</div>" +
        "</div>" +
        '<div class="date-nav">' +
          '<button class="icon-btn" onclick="App.shiftPlanDate(-1)" title="前一天">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>' +
          "</button>" +
          '<button class="btn small" onclick="App.setPlanDateToday()">今天</button>' +
          '<button class="icon-btn" onclick="App.shiftPlanDate(1)" title="后一天">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>' +
          "</button>" +
        "</div>" +
      "</div>" +
      '<div class="card">' +
        '<div class="card-head"><h3>添加计划</h3></div>' +
        '<form class="form-grid" onsubmit="return App.addPlan(event)">' +
          '<div class="field full"><label>计划内容</label><input id="plan-title" class="input" maxlength="120" required></div>' +
          '<div class="field"><label>科目</label><select id="plan-subject" class="select">' + subjectOptions() + "</select></div>" +
          '<div class="field"><label>时间</label><input id="plan-time" type="time" class="input"></div>' +
          '<div class="field"><label>优先级</label><select id="plan-priority" class="select">' +
            '<option value="high">高</option><option value="medium" selected>中</option><option value="low">低</option>' +
          "</select></div>" +
          '<button class="btn primary" type="submit">添加计划</button>' +
        "</form>" +
      "</div>" +
      (scheduled.length
        ? '<div class="section-head"><h2 class="section-title">按时间</h2></div><div class="timeline">' +
          scheduled.map(taskRow).join("") + "</div>"
        : "") +
      (free.length
        ? '<div class="section-head"><h2 class="section-title">自由任务</h2></div><div class="list">' +
          free.map(taskRow).join("") + "</div>"
        : "") +
      (completed.length
        ? '<div class="section-head"><h2 class="section-title">已完成</h2></div><div class="list">' +
          completed.map(taskRow).join("") + "</div>"
        : "") +
      (!dayPlans.length
        ? '<div class="empty">这一天还没有计划</div>'
        : "");
  }

  function renderTests() {
    const stats = Core.testStats(state.tests);
    const planned = state.tests.filter(function (t) {
      return t.status === "planned";
    }).sort(function (a, b) {
      return String(a.date).localeCompare(String(b.date));
    });
    const completed = state.tests.filter(function (t) {
      return t.status === "done";
    }).sort(function (a, b) {
      return String(b.completedAt || b.date).localeCompare(String(a.completedAt || a.date));
    });

    document.getElementById("view-tests").innerHTML =
      '<div class="stat-grid">' +
        statItem("待考", stats.planned) +
        statItem("已完成", stats.completed) +
        statItem("平均分", stats.completed ? stats.avg : "—") +
        statItem("达成目标", stats.targetHits) +
      "</div>" +
      '<div class="card generate-test-card">' +
        '<div class="card-head"><h3>自动生成模拟卷</h3></div>' +
        '<form class="form-grid" onsubmit="return App.generateMockTest(event)">' +
          '<div class="field"><label>科目</label><select id="gen-subject" class="select">' + subjectOptions() + "</select></div>" +
          '<div class="field"><label>年份</label><select id="gen-year" class="select">' +
            '<option value="all">近年全部</option>' +
            QuestionBank.years.map(function (year) {
              return '<option value="' + year + '">' + year + "年</option>";
            }).join("") +
          "</select></div>" +
          '<div class="field"><label>题目数量</label><input id="gen-count" type="number" class="input" min="1" max="20" value="3"></div>' +
          '<button class="btn primary" type="submit">生成模拟卷</button>' +
        "</form>" +
        '<div class="card-head" style="margin-top:18px"><h3>导入真题并生成</h3></div>' +
        '<form class="form-grid" onsubmit="return App.importMockTest(event)">' +
          '<div class="field full"><label>粘贴真题（题目之间空一行）</label>' +
            '<textarea id="import-questions" class="textarea" placeholder="科目：数学&#10;年份：2024&#10;题型：单选&#10;题干：…&#10;选项A：…&#10;选项B：…&#10;答案：B&#10;解析：…"></textarea></div>' +
          '<div class="field full"><label>或选择 .txt / .json 文件</label><input id="import-question-file" type="file" class="input" accept=".txt,.json"></div>' +
          '<button class="btn primary" type="submit">导入并生成模拟卷</button>' +
        "</form>" +
        '<div class="muted" style="margin-top:8px">内置题库为示例整理版，已标注“非官方原题”；导入题支持上面的文本格式或 questions 数组 JSON。</div>' +
      "</div>" +
      '<div class="card search-card">' +
        '<div class="card-head"><h3>联网搜索真题（Bing）</h3></div>' +
        '<form class="form-grid" onsubmit="return App.searchMockTest(event)">' +
          '<div class="field"><label>科目</label><select id="search-subject" class="select">' + subjectOptions() + "</select></div>" +
          '<div class="field"><label>年份</label><select id="search-year" class="select">' +
            '<option value="all">近年全部</option>' +
            QuestionBank.years.map(function (year) {
              return '<option value="' + year + '">' + year + "年</option>";
            }).join("") +
          "</select></div>" +
          '<div class="field"><label>搜索关键词</label><input id="search-keyword" class="input" value="真题 下载"></div>' +
          '<button class="btn primary" type="submit">打开搜索结果</button>' +
        "</form>" +
        '<div class="muted" style="margin-top:8px">将在浏览器新标签页打开搜索结果；找到网页后可回到“电子资料”按网址添加。</div>' +
      "</div>" +
      (planned.length
        ? '<div class="section-head"><h2 class="section-title">待考列表</h2></div><div class="list">' +
          planned.map(testRow).join("") + "</div>"
        : "") +
      (stats.recent.length
        ? '<div class="section-head"><h2 class="section-title">最近成绩</h2></div><div class="card">' +
          testChart(stats.recent) + "</div>"
        : "") +
      (completed.length
        ? '<div class="section-head"><h2 class="section-title">已完成</h2></div><div class="list">' +
          completed.map(testRow).join("") + "</div>"
        : "") +
      (!state.tests.length ? '<div class="empty">还没有模拟测试</div>' : "");
  }

  function renderResources() {
    const stats = Core.resourceStats(state.resources);
    const filtered = state.resources.filter(function (r) {
      const matchQuery = !resourceQuery ||
        r.name.toLowerCase().includes(resourceQuery.toLowerCase()) ||
        (r.tags || "").toLowerCase().includes(resourceQuery.toLowerCase()) ||
        (r.url || "").toLowerCase().includes(resourceQuery.toLowerCase());
      const matchSubject = resourceSubjectFilter === "all" || r.subjectId === resourceSubjectFilter;
      const matchType = resourceTypeFilter === "all" || r.type === resourceTypeFilter;
      return matchQuery && matchSubject && matchType;
    }).sort(function (a, b) {
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });

    document.getElementById("view-resources").innerHTML =
      '<div class="stat-grid">' +
        statItem("资料总数", stats.total) +
        statItem("占用空间", Core.formatBytes(stats.totalSize)) +
        statItem("带文件", state.resources.filter(function (r) { return !!r.fileId; }).length) +
        statItem("网址资料", stats.urlCount) +
      "</div>" +
      '<div class="toolbar">' +
        '<input id="resource-search" class="input" placeholder="搜索名称或标签" value="' + esc(resourceQuery) + '" oninput="App.setResourceQuery(this.value)">' +
        '<select id="resource-subject-filter" class="select" onchange="App.setResourceSubject(this.value)">' +
          '<option value="all">全部科目</option>' + subjectOptions(resourceSubjectFilter) +
        "</select>" +
        '<select id="resource-type-filter" class="select" onchange="App.setResourceType(this.value)">' +
          resourceTypeOptions(resourceTypeFilter) +
        "</select>" +
      "</div>" +
      '<div class="card">' +
        '<div class="card-head"><h3>添加资料</h3></div>' +
        '<form class="form-grid" onsubmit="return App.addResource(event)">' +
          '<div class="field full"><label>资料名称</label><input id="resource-name" class="input" maxlength="100" required></div>' +
          '<div class="field"><label>科目</label><select id="resource-subject" class="select">' + subjectOptions() + "</select></div>" +
          '<div class="field"><label>类型</label><select id="resource-type" class="select">' + resourceTypeOptions() + "</select></div>" +
          '<div class="field full"><label>标签</label><input id="resource-tags" class="input" maxlength="100" placeholder="用逗号分隔"></div>' +
          '<div class="field full"><label>资料网址（可选）</label><input id="resource-url" class="input" maxlength="300" placeholder="https://..."></div>' +
          '<div class="field full"><label>文件（可选，会复制到数据文件夹）</label><input id="resource-file" type="file" class="input"></div>' +
          '<button class="btn primary" type="submit">添加资料</button>' +
        "</form>" +
      "</div>" +
      (filtered.length
        ? '<div class="section-head"><h2 class="section-title">资料列表</h2></div><div class="list">' +
          filtered.map(resourceRow).join("") + "</div>"
        : '<div class="empty">没有符合条件的资料</div>');
  }

  function renderWrong() {
    const stats = Core.wrongStats(state.wrongQuestions);
    const filtered = Core.filterWrongQuestions(state.wrongQuestions, {
      subjectId: wrongSubjectFilter,
      status: wrongStatusFilter,
      query: wrongQuery
    }).sort(function (a, b) {
      return String(a.dueDate).localeCompare(String(b.dueDate));
    });

    document.getElementById("view-wrong").innerHTML =
      '<div class="stat-grid">' +
        statItem("总错题", stats.total) +
        statItem("待复习", stats.due) +
        statItem("已掌握", stats.mastered) +
        statItem("今日已复习", stats.reviewedToday) +
      "</div>" +
      '<div class="toolbar">' +
        '<input class="input" placeholder="搜索题干、来源或标签" value="' + esc(wrongQuery) + '" oninput="App.setWrongQuery(this.value)">' +
        '<select class="select" onchange="App.setWrongSubject(this.value)">' +
          '<option value="all">全部科目</option>' + subjectOptions(wrongSubjectFilter) +
        "</select>" +
        '<select class="select" onchange="App.setWrongStatus(this.value)">' +
          '<option value="all"' + (wrongStatusFilter === "all" ? " selected" : "") + ">全部状态</option>" +
          '<option value="todo"' + (wrongStatusFilter === "todo" ? " selected" : "") + ">待复习</option>" +
          '<option value="reviewing"' + (wrongStatusFilter === "reviewing" ? " selected" : "") + ">复习中</option>" +
          '<option value="mastered"' + (wrongStatusFilter === "mastered" ? " selected" : "") + ">已掌握</option>" +
        "</select>" +
        '<button class="btn primary" onclick="App.startReview()">开始复习（' + stats.due + "）</button>" +
      "</div>" +
      '<div class="card">' +
        '<div class="card-head"><h3>添加错题</h3></div>' +
        '<form class="form-grid" onsubmit="return App.addWrong(event)">' +
          '<div class="field"><label>科目</label><select id="wrong-subject" class="select">' + subjectOptions() + "</select></div>" +
          '<div class="field"><label>来源</label><input id="wrong-source" class="input" maxlength="80"></div>' +
          '<div class="field"><label>难度</label><select id="wrong-difficulty" class="select">' +
            '<option value="1">1 简单</option><option value="2">2 较易</option><option value="3" selected>3 中等</option>' +
            '<option value="4">4 较难</option><option value="5">5 困难</option>' +
          "</select></div>" +
          '<div class="field"><label>标签</label><input id="wrong-tags" class="input" maxlength="80"></div>' +
          '<div class="field full"><label>题干</label><textarea id="wrong-question" class="textarea" required></textarea></div>' +
          '<div class="field"><label>我的答案</label><textarea id="wrong-my-answer" class="textarea"></textarea></div>' +
          '<div class="field"><label>正确答案</label><textarea id="wrong-correct-answer" class="textarea"></textarea></div>' +
          '<div class="field full"><label>解析</label><textarea id="wrong-analysis" class="textarea"></textarea></div>' +
          '<button class="btn primary" type="submit">添加错题</button>' +
        "</form>" +
      "</div>" +
      (filtered.length
        ? '<div class="section-head"><h2 class="section-title">错题列表</h2></div><div class="list">' +
          filtered.map(wrongRow).join("") + "</div>"
        : '<div class="empty">没有符合条件的错题</div>');
  }

  function setView(view) {
    if (!VIEW_TITLES[view]) return;
    currentView = view;
    render();
    window.scrollTo({ top: 0 });
  }

  function addMemo() {
    const input = document.getElementById("memo-input");
    if (!input) return;
    const text = input.value.trim();
    if (!text) {
      toast("请输入备忘内容");
      return;
    }
    state.memos.push({
      id: Core.uid(),
      text: text,
      createdAt: Core.nowISO()
    });
    commit();
  }

  function deleteMemo(id) {
    state.memos = state.memos.filter(function (memo) {
      return memo.id !== id;
    });
    commit();
  }

  function addPlan(event) {
    event.preventDefault();
    const title = document.getElementById("plan-title").value.trim();
    if (!title) {
      toast("请输入计划内容");
      return;
    }
    const plan = Core.createPlan({
      title: title,
      subjectId: document.getElementById("plan-subject").value,
      time: document.getElementById("plan-time").value,
      priority: document.getElementById("plan-priority").value,
      date: selectedPlanDate
    });
    state.plans.push(plan);
    commit();
  }

  function togglePlan(id) {
    Core.togglePlan(state, id);
    commit();
  }

  function deletePlan(id) {
    if (!window.confirm("确定删除这条计划吗？")) return;
    Core.removePlan(state, id);
    commit();
  }

  function shiftPlanDate(offset) {
    selectedPlanDate = Core.addDaysISO(selectedPlanDate, offset);
    render();
  }

  function setPlanDateToday() {
    selectedPlanDate = Core.todayISO();
    render();
  }

  function clearTestTimer() {
    if (testTimerInterval) {
      clearInterval(testTimerInterval);
      testTimerInterval = null;
    }
  }

  function startTest(id) {
    const test = state.tests.find(function (t) {
      return t.id === id;
    });
    if (!test) return;
    clearTestTimer();
    activeTestId = id;
    if (test.questions && test.questions.length) {
      startQuestionTest(test);
      return;
    }
    testRemaining = Number(test.duration) * 60;
    const subject = subjectById(test.subjectId);
    openModal(
      test.name,
      '<div class="muted">' + (subject ? esc(subject.name) + " · " : "") + test.duration + " 分钟 · 满分 " + test.total + "</div>" +
        '<div class="test-clock" id="test-clock">' + Core.formatClock(testRemaining) + "</div>" +
        '<div class="modal-actions">' +
          '<button class="btn" onclick="App.cancelTest()">取消</button>' +
          '<button class="btn primary" onclick="App.finishTest()">交卷并记录成绩</button>' +
        "</div>",
      false
    );
    testTimerInterval = setInterval(function () {
      testRemaining -= 1;
      const clockEl = document.getElementById("test-clock");
      if (clockEl) {
        clockEl.textContent = Core.formatClock(testRemaining);
      }
      if (testRemaining <= 0) {
        clearTestTimer();
        finishTest();
      }
    }, 1000);
  }

  function finishTest() {
    clearTestTimer();
    const test = state.tests.find(function (t) {
      return t.id === activeTestId;
    });
    if (!test) {
      closeModal();
      return;
    }
    openModal(
      "记录成绩",
      '<form onsubmit="return App.submitTestScore(event)">' +
        '<div class="field"><label>实际分数（满分 ' + test.total + "）</label>" +
          '<input id="test-score" type="number" class="input" min="0" max="' + test.total + '" step="0.5" required></div>' +
        '<div class="field" style="margin-top:10px"><label>备注</label><input id="test-note" class="input" maxlength="120"></div>' +
        '<div class="modal-actions"><button class="btn" type="button" onclick="App.cancelTest()">取消</button>' +
          '<button class="btn primary" type="submit">保存成绩</button></div>' +
      "</form>",
      true
    );
  }

  function cancelTest() {
    clearTestTimer();
    closeModal();
  }

  function submitTestScore(event) {
    event.preventDefault();
    const test = state.tests.find(function (t) {
      return t.id === activeTestId;
    });
    if (!test) return;
    const score = Number(document.getElementById("test-score").value);
    if (!Number.isFinite(score) || score < 0 || score > test.total) {
      toast("分数应在 0 到 " + test.total + " 之间");
      return;
    }
    const note = document.getElementById("test-note").value.trim();
    Core.completeTest(state, test.id, score, note);
    commit();
    closeModal();
    toast("成绩已保存");
  }

  function generateMockTest(event) {
    event.preventDefault();
    const subjectId = document.getElementById("gen-subject").value;
    const year = document.getElementById("gen-year").value;
    const count = Math.max(1, Number(document.getElementById("gen-count").value) || 3);
    const subject = subjectById(subjectId);
    const name = year === "all"
      ? "近年真题模拟卷"
      : year + "年" + (subject ? subject.name : "科目") + "真题模拟卷";
    try {
      const test = Core.createGeneratedTest(state, {
        subjectId: subjectId,
        year: year,
        count: count,
        bank: QuestionBank.bank,
        sourceLabel: "示例题库自动组卷",
        name: name
      });
      state.tests.push(test);
      commit();
      toast("模拟卷已生成：" + test.name);
    } catch (err) {
      toast(err.message);
    }
  }

  async function importMockTest(event) {
    event.preventDefault();
    let text = document.getElementById("import-questions").value.trim();
    const fileInput = document.getElementById("import-question-file");
    let fileName = "";
    if (fileInput && fileInput.files.length) {
      fileName = fileInput.files[0].name;
      text = await fileInput.files[0].text();
    }
    if (!text) {
      toast("请粘贴题目或选择文件");
      return;
    }

    let result;
    if (fileName.toLowerCase().endsWith(".json") ||
        text.trim().charAt(0) === "[" ||
        text.trim().charAt(0) === "{") {
      try {
        result = Core.parseQuestionJson(text);
      } catch (err) {
        openModal("导入错误", '<p>JSON 解析失败：' + esc(err.message) + "</p>", true);
        return;
      }
    } else {
      result = Core.parseQuestionText(text);
    }

    if (result.errors && result.errors.length) {
      openModal(
        "导入错误",
        "<ul>" + result.errors.map(function (e) {
          return "<li>" + esc(e) + "</li>";
        }).join("") + "</ul>",
        true
      );
      return;
    }
    if (!result.questions.length) {
      toast("没有解析到题目");
      return;
    }

    const test = Core.createGeneratedTest(state, {
      subjectId: result.questions[0].subjectId || "",
      questions: result.questions,
      sourceLabel: "导入真题",
      name: "导入真题模拟卷（" + result.questions.length + " 题）"
    });
    state.tests.push(test);
    commit();
    toast("已导入并生成模拟卷");
  }

  function searchMockTest(event) {
    event.preventDefault();
    const subjectId = document.getElementById("search-subject").value;
    const year = document.getElementById("search-year").value;
    const keyword = document.getElementById("search-keyword").value.trim() || "真题";
    const subject = subjectById(subjectId);
    const query = Core.buildExamSearchQuery({
      year: year,
      subjectName: subject ? subject.name : "",
      keyword: keyword
    });
    searchOnline(query);
  }

  function searchOnline(query) {
    if (!query) {
      toast("请输入搜索关键词");
      return;
    }
    const url = Core.buildSearchUrl(query);
    window.open(url, "_blank", "noopener,noreferrer");
    toast("已在新标签页打开搜索结果");
  }

  function startQuestionTest(test) {
    clearTestTimer();
    activeTestId = test.id;
    currentQuestionIndex = 0;
    testRemaining = Number(test.duration) * 60;
    openModal(
      test.name,
      '<div class="test-clock" id="test-clock">' + Core.formatClock(testRemaining) + "</div>" +
        '<div id="question-body"></div>',
      false
    );
    renderQuestionStep(test);
    testTimerInterval = setInterval(function () {
      testRemaining -= 1;
      const clockEl = document.getElementById("test-clock");
      if (clockEl) {
        clockEl.textContent = Core.formatClock(testRemaining);
      }
      if (testRemaining <= 0) {
        clearTestTimer();
        finishQuestionTest();
      }
    }, 1000);
  }

  function renderQuestionStep(test) {
    const body = document.getElementById("question-body");
    if (!body) return;
    const question = test.questions[currentQuestionIndex];
    if (!question) {
      body.innerHTML = "";
      return;
    }
    const optionsHtml = question.options && question.options.length
      ? question.options.map(function (option, index) {
          const letter = String.fromCharCode(65 + index);
          const selected = String(question.userAnswer || "").toUpperCase() === letter;
          return '<label class="answer-option">' +
            '<input type="radio" name="answer" value="' + letter + '"' + (selected ? " checked" : "") +
              " onchange=\"App.answerQuestion('" + test.id + "','" + question.id + "',this.value)\">" +
            "<span>" + esc(option) + "</span></label>";
        }).join("")
      : '<textarea id="subjective-answer" class="textarea" style="margin:10px 0" ' +
          "onchange=\"App.answerQuestion('" + test.id + "','" + question.id + "',this.value)\">" +
          esc(question.userAnswer || "") + "</textarea>";

    body.innerHTML =
      '<div class="muted">第 ' + (currentQuestionIndex + 1) + " / " + test.questions.length + " 题 · " +
        esc(question.type) + (question.year ? " · " + esc(question.year) + "年" : "") + "</div>" +
      '<div class="wrong-question" style="margin:10px 0">' + esc(question.question) + "</div>" +
      (question.options && question.options.length
        ? '<div class="answer-list">' + optionsHtml + "</div>"
        : optionsHtml) +
      '<div class="modal-actions">' +
        (currentQuestionIndex > 0
          ? '<button class="btn" onclick="App.prevQuestion()">上一题</button>'
          : "") +
        (currentQuestionIndex < test.questions.length - 1
          ? '<button class="btn primary" onclick="App.nextQuestion()">下一题</button>'
          : "") +
        '<button class="btn danger" onclick="App.finishQuestionTest()">交卷</button>' +
      "</div>";
  }

  function answerQuestion(testId, questionId, value) {
    Core.markUserAnswer(state, testId, questionId, value);
    commit();
  }

  function nextQuestion() {
    const test = state.tests.find(function (t) {
      return t.id === activeTestId;
    });
    if (test && currentQuestionIndex < test.questions.length - 1) {
      currentQuestionIndex += 1;
      renderQuestionStep(test);
    }
  }

  function prevQuestion() {
    if (currentQuestionIndex > 0) {
      currentQuestionIndex -= 1;
      const test = state.tests.find(function (t) {
        return t.id === activeTestId;
      });
      if (test) renderQuestionStep(test);
    }
  }

  function finishQuestionTest() {
    clearTestTimer();
    const test = state.tests.find(function (t) {
      return t.id === activeTestId;
    });
    if (!test) {
      closeModal();
      return;
    }
    Core.completeGeneratedTest(state, test.id);
    commit();
    openModal("成绩与解析", renderResultHtml(test), true);
  }

  function viewTestResult(id) {
    const test = state.tests.find(function (t) {
      return t.id === id;
    });
    if (!test) return;
    openModal("成绩与解析", renderResultHtml(test), true);
  }

  function renderResultHtml(test) {
    const grade = Core.gradeGeneratedTest(test);
    const rows = grade.results.map(function (item, index) {
      const q = item.question;
      const user = String(q.userAnswer || "").trim() || "未作答";
      const status = item.isCorrect === null
        ? '<span class="tag">主观题</span>'
        : item.isCorrect
          ? '<span class="tag solid" style="background:var(--accent)">正确</span>'
          : '<span class="tag solid" style="background:var(--danger)">错误</span>';
      return '<div class="wrong-card" style="margin-top:8px">' +
        '<div class="wrong-top"><div class="wrong-tags">' +
          '<span class="tag">' + esc(q.type) + "</span>" +
          (q.year ? '<span class="tag">' + esc(q.year) + "年</span>" : "") +
          status +
        "</div></div>" +
        '<div class="wrong-question">' + (index + 1) + ". " + esc(q.question) + "</div>" +
        '<div class="answer-box"><b>你的答案：</b>' + esc(user) + "</div>" +
        (q.options && q.options.length
          ? '<div class="answer-box"><b>正确答案：</b>' + esc(q.answer) + "</div>"
          : "") +
        (q.analysis
          ? '<div class="answer-box"><b>解析：</b>' + esc(q.analysis) + "</div>"
          : "") +
      "</div>";
    }).join("");
    return '<div class="stat-grid" style="margin-bottom:10px">' +
      statItem("得分", grade.score) +
      statItem("客观题", grade.correct + " / " + grade.objectiveTotal) +
      statItem("总题数", grade.total) +
      statItem("主观题", "自行核对") +
    "</div>" + rows;
  }

  function deleteTest(id) {
    if (!window.confirm("确定删除这场模拟测试吗？")) return;
    Core.removeTest(state, id);
    commit();
  }

  function setResourceQuery(value) {
    resourceQuery = value;
    renderResources();
  }

  function setResourceSubject(value) {
    resourceSubjectFilter = value;
    renderResources();
  }

  function setResourceType(value) {
    resourceTypeFilter = value;
    renderResources();
  }

  async function addResource(event) {
    event.preventDefault();
    const name = document.getElementById("resource-name").value.trim();
    if (!name) {
      toast("请输入资料名称");
      return;
    }
    const url = document.getElementById("resource-url").value.trim();
    if (url && !Core.isValidHttpUrl(url)) {
      toast("请输入有效的 http/https 网址");
      return;
    }
    const resource = Core.createResource({
      name: name,
      subjectId: document.getElementById("resource-subject").value,
      type: document.getElementById("resource-type").value,
      tags: document.getElementById("resource-tags").value.trim(),
      url: url
    });
    state.resources.push(resource);
    const fileInput = document.getElementById("resource-file");
    const file = fileInput && fileInput.files.length ? fileInput.files[0] : null;
    if (file) {
      if (!dataDirHandle) {
        toast("请先连接数据文件夹，文件未保存");
      } else {
        try {
          const resDir = await Storage.getSubdir(dataDirHandle, "resources", true);
          const storedName = resource.id + "_" + Core.sanitizeFileName(file.name);
          await Storage.writeBlob(resDir, storedName, file);
          resource.fileId = storedName;
          resource.fileName = file.name;
          resource.size = file.size;
        } catch (err) {
          toast("文件保存失败：" + err.message);
        }
      }
    }
    commit();
    toast("资料已添加");
  }

  async function openResource(id) {
    const resource = state.resources.find(function (r) {
      return r.id === id;
    });
    if (!resource || !resource.fileId || !dataDirHandle) {
      toast("这条资料没有可打开的文件");
      return;
    }
    try {
      const resDir = await Storage.getSubdir(dataDirHandle, "resources", false);
      if (!resDir) {
        toast("数据文件夹中没有 resources 目录");
        return;
      }
      const blob = await Storage.readBlob(resDir, resource.fileId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = resource.fileName || resource.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 10000);
    } catch (err) {
      toast("打开文件失败：" + err.message);
    }
  }

  function openResourceUrl(id) {
    const resource = state.resources.find(function (r) {
      return r.id === id;
    });
    if (!resource || !resource.url) {
      toast("这条资料没有网址");
      return;
    }
    window.open(resource.url, "_blank", "noopener,noreferrer");
  }

  async function deleteResource(id) {
    const resource = state.resources.find(function (r) {
      return r.id === id;
    });
    if (!resource) return;
    if (!window.confirm("确定删除这条资料吗？对应文件也会被移除。")) return;
    if (resource.fileId && dataDirHandle) {
      try {
        const resDir = await Storage.getSubdir(dataDirHandle, "resources", false);
        if (resDir) {
          await Storage.removeEntry(resDir, resource.fileId);
        }
      } catch (err) {
        toast("文件删除失败：" + err.message);
      }
    }
    Core.removeResource(state, id);
    commit();
  }

  function setWrongQuery(value) {
    wrongQuery = value;
    renderWrong();
  }

  function setWrongSubject(value) {
    wrongSubjectFilter = value;
    renderWrong();
  }

  function setWrongStatus(value) {
    wrongStatusFilter = value;
    renderWrong();
  }

  function addWrong(event) {
    event.preventDefault();
    const question = document.getElementById("wrong-question").value.trim();
    if (!question) {
      toast("请输入题干");
      return;
    }
    const wrong = Core.createWrongQuestion({
      subjectId: document.getElementById("wrong-subject").value,
      source: document.getElementById("wrong-source").value.trim(),
      difficulty: Number(document.getElementById("wrong-difficulty").value),
      question: question,
      myAnswer: document.getElementById("wrong-my-answer").value.trim(),
      correctAnswer: document.getElementById("wrong-correct-answer").value.trim(),
      analysis: document.getElementById("wrong-analysis").value.trim(),
      tags: document.getElementById("wrong-tags").value.trim()
    });
    state.wrongQuestions.push(wrong);
    commit();
    toast("错题已添加");
  }

  function deleteWrong(id) {
    if (!window.confirm("确定删除这道错题吗？")) return;
    Core.removeWrongQuestion(state, id);
    commit();
  }

  function toggleWrongDetail(id) {
    const detail = document.getElementById("wrong-detail-" + id);
    const btn = document.getElementById("wrong-toggle-" + id);
    if (!detail || !btn) return;
    const hidden = detail.classList.toggle("hidden");
    btn.textContent = hidden ? "查看解析" : "收起解析";
  }

  function startReview() {
    const due = Core.dueWrongQuestions(state.wrongQuestions);
    if (!due.length) {
      toast("没有待复习的错题");
      return;
    }
    reviewQueue = due;
    reviewIndex = 0;
    showReviewCard();
  }

  function showReviewCard() {
    if (reviewIndex >= reviewQueue.length) {
      closeModal();
      render();
      toast("本轮复习完成");
      return;
    }
    const id = reviewQueue[reviewIndex].id;
    const question = state.wrongQuestions.find(function (q) {
      return q.id === id;
    }) || reviewQueue[reviewIndex];
    const subject = subjectById(question.subjectId);
    openModal(
      "错题复习",
      '<div class="muted">第 ' + (reviewIndex + 1) + " / " + reviewQueue.length + " 题</div>" +
        (subject ? '<div class="wrong-tags" style="margin:8px 0"><span class="tag solid" style="background:' + subject.color + '">' + esc(subject.name) + "</span></div>" : "") +
        '<div class="wrong-question">' + esc(question.question) + "</div>" +
        '<div class="answer-box"><b>我的答案：</b>' + esc(question.myAnswer || "未填写") + "</div>" +
        '<div class="hidden" id="review-answer">' +
          '<div class="answer-box"><b>正确答案：</b>' + esc(question.correctAnswer || "未填写") + "</div>" +
          (question.analysis
            ? '<div class="answer-box"><b>解析：</b>' + esc(question.analysis) + "</div>"
            : "") +
        "</div>" +
        '<div class="modal-actions">' +
          '<button class="btn" onclick="App.revealReviewAnswer()">显示答案</button>' +
          '<button class="btn danger" onclick="App.gradeReview(\'again\')">忘记</button>' +
          '<button class="btn" onclick="App.gradeReview(\'hard\')">模糊</button>' +
          '<button class="btn" onclick="App.gradeReview(\'good\')">记得</button>' +
          '<button class="btn primary" onclick="App.gradeReview(\'easy\')">掌握</button>' +
        "</div>",
      false
    );
  }

  function revealReviewAnswer() {
    const box = document.getElementById("review-answer");
    if (box) {
      box.classList.remove("hidden");
    }
  }

  function gradeReview(grade) {
    const question = reviewQueue[reviewIndex];
    if (!question) return;
    Core.applyWrongReview(state, question.id, grade);
    reviewIndex += 1;
    commit();
    if (reviewIndex < reviewQueue.length) {
      showReviewCard();
    } else {
      closeModal();
      render();
      toast("本轮复习完成");
    }
  }

  async function chooseDataFolder() {
    if (!Storage.isSupported()) {
      toast("当前浏览器不支持本地文件夹读写");
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      await connectToHandle(handle);
    } catch (err) {
      if (err && err.name !== "AbortError") {
        toast("选择文件夹失败：" + err.message);
      }
    }
  }

  function useLocalFallback() {
    closeModal();
    storageMode = "local";
    dataDirHandle = null;
    saveFallback(state);
    toast("已使用浏览器内置存储");
    render();
  }

  function subjectSettingRow(subject) {
    return '<div class="subject-row" data-id="' + esc(subject.id) + '">' +
      '<input class="input subject-name" value="' + esc(subject.name) + '" maxlength="30">' +
      '<input type="color" class="subject-color" value="' + esc(subject.color) + '">' +
      '<button type="button" class="icon-btn danger" onclick="App.removeSubjectRow(this)" title="删除">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 15H6L5 6"/></svg>' +
      "</button>" +
    "</div>";
  }

  function openSettings() {
    const location = dataDirHandle ? dataDirHandle.name : "浏览器内置存储";
    openModal(
      "设置",
      '<form onsubmit="return App.saveSettings(event)">' +
        '<div class="form-grid">' +
          '<div class="field"><label>考试名称</label><input id="set-exam-name" class="input" value="' + esc(state.settings.examName) + '" maxlength="40"></div>' +
          '<div class="field"><label>考试日期</label><input id="set-exam-date" type="date" class="input" value="' + esc(state.settings.examDate) + '" required></div>' +
          '<div class="field"><label>你的名字</label><input id="set-user-name" class="input" value="' + esc(state.settings.userName) + '" maxlength="20"></div>' +
          '<div class="field"><label>每日计划目标（项）</label><input id="set-daily-goal" type="number" class="input" min="1" max="30" value="' + Number(state.settings.dailyGoal || 5) + '"></div>' +
        "</div>" +
        '<div class="section-head"><h2 class="section-title">科目管理</h2></div>' +
        '<div id="subject-list">' + state.subjects.map(subjectSettingRow).join("") + "</div>" +
        '<button class="btn small" type="button" onclick="App.addSubjectRow()">添加科目</button>' +
        '<div class="section-head"><h2 class="section-title">数据位置</h2></div>' +
        '<p class="muted">当前：' + esc(location) + "</p>" +
        '<div class="modal-actions">' +
          '<button class="btn" type="button" onclick="App.changeDataFolder()">更换文件夹</button>' +
          '<button class="btn" type="button" onclick="App.backupNow()">备份</button>' +
          '<button class="btn" type="button" onclick="App.restoreFromFolder()">从文件夹恢复</button>' +
          '<button class="btn" type="button" onclick="App.restoreFromFile()">从 data.json 恢复</button>' +
          '<button class="btn primary" type="submit">保存设置</button>' +
        "</div>" +
      "</form>",
      true
    );
  }

  function addSubjectRow() {
    const list = document.getElementById("subject-list");
    if (!list) return;
    const row = document.createElement("div");
    row.className = "subject-row";
    row.dataset.id = Core.uid();
    row.innerHTML =
      '<input class="input subject-name" maxlength="30" placeholder="科目名称">' +
      '<input type="color" class="subject-color" value="#0f8f79">' +
      '<button type="button" class="icon-btn danger" onclick="App.removeSubjectRow(this)" title="删除">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 15H6L5 6"/></svg>' +
      "</button>";
    list.appendChild(row);
  }

  function removeSubjectRow(button) {
    const rows = document.querySelectorAll("#subject-list .subject-row");
    if (rows.length <= 1) {
      toast("至少保留一个科目");
      return;
    }
    const row = button.closest(".subject-row");
    if (row) row.remove();
  }

  function saveSettings(event) {
    event.preventDefault();
    const rows = Array.from(document.querySelectorAll("#subject-list .subject-row"));
    const subjects = rows.map(function (row) {
      return {
        id: row.dataset.id || undefined,
        name: row.querySelector(".subject-name").value.trim(),
        color: row.querySelector(".subject-color").value
      };
    });
    Core.updateSettings(state, {
      examName: document.getElementById("set-exam-name").value.trim() || state.settings.examName,
      examDate: document.getElementById("set-exam-date").value,
      userName: document.getElementById("set-user-name").value.trim() || "缘",
      dailyGoal: Number(document.getElementById("set-daily-goal").value) || 5
    }, subjects);
    commit();
    closeModal();
    toast("设置已保存");
  }

  async function changeDataFolder() {
    if (!Storage.isSupported()) {
      toast("当前浏览器不支持本地文件夹读写");
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      await connectToHandle(handle);
    } catch (err) {
      if (err && err.name !== "AbortError") {
        toast("更换文件夹失败：" + err.message);
      }
    }
  }

  function localTimestamp() {
    const d = new Date();
    const p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
      "_" + p(d.getHours()) + "-" + p(d.getMinutes()) + "-" + p(d.getSeconds());
  }

  async function backupNow() {
    if (!dataDirHandle) {
      toast("请先连接数据文件夹");
      return;
    }
    if (!Storage.isSupported()) {
      toast("当前浏览器不支持本地文件夹读写");
      return;
    }
    try {
      const dest = await window.showDirectoryPicker({ mode: "readwrite" });
      const timestamp = localTimestamp();
      const manifest = Core.backupManifest(state);
      await Storage.backupData(dataDirHandle, dest, timestamp, state, manifest);
      toast("备份完成：" + timestamp);
    } catch (err) {
      if (err && err.name !== "AbortError") {
        toast("备份失败：" + err.message);
      }
    }
  }

  async function restoreFromFolder() {
    if (!Storage.isSupported()) {
      toast("当前浏览器不支持本地文件夹读写");
      return;
    }
    try {
      const source = await window.showDirectoryPicker({ mode: "read" });
      const text = dataDirHandle
        ? await Storage.restoreFromDir(source, dataDirHandle)
        : await Storage.readDataFile(source);
      const parsed = Core.parseState(text);
      if (!parsed.ok) {
        throw new Error(parsed.error);
      }
      state = parsed.state;
      commit();
      closeModal();
      toast("已从文件夹恢复");
    } catch (err) {
      if (err && err.name !== "AbortError") {
        toast("恢复失败：" + err.message);
      }
    }
  }

  async function restoreFromFile() {
    if (!window.showOpenFilePicker) {
      toast("当前浏览器不支持文件选择恢复");
      return;
    }
    try {
      const handles = await window.showOpenFilePicker({
        types: [{ description: "data.json", accept: { "application/json": [".json"] } }],
        multiple: false
      });
      const file = await handles[0].getFile();
      const text = await file.text();
      const parsed = Core.parseState(text);
      if (!parsed.ok) {
        throw new Error(parsed.error);
      }
      state = parsed.state;
      commit();
      closeModal();
      toast("已从 data.json 恢复");
    } catch (err) {
      if (err && err.name !== "AbortError") {
        toast("恢复失败：" + err.message);
      }
    }
  }

  async function init() {
    document.querySelectorAll(".nav-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setView(btn.dataset.view);
      });
    });
    document.getElementById("settings-btn").addEventListener("click", openSettings);
    document.getElementById("backup-btn").addEventListener("click", backupNow);
    window.addEventListener("beforeunload", saveNow);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") {
        saveNow();
      }
    });
    render();

    let savedHandle = null;
    try {
      savedHandle = await loadHandle();
    } catch (err) {
      // ignore, show setup modal below
    }
    if (savedHandle) {
      await connectToHandle(savedHandle);
    } else if (Storage.isSupported()) {
      openSetupModal();
    } else {
      toast("当前浏览器不支持本地文件夹，已使用浏览器内置存储");
    }
  }

  window.KaoYanApp = {
    answerQuestion: answerQuestion,
    addSubjectRow: addSubjectRow,
    addWrong: addWrong,
    addResource: addResource,
    addPlan: addPlan,
    addMemo: addMemo,
    backupNow: backupNow,
    cancelTest: cancelTest,
    changeDataFolder: changeDataFolder,
    chooseDataFolder: chooseDataFolder,
    closeModal: closeModal,
    deletePlan: deletePlan,
    deleteMemo: deleteMemo,
    deleteResource: deleteResource,
    deleteWrong: deleteWrong,
    deleteTest: deleteTest,
    finishTest: finishTest,
    finishQuestionTest: finishQuestionTest,
    generateMockTest: generateMockTest,
    gradeReview: gradeReview,
    importMockTest: importMockTest,
    nextQuestion: nextQuestion,
    openSettings: openSettings,
    openResource: openResource,
    openResourceUrl: openResourceUrl,
    openSetupModal: openSetupModal,
    prevQuestion: prevQuestion,
    removeSubjectRow: removeSubjectRow,
    restoreFromFile: restoreFromFile,
    restoreFromFolder: restoreFromFolder,
    revealReviewAnswer: revealReviewAnswer,
    saveSettings: saveSettings,
    searchMockTest: searchMockTest,
    searchOnline: searchOnline,
    setPlanDateToday: setPlanDateToday,
    setResourceQuery: setResourceQuery,
    setResourceSubject: setResourceSubject,
    setResourceType: setResourceType,
    setWrongQuery: setWrongQuery,
    setWrongStatus: setWrongStatus,
    setWrongSubject: setWrongSubject,
    setView: setView,
    shiftPlanDate: shiftPlanDate,
    startTest: startTest,
    startReview: startReview,
    submitTestScore: submitTestScore,
    toggleWrongDetail: toggleWrongDetail,
    togglePlan: togglePlan,
    useLocalFallback: useLocalFallback,
    viewTestResult: viewTestResult
  };
  window.App = window.KaoYanApp;

  document.addEventListener("DOMContentLoaded", init);
})();
