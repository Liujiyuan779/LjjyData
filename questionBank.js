(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.KaoYanQuestionBank = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const bank = [
    {
      id: "politics-2024-1",
      year: "2024",
      subjectId: "politics",
      type: "单选",
      question: "我国现阶段的基本经济制度是？",
      options: ["A. 单一的公有制经济", "B. 公有制为主体、多种所有制经济共同发展", "C. 完全的私有制经济", "D. 混合所有制为主"],
      answer: "B",
      analysis: "我国基本经济制度是公有制为主体、多种所有制经济共同发展。",
      source: "示例题库（非官方原题）"
    },
    {
      id: "politics-2024-2",
      year: "2024",
      subjectId: "politics",
      type: "单选",
      question: "马克思主义哲学认为，物质的唯一特性是？",
      options: ["A. 运动", "B. 客观实在性", "C. 可知性", "D. 永恒性"],
      answer: "B",
      analysis: "物质的唯一特性是客观实在性。",
      source: "示例题库（非官方原题）"
    },
    {
      id: "politics-2023-1",
      year: "2023",
      subjectId: "politics",
      type: "单选",
      question: "实践之所以是检验真理的唯一标准，是因为实践具有？",
      options: ["A. 直接现实性", "B. 自觉能动性", "C. 社会历史性", "D. 客观规律性"],
      answer: "A",
      analysis: "实践的直接现实性使它能够把主观认识与客观结果相对照。",
      source: "示例题库（非官方原题）"
    },
    {
      id: "english-2024-1",
      year: "2024",
      subjectId: "english",
      type: "单选",
      question: "The word \"significant\" is closest in meaning to ____.",
      options: ["A. important", "B. tiny", "C. doubtful", "D. recent"],
      answer: "A",
      analysis: "significant 意为重要的、显著的。",
      source: "示例题库（非官方原题）"
    },
    {
      id: "english-2024-2",
      year: "2024",
      subjectId: "english",
      type: "阅读",
      question: "According to the passage, the author's attitude toward the policy is ____.",
      options: ["A. supportive", "B. skeptical", "C. indifferent", "D. ironic"],
      answer: "B",
      analysis: "文中转折处表达了保留态度。",
      source: "示例题库（非官方原题）"
    },
    {
      id: "math-2025-1",
      year: "2025",
      subjectId: "math",
      type: "单选",
      question: "设函数 f(x)=x³-3x，则 f(x) 在区间 [-2,2] 上的最小值为？",
      options: ["A. -2", "B. 2", "C. -1", "D. 0"],
      answer: "A",
      analysis: "f'(x)=3x²-3，极值点为 x=±1，比较端点与极值点可得最小值为 -2。",
      source: "示例题库（非官方原题）"
    },
    {
      id: "math-2024-1",
      year: "2024",
      subjectId: "math",
      type: "填空",
      question: "lim(x→0) (1-cos x)/x² = ____.",
      options: null,
      answer: "1/2",
      analysis: "等价无穷小：1-cos x ~ x²/2。",
      source: "示例题库（非官方原题）"
    },
    {
      id: "major-2024-1",
      year: "2024",
      subjectId: "major",
      type: "简答",
      question: "简述数据结构中栈和队列的主要区别。",
      options: null,
      answer: "栈是后进先出结构，队列是先进先出结构。",
      analysis: "两者都是线性结构，区别在于允许插入和删除的一端。",
      source: "示例题库（非官方原题）"
    },
    {
      id: "major-2023-1",
      year: "2023",
      subjectId: "major",
      type: "名词解释",
      question: "解释时间复杂度。",
      options: null,
      answer: "时间复杂度描述算法运行时间随输入规模增长的变化趋势。",
      analysis: "通常用大 O 表示法描述。",
      source: "示例题库（非官方原题）"
    }
  ];

  return {
    bank: bank,
    subjects: ["politics", "english", "math", "major"],
    years: ["2025", "2024", "2023"]
  };
});
