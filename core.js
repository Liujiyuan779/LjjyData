(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.KaoYanCore = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function toISODate(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function parseISODate(iso) {
    const parts = String(iso).split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function todayISO(now) {
    return toISODate(now || new Date());
  }

  function addDaysISO(iso, days) {
    const d = parseISODate(iso);
    d.setDate(d.getDate() + days);
    return toISODate(d);
  }

  function daysUntil(iso, fromISO) {
    const from = parseISODate(fromISO || todayISO()).getTime();
    const target = parseISODate(iso).getTime();
    return Math.round((target - from) / 86400000);
  }

  const WEEK_CN = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

  function formatDateCN(iso) {
    if (!iso) return "";
    const d = parseISODate(iso);
    return (d.getMonth() + 1) + "月" + d.getDate() + "日 " + WEEK_CN[d.getDay()];
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function uid() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function defaultSubjects() {
    return [
      { id: "politics", name: "政治", color: "#c84a5a" },
      { id: "english", name: "英语", color: "#2f7fe0" },
      { id: "math", name: "数学", color: "#0f9f6e" },
      { id: "major", name: "专业课", color: "#a55bd4" }
    ];
  }

  function defaultState(dateStr) {
    const today = dateStr || todayISO();
    return {
      version: 1,
      updatedAt: nowISO(),
      settings: {
        examName: "2027 考研",
        examDate: "2026-12-19",
        userName: "缘",
        dailyGoal: 5
      },
      subjects: defaultSubjects(),
      plans: [
        { id: uid(), title: "背英语单词 50 个", subjectId: "english", time: "08:00", priority: "high", date: today, done: false },
        { id: uid(), title: "高数强化：导数应用 10 题", subjectId: "math", time: "09:30", priority: "high", date: today, done: false },
        { id: uid(), title: "政治选择题 30 题", subjectId: "politics", time: "14:00", priority: "medium", date: today, done: false },
        { id: uid(), title: "专业课框架整理 1 章", subjectId: "major", time: "19:30", priority: "medium", date: today, done: false }
      ],
      memos: [
        { id: uid(), text: "明天 8 点前完成英语阅读 2 篇", createdAt: nowISO() }
      ],
      tests: [
        {
          id: uid(),
          name: "英语阅读限时训练",
          subjectId: "english",
          date: addDaysISO(today, 3),
          duration: 90,
          total: 100,
          target: 70,
          score: null,
          status: "planned",
          notes: "",
          createdAt: nowISO(),
          completedAt: null
        },
        {
          id: uid(),
          name: "2026 数学真题（一）",
          subjectId: "math",
          date: addDaysISO(today, 7),
          duration: 180,
          total: 150,
          target: 120,
          score: null,
          status: "planned",
          notes: "",
          createdAt: nowISO(),
          completedAt: null
        }
      ],
      resources: [
        {
          id: uid(),
          name: "英语近十年真题解析",
          subjectId: "english",
          type: "真题",
          tags: "阅读",
          fileId: null,
          size: 0,
          createdAt: nowISO()
        }
      ],
      wrongQuestions: [
        {
          id: uid(),
          subjectId: "english",
          source: "2024 英语阅读 Text 1",
          difficulty: 3,
          question: "作者对这项政策的态度是？",
          myAnswer: "supportive",
          correctAnswer: "skeptical",
          analysis: "文中转折处表达了保留态度。",
          tags: "态度题",
          status: "todo",
          dueDate: today,
          interval: 1,
          ease: 2.5,
          reviews: 0,
          createdAt: nowISO(),
          lastReviewedAt: null
        },
        {
          id: uid(),
          subjectId: "math",
          source: "强化习题 第三章",
          difficulty: 4,
          question: "求极限：lim(x→0) (1-cos x)/x²",
          myAnswer: "1",
          correctAnswer: "1/2",
          analysis: "等价无穷小：1-cos x ~ x²/2。",
          tags: "极限",
          status: "reviewing",
          dueDate: today,
          interval: 2,
          ease: 2.5,
          reviews: 1,
          createdAt: nowISO(),
          lastReviewedAt: nowISO()
        }
      ]
    };
  }

  function normalizeTest(t) {
    return {
      id: t.id || uid(),
      name: t.name || "未命名测试",
      subjectId: t.subjectId || "",
      date: t.date || todayISO(),
      duration: Number(t.duration) || 120,
      total: Number(t.total) || 100,
      target: Number(t.target) || 0,
      score: t.score == null ? null : Number(t.score),
      status: t.status === "done" ? "done" : "planned",
      notes: t.notes || "",
      createdAt: t.createdAt || nowISO(),
      completedAt: t.completedAt || null
    };
  }

  function normalizeWrongQuestion(q) {
    return {
      id: q.id || uid(),
      subjectId: q.subjectId || "",
      source: q.source || "",
      difficulty: Number(q.difficulty) || 3,
      question: q.question || "",
      myAnswer: q.myAnswer || "",
      correctAnswer: q.correctAnswer || "",
      analysis: q.analysis || "",
      tags: q.tags || "",
      status: ["todo", "reviewing", "mastered"].indexOf(q.status) >= 0 ? q.status : "todo",
      dueDate: q.dueDate || todayISO(),
      interval: Number(q.interval) || 1,
      ease: Number(q.ease) || 2.5,
      reviews: Number(q.reviews) || 0,
      createdAt: q.createdAt || nowISO(),
      lastReviewedAt: q.lastReviewedAt || null
    };
  }

  function mergeState(parsed, dateStr) {
    const base = defaultState(dateStr);
    if (!parsed || typeof parsed !== "object") {
      return base;
    }
    const settings = Object.assign({}, base.settings, parsed.settings || {});
    const subjects = Array.isArray(parsed.subjects) && parsed.subjects.length
      ? parsed.subjects
      : base.subjects;
    return {
      version: Number(parsed.version) || 1,
      updatedAt: parsed.updatedAt || nowISO(),
      settings: settings,
      subjects: subjects,
      plans: Array.isArray(parsed.plans) ? parsed.plans : [],
      memos: Array.isArray(parsed.memos) ? parsed.memos : [],
      tests: Array.isArray(parsed.tests) ? parsed.tests.map(normalizeTest) : [],
      resources: Array.isArray(parsed.resources) ? parsed.resources : [],
      wrongQuestions: Array.isArray(parsed.wrongQuestions)
        ? parsed.wrongQuestions.map(normalizeWrongQuestion)
        : []
    };
  }

  function serializeState(state) {
    return JSON.stringify(state, null, 2);
  }

  function parseState(text, dateStr) {
    try {
      const parsed = JSON.parse(text);
      return { ok: true, state: mergeState(parsed, dateStr) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  function planSummary(plans, date) {
    const dayPlans = plans.filter(function (p) {
      return p.date === date;
    });
    const done = dayPlans.filter(function (p) {
      return p.done;
    }).length;
    const nextList = dayPlans.filter(function (p) {
      return !p.done;
    }).sort(function (a, b) {
      return (a.time || "99:99").localeCompare(b.time || "99:99");
    });
    return {
      total: dayPlans.length,
      done: done,
      next: nextList[0] || null,
      rate: dayPlans.length ? Math.round((done / dayPlans.length) * 100) : 0
    };
  }

  function sortPlans(plans) {
    return plans.slice().sort(function (a, b) {
      return (a.time || "99:99").localeCompare(b.time || "99:99");
    });
  }

  function testStats(tests) {
    const completed = tests.filter(function (t) {
      return t.status === "done" && t.score != null;
    });
    const totalScore = completed.reduce(function (sum, t) {
      return sum + Number(t.score);
    }, 0);
    const avg = completed.length ? Math.round(totalScore / completed.length) : 0;
    const recent = completed.slice().sort(function (a, b) {
      return String(b.completedAt || b.date).localeCompare(String(a.completedAt || a.date));
    }).slice(0, 8).reverse();
    return {
      planned: tests.filter(function (t) {
        return t.status === "planned";
      }).length,
      completed: completed.length,
      avg: avg,
      targetHits: completed.filter(function (t) {
        return Number(t.score) >= Number(t.target);
      }).length,
      recent: recent
    };
  }

  function resourceStats(resources) {
    const typeCounts = {};
    let totalSize = 0;
    resources.forEach(function (r) {
      typeCounts[r.type] = (typeCounts[r.type] || 0) + 1;
      totalSize += Number(r.size) || 0;
    });
    return {
      total: resources.length,
      totalSize: totalSize,
      typeCounts: typeCounts
    };
  }

  function wrongStats(questions, date) {
    const today = date || todayISO();
    const due = questions.filter(function (q) {
      return q.status !== "mastered" && q.dueDate <= today;
    });
    const reviewedToday = questions.filter(function (q) {
      return q.lastReviewedAt && todayISO(new Date(q.lastReviewedAt)) === today;
    });
    return {
      total: questions.length,
      due: due.length,
      mastered: questions.filter(function (q) {
        return q.status === "mastered";
      }).length,
      reviewedToday: reviewedToday.length
    };
  }

  function scheduleReview(q, grade, date) {
    const today = date || todayISO();
    const next = Object.assign({}, q);
    next.reviews = Number(q.reviews || 0) + 1;
    next.lastReviewedAt = nowISO();
    const interval = Number(q.interval) || 1;
    const ease = Number(q.ease) || 2.5;

    if (grade === "again") {
      next.interval = 0;
      next.ease = Math.max(1.3, +(ease - 0.2).toFixed(2));
      next.dueDate = addDaysISO(today, 1);
      next.status = "todo";
    } else if (grade === "hard") {
      next.interval = Math.max(1, Math.round(interval * 0.5));
      next.ease = Math.max(1.3, +(ease - 0.1).toFixed(2));
      next.dueDate = addDaysISO(today, next.interval);
      next.status = "reviewing";
    } else if (grade === "good") {
      const iv = next.reviews <= 1 ? 1 : Math.max(1, Math.round(interval * ease));
      next.interval = iv;
      next.ease = +(ease + 0.05).toFixed(2);
      next.dueDate = addDaysISO(today, iv);
      next.status = "reviewing";
    } else if (grade === "easy") {
      next.interval = Math.max(30, Math.round(interval * ease * 1.3));
      next.ease = +(ease + 0.15).toFixed(2);
      next.dueDate = addDaysISO(today, next.interval);
      next.status = "mastered";
    }
    return next;
  }

  function backupManifest(state, when) {
    return {
      name: "缘的考研舱备份",
      createdAt: when || nowISO(),
      version: state.version || 1,
      fileCount: state.resources.filter(function (r) {
        return !!r.fileId;
      }).length
    };
  }

  function formatBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    if (n < 1024 * 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + " MB";
    return (n / (1024 * 1024 * 1024)).toFixed(1) + " GB";
  }

  function dueWrongQuestions(questions, date) {
    const today = date || todayISO();
    return questions.filter(function (q) {
      return q.status !== "mastered" && q.dueDate <= today;
    });
  }

  function homeDigest(state, date) {
    const today = date || todayISO();
    const plan = planSummary(state.plans, today);
    const memos = (state.memos || []).slice().sort(function (a, b) {
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
    const nextTest = (state.tests || []).filter(function (t) {
      return t.status === "planned";
    }).sort(function (a, b) {
      return String(a.date).localeCompare(String(b.date));
    })[0] || null;
    const wrong = wrongStats(state.wrongQuestions || [], today);
    return {
      today: today,
      days: daysUntil(state.settings.examDate, today),
      examDate: state.settings.examDate,
      examName: state.settings.examName,
      plan: plan,
      memos: memos,
      nextTest: nextTest,
      resourceCount: (state.resources || []).length,
      wrongDue: wrong.due
    };
  }

  function createPlan(planData) {
    return {
      id: uid(),
      title: planData.title,
      subjectId: planData.subjectId || "",
      time: planData.time || "",
      priority: planData.priority || "medium",
      date: planData.date || todayISO(),
      done: false
    };
  }

  function togglePlan(state, id) {
    const plan = state.plans.find(function (p) {
      return p.id === id;
    });
    if (plan) {
      plan.done = !plan.done;
    }
    return state;
  }

  function removePlan(state, id) {
    state.plans = state.plans.filter(function (p) {
      return p.id !== id;
    });
    return state;
  }

  function createTest(data) {
    return {
      id: uid(),
      name: data.name || "未命名测试",
      subjectId: data.subjectId || "",
      date: data.date || todayISO(),
      duration: Number(data.duration) || 120,
      total: Number(data.total) || 100,
      target: Number(data.target) || 0,
      score: null,
      status: "planned",
      notes: data.notes || "",
      createdAt: nowISO(),
      completedAt: null
    };
  }

  function completeTest(state, id, score, note) {
    const test = state.tests.find(function (t) {
      return t.id === id;
    });
    if (test) {
      test.score = Number(score);
      test.status = "done";
      if (note != null) {
        test.notes = note;
      }
      test.completedAt = nowISO();
    }
    return state;
  }

  function removeTest(state, id) {
    state.tests = state.tests.filter(function (t) {
      return t.id !== id;
    });
    return state;
  }

  function formatClock(totalSeconds) {
    const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return h > 0 ? h + ":" + mm + ":" + ss : mm + ":" + ss;
  }

  function sanitizeFileName(name) {
    const cleaned = String(name || "file")
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 80);
    return cleaned || "file";
  }

  function createResource(data) {
    return {
      id: uid(),
      name: data.name || "未命名资料",
      subjectId: data.subjectId || "",
      type: data.type || "其他",
      tags: data.tags || "",
      fileId: null,
      fileName: data.fileName || "",
      size: 0,
      createdAt: nowISO()
    };
  }

  function removeResource(state, id) {
    state.resources = state.resources.filter(function (r) {
      return r.id !== id;
    });
    return state;
  }

  function createWrongQuestion(data) {
    return {
      id: uid(),
      subjectId: data.subjectId || "",
      source: data.source || "",
      difficulty: Number(data.difficulty) || 3,
      question: data.question || "",
      myAnswer: data.myAnswer || "",
      correctAnswer: data.correctAnswer || "",
      analysis: data.analysis || "",
      tags: data.tags || "",
      status: "todo",
      dueDate: data.dueDate || todayISO(),
      interval: 1,
      ease: 2.5,
      reviews: 0,
      createdAt: nowISO(),
      lastReviewedAt: null
    };
  }

  function removeWrongQuestion(state, id) {
    state.wrongQuestions = state.wrongQuestions.filter(function (q) {
      return q.id !== id;
    });
    return state;
  }

  function applyWrongReview(state, id, grade, date) {
    const index = state.wrongQuestions.findIndex(function (q) {
      return q.id === id;
    });
    if (index >= 0) {
      state.wrongQuestions[index] = scheduleReview(state.wrongQuestions[index], grade, date);
    }
    return state;
  }

  function filterWrongQuestions(questions, filters) {
    const query = String(filters.query || "").toLowerCase();
    return questions.filter(function (q) {
      const matchSubject = !filters.subjectId || filters.subjectId === "all" || q.subjectId === filters.subjectId;
      const matchStatus = !filters.status || filters.status === "all" || q.status === filters.status;
      const matchQuery = !query ||
        String(q.question || "").toLowerCase().includes(query) ||
        String(q.source || "").toLowerCase().includes(query) ||
        String(q.tags || "").toLowerCase().includes(query);
      return matchSubject && matchStatus && matchQuery;
    });
  }

  function updateSettings(state, settings, subjects) {
    state.settings = Object.assign({}, state.settings, settings);
    state.subjects = (Array.isArray(subjects) ? subjects : []).map(function (s, index) {
      return {
        id: s.id || uid(),
        name: String(s.name || "科目" + (index + 1)).trim() || "科目" + (index + 1),
        color: /^#[0-9a-fA-F]{6}$/.test(s.color || "") ? s.color : "#0f8f79"
      };
    });
    return state;
  }

  return {
    addDaysISO: addDaysISO,
    backupManifest: backupManifest,
    applyWrongReview: applyWrongReview,
    completeTest: completeTest,
    createWrongQuestion: createWrongQuestion,
    createResource: createResource,
    createTest: createTest,
    createPlan: createPlan,
    defaultState: defaultState,
    daysUntil: daysUntil,
    dueWrongQuestions: dueWrongQuestions,
    formatBytes: formatBytes,
    formatClock: formatClock,
    formatDateCN: formatDateCN,
    filterWrongQuestions: filterWrongQuestions,
    homeDigest: homeDigest,
    mergeState: mergeState,
    nowISO: nowISO,
    parseState: parseState,
    planSummary: planSummary,
    removePlan: removePlan,
    removeResource: removeResource,
    removeTest: removeTest,
    removeWrongQuestion: removeWrongQuestion,
    resourceStats: resourceStats,
    scheduleReview: scheduleReview,
    sanitizeFileName: sanitizeFileName,
    serializeState: serializeState,
    sortPlans: sortPlans,
    testStats: testStats,
    todayISO: todayISO,
    togglePlan: togglePlan,
    uid: uid,
    updateSettings: updateSettings,
    wrongStats: wrongStats
  };
});
