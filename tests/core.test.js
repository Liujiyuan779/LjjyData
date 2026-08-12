"use strict";

const assert = require("assert");
const Core = require("../core.js");

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

test("日期工具：addDaysISO 和 daysUntil", function () {
  assert.strictEqual(Core.addDaysISO("2026-08-12", 3), "2026-08-15");
  assert.strictEqual(Core.addDaysISO("2026-08-12", -3), "2026-08-09");
  assert.strictEqual(Core.daysUntil("2026-12-19", "2026-08-12"), 129);
  assert.strictEqual(Core.formatDateCN("2026-08-12").includes("8月12日"), true);
});

test("默认状态结构完整", function () {
  const s = Core.defaultState("2026-08-12");
  assert.strictEqual(s.version, 1);
  assert.strictEqual(s.settings.theme, "light");
  assert.ok(Array.isArray(s.plans));
  assert.ok(Array.isArray(s.tests));
  assert.ok(Array.isArray(s.resources));
  assert.ok(Array.isArray(s.wrongQuestions));
  assert.ok(Array.isArray(s.subjects));
  assert.strictEqual(s.settings.examDate, "2026-12-19");
});

test("序列化与解析可往返", function () {
  const s = Core.defaultState("2026-08-12");
  const text = Core.serializeState(s);
  const result = Core.parseState(text, "2026-08-12");
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.state.settings.examName, s.settings.examName);
  assert.strictEqual(result.state.plans.length, s.plans.length);
});

test("损坏数据会返回错误而不是抛出", function () {
  const result = Core.parseState("{bad json", "2026-08-12");
  assert.strictEqual(result.ok, false);
});

test("mergeState 补齐缺失字段", function () {
  const result = Core.mergeState({ settings: { examDate: "2027-12-25" } }, "2026-08-12");
  assert.strictEqual(result.settings.examDate, "2027-12-25");
  assert.ok(result.subjects.length >= 4);
  assert.deepStrictEqual(result.plans, []);
  assert.deepStrictEqual(result.memos, []);
});

test("planSummary 计算完成数、下一条和完成率", function () {
  const plans = [
    { id: "1", date: "2026-08-12", time: "09:00", done: true },
    { id: "2", date: "2026-08-12", time: "10:00", done: false },
    { id: "3", date: "2026-08-13", time: "08:00", done: false }
  ];
  const summary = Core.planSummary(plans, "2026-08-12");
  assert.strictEqual(summary.total, 2);
  assert.strictEqual(summary.done, 1);
  assert.strictEqual(summary.rate, 50);
  assert.strictEqual(summary.next.id, "2");
});

test("testStats 统计待考、完成、平均分和目标达成", function () {
  const tests = [
    { status: "planned", score: null },
    { status: "done", score: 80, target: 70, completedAt: "2026-08-01T10:00:00.000Z" },
    { status: "done", score: 100, target: 110, completedAt: "2026-08-02T10:00:00.000Z" }
  ];
  const stats = Core.testStats(tests);
  assert.strictEqual(stats.planned, 1);
  assert.strictEqual(stats.completed, 2);
  assert.strictEqual(stats.avg, 90);
  assert.strictEqual(stats.targetHits, 1);
  assert.strictEqual(stats.recent.length, 2);
});

test("resourceStats 统计总数、大小和类型", function () {
  const stats = Core.resourceStats([
    { type: "真题", size: 1024, url: "" },
    { type: "讲义", size: 2048, url: "https://example.com/a.pdf" },
    { type: "真题", size: 512, url: "" }
  ]);
  assert.strictEqual(stats.total, 3);
  assert.strictEqual(stats.totalSize, 3584);
  assert.strictEqual(stats.urlCount, 1);
  assert.strictEqual(stats.typeCounts["真题"], 2);
  assert.strictEqual(stats.typeCounts["讲义"], 1);
});

test("wrongStats 区分待复习和已掌握", function () {
  const questions = [
    { status: "todo", dueDate: "2026-08-11" },
    { status: "reviewing", dueDate: "2026-08-12" },
    { status: "mastered", dueDate: "2026-08-13" }
  ];
  const stats = Core.wrongStats(questions, "2026-08-12");
  assert.strictEqual(stats.due, 2);
  assert.strictEqual(stats.mastered, 1);
});

test("scheduleReview 四种标记更新复习计划", function () {
  const base = { interval: 1, ease: 2.5, reviews: 2, status: "reviewing", dueDate: "2026-08-12" };
  const again = Core.scheduleReview(base, "again", "2026-08-12");
  assert.strictEqual(again.status, "todo");
  assert.strictEqual(again.dueDate, "2026-08-13");
  assert.strictEqual(again.ease, 2.3);

  const hard = Core.scheduleReview(base, "hard", "2026-08-12");
  assert.strictEqual(hard.dueDate, "2026-08-13");
  assert.strictEqual(hard.status, "reviewing");

  const good = Core.scheduleReview(base, "good", "2026-08-12");
  assert.strictEqual(good.interval, 3);
  assert.strictEqual(good.dueDate, "2026-08-15");

  const easy = Core.scheduleReview(base, "easy", "2026-08-12");
  assert.strictEqual(easy.status, "mastered");
  assert.ok(easy.interval >= 30);
});

