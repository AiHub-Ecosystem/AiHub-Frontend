// @ts-nocheck
/* eslint-disable */

export var SVC_ORDER = ["grade", "weakness", "exercise", "roadmap"];
export var SKILL_ORDER = ["writing", "speaking", "reading", "listening"];
export var SKL = {
  writing: "Writing",
  speaking: "Speaking",
  reading: "Reading",
  listening: "Listening",
};
export var SUF = {
  grade: "grade",
  weakness: "analyze",
  exercise: "exercise",
  roadmap: "roadmap",
};
export var SKM = { writing: 1, speaking: 0.6, reading: 0.45, listening: 0.4 };
export var USERS = [
  "student_1042",
  "student_0877",
  "student_1203",
  "student_0451",
  "student_0090",
];
export var TIMES = [
  "15/10 10:42:07",
  "15/10 10:41:55",
  "15/10 10:40:12",
  "15/10 10:38:40",
  "15/10 10:31:02",
];
export var KEYCYC = [
  "Wispace Production",
  "IELTS Center Staging",
  "Wispace Production",
  "Minh test",
  "Wispace Production",
];
export var PAT = [
  0.67, 0.74, 0.62, 0.83, 0.92, 0.49, 0.39, 0.87, 0.96, 1.0, 0.93, 1.05, 0.74,
  1,
];
export var API = "https://api.aihubproduction.com";
export var KEYH = "Authorization: Bearer aihub_sandbox_znon3a…";

export function scopeOf(svc, sk) {
  return sk + "." + SUF[svc];
}
export function fmt(n) {
  return Number(n).toLocaleString("vi-VN");
}
export function pillCls(t) {
  return t === "ok"
    ? "pill p-ok"
    : t === "warn"
      ? "pill p-warn"
      : t === "neu"
        ? "pill p-neu"
        : "pill p-err";
}
export function parseVN(s) {
  var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((s || "").trim());
  return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
}

export function ops(o) {
  var pc = Math.round((o.q[1] / o.q[2]) * 100);
  return {
    recentTitle: o.recentTitle,
    plan: o.plan,
    today: o.today,
    todayMax: o.todayMax,
    recent: o.rows.map(function (r, i) {
      return {
        t: TIMES[i],
        u: r[0],
        i: r[1],
        o: r[2],
        l: r[3],
        s: r[4],
        cls: pillCls(r[5]),
      };
    }),
    logs: o.rows.map(function (r, i) {
      var bad = r[5] === "err";
      return {
        t: TIMES[i],
        m: o.method || "POST",
        p: o.path,
        k: KEYCYC[i],
        u: r[0],
        c: r[6] || (bad ? "422" : "200"),
        l: r[3],
        rid: "req_01JA9" + o.rid + (i + 3) + "K",
        model: bad ? "—" : o.model,
        inp: r[1],
        out: bad ? r[4] : r[2],
      };
    }),
    quotas: [
      { l: o.q[0], used: o.q[1], total: o.q[2], reset: "01/10/2027" },
      { l: o.r[0], used: o.r[1], total: o.r[2], reset: "đỉnh 24h qua" },
    ],
    stats: o.stats,
    forecast:
      "Đã dùng " +
      pc +
      "% quota “" +
      o.q[0] +
      "”. " +
      (o.cap
        ? "Theo tốc độ hiện tại sẽ chạm trần khoảng " + o.cap + "."
        : "Theo tốc độ hiện tại, đủ dùng đến hết kỳ."),
    chartTitle: o.chartTitle,
    unitShort: o.unitShort,
    chart: PAT.map(function (x) {
      return Math.round(x * o.today);
    }),
    topUsers: o.top.map(function (n, i) {
      return { id: USERS[i], n: n };
    }),
  };
}

/* ====== Mã lỗi theo kỹ năng ====== */
export var CODES = {
  writing: [
    { c: "collocation_error", n: "Sai collocation", g: "LR" },
    { c: "lexical_repetition", n: "Lặp từ", g: "LR" },
    { c: "inappropriate_word_choice", n: "Dùng từ không phù hợp", g: "LR" },
  ],
  speaking: [
    { c: "hesitation", n: "Ngập ngừng, ngắt quãng", g: "FC" },
    { c: "verb_tense", n: "Chia sai thì", g: "GRA" },
    { c: "word_stress", n: "Nhấn sai trọng âm", g: "P" },
  ],
  reading: [
    { c: "tfng_not_given_confusion", n: "Nhầm NOT GIVEN với FALSE", g: "TFNG" },
    {
      c: "matching_headings_main_idea",
      n: "Chọn heading theo chi tiết thay vì ý chính",
      g: "Headings",
    },
    {
      c: "completion_spelling",
      n: "Sai chính tả / dạng từ ở câu điền",
      g: "Completion",
    },
  ],
  listening: [
    { c: "distractor_trap", n: "Chọn thông tin gây nhiễu", g: "Part 2" },
    {
      c: "form_completion_spelling",
      n: "Sai chính tả ở câu điền form",
      g: "Part 1",
    },
    { c: "map_labelling", n: "Xác định sai vị trí trên bản đồ", g: "Part 2" },
  ],
};
export var GROUPS = {
  writing: ["TR", "CC", "LR", "GRA"],
  speaking: ["FC", "LR", "GRA", "P"],
  reading: ["TFNG", "Headings", "MCQ", "Completion"],
  listening: ["Part 1", "Part 2", "Part 3", "Part 4"],
};

/* ====== Bước định danh dùng chung ====== */
export function idStep(sk) {
  return {
    short: "Định danh học viên",
    title: "Định danh học viên",
    desc: "Mỗi request gắn với một End-user (học viên của bạn) để AIHub tính usage và nối lịch sử chấm cho Phân tích điểm yếu. Xong sẽ tự sang bước tiếp theo.",
    fields: [
      {
        id: "idmode",
        label: "Cách định danh",
        kind: "chips",
        options: ["Declared User ID", "Signed User Assertion"],
        def: "Declared User ID",
      },
      {
        id: "uid",
        label: "end_user_id",
        kind: "input",
        def: "student_001",
        help: "ID học viên trong hệ thống của bạn. Thử xoá trống để xem lỗi USER_ID_REQUIRED.",
      },
    ],
    method: "GET",
    path: "/v1/me",
    run: "Kiểm tra định danh",
    invalid: function (v) {
      return !v.uid;
    },
    req: function (v) {
      return (
        "GET " +
        API +
        "/v1/me\n" +
        KEYH +
        "\n" +
        (v.idmode === "Signed User Assertion"
          ? "X-AIHub-User-Assertion: eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOi…"
          : "X-AIHub-User-Id: " + v.uid)
      );
    },
    ok: function (v) {
      return (
        'HTTP 200\n{\n  "org_id": "org_01M4XB56SVSWVDR97BC2H640DD",\n  "end_user_id": "' +
        v.uid +
        '",\n  "identity": "' +
        (v.idmode === "Signed User Assertion" ? "signed" : "declared") +
        '",\n  "scopes": ["writing.grade", "speaking.grade"]\n}'
      );
    },
    err: function () {
      return 'HTTP 400\n{\n  "error_code": "USER_ID_REQUIRED",\n  "error_message": "Thiếu X-AIHub-User-Id."\n}';
    },
    fix: "Gửi header X-AIHub-User-Id (ID học viên) ở mọi request, hoặc bật Signed User Assertion ở trang Xác thực End-user.",
    lat: "84 ms",
    slowLat: "3,1 s",
    slowNote:
      "Request định danh không nên chậm. Kiểm tra mạng từ server của bạn tới AIHub.",
  };
}
export var APP_STEP = {
  short: "Đưa vào app của bạn",
  title: "Đưa vào app của bạn",
  desc: "Copy prompt hoặc code bên dưới. Phía dưới nữa là dữ liệu vừa trả về để bạn đối chiếu.",
  app: true,
};

export var ESSAY =
  "Some people believe that universities should focus only on academic subjects, while others think they should also prepare students for work. In my opinion, both goals are important. Firstly, universities make a research that helps the society develop. Secondly, students need practical skills because the enviroment of modern companies changes quickly...";

/* =================== 1. CHẤM CHỮA =================== */
export var GRADE_BASE = {
  name: "Chấm chữa",
  group: "Dịch vụ 1 / 4",
  badge: "Stable",
  badgeCls: "badge b-stable",
  prev: null,
  inText: "Bài làm của học viên",
  next: "weakness",
  nextCta: "Phân tích điểm yếu của học viên này",
  nextHint: "gom lỗi từ nhiều bài chấm của cùng học viên thành hồ sơ điểm yếu.",
  plans: [
    {
      name: "G-6K",
      feats: [
        "6.000 lượt chấm / năm, dùng chung 4 kỹ năng",
        "Speaking: 1 phút audio = 1 lượt",
      ],
      price: "[giá] credit / năm",
    },
    {
      name: "G-12K",
      feats: [
        "12.000 lượt chấm / năm, dùng chung 4 kỹ năng",
        "Speaking: 1 phút audio = 1 lượt",
      ],
      price: "[giá] credit / năm",
      current: true,
    },
    {
      name: "G-30K",
      feats: [
        "30.000 lượt chấm / năm, dùng chung 4 kỹ năng",
        "Speaking: 1 phút audio = 1 lượt",
      ],
      price: "[giá] credit / năm",
    },
    {
      name: "G-MAX",
      feats: ["Theo nhu cầu", "SLA riêng"],
      price: "Báo giá riêng",
      contact: true,
    },
  ],
};