test("backupManifest 包含文件数量", function () {
  const manifest = Core.backupManifest({
    version: 1,
    resources: [{ fileId: "a" }, { fileId: null }]
  }, "2026-08-12T10:00:00.000Z");
  assert.strictEqual(manifest.fileCount, 1);
  assert.strictEqual(manifest.createdAt, "2026-08-12T10:00:00.000Z");
});

test("homeDigest 汇总首页所需摘要", function () {
  const s = Core.defaultState("2026-08-12");
  s.plans[0].done = true;
  s.resources.push({ id: "r2", fileId: null });
  s.wrongQuestions[0].status = "mastered";
  const digest = Core.homeDigest(s, "2026-08-12");
  assert.strictEqual(digest.plan.done, 1);
  assert.strictEqual(digest.plan.total, 4);
  assert.strictEqual(digest.resourceCount, 2);
  assert.strictEqual(digest.wrongDue, 1);
  assert.strictEqual(digest.days, 129);
  assert.ok(digest.nextTest);
  assert.ok(digest.memos.length >= 1);
});

test("createPlan、togglePlan、removePlan 操作计划", function () {
  const state = { plans: [] };
  const plan = Core.createPlan({
    title: "背单词",
    subjectId: "english",
    time: "08:00",
    priority: "high",
    date: "2026-08-12"
  });
  state.plans.push(plan);
  assert.strictEqual(state.plans.length, 1);
  assert.strictEqual(plan.done, false);

  Core.togglePlan(state, plan.id);
  assert.strictEqual(state.plans[0].done, true);

  Core.removePlan(state, plan.id);
  assert.strictEqual(state.plans.length, 0);
});

test("createTest、completeTest、removeTest 操作测试", function () {
  const state = { tests: [] };
  const test = Core.createTest({
    name: "数学模拟",
    subjectId: "math",
    date: "2026-08-20",
    duration: 180,
    total: 150,
    target: 120
  });
  state.tests.push(test);
  assert.strictEqual(state.tests[0].status, "planned");
  assert.strictEqual(state.tests[0].score, null);

  Core.completeTest(state, test.id, 118, "计算题失分多");
  assert.strictEqual(state.tests[0].status, "done");
  assert.strictEqual(state.tests[0].score, 118);
  assert.strictEqual(state.tests[0].notes, "计算题失分多");
  assert.ok(state.tests[0].completedAt);

  Core.removeTest(state, test.id);
  assert.strictEqual(state.tests.length, 0);
});

test("formatClock 格式化倒计时", function () {
  assert.strictEqual(Core.formatClock(90), "01:30");
  assert.strictEqual(Core.formatClock(3661), "1:01:01");
  assert.strictEqual(Core.formatClock(0), "00:00");
});

test("createResource、removeResource、sanitizeFileName 操作资料", function () {
  const state = { resources: [] };
  const resource = Core.createResource({
    name: "高数讲义",
    subjectId: "math",
    type: "讲义",
    tags: "导数",
    url: "https://example.com/math.pdf"
  });
  state.resources.push(resource);
  assert.strictEqual(state.resources.length, 1);
  assert.strictEqual(resource.fileId, null);
  assert.strictEqual(resource.url, "https://example.com/math.pdf");
  assert.strictEqual(Core.sanitizeFileName("a/b:c?.pdf"), "a_b_c_.pdf");
  assert.strictEqual(Core.isValidHttpUrl("https://example.com"), true);
  assert.strictEqual(Core.isValidHttpUrl("ftp://example.com"), false);
  assert.strictEqual(Core.isValidHttpUrl("not-a-url"), false);
  Core.removeResource(state, resource.id);
  assert.strictEqual(state.resources.length, 0);
});

test("buildSearchUrl 和 buildExamSearchQuery 构造搜索", function () {
  assert.strictEqual(Core.buildSearchUrl("考研 真题"), "https://www.bing.com/search?q=" + encodeURIComponent("考研 真题"));
  const query = Core.buildExamSearchQuery({
    year: "2024",
    subjectName: "数学",
    keyword: "真题"
  });
  assert.strictEqual(query, "2024年 考研 数学 真题");
  const allYear = Core.buildExamSearchQuery({
    year: "all",
    subjectName: "英语",
    keyword: ""
  });
  assert.strictEqual(allYear, "考研 英语");
});

test("createWrongQuestion、removeWrongQuestion、applyWrongReview 操作错题", function () {
  const state = { wrongQuestions: [] };
  const q = Core.createWrongQuestion({
    subjectId: "math",
    source: "第三章",
    difficulty: 4,
    question: "求极限",
    myAnswer: "1",
    correctAnswer: "1/2",
    analysis: "等价无穷小",
    tags: "极限"
  });
  state.wrongQuestions.push(q);
  assert.strictEqual(state.wrongQuestions.length, 1);
  assert.strictEqual(q.status, "todo");

  Core.applyWrongReview(state, q.id, "good", "2026-08-12");
  assert.strictEqual(state.wrongQuestions[0].status, "reviewing");
  assert.strictEqual(state.wrongQuestions[0].reviews, 1);
  assert.strictEqual(state.wrongQuestions[0].dueDate, "2026-08-13");

  const filtered = Core.filterWrongQuestions(state.wrongQuestions, {
    subjectId: "math",
    status: "reviewing",
    query: "极限"
  });
  assert.strictEqual(filtered.length, 1);

  Core.removeWrongQuestion(state, q.id);
  assert.strictEqual(state.wrongQuestions.length, 0);
});

test("updateSettings 更新设置和科目", function () {
  const state = { settings: { examDate: "2026-12-19" }, subjects: [] };
  Core.updateSettings(state, { examDate: "2027-01-01", dailyGoal: 6, theme: "dark" }, [
    { id: "a", name: "政治", color: "#ff0000" },
    { name: "英语", color: "bad-color" }
  ]);
  assert.strictEqual(state.settings.examDate, "2027-01-01");
  assert.strictEqual(state.settings.dailyGoal, 6);
  assert.strictEqual(state.settings.theme, "dark");
  assert.strictEqual(state.subjects.length, 2);
  assert.strictEqual(state.subjects[0].name, "政治");
  assert.strictEqual(state.subjects[1].color, "#0f8f79");
  assert.ok(state.subjects[1].id);
});

test("pickQuestions 按科目和年份筛选", function () {
  const bank = [
    { id: "a", year: "2024", subjectId: "math" },
    { id: "b", year: "2025", subjectId: "math" },
    { id: "c", year: "2024", subjectId: "english" }
  ];
  const picked = Core.pickQuestions(bank, { subjectId: "math", year: "2024" }, 1);
  assert.strictEqual(picked.length, 1);
  assert.strictEqual(picked[0].id, "a");
});

test("createGeneratedTest 自动组卷并带题目", function () {
  const state = Core.defaultState("2026-08-12");
  const test = Core.createGeneratedTest(state, {
    subjectId: "math",
    year: "2024",
    bank: [
      { id: "q1", year: "2024", subjectId: "math", type: "单选", question: "Q1", options: ["A. a", "B. b"], answer: "A" }
    ],
    sourceLabel: "示例题库"
  });
  assert.strictEqual(test.generated, true);
  assert.strictEqual(test.questions.length, 1);
  assert.strictEqual(test.status, "planned");
});

test("parseQuestionText 解析带选项的导入文本", function () {
  const text = [
    "科目：数学",
    "年份：2024",
    "题型：单选",
    "题干：求 1+1",
    "选项A：1",
    "选项B：2",
    "答案：B",
    "解析：1+1=2",
    "",
    "科目：英语",
    "题型：填空",
    "题干：The sky is ____.",
    "答案：blue",
    "解析：天空是蓝色的。"
  ].join("\n");
  const result = Core.parseQuestionText(text);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.questions.length, 2);
  assert.strictEqual(result.questions[0].subjectId, "math");
  assert.deepStrictEqual(result.questions[0].options, ["1", "2"]);
});

test("parseQuestionJson 解析 JSON 题库", function () {
  const result = Core.parseQuestionJson(JSON.stringify({
    questions: [
      { year: "2025", subjectId: "english", question: "Q", options: ["A. a", "B. b"], answer: "A" }
    ]
  }));
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.questions.length, 1);
  assert.strictEqual(result.questions[0].source, "导入题库");
});

test("markUserAnswer、gradeGeneratedTest、completeGeneratedTest 自动判分", function () {
  const state = Core.defaultState("2026-08-12");
  const test = Core.createGeneratedTest(state, {
    subjectId: "math",
    bank: [
      { id: "q1", year: "2024", subjectId: "math", type: "单选", question: "Q1", options: ["A. a", "B. b"], answer: "A" },
      { id: "q2", year: "2024", subjectId: "math", type: "单选", question: "Q2", options: ["A. a", "B. b"], answer: "B" },
      { id: "q3", year: "2024", subjectId: "math", type: "解答", question: "主观题", options: null, answer: "自行核对" }
    ]
  });
  state.tests.push(test);
  Core.markUserAnswer(state, test.id, test.questions[0].id, "A");
  Core.markUserAnswer(state, test.id, test.questions[1].id, "A");
  const grade = Core.gradeGeneratedTest(test);
  assert.strictEqual(grade.objectiveTotal, 2);
  assert.strictEqual(grade.correct, 1);
  assert.strictEqual(grade.score, 1);
  Core.completeGeneratedTest(state, test.id);
  const updated = state.tests.find(function (t) {
    return t.id === test.id;
  });
  assert.strictEqual(updated.status, "done");
  assert.strictEqual(updated.score, 1);
});

if (failed) {
  process.exit(1);
}
console.log("ALL CORE TESTS PASSED");