export var GRADE_W = {
  demoUrl: "https://aihubproduction.com/demo/scoring",
  special: "Rubric & mã lỗi",
  specialKey: "rubric",
  desc: "Chấm và chữa bài IELTS Writing Task 1, Task 2 theo 4 tiêu chí: band từng tiêu chí, nhận xét, lỗi có mã kèm gợi ý sửa.",
  tryTitle: "Chấm chữa thử một bài Writing",
  tryDesc:
    "Dùng bài mẫu hoặc dán bài của bạn để xem AIHub trả về gì, trước khi viết dòng code nào.",
  tryLabel: "Bài làm · Task 2",
  tryInput: ESSAY,
  tryRows: 6,
  tryCta: "Chấm chữa thử",
  tryRunningText: "Đang chấm theo 4 tiêu chí…",
  tryFacts: [
    { l: "Task hỗ trợ", v: "Task 1 · Task 2" },
    { l: "Tiêu chí", v: "TR/TA · CC · LR · GRA" },
    { l: "Trả kết quả", v: "JSON đồng bộ" },
  ],
  flowDesc:
    "Bấm chạy từng bước — xong bước nào sẽ tự trượt sang bước tiếp theo. Cuối cùng copy prompt AI hoặc code vào app của bạn.",
  result: {
    headline: "Band 6.5",
    sub: "Task 2 · 287 từ · chấm trong 4,2 giây",
    metrics: [
      { l: "Task Response", v: "6.5" },
      { l: "Coherence & Cohesion", v: "7.0" },
      { l: "Lexical Resource", v: "6.0" },
      { l: "Grammatical Range", v: "6.5" },
    ],
    comment:
      "Lập luận rõ ở hai đoạn thân bài. Cần đa dạng từ vựng và sửa collocation để lên band 7.",
    itemsTitle: "Lỗi và bản sửa (3)",
    items: [
      {
        code: "collocation_error",
        text: "“make a research” → “do research”",
        meta: "LR · câu 3",
      },
      {
        code: "spelling_error",
        text: "“enviroment” → “environment”",
        meta: "LR · câu 4",
      },
      {
        code: "lexical_repetition",
        text: "“important” lặp 4 lần → “crucial”, “essential”",
        meta: "LR",
      },
    ],
  },
  steps: [
    idStep("writing"),
    {
      short: "Gửi bài chấm",
      title: "Gửi bài chấm chữa",
      desc: "Gửi đề và bài làm lên AIHub. Định danh từ bước trước đã điền sẵn vào header.",
      fields: [
        {
          id: "task",
          label: "task_type",
          kind: "chips",
          options: ["task_1", "task_2"],
          def: "task_2",
        },
        {
          id: "essay",
          label: "essay",
          kind: "text",
          def: ESSAY,
          help: "Thử xoá bớt còn dưới 50 từ để xem lỗi ESSAY_TOO_SHORT.",
        },
      ],
      method: "POST",
      path: "/v1/writing/grade",
      run: "Chấm chữa",
      invalid: function (v) {
        return (v.essay || "").trim().split(/\s+/).length < 50;
      },
      req: function (v) {
        return (
          "POST " +
          API +
          "/v1/writing/grade\n" +
          KEYH +
          "\nX-AIHub-User-Id: " +
          v.uid +
          '\nIdempotency-Key: sub_8f21c\nContent-Type: application/json\n\n{\n  "task_type": "' +
          v.task +
          '",\n  "prompt": "Universities should focus only on academic subjects…",\n  "essay": "' +
          (v.essay || "").slice(0, 60).replace(/"/g, '\\"') +
          '…"\n}'
        );
      },
      ok: function () {
        return 'HTTP 200\n{\n  "request_id": "req_01JA9W2K",\n  "overall_band": 6.5,\n  "criteria": { "TR": 6.5, "CC": 7.0, "LR": 6.0, "GRA": 6.5 },\n  "errors": [\n    { "code": "collocation_error", "excerpt": "make a research", "suggestion": "do research" },\n    { "code": "spelling_error", "excerpt": "enviroment", "suggestion": "environment" },\n    { "code": "lexical_repetition", "excerpt": "important", "count": 4 }\n  ],\n  "model": "writing-grader-2026-09"\n}';
      },
      err: function () {
        return 'HTTP 422\n{\n  "error_code": "ESSAY_TOO_SHORT",\n  "error_message": "Bài làm cần ít nhất 50 từ.",\n  "word_count": 32\n}';
      },
      fix: "Kiểm tra số từ ở frontend trước khi gửi. Dưới 50 từ không chấm; dưới 150/250 từ vẫn chấm nhưng band TR/TA bị giới hạn.",
      lat: "4,2 s",
      slowLat: "9,8 s",
      slowNote:
        "AI chấm có thể mất tới 30 giây khi tải cao. Đặt timeout ≥ 30 giây và gửi Idempotency-Key để retry không bị tính tiền hai lần.",
    },
    APP_STEP,
  ],
  after: [
    "Dán prompt vào công cụ AI coding (Cursor, Claude, ChatGPT…) trong project của bạn.",
    "Đặt AIHUB_API_KEY — lấy ở trang chi tiết API key trong Tổng quan.",
    "Gửi ID học viên thật vào X-AIHub-User-Id để lịch sử chấm nối được sang Phân tích điểm yếu.",
  ],
  code: {
    prompt: function (v) {
      return (
        "Tôi muốn tích hợp AIHub API (" +
        API +
        ") để chấm chữa IELTS Writing trong app của tôi. Hãy viết một endpoint Node.js (Express) nhận đề + bài làm từ frontend, gọi AIHub rồi trả band, nhận xét và lỗi kèm bản sửa về cho học viên.\n\nYêu cầu:\n- Chỉ gọi AIHub từ server. Đọc AIHUB_API_KEY từ biến môi trường, gửi header Authorization: Bearer <key>.\n- Gửi X-AIHub-User-Id = ID học viên đang đăng nhập (giá trị thử: " +
        v.uid +
        ').\n- POST /v1/writing/grade, body {"task_type":"' +
        v.task +
        '","prompt":"...","essay":"..."}.\n- Response có request_id, overall_band, criteria {TR,CC,LR,GRA}, errors[{code,excerpt,suggestion}]. Lưu request_id để phân tích điểm yếu sau này.\n- Gửi Idempotency-Key theo mã bài nộp; timeout 30 giây.\n- Xử lý lỗi: USER_ID_REQUIRED, ESSAY_TOO_SHORT, QUOTA_EXCEEDED, RATE_LIMITED (retry có backoff).'
      );
    },
    node: function (v) {
      return [
        "app.post('/api/grade/writing', async (req, res) => {",
        "  const r = await fetch('" + API + "/v1/writing/grade', {",
        "    method: 'POST',",
        "    headers: {",
        "      Authorization: 'Bearer ' + process.env.AIHUB_API_KEY,",
        "      'X-AIHub-User-Id': req.user.id, // thử: " + v.uid,
        "      'Idempotency-Key': req.body.submissionId,",
        "      'Content-Type': 'application/json'",
        "    },",
        "    body: JSON.stringify({ task_type: '" +
          v.task +
          "', prompt: req.body.prompt, essay: req.body.essay }),",
        "    signal: AbortSignal.timeout(30000)",
        "  });",
        "  const data = await r.json();",
        "  if (!r.ok) return res.status(r.status).json({ code: data.error_code });",
        "  await saveGrade(req.user.id, data.request_id, data);",
        "  res.json({ band: data.overall_band, criteria: data.criteria, errors: data.errors });",
        "});",
      ].join("\n");
    },
    python: function (v) {
      return [
        "import os, requests",
        "",
        "def grade_writing(user_id, submission_id, prompt, essay):",
        "    r = requests.post(",
        "        '" + API + "/v1/writing/grade',",
        "        headers={",
        "            'Authorization': 'Bearer ' + os.environ['AIHUB_API_KEY'],",
        "            'X-AIHub-User-Id': user_id,  # thử: " + v.uid,
        "            'Idempotency-Key': submission_id,",
        "        },",
        "        json={'task_type': '" +
          v.task +
          "', 'prompt': prompt, 'essay': essay},",
        "        timeout=30,",
        "    )",
        "    data = r.json()",
        "    if not r.ok:",
        "        raise RuntimeError(data['error_code'])",
        "    return data",
      ].join("\n");
    },
  },
  recentTitle: "Bài Writing chấm gần đây",
  plan: "G-12K",
  today: 612,
  todayMax: 5000,
  recent: [
    {
      t: "15/10 10:42:07",
      u: "student_1042",
      i: "Task 2 · 291 từ",
      o: "Band 6.5",
      l: "4,1 s",
      s: "Thành công",
      cls: "pill p-ok",
    },
    {
      t: "15/10 10:41:55",
      u: "student_0877",
      i: "Task 1 · 176 từ",
      o: "Band 6.0",
      l: "3,8 s",
      s: "Thành công",
      cls: "pill p-ok",
    },
    {
      t: "15/10 10:40:12",
      u: "student_1203",
      i: "Task 2 · 41 từ",
      o: "—",
      l: "62 ms",
      s: "ESSAY_TOO_SHORT",
      cls: "pill p-err",
    },
    {
      t: "15/10 10:38:40",
      u: "student_0451",
      i: "Task 2 · 312 từ",
      o: "Band 7.0",
      l: "5,6 s",
      s: "Thành công",
      cls: "pill p-ok",
    },
    {
      t: "15/10 10:31:02",
      u: "student_0090",
      i: "Task 2 · 268 từ",
      o: "Band 5.5",
      l: "12,4 s",
      s: "Chậm",
      cls: "pill p-warn",
    },
  ],
  quotas: [
    {
      l: "Lượt chấm Writing / năm",
      used: 8420,
      total: 12000,
      reset: "01/10/2027",
    },
    { l: "Request / phút", used: 38, total: 120, reset: "đỉnh 24h qua" },
  ],
  stats: [
    { l: "Bài chấm 14 ngày", v: "7.412" },
    { l: "End-user", v: "1.208" },
    { l: "Lỗi 24h", v: "6" },
    { l: "Latency p95", v: "6,8 s" },
  ],
  forecast:
    "Đã dùng 70% quota “Lượt chấm Writing / năm”. Theo tốc độ hiện tại sẽ chạm trần khoảng 23/12/2026.",
  chartTitle: "Bài Writing chấm 14 ngày",
  unitShort: "Bài chấm",
  chart: [410, 452, 380, 505, 560, 298, 240, 530, 588, 610, 572, 640, 455, 612],
  topUsers: [
    { id: "student_1042", n: 38 },
    { id: "student_0877", n: 31 },
    { id: "student_0451", n: 27 },
    { id: "student_1203", n: 24 },
    { id: "student_0090", n: 19 },
  ],
  logs: [
    {
      t: "15/10 10:42:07",
      m: "POST",
      p: "/v1/writing/grade",
      k: "Wispace Production",
      u: "student_1042",
      c: "200",
      l: "4,1 s",
      rid: "req_01JA9W2K",
      model: "writing-grader-2026-09",
      inp: 'task_2 · 291 từ · "Some people believe that universities…"',
      out: "overall_band 6.5 · 3 errors",
    },
    {
      t: "15/10 10:41:55",
      m: "POST",
      p: "/v1/writing/grade",
      k: "IELTS Center Staging",
      u: "student_0877",
      c: "200",
      l: "3,8 s",
      rid: "req_01JA9W1Q",
      model: "writing-grader-2026-09",
      inp: 'task_1 · 176 từ · "The bar chart illustrates…"',
      out: "overall_band 6.0 · 5 errors",
    },
    {
      t: "15/10 10:40:12",
      m: "POST",
      p: "/v1/writing/grade",
      k: "Wispace Production",
      u: "student_1203",
      c: "422",
      l: "62 ms",
      rid: "req_01JA9VZ8",
      model: "—",
      inp: "task_2 · 41 từ",
      out: "ESSAY_TOO_SHORT",
    },
    {
      t: "15/10 10:39:30",
      m: "GET",
      p: "/v1/me",
      k: "Minh test",
      u: "—",
      c: "400",
      l: "9 ms",
      rid: "req_01JA9VY1",
      model: "—",
      inp: "thiếu X-AIHub-User-Id",
      out: "USER_ID_REQUIRED",
    },
    {
      t: "15/10 10:35:02",
      m: "POST",
      p: "/v1/writing/grade",
      k: "IELTS Center Staging",
      u: "student_0612",
      c: "429",
      l: "4 ms",
      rid: "req_01JA9VQ2",
      model: "—",
      inp: "—",
      out: "RATE_LIMITED · retry sau 2 s",
    },
  ],
};

export var GRADE_S = {
  demoUrl: "https://aihubproduction.com/demo/scoring",
  special: "Webhook kết quả chấm",
  specialKey: "webhook",
  desc: "Chấm và chữa câu trả lời IELTS Speaking qua audio: lấy câu hỏi theo Part, nhận audio, chấm bất đồng bộ rồi gửi transcript, band 4 tiêu chí và lỗi có mã về webhook của bạn.",
  tryTitle: "Chấm chữa thử một câu trả lời Speaking",
  tryDesc:
    "Dùng audio mẫu Part 2 (1:48) để xem transcript, band và lỗi trả về qua webhook.",
  tryLabel: "Câu hỏi · Part 2",
  tryInput:
    "Describe a place you visited that you would like to go back to. You should say: where it is, when you went there, what you did there, and explain why you would like to go back.",
  tryRows: 4,
  tryCta: "Chấm audio mẫu",
  tryRunningText: "Đang nhận diện giọng nói và chấm… (async)",
  tryFacts: [
    { l: "Part hỗ trợ", v: "Part 1 · 2 · 3" },
    { l: "Định dạng audio", v: "mp3 · m4a · wav · webm" },
    { l: "Trả kết quả", v: "Webhook (async)" },
  ],
  flowDesc:
    "Speaking chạy bất đồng bộ: gửi audio nhận job_id, kết quả về webhook của bạn. Bước 2.4 mô phỏng sự kiện webhook có chữ ký HMAC.",
  result: {
    headline: "Band 6.0",
    sub: "Part 2 · audio 1:48 · webhook sau 11 giây",
    metrics: [
      { l: "Fluency & Coherence", v: "6.0" },
      { l: "Lexical Resource", v: "6.0" },
      { l: "Grammatical Range", v: "5.5" },
      { l: "Pronunciation", v: "6.5" },
    ],
    comment:
      "Trả lời đủ ý, phát âm rõ. Ngập ngừng nhiều ở đoạn giữa và chia sai thì quá khứ.",
    itemsTitle: "Lỗi và bản sửa (3)",
    items: [
      {
        code: "hesitation",
        text: "Ngập ngừng 6 lần trong 0:42–1:05",
        meta: "FC",
      },
      {
        code: "verb_tense",
        text: "“Last year I go to Da Lat” → “went”",
        meta: "GRA · 0:18",
      },
      {
        code: "word_stress",
        text: "“comfortable” nhấn sai âm",
        meta: "P · 1:21",
      },
    ],
  },
  steps: [
    idStep("speaking"),
    {
      short: "Gửi audio",
      title: "Gửi audio để chấm chữa",
      desc: "Upload audio câu trả lời kèm question_id. AIHub trả 202 kèm job_id ngay, chấm xong sẽ gửi webhook.",
      fields: [
        {
          id: "part",
          label: "part",
          kind: "chips",
          options: ["1", "2", "3"],
          def: "2",
        },
        {
          id: "audio",
          label: "audio",
          kind: "chips",
          options: ["answer_p2.m4a · 1:48", "answer_short.m4a · 0:06"],
          def: "answer_p2.m4a · 1:48",
          help: "Chọn audio 6 giây để xem lỗi AUDIO_TOO_SHORT.",
        },
      ],
      method: "POST",
      path: "/v1/speaking/grade",
      run: "Gửi audio",
      invalid: function (v) {
        return v.audio.indexOf("0:06") >= 0;
      },
      req: function (v) {
        return (
          "POST " +
          API +
          "/v1/speaking/grade\n" +
          KEYH +
          "\nX-AIHub-User-Id: " +
          v.uid +
          "\nContent-Type: multipart/form-data\n\nquestion_id=q_p" +
          v.part +
          "_0381\naudio=@" +
          v.audio.split(" ")[0]
        );
      },
      ok: function () {
        return 'HTTP 202\n{\n  "job_id": "job_5HX20Q",\n  "status": "queued",\n  "estimated_seconds": 12\n}';
      },
      err: function () {
        return 'HTTP 422\n{\n  "error_code": "AUDIO_TOO_SHORT",\n  "error_message": "Audio cần ít nhất 15 giây giọng nói."\n}';
      },
      fix: "Chặn nộp bài ở app khi bản ghi dưới 15 giây. Định dạng hỗ trợ: mp3, m4a, wav, webm (≤ 25 MB).",
      lat: "640 ms",
      slowLat: "6,9 s",
      slowNote:
        "Upload chậm thường do file lớn. Nén audio về mono 16 kHz trước khi gửi.",
    },
    {
      short: "Nhận webhook",
      title: "Nhận kết quả qua webhook",
      desc: "AIHub POST sự kiện speaking.graded tới Webhook URL trên key. Verify chữ ký trước khi tin dữ liệu.",
      fields: [
        {
          id: "hook",
          label: "Webhook URL",
          kind: "input",
          def: "https://api.yourapp.com/hooks/aihub",
          help: "Thử gõ http:// hoặc localhost để xem AIHub từ chối thế nào.",
        },
      ],
      method: "POST",
      path: "→ webhook của bạn",
      run: "Gửi sự kiện thử",
      invalid: function (v) {
        return (
          v.hook.indexOf("https://") !== 0 || v.hook.indexOf("localhost") >= 0
        );
      },
      req: function (v) {
        return (
          "POST " +
          v.hook +
          '\nX-AIHub-Event: speaking.graded\nX-AIHub-Signature: t=1792000000,v1=9f2c…e41a\nContent-Type: application/json\n\n{\n  "job_id": "job_5HX20Q",\n  "request_id": "req_01JA9W5S",\n  "end_user_id": "' +
          v.uid +
          '",\n  "overall_band": 6.0,\n  "criteria": { "FC": 6.0, "LR": 6.0, "GRA": 5.5, "P": 6.5 },\n  "transcript": "Last year I go to Da Lat with my family…"\n}'
        );
      },
      ok: function () {
        return "Server của bạn trả: HTTP 200\nChữ ký HMAC-SHA256: hợp lệ ✓\nĐã giao sau 11 giây kể từ khi gửi audio.";
      },
      err: function (v) {
        return v.hook.indexOf("https://") !== 0 ||
          v.hook.indexOf("localhost") >= 0
          ? 'Từ chối lưu URL\n{\n  "error_code": "WEBHOOK_URL_INVALID",\n  "error_message": "Webhook phải là https và truy cập được từ internet."\n}'
          : 'Server của bạn trả: HTTP 401\nChữ ký HMAC-SHA256: không khớp ✗\n{\n  "error_code": "SIGNATURE_INVALID"\n}';
      },
      fix: "Dùng URL https công khai (thử local qua ngrok). Verify chữ ký trên rawBody chưa parse, với signing secret ở tab Webhook kết quả chấm.",
      lat: "11 s",
      slowLat: "48 s",
      slowNote:
        "Khi tải cao, kết quả có thể về sau 30–60 giây. Hiện trạng thái “Đang chấm” và dùng GET /v1/speaking/jobs/{job_id} làm phương án dự phòng.",
    },
    APP_STEP,
  ],
  after: [
    "Dán prompt vào công cụ AI coding trong project của bạn.",
    "Đặt AIHUB_API_KEY và AIHUB_WEBHOOK_SECRET (tab Webhook kết quả chấm).",
    "Khai báo Webhook URL ở trang chi tiết API key.",
  ],
  code: {
    prompt: function (v) {
      return (
        "Tôi muốn tích hợp AIHub Speaking (" +
        API +
        ") vào app luyện IELTS. Hãy viết code Node.js (Express) gồm 2 phần.\n\n1) Endpoint nhận audio từ app: gọi POST /v1/speaking/grade (multipart: question_id, audio), header Authorization: Bearer <AIHUB_API_KEY>, X-AIHub-User-Id = ID học viên (thử: " +
        v.uid +
        '). Lưu job_id, trả cho app trạng thái "Đang chấm".\n2) Endpoint webhook tại ' +
        v.hook +
        ": đọc rawBody, verify header X-AIHub-Signature (HMAC-SHA256 với AIHUB_WEBHOOK_SECRET), trả 200 ngay, rồi lưu request_id, overall_band, criteria {FC,LR,GRA,P}, transcript theo job_id.\n\nXử lý lỗi: AUDIO_TOO_SHORT, AUDIO_FORMAT_UNSUPPORTED, SIGNATURE_INVALID, sự kiện speaking.failed."
      );
    },
    node: function () {
      return [
        "import crypto from 'crypto';",
        "",
        "app.post('/hooks/aihub', express.raw({ type: 'application/json' }), (req, res) => {",
        "  const [t, v1] = req.get('X-AIHub-Signature').split(',').map(s => s.split('=')[1]);",
        "  const mac = crypto.createHmac('sha256', process.env.AIHUB_WEBHOOK_SECRET)",
        "    .update(t + '.' + req.body).digest('hex');",
        "  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(v1))) return res.sendStatus(401);",
        "  res.sendStatus(200);",
        "  const evt = JSON.parse(req.body);",
        "  if (req.get('X-AIHub-Event') === 'speaking.graded') saveResult(evt.job_id, evt);",
        "});",
      ].join("\n");
    },
    python: function () {
      return [
        "import hmac, hashlib, os",
        "",
        "@app.post('/hooks/aihub')",
        "def aihub_hook():",
        "    raw = request.get_data()",
        "    t, v1 = [p.split('=')[1] for p in request.headers['X-AIHub-Signature'].split(',')]",
        "    mac = hmac.new(os.environ['AIHUB_WEBHOOK_SECRET'].encode(), (t + '.').encode() + raw, hashlib.sha256).hexdigest()",
        "    if not hmac.compare_digest(mac, v1):",
        "        abort(401)",
        "    evt = request.get_json()",
        "    if request.headers['X-AIHub-Event'] == 'speaking.graded':",
        "        save_result(evt['job_id'], evt)",
        "    return '', 200",
      ].join("\n");
    },
  },
  recentTitle: "Bài Speaking chấm gần đây",
  plan: "G-12K",
  today: 161,
  todayMax: 1500,
  recent: [
    {
      t: "15/10 10:42:30",
      u: "student_1042",
      i: "Part 2 · 1:52",
      o: "Band 6.5",
      l: "12 s",
      s: "Đã gửi webhook",
      cls: "pill p-ok",
    },
    {
      t: "15/10 10:40:05",
      u: "student_0612",
      i: "Part 1 · 0:41",
      o: "Band 5.5",
      l: "9 s",
      s: "Đã gửi webhook",
      cls: "pill p-ok",
    },
    {
      t: "15/10 10:37:48",
      u: "student_0877",
      i: "Part 3 · 2:10",
      o: "Đang chấm",
      l: "—",
      s: "Queued",
      cls: "pill p-neu",
    },
    {
      t: "15/10 10:33:11",
      u: "student_0090",
      i: "Part 2 · 0:09",
      o: "—",
      l: "210 ms",
      s: "AUDIO_TOO_SHORT",
      cls: "pill p-err",
    },
    {
      t: "15/10 10:28:59",
      u: "student_0451",
      i: "Part 2 · 1:47",
      o: "Band 7.0",
      l: "14 s",
      s: "Webhook retry 2/5",
      cls: "pill p-warn",
    },
  ],
  quotas: [
    { l: "Phút Speaking / năm", used: 2380, total: 3000, reset: "01/10/2027" },
    { l: "Job đồng thời", used: 9, total: 20, reset: "đỉnh 24h qua" },
  ],
  stats: [
    { l: "Bài nói 14 ngày", v: "1.644" },
    { l: "End-user", v: "512" },
    { l: "Webhook lỗi 24h", v: "3" },
    { l: "Thời gian chấm p95", v: "19 s" },
  ],
  forecast:
    "Đã dùng 79% quota “Phút Speaking / năm”. Theo tốc độ hiện tại sẽ chạm trần khoảng 02/12/2026.",
  chartTitle: "Bài Speaking chấm 14 ngày",
  unitShort: "Phút audio",
  chart: [96, 110, 88, 120, 140, 60, 52, 131, 150, 158, 142, 170, 120, 161],
  topUsers: [
    { id: "student_1042", n: 22 },
    { id: "student_0451", n: 18 },
    { id: "student_0612", n: 15 },
    { id: "student_0877", n: 12 },
    { id: "student_0090", n: 9 },
  ],
  logs: [
    {
      t: "15/10 10:42:30",
      m: "POST",
      p: "/v1/speaking/grade",
      k: "Wispace Production",
      u: "student_1042",
      c: "202",
      l: "590 ms",
      rid: "req_01JA9W3A",
      model: "speaking-grader-2026-09",
      inp: "q_p2_0381 · answer.m4a · 1:52",
      out: "job_5HX21B queued",
    },
    {
      t: "15/10 10:40:05",
      m: "POST",
      p: "/v1/speaking/grade",
      k: "Wispace Production",
      u: "student_0612",
      c: "202",
      l: "420 ms",
      rid: "req_01JA9VZY",
      model: "speaking-grader-2026-09",
      inp: "q_p1_0114 · answer.m4a · 0:41",
      out: "job_5HX20Z queued",
    },
    {
      t: "15/10 10:33:11",
      m: "POST",
      p: "/v1/speaking/grade",
      k: "Wispace Production",
      u: "student_0090",
      c: "422",
      l: "210 ms",
      rid: "req_01JA9VR0",
      model: "—",
      inp: "answer.m4a · 0:09",
      out: "AUDIO_TOO_SHORT",
    },
    {
      t: "15/10 10:30:02",
      m: "GET",
      p: "/v1/speaking/questions",
      k: "Minh test",
      u: "student_001",
      c: "200",
      l: "96 ms",
      rid: "req_01JA9VN4",
      model: "—",
      inp: "part=2",
      out: "q_p2_0381",
    },
  ],
};

/* Reading / Listening: chấm khách quan + chữa từng câu */
export var OBJ = {
  reading: {
    test: "ac_reading_t3",
    badTest: "ac_reading_t99",
    rid: "req_01JAA1R3",
    desc: "Chấm và chữa bài IELTS Reading: nhận đáp án 40 câu, trả số câu đúng, band, độ chính xác theo dạng câu hỏi và giải thích từng câu sai kèm dẫn chứng trong bài đọc.",
    tryInput:
      "1 TRUE · 2 NOT GIVEN · 3 FALSE · 4 iv · 5 vii · 6 FALSE · … · 40 C",
    tryFacts: [
      { l: "Đề mẫu", v: "Academic Test 3" },
      { l: "Dạng câu", v: "6 dạng" },
      { l: "Trả kết quả", v: "JSON đồng bộ" },
    ],
    result: {
      headline: "Band 6.5",
      sub: "29 / 40 câu đúng · Academic · chấm trong 0,8 giây",
      metrics: [
        { l: "TRUE / FALSE / NOT GIVEN", v: "9 / 14" },
        { l: "Matching Headings", v: "4 / 7" },
        { l: "Multiple choice", v: "8 / 9" },
        { l: "Completion", v: "8 / 10" },
      ],
      comment:
        "Sai nhiều ở NOT GIVEN (5 câu chọn FALSE) và Matching Headings ở các đoạn dài.",
      itemsTitle: "Câu sai và lời chữa (3 / 11)",
      items: [
        {
          code: "Câu 6",
          text: "Chọn FALSE, đáp án NOT GIVEN — đoạn B không nhắc tới chi phí",
          meta: "TFNG · đoạn B",
        },
        {
          code: "Câu 15",
          text: "Chọn iii, đáp án vi — heading tóm ý chính, không phải chi tiết",
          meta: "Headings · đoạn D",
        },
        {
          code: "Câu 33",
          text: "Viết “researches”, đáp án “research”",
          meta: "Completion · dạng từ",
        },
      ],
    },
    okBody:
      '  "correct": 29,\n  "total": 40,\n  "band": 6.5,\n  "by_type": { "TFNG": "9/14", "Headings": "4/7", "MCQ": "8/9", "Completion": "8/10" },\n  "errors": [\n    { "q": 6, "code": "tfng_not_given_confusion", "answer": "FALSE", "correct": "NOT GIVEN", "evidence": "Paragraph B" },\n    { "q": 15, "code": "matching_headings_main_idea", "answer": "iii", "correct": "vi", "evidence": "Paragraph D" },\n    { "q": 33, "code": "completion_spelling", "answer": "researches", "correct": "research" }\n  ]',
    bank: {
      title: "Ngân hàng đề & dạng câu hỏi Reading",
      tests: "[N] đề Academic · [N] đề General",
      rows: [
        {
          t: "TRUE / FALSE / NOT GIVEN",
          c: "tfng_not_given_confusion",
          d: "Câu đúng, câu học viên chọn, đoạn và dòng dẫn chứng",
        },
        {
          t: "YES / NO / NOT GIVEN",
          c: "ynng_opinion_vs_fact",
          d: "Phân biệt ý kiến tác giả với thông tin",
        },
        {
          t: "Matching Headings",
          c: "matching_headings_main_idea",
          d: "Ý chính của đoạn, lý do heading sai",
        },
        {
          t: "Multiple choice",
          c: "mcq_partial_match",
          d: "Vị trí đáp án, vì sao phương án nhiễu sai",
        },
        {
          t: "Sentence / Summary completion",
          c: "completion_spelling",
          d: "Từ đúng trong bài, giới hạn số từ",
        },
        {
          t: "Matching information",
          c: "matching_info_location",
          d: "Đoạn chứa thông tin, cụm paraphrase",
        },
      ],
    },
    ops: {
      rows: [
        [
          "student_1042",
          "Academic T3 · 40 câu",
          "29/40 · Band 6.5",
          "0,8 s",
          "Thành công",
          "ok",
        ],
        [
          "student_0877",
          "General T1 · 40 câu",
          "33/40 · Band 6.5",
          "0,7 s",
          "Thành công",
          "ok",
        ],
        [
          "student_1203",
          "ac_reading_t99",
          "—",
          "35 ms",
          "TEST_NOT_FOUND",
          "err",
          "404",
        ],
        [
          "student_0451",
          "Academic T5 · 40 câu",
          "35/40 · Band 8.0",
          "0,9 s",
          "Thành công",
          "ok",
        ],
        [
          "student_0090",
          "Academic T2 · 28 câu",
          "—",
          "30 ms",
          "ANSWERS_INCOMPLETE",
          "err",
        ],
      ],
      q: 2210,
      rate: 12,
      today: 204,
      top: [12, 10, 9, 8, 6],
      p95: "1,2 s",
      n14: "2.486",
      users: "742",
    },
  },
  listening: {
    test: "listening_t3",
    badTest: "listening_t99",
    rid: "req_01JAA2L7",
    desc: "Chấm và chữa bài IELTS Listening: nhận đáp án 40 câu, trả số câu đúng, band, độ chính xác theo từng Part và giải thích từng câu sai kèm đoạn transcript, mốc thời gian chứa đáp án.",
    tryInput: "1 Johnson · 2 Wensday · 3 15 · 4 B · 5 car park · … · 40 oxygen",
    tryFacts: [
      { l: "Đề mẫu", v: "Listening Test 3" },
      { l: "Phần", v: "Part 1 – 4" },
      { l: "Trả kết quả", v: "JSON đồng bộ" },
    ],
    result: {
      headline: "Band 7.0",
      sub: "31 / 40 câu đúng · Test 3 · chấm trong 0,6 giây",
      metrics: [
        { l: "Part 1", v: "9 / 10" },
        { l: "Part 2", v: "6 / 10" },
        { l: "Part 3", v: "8 / 10" },
        { l: "Part 4", v: "8 / 10" },
      ],
      comment:
        "Mất điểm chủ yếu ở Part 2: chọn thông tin bị người nói sửa lại và ghi nhãn sai trên bản đồ.",
      itemsTitle: "Câu sai và lời chữa (3 / 9)",
      items: [
        {
          code: "Câu 2",
          text: "Viết “Wensday”, đáp án “Wednesday”",
          meta: "Part 1 · 00:52",
        },
        {
          code: "Câu 13",
          text: "Chọn B, đáp án C — người nói đổi sang thứ Năm sau đó",
          meta: "Part 2 · 08:41",
        },
        {
          code: "Câu 17",
          text: "Ghi “café” sai vị trí — “opposite the entrance”",
          meta: "Part 2 · 10:05",
        },
      ],
    },
    okBody:
      '  "correct": 31,\n  "total": 40,\n  "band": 7.0,\n  "by_part": { "P1": "9/10", "P2": "6/10", "P3": "8/10", "P4": "8/10" },\n  "errors": [\n    { "q": 2, "code": "form_completion_spelling", "answer": "Wensday", "correct": "Wednesday", "timestamp": "00:52" },\n    { "q": 13, "code": "distractor_trap", "answer": "B", "correct": "C", "timestamp": "08:41" },\n    { "q": 17, "code": "map_labelling", "answer": "F", "correct": "D", "timestamp": "10:05" }\n  ]',
    bank: {
      title: "Ngân hàng đề & dạng câu hỏi Listening",
      tests: "[N] đề",
      rows: [
        {
          t: "Form / Note completion",
          c: "form_completion_spelling",
          d: "Từ đúng, đoạn transcript, mốc thời gian",
        },
        {
          t: "Multiple choice",
          c: "distractor_trap",
          d: "Thông tin gây nhiễu và chỗ người nói sửa lại",
        },
        {
          t: "Map / Plan labelling",
          c: "map_labelling",
          d: "Cụm chỉ hướng trong transcript",
        },
        {
          t: "Matching",
          c: "matching_speaker_opinion",
          d: "Người nói và ý kiến tương ứng",
        },
        {
          t: "Sentence completion",
          c: "completion_word_limit",
          d: "Giới hạn số từ, dạng từ đúng",
        },
      ],
    },
    ops: {
      rows: [
        [
          "student_1042",
          "Test 3 · 40 câu",
          "31/40 · Band 7.0",
          "0,6 s",
          "Thành công",
          "ok",
        ],
        [
          "student_0877",
          "Test 1 · 40 câu",
          "27/40 · Band 6.5",
          "0,6 s",
          "Thành công",
          "ok",
        ],
        [
          "student_1203",
          "listening_t99",
          "—",
          "33 ms",
          "TEST_NOT_FOUND",
          "err",
          "404",
        ],
        [
          "student_0451",
          "Test 4 · 40 câu",
          "36/40 · Band 8.0",
          "0,7 s",
          "Thành công",
          "ok",
        ],
        [
          "student_0090",
          "Test 2 · 31 câu",
          "—",
          "28 ms",
          "ANSWERS_INCOMPLETE",
          "err",
        ],
      ],
      q: 1840,
      rate: 10,
      today: 176,
      top: [11, 9, 8, 7, 5],
      p95: "0,9 s",
      n14: "2.102",
      users: "688",
    },
  },
};

export function gradeObjective(sk) {
  var L = SKL[sk],
    D = OBJ[sk];
  return {
    demoUrl: "https://aihubproduction.com/demo",
    special: "Ngân hàng đề & dạng câu",
    specialKey: "bank",
    bank: D.bank,
    desc: D.desc,
    tryTitle: "Chấm chữa thử một bài " + L,
    tryDesc:
      "Dùng bài làm mẫu của học viên để xem số câu đúng, band và lời chữa từng câu sai.",
    tryLabel: "Đáp án học viên (40 câu)",
    tryInput: D.tryInput,
    tryRows: 3,
    tryCta: "Chấm chữa thử",
    tryRunningText: "Đang chấm 40 câu và soạn lời chữa…",
    tryFacts: D.tryFacts,
    flowDesc:
      "Hai lời gọi: định danh học viên, rồi gửi test_id và 40 đáp án. Cuối cùng copy prompt AI hoặc code vào app.",
    result: D.result,
    steps: [
      idStep(sk),
      {
        short: "Gửi bài làm",
        title: "Gửi đáp án để chấm chữa",
        desc: "Gửi test_id và đáp án 40 câu. AIHub chấm, quy đổi band và giải thích từng câu sai.",
        fields: [
          {
            id: "test",
            label: "test_id",
            kind: "input",
            def: D.test,
            help: "Thử " + D.badTest + " để xem lỗi TEST_NOT_FOUND.",
          },
          {
            id: "ans",
            label: "answers",
            kind: "chips",
            options: ["40 / 40 câu", "28 / 40 câu"],
            def: "40 / 40 câu",
            help: "Chọn 28 câu để xem lỗi ANSWERS_INCOMPLETE.",
          },
        ],
        method: "POST",
        path: "/v1/" + sk + "/grade",
        run: "Chấm chữa",
        invalid: function (v) {
          return v.test !== D.test || v.ans.indexOf("28") === 0;
        },
        req: function (v) {
          return (
            "POST " +
            API +
            "/v1/" +
            sk +
            "/grade\n" +
            KEYH +
            "\nX-AIHub-User-Id: " +
            v.uid +
            '\nContent-Type: application/json\n\n{\n  "test_id": "' +
            v.test +
            '",\n  "answers": ["…", "…", "… (' +
            (v.ans.indexOf("28") === 0 ? 28 : 40) +
            ' phần tử)"]\n}'
          );
        },
        ok: function () {
          return (
            'HTTP 200\n{\n  "request_id": "' + D.rid + '",\n' + D.okBody + "\n}"
          );
        },
        err: function (v) {
          return v.test !== D.test
            ? 'HTTP 404\n{\n  "error_code": "TEST_NOT_FOUND",\n  "error_message": "Không có đề ' +
                v.test +
                '."\n}'
            : 'HTTP 422\n{\n  "error_code": "ANSWERS_INCOMPLETE",\n  "error_message": "Cần đủ 40 phần tử; câu bỏ trống gửi chuỗi rỗng.",\n  "received": 28\n}';
        },
        fix: 'Dùng test_id có trong Ngân hàng đề (hoặc đề bạn đã upload). Luôn gửi đủ 40 phần tử, câu học viên bỏ trống gửi "".',
        lat: "0,8 s",
        slowLat: "4,9 s",
        slowNote:
          'Lời chữa chi tiết cho nhiều câu sai có thể chậm hơn. Truyền explain="summary" để nhận band ngay, lấy lời chữa sau.',
      },
      APP_STEP,
    ],
    after: [
      "Dán prompt vào công cụ AI coding trong project của bạn.",
      "Đặt AIHUB_API_KEY — lấy ở trang chi tiết API key.",
      "Lưu request_id để Phân tích điểm yếu gom lỗi " + L + " theo học viên.",
    ],
    code: {
      prompt: function (v) {
        return (
          "Tôi muốn tích hợp AIHub (" +
          API +
          ") để chấm chữa IELTS " +
          L +
          " trong app. Hãy viết endpoint Node.js nhận test_id và 40 đáp án của học viên, gọi AIHub, trả số câu đúng, band và lời chữa từng câu sai.\n\nYêu cầu:\n- Header Authorization: Bearer <AIHUB_API_KEY>, X-AIHub-User-Id: <id học viên> (thử: " +
          v.uid +
          ").\n- POST /v1/" +
          sk +
          '/grade, body {"test_id":"' +
          v.test +
          '","answers":[...]} đủ 40 phần tử, câu bỏ trống gửi "".\n- Response: correct, total, band, ' +
          (sk === "reading" ? "by_type" : "by_part") +
          ", errors[{q,code,answer,correct," +
          (sk === "reading" ? "evidence" : "timestamp") +
          "}]. Lưu request_id.\n- Hiển thị lời chữa ngay dưới từng câu sai.\n- Xử lý lỗi: TEST_NOT_FOUND, ANSWERS_INCOMPLETE, RATE_LIMITED."
        );
      },
      node: function (v) {
        return [
          "app.post('/api/grade/" + sk + "', async (req, res) => {",
          "  const r = await fetch('" + API + "/v1/" + sk + "/grade', {",
          "    method: 'POST',",
          "    headers: {",
          "      Authorization: 'Bearer ' + process.env.AIHUB_API_KEY,",
          "      'X-AIHub-User-Id': req.user.id, // thử: " + v.uid,
          "      'Content-Type': 'application/json'",
          "    },",
          "    body: JSON.stringify({ test_id: req.body.testId ?? '" +
            v.test +
            "', answers: req.body.answers })",
          "  });",
          "  const data = await r.json();",
          "  if (!r.ok) return res.status(r.status).json({ code: data.error_code });",
          "  await saveGrade(req.user.id, data.request_id, data);",
          "  res.json(data);",
          "});",
        ].join("\n");
      },
      python: function (v) {
        return [
          "import os, requests",
          "",
          "def grade_" + sk + "(user_id, answers, test_id='" + v.test + "'):",
          "    r = requests.post('" + API + "/v1/" + sk + "/grade',",
          "        headers={'Authorization': 'Bearer ' + os.environ['AIHUB_API_KEY'], 'X-AIHub-User-Id': user_id},",
          "        json={'test_id': test_id, 'answers': answers}, timeout=15)",
          "    data = r.json()",
          "    if not r.ok:",
          "        raise RuntimeError(data['error_code'])",
          "    return data",
        ].join("\n");
      },
    },
  };
}

export function gradeOps(sk) {
  var D = OBJ[sk].ops,
    L = SKL[sk];
  return ops({
    recentTitle: "Bài " + L + " chấm gần đây",
    plan: "G-12K",
    today: D.today,
    todayMax: 3000,
    path: "/v1/" + sk + "/grade",
    model: sk + "-grader-2026-09",
    rid: sk === "reading" ? "R" : "L",
    q: ["Lượt chấm " + L + " / năm", D.q, 12000],
    r: ["Request / phút", D.rate, 120],
    stats: [
      { l: "Bài chấm 14 ngày", v: D.n14 },
      { l: "End-user", v: D.users },
      { l: "Lỗi 24h", v: "2" },
      { l: "Latency p95", v: D.p95 },
    ],
    chartTitle: "Bài " + L + " chấm 14 ngày",
    unitShort: "Bài chấm",
    top: D.top,
    rows: D.ops ? D.ops.rows : D.rows,
  });
}

/* =================== 2. PHÂN TÍCH ĐIỂM YẾU =================== */
export var WEAK_BASE = {
  name: "Phân tích điểm yếu",
  group: "Dịch vụ 2 / 4",
  badge: "Stable",
  badgeCls: "badge b-stable",
  prev: "grade",
  inText: "(lịch sử bài đã chấm của một học viên)",
  next: "exercise",
  nextCta: "Sinh bài tập cho điểm yếu ưu tiên",
  nextHint: "dùng mã lỗi ưu tiên 1 làm đầu vào cho Tạo bài tập.",
  demoUrl: "https://aihubproduction.com/lab",
  special: "Cấu trúc hồ sơ",
  specialKey: "profile",
  plans: [
    {
      name: "A-2K",
      feats: [
        "2.000 lượt phân tích / năm, dùng chung 4 kỹ năng",
        "30 request / phút",
      ],
      price: "[giá] credit / năm",
    },
    {
      name: "A-5K",
      feats: [
        "5.000 lượt phân tích / năm, dùng chung 4 kỹ năng",
        "60 request / phút",
      ],
      price: "[giá] credit / năm",
      current: true,
    },
    {
      name: "A-15K",
      feats: [
        "15.000 lượt phân tích / năm, dùng chung 4 kỹ năng",
        "150 request / phút",
      ],
      price: "[giá] credit / năm",
    },
    {
      name: "A-MAX",
      feats: ["Theo nhu cầu", "SLA riêng"],
      price: "Báo giá riêng",
      contact: true,
    },
  ],
};
export var WD = {
  writing: {
    hist: "12 bài Writing",
    counts: [14, 9, 7],
    trends: ["flat", "down", "flat"],
    metrics: [
      ["TR (đầu kỳ → nay)", "6.5 → 6.5"],
      ["CC", "6.5 → 7.0"],
      ["LR", "6.0 → 6.0"],
      ["GRA", "6.0 → 6.5"],
    ],
    trendJson:
      '{ "TR": [6.5, 6.5], "CC": [6.5, 7.0], "LR": [6.0, 6.0], "GRA": [6.0, 6.5] }',
    comment:
      "LR đứng yên ở 6.0 sau 12 bài. Collocation và lặp từ chiếm 61% lỗi LR — nên luyện LR trước khi tăng số bài viết.",
    ev: [
      ["make a research", "do research"],
      ["do a mistake", "make a mistake"],
    ],
  },
  speaking: {
    hist: "8 bài Speaking",
    counts: [22, 11, 6],
    trends: ["down", "flat", "flat"],
    metrics: [
      ["FC (đầu kỳ → nay)", "5.5 → 6.0"],
      ["LR", "6.0 → 6.0"],
      ["GRA", "5.5 → 5.5"],
      ["P", "6.5 → 6.5"],
    ],
    trendJson:
      '{ "FC": [5.5, 6.0], "LR": [6.0, 6.0], "GRA": [5.5, 5.5], "P": [6.5, 6.5] }',
    comment:
      "GRA đứng yên ở 5.5: chia sai thì quá khứ lặp lại ở Part 2. Ngập ngừng đã giảm nhưng vẫn nhiều nhất.",
    ev: [
      ["Last year I go to Da Lat", "went"],
      ["When I was child, I play…", "played"],
    ],
  },
  reading: {
    hist: "10 bài Reading",
    counts: [19, 12, 8],
    trends: ["flat", "flat", "down"],
    metrics: [
      ["TFNG (đầu kỳ → nay)", "58% → 61%"],
      ["Headings", "52% → 55%"],
      ["MCQ", "80% → 84%"],
      ["Completion", "82% → 86%"],
    ],
    trendJson:
      '{ "TFNG": [0.58, 0.61], "Headings": [0.52, 0.55], "MCQ": [0.80, 0.84], "Completion": [0.82, 0.86] }',
    comment:
      "TFNG và Matching Headings kéo band xuống: 63% câu sai TFNG là chọn FALSE khi đáp án NOT GIVEN.",
    ev: [
      ["Câu 6 · chọn FALSE", "NOT GIVEN — đoạn B không nhắc tới chi phí"],
      ["Câu 15 · chọn iii", "vi — heading là ý chính đoạn D"],
    ],
  },
  listening: {
    hist: "10 bài Listening",
    counts: [16, 10, 9],
    trends: ["flat", "down", "flat"],
    metrics: [
      ["Part 1 (đầu kỳ → nay)", "88% → 92%"],
      ["Part 2", "60% → 62%"],
      ["Part 3", "70% → 74%"],
      ["Part 4", "72% → 75%"],
    ],
    trendJson:
      '{ "P1": [0.88, 0.92], "P2": [0.60, 0.62], "P3": [0.70, 0.74], "P4": [0.72, 0.75] }',
    comment:
      "Part 2 thấp nhất: hay chọn thông tin bị người nói sửa lại sau đó, và xác định sai vị trí trên bản đồ.",
    ev: [
      ["Câu 13 · chọn B", "C — người nói đổi sang thứ Năm"],
      ["Câu 2 · “Wensday”", "Wednesday"],
    ],
  },
};

export function weakFor(sk) {
  var L = SKL[sk],
    C = CODES[sk],
    D = WD[sk];
  var codesList = C.map(function (c) {
    return c.c;
  });
  var wjson = C.map(function (c, i) {
    return (
      '    { "code": "' +
      c.c +
      '", "group": "' +
      c.g +
      '", "count": ' +
      D.counts[i] +
      ', "trend": "' +
      D.trends[i] +
      '", "priority": ' +
      (i + 1) +
      " }"
    );
  }).join(",\n");
  return {
    scope: scopeOf("weakness", sk),
    ex: {
      code: C[0].c,
      group: C[0].g,
      count: String(D.counts[0]),
      ev: "req_01JA9W2K · “" + D.ev[0][0] + "”",
    },
    desc:
      "Tổng hợp lịch sử Chấm chữa " +
      L +
      " của một học viên thành hồ sơ điểm yếu: " +
      (sk === "writing" || sk === "speaking"
        ? "tiêu chí đang kéo band xuống"
        : sk === "reading"
          ? "dạng câu hỏi đang mất điểm"
          : "Part đang mất điểm") +
      ", mã lỗi lặp lại, mức ưu tiên luyện tập và bằng chứng từ từng bài.",
    tryTitle: "Phân tích thử một học viên mẫu",
    tryDesc:
      "Dùng lịch sử " +
      D.hist +
      " đã chấm của học viên mẫu để xem hồ sơ điểm yếu trả về.",
    tryLabel: "end_user_id",
    tryInput: "student_1042",
    tryRows: 2,
    tryCta: "Phân tích thử",
    tryRunningText: "Đang gom lỗi từ " + D.hist + "…",
    tryFacts: [
      { l: "Nguồn dữ liệu", v: "Lịch sử Chấm chữa " + L },
      { l: "Tối thiểu", v: "3 bài đã chấm" },
      { l: "Phạm vi", v: "last_10 · 30d · 90d" },
    ],
    flowDesc:
      "Hai lời gọi: tạo hồ sơ điểm yếu " +
      L +
      " cho một học viên, rồi lấy chi tiết và bằng chứng của từng điểm yếu.",
    result: {
      headline: "3 điểm yếu ưu tiên",
      sub: "student_1042 · " + D.hist + " · 30 ngày",
      metrics: D.metrics.map(function (m) {
        return { l: m[0], v: m[1] };
      }),
      comment: D.comment,
      itemsTitle: "Điểm yếu theo thứ tự ưu tiên",
      items: C.map(function (c, i) {
        return {
          code: c.c,
          text:
            c.n +
            " — " +
            D.counts[i] +
            " lần, " +
            { flat: "không giảm", down: "giảm nhẹ", up: "tăng" }[D.trends[i]],
          meta: "Ưu tiên " + (i + 1) + " · " + c.g,
        };
      }),
    },
    steps: [
      {
        short: "Tạo hồ sơ",
        title: "Tạo hồ sơ điểm yếu " + L,
        desc:
          "AIHub đọc các bài " +
          L +
          " đã chấm của học viên (theo end_user_id) trong phạm vi bạn chọn và trả về hồ sơ điểm yếu.",
        fields: [
          {
            id: "uid",
            label: "end_user_id",
            kind: "input",
            def: "student_1042",
            help: "Thử student_new (mới chấm 1 bài) để xem lỗi INSUFFICIENT_HISTORY.",
          },
          {
            id: "window",
            label: "window",
            kind: "chips",
            options: ["last_10", "30d", "90d"],
            def: "30d",
          },
        ],
        method: "POST",
        path: "/v1/weakness/analyze",
        run: "Phân tích",
        invalid: function (v) {
          return !v.uid || v.uid === "student_new";
        },
        req: function (v) {
          return (
            "POST " +
            API +
            "/v1/weakness/analyze\n" +
            KEYH +
            "\nX-AIHub-User-Id: " +
            v.uid +
            '\nContent-Type: application/json\n\n{\n  "skill": "' +
            sk +
            '",\n  "window": "' +
            v.window +
            '"\n}'
          );
        },
        ok: function (v) {
          return (
            'HTTP 200\n{\n  "profile_id": "wp_8M2K",\n  "end_user_id": "' +
            v.uid +
            '",\n  "skill": "' +
            sk +
            '",\n  "trend": ' +
            D.trendJson +
            ',\n  "weaknesses": [\n' +
            wjson +
            "\n  ]\n}"
          );
        },
        err: function (v) {
          return !v.uid
            ? 'HTTP 400\n{\n  "error_code": "USER_ID_REQUIRED"\n}'
            : 'HTTP 422\n{\n  "error_code": "INSUFFICIENT_HISTORY",\n  "error_message": "Cần ít nhất 3 bài ' +
                L +
                ' đã chấm.",\n  "submissions": 1\n}';
        },
        fix:
          "Chỉ gọi khi học viên có từ 3 bài " +
          L +
          " đã qua Chấm chữa. Trước đó, dùng trực tiếp errors[] của từng bài.",
        lat: "1,2 s",
        slowLat: "8,4 s",
        slowNote:
          "Phân tích 90 ngày nhiều bài có thể chậm. Chạy theo lịch (ví dụ mỗi tối) và lưu profile_id.",
      },
      {
        short: "Chi tiết điểm yếu",
        title: "Lấy chi tiết một điểm yếu",
        desc: "Lấy bằng chứng (đoạn trích kèm request_id) để hiển thị cho học viên hoặc giáo viên. profile_id từ bước trước đã điền sẵn.",
        fields: [
          {
            id: "code",
            label: "code",
            kind: "input",
            def: C[0].c,
            help: "Thử một mã không có trong hồ sơ để xem lỗi WEAKNESS_NOT_FOUND.",
          },
        ],
        method: "GET",
        path: "/v1/weakness/profiles/wp_8M2K/items/{code}",
        run: "Lấy chi tiết",
        invalid: function (v) {
          return codesList.indexOf(v.code) < 0;
        },
        req: function (v) {
          return (
            "GET " +
            API +
            "/v1/weakness/profiles/wp_8M2K/items/" +
            v.code +
            "\n" +
            KEYH +
            "\nX-AIHub-User-Id: " +
            v.uid
          );
        },
        ok: function (v) {
          return (
            'HTTP 200\n{\n  "code": "' +
            v.code +
            '",\n  "skill": "' +
            sk +
            '",\n  "count": ' +
            D.counts[Math.max(0, codesList.indexOf(v.code))] +
            ',\n  "evidence": [\n    { "request_id": "req_01JA9W2K", "excerpt": "' +
            D.ev[0][0] +
            '", "fix": "' +
            D.ev[0][1] +
            '" },\n    { "request_id": "req_01JA8Q7D", "excerpt": "' +
            D.ev[1][0] +
            '", "fix": "' +
            D.ev[1][1] +
            '" }\n  ],\n  "next": { "service": "exercise", "skill": "' +
            sk +
            '", "error_code": "' +
            v.code +
            '" }\n}'
          );
        },
        err: function (v) {
          return (
            'HTTP 404\n{\n  "error_code": "WEAKNESS_NOT_FOUND",\n  "error_message": "' +
            v.code +
            ' không nằm trong hồ sơ wp_8M2K."\n}'
          );
        },
        fix: "Chỉ dùng các code có trong weaknesses[] của hồ sơ vừa tạo.",
        lat: "140 ms",
        slowLat: "3,2 s",
        slowNote:
          "Bằng chứng nhiều bài có thể chậm. Phân trang bằng tham số limit/cursor.",
      },
      APP_STEP,
    ],
    after: [
      "Dán prompt vào công cụ AI coding trong project của bạn.",
      "Chạy phân tích theo lịch cho học viên có bài " +
        L +
        " mới, lưu profile_id.",
      "Dùng weaknesses[0].code làm đầu vào cho Tạo bài tập " +
        L +
        ", profile_id cho Lộ trình cá nhân hoá.",
    ],
    code: {
      prompt: function (v) {
        return (
          "Tôi dùng AIHub để chấm chữa IELTS " +
          L +
          ". Hãy viết một job Node.js chạy mỗi tối: với mỗi học viên có bài " +
          L +
          " mới trong ngày, gọi AIHub để cập nhật hồ sơ điểm yếu.\n\nYêu cầu:\n- POST " +
          API +
          '/v1/weakness/analyze, body {"skill":"' +
          sk +
          '","window":"' +
          v.window +
          '"}.\n- Header: Authorization: Bearer <AIHUB_API_KEY>, X-AIHub-User-Id: <id học viên>.\n- Lưu profile_id và weaknesses[] (code, group, count, trend, priority).\n- Bỏ qua học viên trả về INSUFFICIENT_HISTORY.\n- Hiển thị 3 điểm yếu ưu tiên kèm bằng chứng từ GET /v1/weakness/profiles/{profile_id}/items/{code}.'
        );
      },
      node: function (v) {
        return [
          "export async function refreshWeakness(userId) {",
          "  const r = await fetch('" + API + "/v1/weakness/analyze', {",
          "    method: 'POST',",
          "    headers: { Authorization: 'Bearer ' + process.env.AIHUB_API_KEY, 'X-AIHub-User-Id': userId, 'Content-Type': 'application/json' },",
          "    body: JSON.stringify({ skill: '" +
            sk +
            "', window: '" +
            v.window +
            "' })",
          "  });",
          "  const data = await r.json();",
          "  if (data.error_code === 'INSUFFICIENT_HISTORY') return null;",
          "  if (!r.ok) throw new Error(data.error_code);",
          "  await saveProfile(userId, '" +
            sk +
            "', data.profile_id, data.weaknesses);",
          "  return data;",
          "}",
        ].join("\n");
      },
      python: function (v) {
        return [
          "import os, requests",
          "",
          "def refresh_weakness(user_id):",
          "    r = requests.post('" + API + "/v1/weakness/analyze',",
          "        headers={'Authorization': 'Bearer ' + os.environ['AIHUB_API_KEY'], 'X-AIHub-User-Id': user_id},",
          "        json={'skill': '" +
            sk +
            "', 'window': '" +
            v.window +
            "'}, timeout=30)",
          "    data = r.json()",
          "    if data.get('error_code') == 'INSUFFICIENT_HISTORY':",
          "        return None",
          "    r.raise_for_status()",
          "    return data",
        ].join("\n");
      },
    },
  };
}
export function weakOps(sk) {
  var m = SKM[sk],
    C = CODES[sk],
    L = SKL[sk];
  return ops({
    recentTitle: "Hồ sơ điểm yếu " + L + " gần đây",
    plan: "A-5K",
    today: Math.round(94 * m),
    todayMax: 2000,
    path: "/v1/weakness/analyze",
    model: "weakness-analyzer-2026-09",
    rid: "W" + sk[0].toUpperCase(),
    q: ["Lượt phân tích " + L + " / năm", Math.round(1820 * m), 5000],
    r: ["Request / phút", Math.round(14 * m) + 2, 60],
    stats: [
      { l: "Hồ sơ 14 ngày", v: fmt(Math.round(1096 * m)) },
      { l: "End-user", v: fmt(Math.round(688 * m)) },
      { l: "Lỗi 24h", v: "2" },
      { l: "Latency p95", v: "2,9 s" },
    ],
    chartTitle: "Lượt phân tích " + L + " 14 ngày",
    unitShort: "Lượt phân tích",
    top: [6, 5, 5, 4, 3],
    rows: [
      [
        USERS[0],
        WD[sk].hist + " · 30d",
        "3 điểm yếu · " + C[0].c,
        "1,1 s",
        "Thành công",
        "ok",
      ],
      [USERS[1], "9 bài · 30d", "4 điểm yếu", "0,9 s", "Thành công", "ok"],
      [USERS[2], "1 bài", "—", "40 ms", "INSUFFICIENT_HISTORY", "err"],
      [USERS[3], "7 bài · last_10", "2 điểm yếu", "1,0 s", "Thành công", "ok"],
    ],
  });
}

/* =================== 3. TẠO BÀI TẬP =================== */
export var EX_BASE = {
  name: "Tạo bài tập",
  group: "Dịch vụ 3 / 4",
  badge: "Stable",
  badgeCls: "badge b-stable",
  prev: "weakness",
  inText: "(mã lỗi ưu tiên) hoặc errors[] của một bài chấm",
  next: "roadmap",
  nextCta: "Xếp bài tập vào lộ trình",
  nextHint:
    "Lộ trình cá nhân hoá xếp các bộ bài tập theo tuần, theo mục tiêu band và ngày thi.",
  demoUrl: "https://aihubproduction.com/lab",
  special: "Kho mẫu đã lưu",
  specialKey: "templates",
  plans: [
    {
      name: "E-2K",
      feats: [
        "2.000 bộ bài tập / năm, dùng chung 4 kỹ năng",
        "30 request / phút",
      ],
      price: "[giá] credit / năm",
    },
    {
      name: "E-5K",
      feats: [
        "5.000 bộ bài tập / năm, dùng chung 4 kỹ năng",
        "60 request / phút",
      ],
      price: "[giá] credit / năm",
      current: true,
    },
    {
      name: "E-15K",
      feats: [
        "15.000 bộ bài tập / năm, dùng chung 4 kỹ năng",
        "150 request / phút",
      ],
      price: "[giá] credit / năm",
    },
    {
      name: "E-MAX",
      feats: ["Theo nhu cầu", "SLA riêng"],
      price: "Báo giá riêng",
      contact: true,
    },
  ],
};
export var ED = {
  writing: {
    tryLabel: "Câu có lỗi",
    tryInput: "Universities make a research that helps the society develop.",
    topics: ["Education", "Environment", "Technology"],
    extra: ["spelling_error", "informal_vocabulary"],
    result: {
      headline: "3 bài tập",
      sub: "Lexical Resource · collocation_error · Task 2",
      metrics: [
        { l: "Tiêu chí", v: "LR" },
        { l: "Mã lỗi", v: "collocation_error" },
        { l: "Độ khó", v: "Band 6–7" },
        { l: "Câu tham chiếu", v: "12" },
      ],
      comment:
        "Bài tập dùng câu tham chiếu cùng chủ đề Education để học viên luyện collocation với “research”.",
      itemsTitle: "Bài tập sinh ra",
      items: [
        {
          code: "fill_blank",
          text: "Scientists ___ research into renewable energy. (do / make)",
          meta: "Điền từ",
        },
        {
          code: "rewrite",
          text: "Viết lại cho đúng: “We made a big progress this year.”",
          meta: "Viết lại câu",
        },
        {
          code: "choose",
          text: "Chọn collocation đúng: take / have / do a decision",
          meta: "Trắc nghiệm",
        },
      ],
    },
  },
  speaking: {
    tryLabel: "Câu nói có lỗi (transcript)",
    tryInput:
      "Last year I go to Da Lat with my family and we stay there for three days.",
    topics: ["Travel", "Hometown", "Work"],
    extra: [],
    result: {
      headline: "3 bài luyện nói",
      sub: "GRA · verb_tense · Part 2",
      metrics: [
        { l: "Tiêu chí", v: "GRA" },
        { l: "Mã lỗi", v: "verb_tense" },
        { l: "Độ khó", v: "Band 5.5–6.5" },
        { l: "Audio mẫu", v: "6 câu" },
      ],
      comment:
        "Bài luyện kể chuyện quá khứ có audio mẫu để học viên shadowing, rồi nộp lại qua Chấm chữa Speaking.",
      itemsTitle: "Bài tập sinh ra",
      items: [
        {
          code: "retell",
          text: "Kể lại chuyến đi gần nhất trong 60 giây, dùng ít nhất 5 động từ quá khứ",
          meta: "Nói tự do",
        },
        {
          code: "transform",
          text: "Đổi sang quá khứ: “I go to the market and buy some fruit.”",
          meta: "Chuyển thì",
        },
        {
          code: "shadowing",
          text: "Nghe và nhắc lại 6 câu mẫu có “went, stayed, visited”",
          meta: "Shadowing",
        },
      ],
    },
  },
  reading: {
    tryLabel: "Câu học viên làm sai",
    tryInput:
      "Câu 6: “The new system reduced costs.” — học viên chọn FALSE, đáp án NOT GIVEN",
    topics: ["Science", "History", "Environment"],
    extra: [],
    result: {
      headline: "3 bài luyện đọc",
      sub: "TFNG · tfng_not_given_confusion · Academic",
      metrics: [
        { l: "Dạng câu", v: "TFNG" },
        { l: "Mã lỗi", v: "tfng_not_given_confusion" },
        { l: "Độ khó", v: "Band 6–7" },
        { l: "Đoạn đọc", v: "3" },
      ],
      comment:
        "Mỗi bài có một đoạn đọc ngắn và 4–5 câu TFNG cố ý trộn FALSE với NOT GIVEN, kèm giải thích.",
      itemsTitle: "Bài tập sinh ra",
      items: [
        {
          code: "tfng_set",
          text: "Đoạn 180 từ về năng lượng tái tạo + 5 câu TRUE / FALSE / NOT GIVEN",
          meta: "TFNG",
        },
        {
          code: "spot_claim",
          text: "Gạch chân câu chứng minh FALSE; không có → NOT GIVEN",
          meta: "Tìm dẫn chứng",
        },
        {
          code: "paraphrase",
          text: "Nối 6 cặp câu đồng nghĩa giữa đề và bài đọc",
          meta: "Paraphrase",
        },
      ],
    },
  },
  listening: {
    tryLabel: "Câu học viên làm sai",
    tryInput:
      "Câu 13 (Part 2): học viên chọn B — thông tin người nói đã sửa lại sau đó",
    topics: ["Campus", "Travel", "Community"],
    extra: [],
    result: {
      headline: "3 bài luyện nghe",
      sub: "Part 2 · distractor_trap",
      metrics: [
        { l: "Phần", v: "Part 2" },
        { l: "Mã lỗi", v: "distractor_trap" },
        { l: "Độ khó", v: "Band 6–7" },
        { l: "Audio", v: "3 đoạn" },
      ],
      comment:
        "Mỗi bài có một đoạn audio chứa thông tin bị sửa lại (“actually”, “sorry, I mean”) để học viên luyện nghe đến hết câu.",
      itemsTitle: "Bài tập sinh ra",
      items: [
        {
          code: "mcq_audio",
          text: "Audio 90 giây + 4 câu MCQ có thông tin gây nhiễu",
          meta: "MCQ",
        },
        {
          code: "signal_words",
          text: "Đánh dấu thời điểm người nói đổi ý trong transcript",
          meta: "Từ tín hiệu",
        },
        {
          code: "dictation",
          text: "Chép chính tả 5 câu chứa đáp án cuối cùng",
          meta: "Chính tả",
        },
      ],
    },
  },
};
export function exFor(sk) {
  var L = SKL[sk],
    C = CODES[sk],
    D = ED[sk];
  var valid = C.map(function (c) {
    return c.c;
  }).concat(D.extra);
  var grpLabel =
    sk === "reading"
      ? "question_type"
      : sk === "listening"
        ? "part"
        : "criteria";
  return {
    scope: scopeOf("exercise", sk),
    desc:
      "Sinh bài tập " +
      L +
      " bám đúng điểm yếu của học viên: chọn " +
      (sk === "reading"
        ? "dạng câu hỏi"
        : sk === "listening"
          ? "Part"
          : "tiêu chí") +
      " và mã lỗi, AIHub lấy dữ liệu tham chiếu rồi sinh bài tập kèm đáp án.",
    tryTitle: "Sinh thử bài tập " + L + " từ một lỗi",
    tryDesc:
      "Dán lỗi của học viên. AIHub nhận diện mã lỗi và sinh bài tập luyện đúng lỗi đó.",
    tryLabel: D.tryLabel,
    tryInput: D.tryInput,
    tryRows: 3,
    tryCta: "Sinh bài tập",
    tryRunningText: "Đang lấy dữ liệu tham chiếu và sinh bài tập…",
    tryFacts: [
      {
        l:
          sk === "reading"
            ? "Dạng câu"
            : sk === "listening"
              ? "Phần"
              : "Tiêu chí",
        v: GROUPS[sk].join(" · "),
      },
      {
        l: "Dạng bài",
        v: D.result.items
          .map(function (i) {
            return i.meta;
          })
          .join(" · "),
      },
      { l: "Đầu vào", v: "Mã lỗi hoặc lỗi cụ thể" },
    ],
    flowDesc:
      "Hai lời gọi: lấy dữ liệu tham chiếu cho điểm yếu, rồi sinh bài tập. Cuối cùng copy prompt AI hoặc code vào app.",
    result: D.result,
    steps: [
      {
        short: "Chọn điểm yếu",
        title: "Chọn điểm yếu và lấy dữ liệu tham chiếu",
        desc:
          "Chọn " +
          grpLabel +
          " và mã lỗi cần luyện — thường là weaknesses[0] từ Phân tích điểm yếu " +
          L +
          ".",
        fields: [
          {
            id: "grp",
            label: grpLabel,
            kind: "chips",
            options: GROUPS[sk],
            def: C[0].g,
          },
          {
            id: "code",
            label: "error_code",
            kind: "input",
            def: C[0].c,
            help: "Lấy từ weaknesses[].code hoặc errors[].code. Thử gõ sai để xem lỗi ERROR_CODE_NOT_FOUND.",
          },
          {
            id: "topic",
            label: "topic",
            kind: "chips",
            options: D.topics,
            def: D.topics[0],
          },
        ],
        method: "GET",
        path: "/v1/exercises/references",
        run: "Lấy dữ liệu tham chiếu",
        invalid: function (v) {
          return valid.indexOf(v.code) < 0;
        },
        req: function (v) {
          return (
            "GET " +
            API +
            "/v1/exercises/references?skill=" +
            sk +
            "&" +
            grpLabel +
            "=" +
            encodeURIComponent(v.grp) +
            "&error_code=" +
            v.code +
            "&topic=" +
            v.topic.toLowerCase() +
            "\n" +
            KEYH +
            "\nX-AIHub-User-Id: student_1042"
          );
        },
        ok: function (v) {
          return (
            'HTTP 200\n{\n  "reference_set_id": "ref_7Q2M",\n  "skill": "' +
            sk +
            '",\n  "error_code": "' +
            v.code +
            '",\n  "items": 12\n}'
          );
        },
        err: function (v) {
          return (
            'HTTP 404\n{\n  "error_code": "ERROR_CODE_NOT_FOUND",\n  "error_message": "Không có mã lỗi ' +
            v.code +
            " cho " +
            L +
            '."\n}'
          );
        },
        fix: "Dùng đúng mã trong weaknesses[].code (Phân tích điểm yếu) hoặc errors[].code (Chấm chữa) của cùng kỹ năng.",
        lat: "210 ms",
        slowLat: "4,6 s",
        slowNote:
          "Bộ tham chiếu lớn có thể chậm. Cache reference_set_id theo (skill, error_code, topic).",
      },
      {
        short: "Sinh bài tập",
        title: "Sinh bài tập",
        desc: "Sinh bài tập từ bộ tham chiếu vừa lấy. reference_set_id từ bước trước đã điền sẵn.",
        fields: [
          {
            id: "count",
            label: "count",
            kind: "chips",
            options: ["3", "5", "10"],
            def: "3",
          },
          {
            id: "level",
            label: "target_band",
            kind: "chips",
            options: ["5–6", "6–7", "7–8"],
            def: "6–7",
          },
        ],
        method: "POST",
        path: "/v1/exercises",
        run: "Sinh bài tập",
        req: function (v) {
          return (
            "POST " +
            API +
            "/v1/exercises\n" +
            KEYH +
            '\nX-AIHub-User-Id: student_1042\nContent-Type: application/json\n\n{\n  "reference_set_id": "ref_7Q2M",\n  "count": ' +
            v.count +
            ',\n  "target_band": "' +
            v.level +
            '"\n}'
          );
        },
        ok: function () {
          return (
            'HTTP 200\n{\n  "exercise_set_id": "ex_3KD9",\n  "skill": "' +
            sk +
            '",\n  "exercises": [\n' +
            D.result.items
              .map(function (i) {
                return (
                  '    { "type": "' +
                  i.code +
                  '", "prompt": "' +
                  i.text.replace(/"/g, '\\"').slice(0, 48) +
                  '…" }'
                );
              })
              .join(",\n") +
            "\n  ]\n}"
          );
        },
        err: function () {
          return 'HTTP 410\n{\n  "error_code": "REFERENCE_SET_EXPIRED",\n  "error_message": "reference_set_id hết hạn sau 24 giờ."\n}';
        },
        fix: "Gọi lại bước lấy dữ liệu tham chiếu để có reference_set_id mới, hoặc lưu thành mẫu ở Kho mẫu.",
        lat: "3,4 s",
        slowLat: "11,2 s",
        slowNote:
          "Sinh 10 bài tập có thể mất hơn 10 giây. Gọi từ job nền và hiện trạng thái “Đang chuẩn bị bài tập”.",
      },
      APP_STEP,
    ],
    after: [
      "Dán prompt vào công cụ AI coding trong project của bạn.",
      "Đặt AIHUB_API_KEY — lấy ở trang chi tiết API key.",
      "Nối với Phân tích điểm yếu " +
        L +
        ": sinh bài tập cho weaknesses[0] mỗi khi hồ sơ được cập nhật.",
    ],
    code: {
      prompt: function (v) {
        return (
          "Tôi dùng AIHub để phân tích điểm yếu IELTS " +
          L +
          " của học viên. Hãy viết hàm Node.js sinh bài tập luyện đúng điểm yếu ưu tiên.\n\nYêu cầu:\n- Đầu vào: end_user_id và weaknesses[0] (code, group).\n- GET /v1/exercises/references?skill=" +
          sk +
          "&" +
          grpLabel +
          '=<group>&error_code=<code>&topic=<topic> để lấy reference_set_id (cache 24 giờ).\n- POST /v1/exercises với {"reference_set_id","count":' +
          v.count +
          ',"target_band":"' +
          v.level +
          '"}.\n- Header: Authorization: Bearer <AIHUB_API_KEY>, X-AIHub-User-Id.\n- Xử lý lỗi: ERROR_CODE_NOT_FOUND, REFERENCE_SET_EXPIRED, RATE_LIMITED.'
        );
      },
      node: function (v) {
        return [
          "const BASE = '" + API + "/v1/exercises';",
          "",
          "export async function exercisesFor(userId, weakness, topic) {",
          "  const headers = { Authorization: 'Bearer ' + process.env.AIHUB_API_KEY, 'X-AIHub-User-Id': userId };",
          "  const q = new URLSearchParams({ skill: '" +
            sk +
            "', " +
            grpLabel +
            ": weakness.group, error_code: weakness.code, topic });",
          "  const ref = await fetch(BASE + '/references?' + q, { headers }).then(r => r.json());",
          "  const r = await fetch(BASE, {",
          "    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },",
          "    body: JSON.stringify({ reference_set_id: ref.reference_set_id, count: " +
            v.count +
            ", target_band: '" +
            v.level +
            "' })",
          "  });",
          "  return (await r.json()).exercises;",
          "}",
        ].join("\n");
      },
      python: function (v) {
        return [
          "import os, requests",
          "",
          "BASE = '" + API + "/v1/exercises'",
          "",
          "def exercises_for(user_id, weakness, topic):",
          "    h = {'Authorization': 'Bearer ' + os.environ['AIHUB_API_KEY'], 'X-AIHub-User-Id': user_id}",
          "    ref = requests.get(BASE + '/references', headers=h, params={'skill': '" +
            sk +
            "', '" +
            grpLabel +
            "': weakness['group'], 'error_code': weakness['code'], 'topic': topic}, timeout=10).json()",
          "    r = requests.post(BASE, headers=h, json={'reference_set_id': ref['reference_set_id'], 'count': " +
            v.count +
            ", 'target_band': '" +
            v.level +
            "'}, timeout=30)",
          "    return r.json()['exercises']",
        ].join("\n");
      },
    },
  };
}
export function exOps(sk) {
  var m = SKM[sk],
    C = CODES[sk],
    L = SKL[sk];
  return ops({
    recentTitle: "Bộ bài tập " + L + " gần đây",
    plan: "E-5K",
    today: Math.round(186 * m),
    todayMax: 2000,
    path: "/v1/exercises",
    model: "exercise-gen-2026-08",
    rid: "E" + sk[0].toUpperCase(),
    q: ["Bộ bài tập " + L + " / năm", Math.round(2140 * m), 5000],
    r: ["Request / phút", Math.round(22 * m) + 2, 60],
    stats: [
      { l: "Bộ bài tập 14 ngày", v: fmt(Math.round(1902 * m)) },
      { l: "End-user", v: fmt(Math.round(644 * m)) },
      { l: "Lỗi 24h", v: "2" },
      { l: "Latency p95", v: "5,1 s" },
    ],
    chartTitle: "Bộ bài tập " + L + " 14 ngày",
    unitShort: "Bộ bài tập",
    top: [14, 11, 9, 7, 6],
    rows: [
      [
        USERS[0],
        C[0].g + " · " + C[0].c,
        "5 bài tập",
        "3,2 s",
        "Thành công",
        "ok",
      ],
      [
        USERS[1],
        C[1].g + " · " + C[1].c,
        "3 bài tập",
        "2,9 s",
        "Thành công",
        "ok",
      ],
      [
        USERS[2],
        "sai_ma_loi",
        "—",
        "40 ms",
        "ERROR_CODE_NOT_FOUND",
        "err",
        "404",
      ],
      [
        USERS[3],
        C[2].g + " · " + C[2].c,
        "3 bài tập",
        "3,0 s",
        "Thành công",
        "ok",
      ],
    ],
  });
}

/* =================== 4. LỘ TRÌNH CÁ NHÂN HOÁ =================== */
export var RM_BASE = {
  name: "Lộ trình cá nhân hoá",
  group: "Dịch vụ 4 / 4",
  badge: "Beta",
  badgeCls: "badge b-beta",
  prev: "weakness",
  inText: "(profile_id) + band mục tiêu + ngày thi",
  next: null,
  demoUrl: "https://aihubproduction.com/demo",
  special: "Cấu hình lộ trình",
  specialKey: "roadmapCfg",
  plans: [
    {
      name: "R-300",
      feats: ["300 học viên có lộ trình / năm", "3.000 lần cập nhật / tháng"],
      price: "[giá] credit / năm",
    },
    {
      name: "R-1K",
      feats: [
        "1.000 học viên có lộ trình / năm",
        "10.000 lần cập nhật / tháng",
      ],
      price: "[giá] credit / năm",
      current: true,
    },
    {
      name: "R-5K",
      feats: [
        "5.000 học viên có lộ trình / năm",
        "50.000 lần cập nhật / tháng",
      ],
      price: "[giá] credit / năm",
    },
    {
      name: "R-MAX",
      feats: ["Theo nhu cầu", "SLA riêng"],
      price: "Báo giá riêng",
      contact: true,
    },
  ],
};
export var RD = {
  writing: {
    weeks: 13,
    from: "6.0",
    target: "7.0",
    hours: "6",
    metrics: [
      ["Task 1", "35%"],
      ["Task 2", "65%"],
      ["Bộ bài tập", "52"],
      ["Bài thi thử", "3"],
    ],
    comment:
      "Tuần 1–4 tập trung LR (collocation, lặp từ) theo hồ sơ điểm yếu; từ tuần 5 xen bài thi thử mỗi 4 tuần để đo tiến độ và sắp lại.",
    items: [
      [
        "Tuần 1–2",
        "Collocation học thuật: 12 bài tập + 2 bài Task 2",
        "LR · collocation_error",
      ],
      [
        "Tuần 3–4",
        "Paraphrase, giảm lặp từ: 10 bài tập + 2 bài Task 2",
        "LR · lexical_repetition",
      ],
      ["Tuần 5", "Thi thử Writing, sắp lại lộ trình", "Mốc kiểm tra"],
    ],
  },
  speaking: {
    weeks: 10,
    from: "5.5",
    target: "6.5",
    hours: "4",
    metrics: [
      ["Part 1", "20%"],
      ["Part 2", "50%"],
      ["Part 3", "30%"],
      ["Bài nói thử", "3"],
    ],
    comment:
      "Tuần 1–3 sửa thì quá khứ qua Part 2, tuần 4–6 giảm ngập ngừng bằng bài nói 2 phút có giới hạn thời gian.",
    items: [
      [
        "Tuần 1–3",
        "Kể chuyện quá khứ Part 2: 9 bài luyện + 3 bài nói chấm",
        "GRA · verb_tense",
      ],
      [
        "Tuần 4–6",
        "Nói liền mạch 2 phút, giảm từ đệm: 9 bài luyện",
        "FC · hesitation",
      ],
      ["Tuần 7", "Bài nói thử đủ 3 Part, sắp lại lộ trình", "Mốc kiểm tra"],
    ],
  },
  reading: {
    weeks: 8,
    from: "6.0",
    target: "7.0",
    hours: "5",
    metrics: [
      ["TFNG", "35%"],
      ["Headings", "30%"],
      ["Dạng khác", "35%"],
      ["Đề thi thử", "3"],
    ],
    comment:
      "Tuần 1–3 luyện phân biệt FALSE / NOT GIVEN, tuần 4–5 luyện Matching Headings theo ý chính đoạn.",
    items: [
      [
        "Tuần 1–3",
        "TFNG: 15 đoạn đọc ngắn, tìm dẫn chứng",
        "TFNG · tfng_not_given_confusion",
      ],
      [
        "Tuần 4–5",
        "Matching Headings: tóm ý chính 20 đoạn",
        "Headings · matching_headings_main_idea",
      ],
      ["Tuần 6", "Đề thi thử Academic, sắp lại lộ trình", "Mốc kiểm tra"],
    ],
  },
  listening: {
    weeks: 8,
    from: "6.5",
    target: "7.5",
    hours: "4",
    metrics: [
      ["Part 1", "10%"],
      ["Part 2", "40%"],
      ["Part 3–4", "50%"],
      ["Đề thi thử", "3"],
    ],
    comment:
      "Tuần 1–3 luyện nghe thông tin bị sửa lại ở Part 2, tuần 4–5 luyện bản đồ và chỉ hướng.",
    items: [
      [
        "Tuần 1–3",
        "Nghe thông tin gây nhiễu: 12 đoạn audio Part 2",
        "Part 2 · distractor_trap",
      ],
      [
        "Tuần 4–5",
        "Map labelling: 8 bản đồ + cụm chỉ hướng",
        "Part 2 · map_labelling",
      ],
      ["Tuần 6", "Đề thi thử Listening, sắp lại lộ trình", "Mốc kiểm tra"],
    ],
  },
};
export function rmFor(sk) {
  var L = SKL[sk],
    D = RD[sk];
  return {
    scope: scopeOf("roadmap", sk),
    desc:
      "Dựng lộ trình luyện " +
      L +
      " theo tuần từ hồ sơ điểm yếu, band mục tiêu, ngày thi và số giờ học; tự sắp lại khi học viên có bài chấm " +
      L +
      " mới.",
    tryTitle: "Tạo thử lộ trình " + L + " cho học viên mẫu",
    tryDesc:
      "Dùng hồ sơ điểm yếu " + L + " của học viên mẫu để xem lộ trình trả về.",
    tryLabel: "Mục tiêu",
    tryInput:
      "student_1042 · " +
      L +
      " " +
      D.from +
      " → " +
      D.target +
      " · thi 15/01/2027 · " +
      D.hours +
      " giờ/tuần",
    tryRows: 2,
    tryCta: "Tạo lộ trình thử",
    tryRunningText: "Đang xếp lộ trình theo tuần…",
    tryFacts: [
      { l: "Đầu vào", v: "profile_id · band · ngày thi" },
      { l: "Đơn vị", v: "Tuần" },
      { l: "Cập nhật", v: "Tự động khi có bài chấm mới" },
    ],
    flowDesc:
      "Tạo lộ trình " +
      L +
      " cho một học viên, rồi cập nhật sau mỗi bài chấm mới. Cuối cùng copy prompt AI hoặc code vào app.",
    result: {
      headline: D.weeks + " tuần",
      sub:
        L +
        " " +
        D.from +
        " → " +
        D.target +
        " · " +
        D.hours +
        " giờ/tuần · thi 15/01/2027",
      metrics: D.metrics.map(function (m) {
        return { l: m[0], v: m[1] };
      }),
      comment: D.comment,
      itemsTitle: "Các chặng",
      items: D.items.map(function (i) {
        return { code: i[0], text: i[1], meta: i[2] };
      }),
    },
    steps: [
      {
        short: "Tạo lộ trình",
        title: "Tạo lộ trình " + L,
        desc: "Gửi hồ sơ điểm yếu và mục tiêu của học viên. AIHub trả về lộ trình theo tuần.",
        fields: [
          {
            id: "uid",
            label: "end_user_id",
            kind: "input",
            def: "student_1042",
          },
          {
            id: "target",
            label: "target_band",
            kind: "chips",
            options: ["6.5", "7.0", "7.5"],
            def:
              D.target === "6.5" ? "6.5" : D.target === "7.5" ? "7.5" : "7.0",
          },
          {
            id: "exam",
            label: "exam_date",
            kind: "input",
            def: "15/01/2027",
            help: "Thử một ngày trong vòng 14 ngày tới (VD 20/10/2026) để xem lỗi EXAM_DATE_TOO_SOON.",
          },
          {
            id: "hours",
            label: "hours_per_week",
            kind: "chips",
            options: ["4", "6", "10"],
            def: D.hours === "5" ? "6" : D.hours,
          },
        ],
        method: "POST",
        path: "/v1/roadmaps",
        run: "Tạo lộ trình",
        invalid: function (v) {
          var d = parseVN(v.exam);
          return !d || d < new Date(2026, 9, 29);
        },
        req: function (v) {
          return (
            "POST " +
            API +
            "/v1/roadmaps\n" +
            KEYH +
            "\nX-AIHub-User-Id: " +
            v.uid +
            '\nContent-Type: application/json\n\n{\n  "skill": "' +
            sk +
            '",\n  "weakness_profile_id": "wp_8M2K",\n  "target_band": ' +
            v.target +
            ',\n  "exam_date": "' +
            v.exam +
            '",\n  "hours_per_week": ' +
            v.hours +
            "\n}"
          );
        },
        ok: function (v) {
          return (
            'HTTP 201\n{\n  "roadmap_id": "rm_4T7P",\n  "skill": "' +
            sk +
            '",\n  "end_user_id": "' +
            v.uid +
            '",\n  "target_band": ' +
            v.target +
            ',\n  "weeks": ' +
            D.weeks +
            ',\n  "weeks_preview": [\n' +
            D.items
              .map(function (i) {
                return (
                  '    { "weeks": "' + i[0] + '", "focus": "' + i[2] + '" }'
                );
              })
              .join(",\n") +
            "\n  ]\n}"
          );
        },
        err: function (v) {
          return (
            'HTTP 422\n{\n  "error_code": "EXAM_DATE_TOO_SOON",\n  "error_message": "Ngày thi cần cách hôm nay ít nhất 14 ngày.",\n  "exam_date": "' +
            v.exam +
            '"\n}'
          );
        },
        fix: "Với học viên sắp thi dưới 14 ngày, dùng trực tiếp Tạo bài tập cho điểm yếu ưu tiên. Ngày thi theo định dạng dd/mm/yyyy.",
        lat: "2,6 s",
        slowLat: "12,5 s",
        slowNote:
          "Lộ trình dài (trên 20 tuần) có thể mất hơn 10 giây. Tạo từ job nền và báo học viên khi xong.",
      },
      {
        short: "Cập nhật tiến độ",
        title: "Cập nhật lộ trình sau bài chấm mới",
        desc:
          "Gửi request_id của một bài " +
          L +
          " vừa Chấm chữa. AIHub sắp lại các tuần còn lại nếu điểm yếu thay đổi.",
        fields: [
          {
            id: "gid",
            label: "grade_request_id",
            kind: "input",
            def: "req_01JA9W2K",
            help: "request_id trả về từ Chấm chữa. Thử xoá trống để xem lỗi GRADE_NOT_FOUND.",
          },
        ],
        method: "POST",
        path: "/v1/roadmaps/rm_4T7P/progress",
        run: "Cập nhật",
        invalid: function (v) {
          return !v.gid || v.gid.indexOf("req_") !== 0;
        },
        req: function (v) {
          return (
            "POST " +
            API +
            "/v1/roadmaps/rm_4T7P/progress\n" +
            KEYH +
            "\nX-AIHub-User-Id: " +
            v.uid +
            '\nContent-Type: application/json\n\n{\n  "grade_request_id": "' +
            v.gid +
            '"\n}'
          );
        },
        ok: function () {
          return (
            'HTTP 200\n{\n  "roadmap_id": "rm_4T7P",\n  "replanned": true,\n  "changes": [\n    "' +
            D.items[0][0] +
            ": giữ trọng tâm " +
            D.items[0][2].split(" · ")[1] +
            ' (vẫn lặp ở bài mới)"\n  ],\n  "on_track": true,\n  "next_checkpoint": "12/11/2026"\n}'
          );
        },
        err: function (v) {
          return (
            'HTTP 404\n{\n  "error_code": "GRADE_NOT_FOUND",\n  "error_message": "Không tìm thấy bài chấm ' +
            (v.gid || "(trống)") +
            ' của học viên này."\n}'
          );
        },
        fix:
          "Gửi đúng request_id mà Chấm chữa " +
          L +
          " trả về cho cùng end_user_id. Nếu đã bật “Tự cập nhật” thì không cần gọi bước này.",
        lat: "1,8 s",
        slowLat: "7,9 s",
        slowNote:
          "Bật “Tự cập nhật khi có bài chấm mới” để AIHub tự sắp lại và báo qua webhook roadmap.updated.",
      },
      APP_STEP,
    ],
    after: [
      "Dán prompt vào công cụ AI coding trong project của bạn.",
      "Tạo lộ trình sau lần Phân tích điểm yếu " +
        L +
        " đầu tiên của học viên.",
      "Nghe webhook roadmap.updated để làm mới màn hình lộ trình.",
    ],
    code: {
      prompt: function (v) {
        return (
          "Tôi dùng AIHub cho app luyện IELTS. Hãy viết code Node.js tạo và hiển thị lộ trình " +
          L +
          " cá nhân hoá cho học viên.\n\nYêu cầu:\n- POST " +
          API +
          '/v1/roadmaps với {"skill":"' +
          sk +
          '","weakness_profile_id","target_band":' +
          v.target +
          ',"exam_date":"' +
          v.exam +
          '","hours_per_week":' +
          v.hours +
          "}. Header Authorization: Bearer <AIHUB_API_KEY>, X-AIHub-User-Id.\n- Lưu roadmap_id; hiển thị weeks_preview theo tuần.\n- Sau mỗi bài Chấm chữa " +
          L +
          ', gọi POST /v1/roadmaps/{roadmap_id}/progress với {"grade_request_id"} (hoặc nghe webhook roadmap.updated).\n- Xử lý lỗi: EXAM_DATE_TOO_SOON, GRADE_NOT_FOUND, WEAKNESS_PROFILE_REQUIRED.'
        );
      },
      node: function (v) {
        return [
          "const BASE = '" + API + "/v1/roadmaps';",
          "const H = { Authorization: 'Bearer ' + process.env.AIHUB_API_KEY, 'Content-Type': 'application/json' };",
          "",
          "export async function createRoadmap(userId, profileId) {",
          "  const r = await fetch(BASE, {",
          "    method: 'POST', headers: { ...H, 'X-AIHub-User-Id': userId },",
          "    body: JSON.stringify({ skill: '" +
            sk +
            "', weakness_profile_id: profileId, target_band: " +
            v.target +
            ", exam_date: '" +
            v.exam +
            "', hours_per_week: " +
            v.hours +
            " })",
          "  });",
          "  const data = await r.json();",
          "  if (!r.ok) throw new Error(data.error_code);",
          "  return data;",
          "}",
        ].join("\n");
      },
      python: function (v) {
        return [
          "import os, requests",
          "",
          "def create_roadmap(user_id, profile_id):",
          "    h = {'Authorization': 'Bearer ' + os.environ['AIHUB_API_KEY'], 'X-AIHub-User-Id': user_id}",
          "    r = requests.post('" + API + "/v1/roadmaps', headers=h, json={",
          "        'skill': '" + sk + "', 'weakness_profile_id': profile_id,",
          "        'target_band': " +
            v.target +
            ", 'exam_date': '" +
            v.exam +
            "', 'hours_per_week': " +
            v.hours +
            "}, timeout=30)",
          "    r.raise_for_status()",
          "    return r.json()",
        ].join("\n");
      },
    },
  };
}
export function rmOps(sk) {
  var m = SKM[sk],
    L = SKL[sk],
    D = RD[sk];
  return ops({
    recentTitle: "Lộ trình " + L + " gần đây",
    plan: "R-1K",
    today: Math.max(6, Math.round(23 * m)),
    todayMax: 500,
    path: "/v1/roadmaps",
    model: "roadmap-planner-2026-10-beta",
    rid: "M" + sk[0].toUpperCase(),
    q: ["Học viên có lộ trình " + L + " / năm", Math.round(312 * m), 1000],
    r: ["Lần cập nhật / phút", Math.round(8 * m) + 1, 30],
    stats: [
      { l: "Lộ trình đang chạy", v: fmt(Math.round(298 * m)) },
      { l: "Đúng tiến độ", v: "81%" },
      { l: "Lỗi 24h", v: "1" },
      { l: "Latency p95", v: "4,4 s" },
    ],
    chartTitle: "Lộ trình " + L + " tạo và cập nhật 14 ngày",
    unitShort: "Lần cập nhật",
    top: [9, 8, 6, 5, 4],
    rows: [
      [
        USERS[0],
        D.from + " → " + D.target + " · thi 15/01",
        D.weeks + " tuần",
        "2,4 s",
        "Tạo mới",
        "ok",
        "201",
      ],
      [
        USERS[1],
        "bài chấm req_01JA9W1Q",
        "Sắp lại 1 chặng",
        "1,7 s",
        "Cập nhật",
        "ok",
      ],
      [
        USERS[3],
        "6.5 → 7.5 · thi 30/11",
        "—",
        "60 ms",
        "Chậm kế hoạch 2 tuần",
        "warn",
      ],
      [USERS[2], "thi 22/10/2026", "—", "30 ms", "EXAM_DATE_TOO_SOON", "err"],
    ],
  });
}

export var SVC = {
  grade: GRADE_BASE,
  weakness: WEAK_BASE,
  exercise: EX_BASE,
  roadmap: RM_BASE,
};
export var PIPE = {
  grade: {
    io: "Bài làm 4 kỹ năng → band, nhận xét, lỗi có mã kèm lời chữa",
    unit: "Lượt chấm",
    todayN: 1153,
  },
  weakness: {
    io: "Lịch sử bài chấm → điểm yếu ưu tiên kèm bằng chứng",
    unit: "Lượt phân tích",
    todayN: 230,
  },
  exercise: {
    io: "Mã lỗi / điểm yếu → bộ bài tập kèm đáp án",
    unit: "Bộ bài tập",
    todayN: 455,
  },
  roadmap: {
    io: "Hồ sơ điểm yếu + mục tiêu → lộ trình theo tuần",
    unit: "Lộ trình",
    todayN: 56,
  },
};
export var QUOTA_DEF = {
  grade: ["Lượt chấm / năm (key này)", 12000],
  weakness: ["Lượt phân tích / năm (key này)", 5000],
  exercise: ["Bộ bài tập / năm (key này)", 5000],
  roadmap: ["Học viên có lộ trình / năm (key này)", 1000],
};

export function G(list) {
  var g = {};
  list.forEach(function (s) {
    g[s] = true;
  });
  return g;
}
export var KEYS0 = [
  {
    id: "k_wispace",
    name: "Wispace Production",
    prefix: "aihub_live_7k2m…q81c",
    env: "Production",
    grants: G([
      "writing.grade",
      "speaking.grade",
      "reading.grade",
      "listening.grade",
      "writing.analyze",
      "speaking.analyze",
      "reading.analyze",
      "listening.analyze",
      "writing.exercise",
      "speaking.exercise",
      "reading.exercise",
      "writing.roadmap",
      "speaking.roadmap",
    ]),
    today: 842,
    expires: "Không hết hạn",
    created: "03/07/2026 09:12",
    lastUsed: "2 phút trước",
    webhook: "https://api.wispace.vn/hooks/aihub",
    use: {
      grade: [8120, 12000],
      weakness: [1210, 5000],
      exercise: [1880, 5000],
      roadmap: [240, 1000],
    },
  },
  {
    id: "k_center",
    name: "IELTS Center Staging",
    prefix: "aihub_live_3f9a…c210",
    env: "Production",
    grants: G([
      "writing.grade",
      "reading.grade",
      "listening.grade",
      "writing.exercise",
    ]),
    today: 117,
    expires: "31/12/2026",
    created: "10/08/2026 14:40",
    lastUsed: "18 phút trước",
    webhook: "",
    use: { grade: [2300, 12000], exercise: [260, 5000] },
  },
  {
    id: "k_minh",
    name: "Minh test",
    prefix: "aihub_sandbox_znon3a",
    env: "Sandbox",
    grants: G(["writing.grade", "speaking.grade"]),
    today: 0,
    expires: "31/10/2026 20:56",
    created: "14/10/2026 20:56",
    lastUsed: "Chưa dùng",
    webhook: "",
    use: {},
  },
];

export var TOPUPS = [
  "5.000",
  "10.000",
  "20.000",
  "50.000",
  "100.000",
  "200.000",
];
export var BILLS = [
  {
    t: "01/10/2026 00:05",
    c: "Tự động gia hạn gói G-12K",
    a: "−[giá] credit",
    m: "Số dư credit",
    s: "Thành công",
    cls: "pill p-ok",
  },
  {
    t: "28/09/2026 14:22",
    c: "Nạp credit",
    a: "+50.000 credit",
    m: "Chuyển khoản",
    s: "Thành công",
    cls: "pill p-ok",
  },
  {
    t: "20/09/2026 09:15",
    c: "Mua gói R-1K (Beta)",
    a: "−[giá] credit",
    m: "Số dư credit",
    s: "Thành công",
    cls: "pill p-ok",
  },
  {
    t: "18/08/2026 10:00",
    c: "Nâng gói A-5K",
    a: "−[giá] credit",
    m: "Số dư credit",
    s: "Thành công",
    cls: "pill p-ok",
  },
  {
    t: "02/08/2026 09:41",
    c: "Nạp credit",
    a: "+20.000 credit",
    m: "Chuyển khoản",
    s: "Đang xử lý",
    cls: "pill p-warn",
  },
];
export var MEMBERS = [
  {
    n: "Binh Minh",
    e: "minhcq@cas.so",
    r: "Owner",
    s: "Đang hoạt động",
    cls: "pill p-ok",
  },
  {
    n: "[Tên thành viên]",
    e: "dev@yourcompany.com",
    r: "Developer",
    s: "Đang hoạt động",
    cls: "pill p-ok",
  },
  {
    n: "[Tên thành viên]",
    e: "ketoan@yourcompany.com",
    r: "Kế toán",
    s: "Đang hoạt động",
    cls: "pill p-ok",
  },
  {
    n: "—",
    e: "partner@yourcompany.com",
    r: "Developer",
    s: "Đã mời, chưa nhận",
    cls: "pill p-warn",
  },
];
export var HOOKS = [
  {
    t: "15/10 10:42:42",
    e: "speaking.graded",
    j: "job_5HX21B",
    c: "200",
    n: "1",
    cls: "pill p-ok",
  },
  {
    t: "15/10 10:40:14",
    e: "speaking.graded",
    j: "job_5HX20Z",
    c: "200",
    n: "1",
    cls: "pill p-ok",
  },
  {
    t: "15/10 10:29:13",
    e: "speaking.graded",
    j: "job_5HX1QK",
    c: "503",
    n: "2 / 5",
    cls: "pill p-warn",
  },
  {
    t: "15/10 09:58:40",
    e: "speaking.failed",
    j: "job_5HX0M2",
    c: "200",
    n: "1",
    cls: "pill p-ok",
  },
];

export function svcGranted(k, s) {
  return SKILL_ORDER.some(function (sk) {
    return !!k.grants[scopeOf(s, sk)];
  });
}
export function grantedSkills(k, s) {
  return SKILL_ORDER.filter(function (sk) {
    return !!k.grants[scopeOf(s, sk)];
  });
}
