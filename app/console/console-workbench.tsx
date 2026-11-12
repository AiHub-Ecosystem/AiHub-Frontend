// @ts-nocheck
/* eslint-disable */
"use client";

import React from "react";
import {
  SVC_ORDER,
  SKILL_ORDER,
  SKL,
  SUF,
  SKM,
  USERS,
  TIMES,
  KEYCYC,
  PAT,
  API,
  KEYH,
  CODES,
  GROUPS,
  APP_STEP,
  ESSAY,
  GRADE_BASE,
  GRADE_W,
  GRADE_S,
  OBJ,
  WEAK_BASE,
  WD,
  EX_BASE,
  ED,
  RM_BASE,
  RD,
  SVC,
  PIPE,
  QUOTA_DEF,
  KEYS0,
  TOPUPS,
  BILLS,
  MEMBERS,
  HOOKS,
  scopeOf,
  fmt,
  pillCls,
  parseVN,
  ops,
  idStep,
  gradeObjective,
  gradeOps,
  weakFor,
  weakOps,
  exFor,
  exOps,
  rmFor,
  rmOps,
  G,
  svcGranted,
  grantedSkills,
} from "./console-data";
import "./console-prototype.css";

function parseStyle(styleInput: any): React.CSSProperties {
  if (!styleInput) return {};
  if (typeof styleInput === "object") return styleInput;
  const result: Record<string, string> = {};
  for (const part of String(styleInput).split(";")) {
    const trimmed = part.trim();
    if (!trimmed || !trimmed.includes(":")) continue;
    const [rawKey, ...rawValParts] = trimmed.split(":");
    const key = rawKey.trim();
    const val = rawValParts.join(":").trim();
    if (!key || !val) continue;
    const camelKey = key.startsWith("--")
      ? key
      : key.replace(/-([a-z])/g, (_, g) => g.toUpperCase());
    result[camelKey] = val;
  }
  return result as React.CSSProperties;
}

export class ConsoleWorkbench extends React.Component<{}, any> {
  constructor(...args) {
    super(...args);
    this.state = {
      page: "overview",
      svc: "grade",
      skill: "writing",
      tab: "overview",
      demo: "new",
      keyId: "k_minh",
      keys: KEYS0.map(function (k) {
        return Object.assign({}, k, { grants: Object.assign({}, k.grants) });
      }),
      mode: "mock",
      scenario: "ok",
      progress: {},
      fv: {},
      running: false,
      tryInput: {},
      tryState: {},
      codeTab: "prompt",
      copied: "",
      usageKey: "all",
      logOpen: -1,
      showContent: false,
      identity: "declared",
      grantFor: null,
      grantDraft: {},
      createOpen: false,
      newName: "",
      newEnv: "Sandbox",
      newExp: "30 ngày",
      reveal: "",
      revealFor: null,
      revokeAsk: false,
      rotateAsk: false,
      grace: "24 giờ",
      planTab: "grade",
      topup: "10.000",
      credit: 48200,
      toast: "",
      expanded: { grade: true },
    };
    this._cache = {};
  }
  componentDidMount() {
    if (typeof document !== "undefined") {
      document.body.classList.add("console-active");
    }
  }
  componentWillUnmount() {
    if (typeof document !== "undefined") {
      document.body.classList.remove("console-active");
    }
  }

  cfgFor(svc, sk) {
    var key = svc + "_" + sk;
    if (this._cache[key]) return this._cache[key];
    var c;
    if (svc === "grade") {
      var body =
        sk === "writing"
          ? GRADE_W
          : sk === "speaking"
            ? GRADE_S
            : Object.assign(gradeObjective(sk), gradeOps(sk));
      c = Object.assign({}, GRADE_BASE, body, { scope: scopeOf("grade", sk) });
    } else if (svc === "weakness")
      c = Object.assign({}, WEAK_BASE, weakFor(sk), weakOps(sk));
    else if (svc === "exercise")
      c = Object.assign({}, EX_BASE, exFor(sk), exOps(sk));
    else c = Object.assign({}, RM_BASE, rmFor(sk), rmOps(sk));
    c.skillLabel = "IELTS " + SKL[sk];
    this._cache[key] = c;
    return c;
  }
  pk() {
    return this.state.svc + "_" + this.state.skill;
  }
  cfg() {
    return this.cfgFor(this.state.svc, this.state.skill);
  }

  flash(msg) {
    var self = this;
    this.setState({ toast: msg });
    clearTimeout(this._t);
    this._t = setTimeout(function () {
      self.setState({ toast: "" });
    }, 2600);
  }
  copy(text, label) {
    try {
      navigator.clipboard.writeText(text);
    } catch (e) {}
    this.setState({ copied: label });
    this.flash("Đã copy vào clipboard.");
  }
  prog(k) {
    return this.state.progress[k] || { cur: 0, done: {}, out: {} };
  }
  vals(k, cfg) {
    var v = {};
    var fv = this.state.fv[k] || {};
    (cfg.steps || []).forEach(function (st) {
      (st.fields || []).forEach(function (f) {
        if (v[f.id] === undefined)
          v[f.id] = fv[f.id] !== undefined ? fv[f.id] : f.def;
      });
    });
    if (v.uid === undefined) v.uid = "student_001";
    v.skill = this.state.skill;
    return v;
  }
  setField(k, id, val) {
    var fv = Object.assign({}, this.state.fv);
    fv[k] = Object.assign({}, fv[k] || {});
    fv[k][id] = val;
    this.setState({ fv: fv });
  }
  setProg(k, p) {
    var all = Object.assign({}, this.state.progress);
    all[k] = p;
    this.setState({ progress: all });
  }
  go(page, extra) {
    this.setState(
      Object.assign(
        { page: page, revokeAsk: false, rotateAsk: false, logOpen: -1 },
        extra || {}
      )
    );
    try {
      window.scrollTo(0, 0);
    } catch (e) {}
  }
  openSvc(svc, tab, sk) {
    var e = Object.assign({}, this.state.expanded || {});
    e[svc] = true;
    var x = {
      svc: svc,
      tab: tab || "overview",
      running: false,
      usageKey: "all",
      expanded: e,
    };
    if (sk) x.skill = sk;
    this.go("service", x);
  }

  runStep() {
    var self = this,
      k = this.pk(),
      cfg = this.cfg(),
      p = this.prog(k),
      st = cfg.steps[p.cur],
      v = this.vals(k, cfg);
    var invalid = st.invalid ? st.invalid(v) : false;
    var isErr = this.state.scenario === "err" || invalid;
    var slow = this.state.scenario === "slow";
    this.setState({ running: true });
    setTimeout(
      function () {
        var p2 = self.prog(k);
        var out = Object.assign({}, p2.out);
        out[p2.cur] = isErr
          ? { text: st.err(v), err: true, lat: "—" }
          : {
              text: st.ok(v),
              err: false,
              slow: slow,
              lat: slow ? st.slowLat : st.lat,
            };
        var done = Object.assign({}, p2.done);
        if (!isErr) done[p2.cur] = true;
        self.setState({ running: false });
        self.setProg(k, { cur: p2.cur, done: done, out: out });
        if (!isErr) {
          setTimeout(
            function () {
              var p3 = self.prog(k);
              if (p3.cur < cfg.steps.length - 1)
                self.setProg(k, {
                  cur: p3.cur + 1,
                  done: p3.done,
                  out: p3.out,
                });
            },
            slow ? 1800 : 1100
          );
        }
      },
      slow ? 2600 : 750
    );
  }
  runTry() {
    var self = this,
      k = this.pk();
    var ts = Object.assign({}, this.state.tryState);
    ts[k] = "running";
    this.setState({ tryState: ts });
    setTimeout(
      function () {
        var t2 = Object.assign({}, self.state.tryState);
        t2[k] = "done";
        self.setState({ tryState: t2 });
      },
      k === "grade_speaking" ? 1800 : 1200
    );
  }

  skillCards(grants, onToggle, locked) {
    var self = this;
    return SVC_ORDER.map(function (s) {
      var on = SKILL_ORDER.filter(function (sk) {
        return !!grants[scopeOf(s, sk)];
      });
      return {
        svc: s,
        name: SVC[s].name + (SVC[s].badge === "Beta" ? " (Beta)" : ""),
        on: on.length > 0,
        cls: on.length ? "chk on" : "chk",
        countText: on.length + " / 4 kỹ năng",
        scopeText: on.length
          ? on
              .map(function (sk) {
                return scopeOf(s, sk);
              })
              .join(" · ")
          : "Chưa cấp scope nào",
        skills: SKILL_ORDER.map(function (sk) {
          var sc = scopeOf(s, sk);
          return {
            label: "IELTS " + SKL[sk],
            on: !!grants[sc],
            locked: !!locked,
            toggle: function () {
              onToggle(sc);
            },
          };
        }),
      };
    });
  }

  renderVals() {
    var self = this,
      S = this.state;
    var isNew = S.demo === "new",
      isDone = !isNew;
    var keysVisible = isNew
      ? S.keys.filter(function (k) {
          return k.id === "k_minh" || k.created === "Vừa tạo";
        })
      : S.keys;
    var navCls = function (on) {
      return on ? "nav on" : "nav";
    };
    var segCls = function (on) {
      return on ? "sb on" : "sb";
    };
    var svcPage = S.page === "service";

    var nav = {
      overview: navCls(S.page === "overview" || S.page === "key"),
      sandbox: navCls(S.page === "sandbox"),
      grade: svcPage && S.svc === "grade" ? "nav par" : "nav",
      weakness: svcPage && S.svc === "weakness" ? "nav par" : "nav",
      exercise: svcPage && S.svc === "exercise" ? "nav par" : "nav",
      roadmap: svcPage && S.svc === "roadmap" ? "nav par" : "nav",
      identity: navCls(S.page === "identity"),
      plans: navCls(S.page === "plans"),
      billing: navCls(S.page === "billing"),
      members: navCls(S.page === "members"),
    };
    var pg = {};
    [
      "overview",
      "key",
      "service",
      "sandbox",
      "identity",
      "plans",
      "billing",
      "members",
    ].forEach(function (p) {
      pg[p] = S.page === p;
    });
    var EXP = S.expanded || {};
    var exp = {},
      chev = {},
      sub = {},
      navT = {};
    SVC_ORDER.forEach(function (s2) {
      exp[s2] = !!EXP[s2];
      chev[s2] = exp[s2] ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6";
      sub[s2] = SKILL_ORDER.map(function (sk) {
        var on = svcPage && S.svc === s2 && S.skill === sk;
        return {
          label: "IELTS " + SKL[sk],
          cls: on ? "snav on" : "snav",
          cur: on ? "page" : "false",
          go: function () {
            self.openSvc(s2, svcPage && S.svc === s2 ? S.tab : "overview", sk);
          },
        };
      });
      navT[s2] = function () {
        var e = Object.assign({}, S.expanded || {});
        if (e[s2] && !(svcPage && S.svc !== s2)) {
          e[s2] = false;
          self.setState({ expanded: e });
        } else {
          self.openSvc(s2);
        }
      };
    });

    var k = this.pk();
    var sv = Object.assign({}, this.cfg());
    var tabNames = {
      overview: "Tổng quan",
      integrate: "Tích hợp",
      special: sv.special || "",
      usage: "Usage & Quota",
      logs: "Logs",
      pricing: "Bảng giá",
    };
    var crumbMap = {
      overview: "Tổng quan",
      key: "Tổng quan / API key",
      sandbox: "Sandbox",
      identity: "Bảo mật / Xác thực End-user",
      plans: "Tài khoản / Gói & Credit",
      billing: "Tài khoản / Lịch sử thanh toán",
      members: "Tài khoản / Thành viên",
    };
    var crumb =
      "AIHub Console / " +
      (svcPage
        ? "Dịch vụ / " +
          sv.name +
          " / " +
          sv.skillLabel +
          " / " +
          tabNames[S.tab]
        : crumbMap[S.page]);

    // ---- keys table
    var keyRows = keysVisible.map(function (kk) {
      var svcs = SVC_ORDER.filter(function (s) {
        return svcGranted(kk, s);
      }).map(function (s) {
        var g = grantedSkills(kk, s);
        return (
          SVC[s].name +
          " · " +
          (g.length === 4
            ? "4 kỹ năng"
            : g
                .map(function (x) {
                  return SKL[x];
                })
                .join(", "))
        );
      });
      return {
        name: kk.name,
        prefix: kk.prefix,
        env: kk.revoked ? "Đã thu hồi" : kk.env,
        envCls: kk.revoked
          ? "pill p-err"
          : kk.env === "Production"
            ? "badge b-prod"
            : "badge b-sbx",
        today: isNew ? "0" : fmt(kk.today),
        expires: kk.expires,
        svcs: svcs,
        noScope: svcs.length === 0,
        open: function () {
          self.go("key", { keyId: kk.id });
        },
        grant: function () {
          self.setState({
            grantFor: kk.id,
            grantDraft: Object.assign({}, kk.grants),
          });
        },
      };
    });
    var prodCount = keysVisible.filter(function (kk) {
      return kk.env === "Production";
    }).length;
    var kpis = isNew
      ? [
          { l: "Request hôm nay", v: "0", s: "Chưa có request nào" },
          {
            l: "API keys",
            v: String(keysVisible.length),
            s:
              prodCount +
              " Production · " +
              (keysVisible.length - prodCount) +
              " Sandbox",
          },
          { l: "Credit còn lại", v: "0", s: "Sandbox miễn phí" },
          {
            l: "Học viên được phục vụ",
            v: "0",
            s: "Theo end_user_id, 30 ngày",
          },
        ]
      : [
          {
            l: "Request hôm nay",
            v: "1.894",
            s: "4 dịch vụ × 4 kỹ năng · " + keysVisible.length + " key",
          },
          {
            l: "API keys",
            v: String(keysVisible.length),
            s:
              prodCount +
              " Production · " +
              (keysVisible.length - prodCount) +
              " Sandbox",
          },
          {
            l: "Credit còn lại",
            v: fmt(S.credit),
            s: "Theo tốc độ hiện tại đủ khoảng 41 ngày",
          },
          {
            l: "Học viên được phục vụ",
            v: "1.384",
            s: "Theo end_user_id, 30 ngày",
          },
        ];

    var pipeline = SVC_ORDER.map(function (s, i) {
      return {
        n: String(i + 1),
        name: SVC[s].name,
        badge: SVC[s].badge,
        badgeCls: SVC[s].badgeCls,
        io: PIPE[s].io,
        unit: PIPE[s].unit,
        today: isNew ? "0" : fmt(PIPE[s].todayN),
        skills: SKILL_ORDER.map(function (sk) {
          return SKL[sk];
        }),
        open: function () {
          self.openSvc(s);
        },
      };
    });

    var tried =
      !!(S.progress.grade_writing && S.progress.grade_writing.done[1]) ||
      S.tryState.grade_writing === "done";
    var obItems = [
      {
        t: "Tạo API key",
        d: "Đã có key Sandbox “Minh test” với quyền writing.grade, speaking.grade. Key Production tạo khi bạn sẵn sàng.",
        cta: "Tạo key Production",
        done: true,
        go: function () {
          self.setState({
            createOpen: true,
            newEnv: "Production",
            newName: "",
          });
        },
      },
      {
        t: "Chấm chữa bài đầu tiên",
        d: "Chạy thử Chấm chữa IELTS Writing ngay trên Console, không cần viết code. Sau đó copy prompt hoặc code vào app.",
        cta: "Mở Chấm chữa",
        done: tried,
        go: function () {
          self.openSvc("grade", "integrate", "writing");
        },
      },
      {
        t: "Bật xác thực có chữ ký",
        d: "Tuỳ chọn. Chặn việc dùng API key để gửi request dưới ID học viên bất kỳ.",
        cta: "Cấu hình identity",
        done: S.identity === "signed",
        go: function () {
          self.go("identity");
        },
      },
    ];
    var onboard = obItems.map(function (o, i) {
      return {
        t: o.t,
        d: o.d,
        cta: o.cta,
        go: o.go,
        n: o.done ? "✓" : String(i + 1),
        box:
          "border: 1px solid " +
          (o.done ? "#BFE3D2" : "#E4E4EC") +
          "; background: " +
          (o.done ? "#F3FAF6" : "#FFFFFF") +
          "; border-radius: 14px; padding: 16px;",
        dot:
          "width: 26px; height: 26px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font: 700 12px/16px Plus Jakarta Sans, sans-serif; " +
          (o.done
            ? "background: #0F6B4C; color: #fff;"
            : "background: #EDEBFE; color: #4547C9;"),
      };
    });
    var obDoneCount = obItems.filter(function (o) {
      return o.done;
    }).length;

    // ---- key detail
    var K =
      S.keys.filter(function (kk) {
        return kk.id === S.keyId;
      })[0] || S.keys[0];
    var toggleKeyScope = function (sc) {
      var was = !!K.grants[sc];
      var keys = S.keys.map(function (kk) {
        if (kk.id !== K.id) return kk;
        var g = Object.assign({}, kk.grants);
        if (was) delete g[sc];
        else g[sc] = true;
        return Object.assign({}, kk, { grants: g });
      });
      self.setState({ keys: keys });
      self.flash((was ? "Đã gỡ quyền " : "Đã cấp quyền ") + sc + ".");
    };
    var svcCards = this.skillCards(K.grants, toggleKeyScope, K.revoked).map(
      function (c) {
        var u = K.use[c.svc] || [0, QUOTA_DEF[c.svc][1]];
        return Object.assign(c, {
          quotaLabel: QUOTA_DEF[c.svc][0],
          quotaText: fmt(u[0]) + " / " + fmt(u[1]),
          barStyle:
            "width: " + Math.max(2, Math.round((u[0] / u[1]) * 100)) + "%;",
          open: function () {
            self.openSvc(c.svc, "overview", grantedSkills(K, c.svc)[0]);
          },
        });
      }
    );
    var kd = {
      name: K.name,
      prefix: K.prefix,
      env: K.env,
      envCls: K.env === "Production" ? "badge b-prod" : "badge b-sbx",
      created: K.created,
      expires: K.expires,
      lastUsed: isNew && K.id !== "k_minh" ? "Chưa dùng" : K.lastUsed,
      webhook: K.webhook,
      hasWebhook: !!K.webhook,
      noWebhook: !K.webhook,
      revoked: !!K.revoked,
      active: !K.revoked,
      svcCards: svcCards,
    };
    var graceOpts = ["Ngay lập tức", "24 giờ", "7 ngày"].map(function (g) {
      return {
        label: g,
        on: S.grace === g,
        cls: segCls(S.grace === g),
        pick: function () {
          self.setState({ grace: g });
        },
      };
    });

    // ---- service page
    var s = S.svc;
    var tabsList = [
      "overview",
      "integrate",
      "special",
      "usage",
      "logs",
      "pricing",
    ];
    var tabs = tabsList.map(function (t) {
      return {
        label: tabNames[t],
        on: S.tab === t,
        cls: S.tab === t ? "tab on" : "tab",
        go: function () {
          self.setState({ tab: t, logOpen: -1 });
        },
      };
    });
    var tab = {
      special: S.tab === "special",
      usage: S.tab === "usage",
      logs: S.tab === "logs",
      pricing: S.tab === "pricing",
    };
    var showIntegration =
      S.tab === "integrate" || (S.tab === "overview" && isNew);
    var showBanner = S.tab === "overview" && isNew;
    var showOps = S.tab === "overview" && isDone;
    var sp = {
      rubric: sv.specialKey === "rubric",
      webhook: sv.specialKey === "webhook",
      bank: sv.specialKey === "bank",
      templates: sv.specialKey === "templates",
      profile: sv.specialKey === "profile",
      roadmapCfg: sv.specialKey === "roadmapCfg",
    };
    if (!sv.bank) sv.bank = { title: "", tests: "", rows: [] };
    if (!sv.ex) sv.ex = { code: "", group: "", count: "", ev: "" };
    sv.notGranted = !S.keys.some(function (kk) {
      return !kk.revoked && kk.grants[sv.scope];
    });
    var skillOpts = SKILL_ORDER.map(function (sk) {
      var on = S.skill === sk;
      return {
        label: "IELTS " + SKL[sk],
        scope: scopeOf(s, sk),
        on: on,
        cls: on ? "skt on" : "skt",
        pick: function () {
          self.setState({
            skill: sk,
            usageKey: "all",
            logOpen: -1,
            running: false,
          });
        },
      };
    });

    var chain = {
      hasPrev: !!sv.prev,
      prevName: sv.prev ? SVC[sv.prev].name : "",
      inText: sv.inText || "",
      goPrev: function () {
        if (sv.prev) self.openSvc(sv.prev);
      },
      hasNext: !!sv.next,
      noNext: !sv.next,
      nextName: sv.next ? SVC[sv.next].name : "",
      nextCta: sv.nextCta || "",
      nextHint: sv.nextHint || "",
      goNext: function () {
        if (sv.next) self.openSvc(sv.next);
      },
      goNextIntegrate: function () {
        if (sv.next) self.openSvc(sv.next, "integrate");
      },
    };

    var res = sv.result || { metrics: [], items: [] };
    var tryInput =
      S.tryInput[k] !== undefined ? S.tryInput[k] : sv.tryInput || "";
    var tState = S.tryState[k];
    var p = this.prog(k),
      steps = sv.steps || [];
    var v = this.vals(k, sv);
    var curStep = steps[p.cur] || {};
    var out = p.out[p.cur];
    var fvS = S.fv[k] || {};
    var fields = (curStep.fields || []).map(function (f) {
      var val = fvS[f.id] !== undefined ? fvS[f.id] : f.def;
      return {
        label: f.label,
        domId: "f-" + k + "-" + f.id,
        value: val,
        help: f.help || "",
        hasHelp: !!f.help,
        isChips: f.kind === "chips",
        isInput: f.kind === "input",
        isText: f.kind === "text",
        onChange: function (e) {
          self.setField(k, f.id, e.target.value);
        },
        opts: (f.options || []).map(function (o) {
          return {
            label: o,
            on: val === o,
            cls: segCls(val === o),
            pick: function () {
              self.setField(k, f.id, o);
            },
          };
        }),
      };
    });
    var lastIdx = steps.length - 1;
    var stepNum = function (i) {
      return "2." + (i + 1);
    };
    var stepPills = steps.map(function (st, i) {
      var locked = i > 0 && !p.done[i - 1],
        done = !!p.done[i],
        curr = i === p.cur;
      return {
        label: stepNum(i) + " " + st.short,
        done: done,
        locked: locked,
        ariaCur: curr ? "step" : "false",
        cls: curr ? "stepbtn cur" : done ? "stepbtn done" : "stepbtn",
        go: function () {
          self.setProg(k, { cur: i, done: p.done, out: p.out });
        },
      };
    });
    var cur = {
      num: stepNum(p.cur),
      title: stepNum(p.cur) + " · " + (curStep.title || ""),
      desc: curStep.desc || "",
      statusText: p.done[p.cur] ? "Đã xong" : "Đang làm",
      statusCls: p.done[p.cur] ? "pill p-ok" : "pill p-neu",
      isCall: !curStep.app,
      isApp: !!curStep.app,
      fields: fields,
      endpoint: (curStep.method || "") + " " + (curStep.path || ""),
      reqText: curStep.req ? curStep.req(v) : "",
      hasResp: !!out && !S.running,
      noResp: !out && !S.running,
      respText: out ? out.text : "",
      respColor: out && out.err ? "#FF9B90" : "#9FE3BF",
      lat: out ? out.lat : "",
      showFix: !!out && out.err && !S.running,
      fix: curStep.fix || "",
      showSlow: !!out && !out.err && !!out.slow && !S.running,
      slowNote: curStep.slowNote || "",
    };
    var appCode = curStep.app && sv.code ? sv.code[S.codeTab](v) : "";
    var modeOpts = [
      { k: "mock", l: "Mô phỏng" },
      { k: "sandbox", l: "Gọi Sandbox thật" },
    ].map(function (o) {
      return {
        label: o.l,
        on: S.mode === o.k,
        cls: segCls(S.mode === o.k),
        pick: function () {
          self.setState({ mode: o.k });
        },
      };
    });
    var scenOpts = [
      { k: "ok", l: "Thành công" },
      { k: "err", l: "Lỗi" },
      { k: "slow", l: "Phản hồi chậm" },
    ].map(function (o) {
      return {
        label: o.l,
        on: S.scenario === o.k,
        cls: segCls(S.scenario === o.k),
        pick: function () {
          self.setState({ scenario: o.k });
        },
      };
    });
    var codeTabs = [
      { k: "prompt", l: "Prompt cho AI" },
      { k: "node", l: "Node.js" },
      { k: "python", l: "Python" },
    ].map(function (o) {
      return {
        label: o.l,
        on: S.codeTab === o.k,
        cls: segCls(S.codeTab === o.k),
        pick: function () {
          self.setState({ codeTab: o.k });
        },
      };
    });

    // ops + usage
    var pctOf = function (q) {
      return Math.round((q.used / q.total) * 100);
    };
    sv.todayText = fmt(sv.today) + " / " + fmt(sv.todayMax);
    sv.todayBar =
      "width: " +
      Math.max(1, Math.round((sv.today / sv.todayMax) * 100)) +
      "%;";
    sv.quotas = (sv.quotas || []).map(function (q) {
      var pc = pctOf(q);
      return {
        l: q.l,
        pct: pc + "%",
        text: fmt(q.used) + " / " + fmt(q.total) + " · reset " + q.reset,
        big: fmt(q.used) + " / " + fmt(q.total),
        reset:
          (q.reset.indexOf("/") > 0 ? "Reset " : "") +
          q.reset +
          " · " +
          pc +
          "%",
        bar: "width: " + Math.max(1, pc) + "%;",
        fillCls: pc >= 75 ? "fill-warn" : "fill",
      };
    });
    var svKeys = S.keys
      .filter(function (kk) {
        return kk.grants[sv.scope] && !kk.revoked;
      })
      .map(function (kk) {
        return {
          name: kk.name,
          open: function () {
            self.go("key", { keyId: kk.id });
          },
        };
      });
    var usageKeys = [{ id: "all", name: "Tất cả" }].concat(
      S.keys
        .filter(function (kk) {
          return kk.grants[sv.scope];
        })
        .map(function (kk) {
          return { id: kk.id, name: kk.name };
        })
    );
    var usageKeyOpts = usageKeys.map(function (kk) {
      return {
        label: kk.name,
        on: S.usageKey === kk.id,
        cls: segCls(S.usageKey === kk.id),
        pick: function () {
          self.setState({ usageKey: kk.id });
        },
      };
    });
    var factor =
      S.usageKey === "all"
        ? 1
        : S.usageKey === "k_wispace"
          ? 0.72
          : S.usageKey === "k_center"
            ? 0.26
            : 0.02;
    var chartData = (sv.chart || []).map(function (n) {
      return Math.round(n * factor);
    });
    var mx = Math.max.apply(null, chartData.concat([1]));
    var chart = chartData.map(function (n, i) {
      return {
        style: "height: " + Math.max(2, Math.round((n / mx) * 150)) + "px;",
        tip: i + 2 + "/10: " + fmt(n),
      };
    });
    var usageKeyLabel = (
      usageKeys.filter(function (kk) {
        return kk.id === S.usageKey;
      })[0] || usageKeys[0]
    ).name;

    var logRows = (sv.logs || []).map(function (l, i) {
      var open = S.logOpen === i;
      var c = Number(l.c);
      return Object.assign({}, l, {
        open: open,
        chev: open ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6",
        cls: c < 300 ? "pill p-ok" : c === 429 ? "pill p-warn" : "pill p-err",
        inText: S.showContent
          ? l.inp
          : "•••• đã che · bật “Hiện nội dung” để xem",
        outText: l.out,
        toggle: function () {
          self.setState({ logOpen: open ? -1 : i });
        },
      });
    });

    var planSvc = svcPage ? s : S.planTab;
    var plans = ((SVC[planSvc] && SVC[planSvc].plans) || []).map(function (pl) {
      return {
        name: pl.name,
        feats: pl.feats,
        price: pl.price,
        current: !!pl.current,
        box:
          "background: #fff; border: " +
          (pl.current ? "2px solid #0F6B4C" : "1px solid #E4E4EC") +
          "; border-radius: 20px; padding: " +
          (pl.current ? "19px" : "20px") +
          "; display: flex; flex-direction: column; gap: 10px; min-height: 220px;",
        btnCls: pl.current ? "btn btn-s" : "btn btn-p",
        cta: pl.current ? "Đang dùng" : pl.contact ? "Liên hệ" : "Mua ngay",
        buy: function () {
          self.flash(
            pl.contact
              ? "Đã gửi yêu cầu báo giá. AIHub sẽ liên hệ trong 1 ngày làm việc."
              : "Prototype: mở bước xác nhận thanh toán bằng credit."
          );
        },
      };
    });
    var planTabs = SVC_ORDER.map(function (kk) {
      return {
        label: SVC[kk].name,
        on: S.planTab === kk,
        cls: S.planTab === kk ? "tab on" : "tab",
        go: function () {
          self.setState({ planTab: kk });
        },
      };
    });
    var topups = TOPUPS.map(function (t) {
      var on = S.topup === t;
      return {
        label: t,
        on: on,
        cls: on ? "btn btn-sm btn-p" : "btn btn-s btn-sm",
        pick: function () {
          self.setState({ topup: t });
        },
      };
    });
    var hooks = HOOKS.map(function (h) {
      return Object.assign({}, h, {
        retry: function () {
          self.flash("Đã gửi lại " + h.j + ".");
        },
      });
    });

    var idOpts = [
      {
        k: "declared",
        title: "Declared User ID",
        tag: "Mặc định",
        tagCls: "pill p-neu",
        desc: "Backend gửi ID học viên dạng chuỗi. Đơn giản, nhưng ai có API key cũng gửi được request dưới ID bất kỳ.",
        header: "X-AIHub-User-Id: student_001",
      },
      {
        k: "signed",
        title: "Signed User Assertion",
        tag: "Khuyên dùng cho Production",
        tagCls: "pill p-ok",
        desc: "Backend ký một JWT ngắn hạn cho mỗi học viên. AIHub verify chữ ký trước khi xử lý.",
        header: "X-AIHub-User-Assertion: eyJhbGciOiJFUzI1NiJ9…",
      },
    ].map(function (o) {
      var on = (o.k === "signed") === (S.identity !== "declared");
      return Object.assign({}, o, {
        on: on,
        cls: on ? "chk on" : "chk",
        pick: function () {
          self.setState({
            identity:
              o.k === "signed"
                ? S.identity === "signed"
                  ? "signed"
                  : "signed-draft"
                : "declared",
          });
        },
      });
    });

    var GK = S.keys.filter(function (kk) {
      return kk.id === S.grantFor;
    })[0];
    var grantRows = this.skillCards(
      S.grantDraft,
      function (sc) {
        var d = Object.assign({}, S.grantDraft);
        if (d[sc]) delete d[sc];
        else d[sc] = true;
        self.setState({ grantDraft: d });
      },
      false
    );

    var newEnvOpts = ["Sandbox", "Production"].map(function (o) {
      return {
        label: o,
        on: S.newEnv === o,
        cls: segCls(S.newEnv === o),
        pick: function () {
          self.setState({ newEnv: o });
        },
      };
    });
    var newExpOpts = ["30 ngày", "90 ngày", "Không hết hạn"].map(function (o) {
      return {
        label: o,
        on: S.newExp === o,
        cls: segCls(S.newExp === o),
        pick: function () {
          self.setState({ newExp: o });
        },
      };
    });

    var stop = function (e) {
      e.stopPropagation();
    };
    var closeModal = function () {
      self.setState({ grantFor: null, createOpen: false });
    };

    return {
      nav: nav,
      pg: pg,
      exp: exp,
      chev: chev,
      sub: sub,
      navT: navT,
      crumb: crumb,
      orgPlan: isNew ? "Sandbox" : "Business",
      isNew: isNew,
      isDone: isDone,
      demoNewCls: segCls(isNew),
      demoDoneCls: segCls(isDone),
      setDemoNew: function () {
        self.setState({ demo: "new" });
      },
      setDemoDone: function () {
        self.setState({ demo: "done" });
      },
      goOverview: function () {
        self.go("overview");
      },
      goSandbox: function () {
        self.go("sandbox");
      },
      goGrade: function () {
        self.openSvc("grade");
      },
      goWeakness: function () {
        self.openSvc("weakness");
      },
      goExercise: function () {
        self.openSvc("exercise");
      },
      goRoadmap: function () {
        self.openSvc("roadmap");
      },
      goIdentity: function () {
        self.go("identity");
      },
      goPlans: function () {
        self.go("plans");
      },
      goBilling: function () {
        self.go("billing");
      },
      goMembers: function () {
        self.go("members");
      },
      identityOff: S.identity !== "signed",
      identityOn: S.identity !== "declared",
      identityLabel:
        S.identity === "signed" ? "Signed User Assertion" : "Declared User ID",
      identityHint:
        S.identity === "signed"
          ? "AIHub verify chữ ký JWT trước khi xử lý."
          : "Xác thực có chữ ký đang tắt — nên bật trước khi lên Production.",

      kpis: kpis,
      pipeline: pipeline,
      onboard: onboard,
      obDoneCount: obDoneCount,
      keyRows: keyRows,
      keyCountText: keysVisible.length + " / 50 key chưa thu hồi.",
      openCreate: function () {
        self.setState({
          createOpen: true,
          newName: "",
          newEnv: "Sandbox",
          newExp: "30 ngày",
        });
      },

      kd: kd,
      graceOpts: graceOpts,
      revokeAsk: S.revokeAsk,
      rotateAsk: S.rotateAsk,
      askRevoke: function () {
        self.setState({ revokeAsk: true, rotateAsk: false });
      },
      cancelRevoke: function () {
        self.setState({ revokeAsk: false });
      },
      confirmRevoke: function () {
        var keys = S.keys.map(function (kk) {
          return kk.id === K.id ? Object.assign({}, kk, { revoked: true }) : kk;
        });
        self.setState({ keys: keys, revokeAsk: false });
        self.flash("Đã thu hồi " + K.name + ".");
      },
      askRotate: function () {
        self.setState({ rotateAsk: true, revokeAsk: false });
      },
      cancelRotate: function () {
        self.setState({ rotateAsk: false });
      },
      confirmRotate: function () {
        var g = S.grace;
        self.setState({
          rotateAsk: false,
          reveal:
            K.prefix.split("…")[0] +
            "n3w" +
            Math.random().toString(36).slice(2, 14),
          revealFor: null,
        });
        self.flash(
          g === "Ngay lập tức"
            ? "Key cũ đã ngừng hoạt động."
            : "Key cũ còn hoạt động thêm " + g + "."
        );
      },
      toastSoon: function () {
        self.flash("Prototype: chức năng này chưa dựng.");
      },

      sv: sv,
      chain: chain,
      skillOpts: skillOpts,
      tabs: tabs,
      tab: tab,
      sp: sp,
      showIntegration: showIntegration,
      showBanner: showBanner,
      showOps: showOps,
      res: res,
      tryInput: tryInput,
      onTryInput: function (e) {
        var t = Object.assign({}, S.tryInput);
        t[k] = e.target.value;
        self.setState({ tryInput: t });
      },
      tryEmpty: !tState,
      tryRunning: tState === "running",
      tryDone: tState === "done",
      tryCta:
        tState === "running"
          ? "Đang chạy…"
          : tState === "done"
            ? "Chạy lại"
            : sv.tryCta || "",
      runTry: function () {
        self.runTry();
      },
      modeOpts: modeOpts,
      scenOpts: scenOpts,
      codeTabs: codeTabs,
      modeNote:
        S.mode === "mock"
          ? "Không cần key. Dữ liệu mô phỏng có cùng cấu trúc với API thật; chọn “Lỗi” để xem lỗi thường gặp và cách xử lý."
          : "Gọi thật tới môi trường Sandbox bằng key “Minh test”. Miễn phí, có giới hạn lượt gọi mỗi ngày.",
      modeBadge: S.mode === "mock" ? "Dữ liệu mô phỏng" : "Sandbox",
      keyLine:
        S.mode === "mock"
          ? "Đang dùng key demo — không cần nhập gì."
          : "Đang dùng key Minh test (aihub_sandbox_znon3a).",
      resetFlow: function () {
        self.setProg(k, { cur: 0, done: {}, out: {} });
        var fv = Object.assign({}, S.fv);
        fv[k] = {};
        self.setState({ fv: fv, running: false });
      },
      stepPills: stepPills,
      cur: cur,
      running: S.running,
      runLabel: S.running ? "Đang gọi…" : curStep.run || "",
      runStep: function () {
        self.runStep();
      },
      atFirst: p.cur === 0,
      nextLocked: p.cur >= lastIdx || !p.done[p.cur],
      prevStep: function () {
        if (p.cur > 0)
          self.setProg(k, { cur: p.cur - 1, done: p.done, out: p.out });
      },
      nextStep: function () {
        if (p.cur < lastIdx && p.done[p.cur])
          self.setProg(k, { cur: p.cur + 1, done: p.done, out: p.out });
      },
      copyReq: function () {
        self.copy(cur.reqText, "req");
      },
      appCode: appCode,
      copyAppLabel:
        S.copied === "app"
          ? "Đã copy"
          : S.codeTab === "prompt"
            ? "Copy prompt"
            : "Copy code",
      copyApp: function () {
        self.copy(appCode, "app");
      },
      svKeys: svKeys,
      goLogsTab: function () {
        self.setState({ tab: "logs" });
      },
      goIntegrateTab: function () {
        self.setState({ tab: "integrate" });
      },
      goPricingTab: function () {
        self.setState({ tab: "pricing" });
      },
      sendTestHook: function () {
        self.flash(
          "Đã gửi speaking.graded thử tới https://api.wispace.vn/hooks/aihub — HTTP 200."
        );
      },
      hooks: hooks,
      usageKeyOpts: usageKeyOpts,
      chart: chart,
      usageKeyLabel: usageKeyLabel,
      exportCsv: function () {
        self.flash("Prototype: xuất CSV usage theo end_user_id.");
      },
      logRows: logRows,
      showContent: S.showContent,
      toggleContent: function () {
        self.setState({ showContent: !S.showContent });
      },
      plans: plans,
      planTabs: planTabs,
      topups: topups,
      credit: fmt(S.credit),
      buyCredit: function () {
        self.flash(
          "Prototype: tạo lệnh nạp " + S.topup + " credit qua chuyển khoản."
        );
      },
      bills: BILLS,
      members: MEMBERS,
      selfGrant: function () {
        self.flash("Đã cấp quyền sandbox cho minhcq@cas.so.");
      },
      idOpts: idOpts,
      saveIdentity: function () {
        self.setState({ identity: "signed" });
        self.flash("Đã bật Signed User Assertion.");
      },

      grantOpen: !!GK,
      grantKeyName: GK ? GK.name : "",
      grantRows: grantRows,
      stop: stop,
      closeModal: closeModal,
      saveGrant: function () {
        var keys = S.keys.map(function (kk) {
          return kk.id === S.grantFor
            ? Object.assign({}, kk, { grants: Object.assign({}, S.grantDraft) })
            : kk;
        });
        self.setState({ keys: keys, grantFor: null });
        self.flash("Đã lưu quyền dịch vụ.");
      },

      createOpen: S.createOpen,
      newName: S.newName,
      newNameEmpty: !S.newName.trim(),
      newEnvOpts: newEnvOpts,
      newExpOpts: newExpOpts,
      onNewName: function (e) {
        self.setState({ newName: e.target.value });
      },
      submitCreate: function () {
        var id = "k_" + Date.now();
        var pre = S.newEnv === "Production" ? "aihub_live_" : "aihub_sandbox_";
        var full =
          pre +
          Math.random().toString(36).slice(2, 10) +
          Math.random().toString(36).slice(2, 10);
        var nk = {
          id: id,
          name: S.newName.trim(),
          prefix: full.slice(0, pre.length + 6),
          env: S.newEnv,
          grants: {},
          today: 0,
          expires:
            S.newExp === "Không hết hạn" ? "Không hết hạn" : "Sau " + S.newExp,
          created: "Vừa tạo",
          lastUsed: "Chưa dùng",
          webhook: "",
          use: {},
        };
        self.setState({
          keys: S.keys.concat([nk]),
          createOpen: false,
          reveal: full,
          revealFor: id,
        });
      },
      revealOpen: !!S.reveal,
      revealKey: S.reveal,
      revealCta: S.revealFor ? "Tôi đã lưu, cấp quyền tiếp" : "Tôi đã lưu",
      copyReveal: function () {
        self.copy(S.reveal, "reveal");
      },
      closeReveal: function () {
        var id = S.revealFor;
        var nk = S.keys.filter(function (x) {
          return x.id === id;
        })[0];
        self.setState({
          reveal: "",
          revealFor: null,
          grantFor: nk ? nk.id : null,
          grantDraft: nk ? Object.assign({}, nk.grants) : {},
        });
      },

      hasToast: !!S.toast,
      toast: S.toast,
    };
  }

  render() {
    const vals = this.renderVals();
    const {
      Prototype,
      appCode,
      askRevoke,
      askRotate,
      atFirst,
      bills,
      buyCredit,
      cancelRevoke,
      cancelRotate,
      chain,
      chart,
      chev,
      closeModal,
      closeReveal,
      codeTabs,
      confirmRevoke,
      confirmRotate,
      copyApp,
      copyAppLabel,
      copyReq,
      copyReveal,
      createOpen,
      created,
      credit,
      crumb,
      cur,
      demo,
      demoDoneCls,
      demoNewCls,
      done,
      env,
      exp,
      expires,
      exportCsv,
      fv,
      goBilling,
      goExercise,
      goGrade,
      goIdentity,
      goIntegrateTab,
      goLogsTab,
      goMembers,
      goOverview,
      goPlans,
      goPricingTab,
      goRoadmap,
      goSandbox,
      goWeakness,
      graceOpts,
      grantDraft,
      grantFor,
      grantKeyName,
      grantOpen,
      grantRows,
      grants,
      hasToast,
      hooks,
      https,
      id,
      idOpts,
      identity,
      identityHint,
      identityLabel,
      identityOff,
      identityOn,
      isDone,
      isNew,
      kd,
      keyCountText,
      keyLine,
      keyRows,
      keys,
      kpis,
      lastUsed,
      logRows,
      members,
      modeBadge,
      modeNote,
      modeOpts,
      name,
      nav,
      navT,
      newEnv,
      newEnvOpts,
      newExp,
      newExpOpts,
      newName,
      newNameEmpty,
      nextLocked,
      nextStep,
      obDoneCount,
      onNewName,
      onTryInput,
      onboard,
      openCreate,
      orgPlan,
      out,
      pg,
      pipeline,
      planTabs,
      plans,
      prefix,
      prevStep,
      res,
      resetFlow,
      reveal,
      revealCta,
      revealFor,
      revealKey,
      revealOpen,
      revokeAsk,
      revoked,
      rotateAsk,
      runLabel,
      runStep,
      runTry,
      running,
      saveGrant,
      saveIdentity,
      scenOpts,
      selfGrant,
      sendTestHook,
      setDemoDone,
      setDemoNew,
      showBanner,
      showContent,
      showIntegration,
      showOps,
      skillOpts,
      sp,
      stepPills,
      stop,
      sub,
      submitCreate,
      sv,
      svKeys,
      tab,
      tabs,
      toast,
      toastSoon,
      today,
      toggleContent,
      topups,
      tryCta,
      tryDone,
      tryEmpty,
      tryInput,
      tryRunning,
      usageKeyLabel,
      usageKeyOpts,
      use,
      webhook,
    } = vals;
    return (
      <div
        data-console-app="true"
        style={{
          minHeight: "1240px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "stretch",
          background: "#F7F7FB",
          color: "#14152B",
          fontFamily: "'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif",
          fontSize: "14px",
          lineHeight: "20px",
        }}
      >
        {/* ============ SIDEBAR ============ */}
        <nav
          aria-label="Điều hướng Console"
          style={{
            flex: "1 1 248px",
            maxWidth: "100%",
            background: "#FFFFFF",
            borderRight: "1px solid #E4E4EC",
            padding: "20px 12px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "8px",
              padding: "4px 12px 16px",
            }}
          >
            <span
              className="h"
              style={{ fontSize: "22px", lineHeight: "28px" }}
            >
              Ai<span style={{ color: "#5B5FEF" }}>Hub</span>
            </span>
            <span className="eyebrow" style={{ fontSize: "10px" }}>
              Console
            </span>
          </div>
          <button
            type="button"
            className="nav"
            style={{
              border: "1px solid #E4E4EC",
              background: "#F7F7FB",
              padding: "10px 12px",
              marginBottom: "4px",
            }}
            aria-label="Đổi Organization: Minh test"
          >
            <span
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "#EDEBFE",
                color: "#4547C9",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                font: "700 12px/16px 'Plus Jakarta Sans', sans-serif",
                flex: "none",
              }}
            >
              MT
            </span>
            <span
              style={{
                display: "flex",
                flexDirection: "column",
                minWidth: "0",
                flex: "1",
              }}
            >
              <span style={{ fontWeight: "600" }}>Minh test</span>
              <span
                className="muted"
                style={{ fontSize: "12px", lineHeight: "16px" }}
              >
                Owner · {orgPlan}
              </span>
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#5C5D77"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 15l5 5 5-5M7 9l5-5 5 5"></path>
            </svg>
          </button>

          <div className="navgrp">Workspace</div>
          <button type="button" className={nav.overview} onClick={goOverview}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
              <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
              <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
              <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
            </svg>
            Tổng quan
          </button>
          <button type="button" className={nav.sandbox} onClick={goSandbox}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"></path>
              <path d="M7.5 15h9"></path>
            </svg>
            Sandbox
          </button>

          <div className="navgrp">Dịch vụ</div>
          <button
            type="button"
            className={nav.grade}
            onClick={navT.grade}
            aria-expanded={exp.grade}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path>
            </svg>
            <span style={{ flex: "1" }}>Chấm chữa</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#5C5D77"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d={chev.grade}></path>
            </svg>
          </button>

          {Boolean(exp.grade) && (
            <>
              <div className="subnav">
                {sub.grade?.map((x: any, idx_x: number) => (
                  <React.Fragment key={idx_x}>
                    <button
                      type="button"
                      className={x.cls}
                      aria-current={x.cur}
                      onClick={x.go}
                    >
                      {x.label}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </>
          )}

          <button
            type="button"
            className={nav.weakness}
            onClick={navT.weakness}
            aria-expanded={exp.weakness}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7"></circle>
              <path d="M20 20l-3.5-3.5"></path>
              <path d="M8 13l2-2 1.5 1.5L14 10"></path>
            </svg>
            <span style={{ flex: "1" }}>Phân tích điểm yếu</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#5C5D77"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d={chev.weakness}></path>
            </svg>
          </button>

          {Boolean(exp.weakness) && (
            <>
              <div className="subnav">
                {sub.weakness?.map((x: any, idx_x: number) => (
                  <React.Fragment key={idx_x}>
                    <button
                      type="button"
                      className={x.cls}
                      aria-current={x.cur}
                      onClick={x.go}
                    >
                      {x.label}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </>
          )}

          <button
            type="button"
            className={nav.exercise}
            onClick={navT.exercise}
            aria-expanded={exp.exercise}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 6h11M9 12h11M9 18h11"></path>
              <path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"></path>
            </svg>
            <span style={{ flex: "1" }}>Tạo bài tập</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#5C5D77"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d={chev.exercise}></path>
            </svg>
          </button>

          {Boolean(exp.exercise) && (
            <>
              <div className="subnav">
                {sub.exercise?.map((x: any, idx_x: number) => (
                  <React.Fragment key={idx_x}>
                    <button
                      type="button"
                      className={x.cls}
                      aria-current={x.cur}
                      onClick={x.go}
                    >
                      {x.label}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </>
          )}

          <button
            type="button"
            className={nav.roadmap}
            onClick={navT.roadmap}
            aria-expanded={exp.roadmap}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"></path>
              <path d="M9 4v14M15 6v14"></path>
            </svg>
            <span style={{ flex: "1" }}>Lộ trình cá nhân hoá</span>
            <span className="badge b-beta">Beta</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#5C5D77"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d={chev.roadmap}></path>
            </svg>
          </button>

          {Boolean(exp.roadmap) && (
            <>
              <div className="subnav">
                {sub.roadmap?.map((x: any, idx_x: number) => (
                  <React.Fragment key={idx_x}>
                    <button
                      type="button"
                      className={x.cls}
                      aria-current={x.cur}
                      onClick={x.go}
                    >
                      {x.label}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </>
          )}

          <div className="navgrp">Bảo mật</div>
          <button type="button" className={nav.identity} onClick={goIdentity}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"></path>
              <path d="M9 12l2 2 4-4"></path>
            </svg>
            <span style={{ flex: "1" }}>Xác thực End-user</span>

            {Boolean(identityOff) && (
              <>
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#C77700",
                  }}
                  aria-label="Chưa bật xác thực có chữ ký"
                ></span>
              </>
            )}
          </button>

          <div className="navgrp">Tài khoản</div>
          <button type="button" className={nav.plans} onClick={goPlans}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="6" width="18" height="13" rx="2"></rect>
              <path d="M3 10h18M16 15h2"></path>
            </svg>
            Gói &amp; Credit
          </button>
          <button type="button" className={nav.billing} onClick={goBilling}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"></path>
              <path d="M9 8h6M9 12h6"></path>
            </svg>
            Lịch sử thanh toán
          </button>
          <button type="button" className={nav.members} onClick={goMembers}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="9" cy="8" r="3.5"></circle>
              <path d="M2.5 20a6.5 6.5 0 0 1 13 0"></path>
              <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"></path>
            </svg>
            Thành viên
          </button>

          <div style={{ flex: "1", minHeight: "24px" }}></div>
          <div
            className="muted"
            style={{
              fontSize: "12px",
              lineHeight: "16px",
              padding: "8px 12px",
            }}
          >
            AIHub Console 1.0 ·{" "}
            <a
              href="https://aihubproduction.com/docs"
              target="_blank"
              rel="noopener"
            >
              Tài liệu
            </a>
          </div>
        </nav>

        {/* ============ MAIN ============ */}
        <main
          style={{
            flex: "999 1 560px",
            minWidth: "0",
            padding: "20px 32px 48px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div
              className="mono muted"
              style={{ fontSize: "12px", lineHeight: "16px" }}
            >
              {crumb}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <span className="muted" style={{ fontSize: "12px" }}>
                Xem như
              </span>
              <div
                className="seg"
                role="group"
                aria-label="Trạng thái khách hàng (chế độ demo)"
              >
                <button
                  type="button"
                  className={demoNewCls}
                  aria-pressed={isNew}
                  onClick={setDemoNew}
                >
                  Khách mới
                </button>
                <button
                  type="button"
                  className={demoDoneCls}
                  aria-pressed={isDone}
                  onClick={setDemoDone}
                >
                  Đã tích hợp
                </button>
              </div>
            </div>
          </div>

          {/* ============ PAGE: OVERVIEW ============ */}

          {Boolean(pg.overview) && (
            <>
              <div
                className="fade"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                }}
              >
                <div>
                  <h1
                    className="h"
                    style={{ fontSize: "28px", lineHeight: "34px" }}
                  >
                    Tổng quan
                  </h1>
                  <p className="muted" style={{ margin: "4px 0 0" }}>
                    Số liệu hôm nay, đo lúc 10:42 15/10/2026.
                  </p>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "12px",
                  }}
                >
                  {kpis?.map((k: any, idx_k: number) => (
                    <React.Fragment key={idx_k}>
                      <div
                        className="card"
                        style={{ padding: "16px 18px", borderRadius: "16px" }}
                      >
                        <div className="eyebrow">{k.l}</div>
                        <div
                          className="h"
                          style={{
                            fontSize: "26px",
                            lineHeight: "32px",
                            marginTop: "6px",
                          }}
                        >
                          {k.v}
                        </div>
                        <div
                          className="muted"
                          style={{
                            fontSize: "12px",
                            lineHeight: "16px",
                            marginTop: "2px",
                          }}
                        >
                          {k.s}
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>

                <section
                  className="card"
                  style={{ padding: "24px" }}
                  aria-labelledby="pipe-title"
                >
                  <h2
                    id="pipe-title"
                    className="h"
                    style={{ fontSize: "20px", lineHeight: "26px" }}
                  >
                    4 dịch vụ × 4 kỹ năng
                  </h2>
                  <p className="muted" style={{ margin: "4px 0 0" }}>
                    Mỗi dịch vụ có 4 tab IELTS Writing, Speaking, Reading,
                    Listening. Đầu ra của dịch vụ trước là đầu vào của dịch vụ
                    sau.
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(210px, 1fr))",
                      gap: "12px",
                      marginTop: "16px",
                    }}
                  >
                    {pipeline?.map((p: any, idx_p: number) => (
                      <React.Fragment key={idx_p}>
                        <button type="button" className="pipe" onClick={p.open}>
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              width: "100%",
                            }}
                          >
                            <span className="num">{p.n}</span>
                            <span
                              style={{ fontWeight: "700", fontSize: "15px" }}
                            >
                              {p.name}
                            </span>
                            <span
                              className={p.badgeCls}
                              style={{ marginLeft: "auto" }}
                            >
                              {p.badge}
                            </span>
                          </span>
                          <span
                            className="muted"
                            style={{ fontSize: "13px", lineHeight: "18px" }}
                          >
                            {p.io}
                          </span>
                          <span
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "baseline",
                              width: "100%",
                              marginTop: "4px",
                            }}
                          >
                            <span
                              className="mono"
                              style={{ fontWeight: "600" }}
                            >
                              {p.today}
                            </span>
                            <span
                              className="muted"
                              style={{ fontSize: "12px" }}
                            >
                              {p.unit} hôm nay
                            </span>
                          </span>
                          <span
                            style={{
                              display: "flex",
                              gap: "4px",
                              flexWrap: "wrap",
                            }}
                          >
                            {p.skills?.map((x: any, idx_x: number) => (
                              <React.Fragment key={idx_x}>
                                <span
                                  className="scope"
                                  style={{
                                    fontSize: "11px",
                                    fontFamily: "'Hanken Grotesk', sans-serif",
                                  }}
                                >
                                  {x}
                                </span>
                              </React.Fragment>
                            ))}
                          </span>
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                </section>

                {Boolean(isNew) && (
                  <>
                    <section
                      className="card"
                      style={{ padding: "24px" }}
                      aria-labelledby="ob-title"
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "12px",
                          flexWrap: "wrap",
                          alignItems: "flex-start",
                        }}
                      >
                        <div>
                          <div className="eyebrow-p">Bắt đầu</div>
                          <h2
                            id="ob-title"
                            className="h"
                            style={{
                              fontSize: "20px",
                              lineHeight: "26px",
                              marginTop: "4px",
                            }}
                          >
                            3 bước để chấm bài đầu tiên qua API
                          </h2>
                          <p className="muted" style={{ margin: "4px 0 0" }}>
                            Làm theo thứ tự. Bước 3 là tuỳ chọn, nên bật trước
                            khi lên Production.
                          </p>
                        </div>
                        <span className="pill p-neu">
                          {obDoneCount} / 3 xong
                        </span>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(240px, 1fr))",
                          gap: "12px",
                          marginTop: "16px",
                        }}
                      >
                        {onboard?.map((o: any, idx_o: number) => (
                          <React.Fragment key={idx_o}>
                            <div style={parseStyle(o.box)}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "10px",
                                }}
                              >
                                <span style={parseStyle(o.dot)}>{o.n}</span>
                                <span style={{ fontWeight: "600" }}>{o.t}</span>
                              </div>
                              <p
                                className="muted"
                                style={{
                                  margin: "8px 0 12px",
                                  fontSize: "13px",
                                  lineHeight: "18px",
                                }}
                              >
                                {o.d}
                              </p>
                              <button
                                type="button"
                                className="btn btn-s btn-sm"
                                onClick={o.go}
                              >
                                {o.cta}
                              </button>
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                    </section>
                  </>
                )}

                <section
                  className="card"
                  style={{ padding: "24px" }}
                  aria-labelledby="keys-title"
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <h2
                        id="keys-title"
                        className="h"
                        style={{ fontSize: "20px", lineHeight: "26px" }}
                      >
                        API keys
                      </h2>
                      <p className="muted" style={{ margin: "4px 0 0" }}>
                        Quản lý key và quyền gọi từng dịch vụ, từng kỹ năng. Bấm
                        vào một key để mở trang chi tiết. {keyCountText}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-p"
                      onClick={openCreate}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        aria-hidden="true"
                      >
                        <path d="M12 5v14M5 12h14"></path>
                      </svg>
                      Tạo API key
                    </button>
                  </div>
                  <div style={{ overflowX: "auto", marginTop: "12px" }}>
                    <div
                      role="table"
                      aria-label="API keys"
                      style={{ minWidth: "980px" }}
                    >
                      <div
                        role="row"
                        className="trow"
                        style={{
                          gridTemplateColumns:
                            "minmax(180px, 1.4fr) minmax(280px, 2.6fr) 130px 110px 130px 140px 52px",
                        }}
                      >
                        <div role="columnheader" className="thc">
                          Key
                        </div>
                        <div role="columnheader" className="thc">
                          Dịch vụ được cấp quyền
                        </div>
                        <div role="columnheader" className="thc"></div>
                        <div role="columnheader" className="thc">
                          Môi trường
                        </div>
                        <div
                          role="columnheader"
                          className="thc"
                          style={{ textAlign: "right" }}
                        >
                          Request hôm nay
                        </div>
                        <div
                          role="columnheader"
                          className="thc"
                          style={{ textAlign: "right" }}
                        >
                          Hạn dùng
                        </div>
                        <div role="columnheader" className="thc"></div>
                      </div>

                      {keyRows?.map((r: any, idx_r: number) => (
                        <React.Fragment key={idx_r}>
                          <div
                            role="row"
                            className="trow b"
                            style={{
                              gridTemplateColumns:
                                "minmax(180px, 1.4fr) minmax(280px, 2.6fr) 130px 110px 130px 140px 52px",
                            }}
                          >
                            <div role="cell" className="tc">
                              <button
                                type="button"
                                className="btn-link"
                                style={{ color: "#14152B" }}
                                onClick={r.open}
                              >
                                {r.name}
                              </button>
                              <div
                                className="mono muted"
                                style={{ fontSize: "12px", lineHeight: "16px" }}
                              >
                                {r.prefix}
                              </div>
                            </div>
                            <div role="cell" className="tc">
                              <div
                                style={{
                                  display: "flex",
                                  gap: "6px",
                                  flexWrap: "wrap",
                                }}
                              >
                                {r.svcs?.map((sc: any, idx_sc: number) => (
                                  <React.Fragment key={idx_sc}>
                                    <span
                                      className="scope"
                                      style={{
                                        fontFamily:
                                          "'Hanken Grotesk', sans-serif",
                                      }}
                                    >
                                      {sc}
                                    </span>
                                  </React.Fragment>
                                ))}

                                {Boolean(r.noScope) && (
                                  <>
                                    <span className="muted">
                                      Chưa cấp quyền dịch vụ
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div role="cell" className="tc">
                              <button
                                type="button"
                                className="btn btn-s btn-sm"
                                onClick={r.grant}
                                aria-label={`Cấp quyền cho ${r.name}`}
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"></path>
                                </svg>
                                Cấp quyền
                              </button>
                            </div>
                            <div role="cell" className="tc">
                              <span className={r.envCls}>{r.env}</span>
                            </div>
                            <div
                              role="cell"
                              className="tc mono"
                              style={{ textAlign: "right" }}
                            >
                              {r.today}
                            </div>
                            <div
                              role="cell"
                              className="tc"
                              style={{ textAlign: "right" }}
                            >
                              {r.expires}
                            </div>
                            <div
                              role="cell"
                              className="tc"
                              style={{ textAlign: "right", padding: "8px" }}
                            >
                              <button
                                type="button"
                                className="iconbtn"
                                onClick={r.open}
                                aria-label={`Mở chi tiết ${r.name}`}
                              >
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  aria-hidden="true"
                                >
                                  <path d="M9 6l6 6-6 6"></path>
                                </svg>
                              </button>
                            </div>
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </section>

                <section
                  className="card"
                  style={{
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "12px",
                      background: "#EDEBFE",
                      color: "#4547C9",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flex: "none",
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"></path>
                    </svg>
                  </span>
                  <div style={{ flex: "1", minWidth: "220px" }}>
                    <div style={{ fontWeight: "600" }}>
                      Xác thực End-user: {identityLabel}
                    </div>
                    <div
                      className="muted"
                      style={{ fontSize: "13px", lineHeight: "18px" }}
                    >
                      {identityHint}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-s btn-sm"
                    onClick={goIdentity}
                  >
                    Cấu hình
                  </button>
                </section>
              </div>
            </>
          )}

          {/* ============ PAGE: KEY DETAIL ============ */}

          {Boolean(pg.key) && (
            <>
              <div
                className="fade"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                }}
              >
                <section className="card" style={{ padding: "24px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <button
                        type="button"
                        className="iconbtn"
                        onClick={goOverview}
                        aria-label="Quay lại Tổng quan"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          aria-hidden="true"
                        >
                          <path d="M15 6l-6 6 6 6"></path>
                        </svg>
                      </button>
                      <h1
                        className="h"
                        style={{ fontSize: "24px", lineHeight: "30px" }}
                      >
                        {kd.name}
                      </h1>
                      <span className={kd.envCls}>{kd.env}</span>

                      {Boolean(kd.revoked) && (
                        <>
                          <span className="pill p-err">Đã thu hồi</span>
                        </>
                      )}
                    </div>

                    {Boolean(kd.active) && (
                      <>
                        <button
                          type="button"
                          className="btn btn-d btn-sm"
                          onClick={askRevoke}
                        >
                          Thu hồi key
                        </button>
                      </>
                    )}
                  </div>

                  {Boolean(revokeAsk) && (
                    <>
                      <div
                        style={{
                          marginTop: "16px",
                          padding: "16px",
                          borderRadius: "14px",
                          background: "#FDECEA",
                          display: "flex",
                          gap: "12px",
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <div
                          style={{
                            flex: "1",
                            minWidth: "240px",
                            color: "#7A1B12",
                          }}
                        >
                          <strong>Thu hồi {kd.name}?</strong> Mọi request dùng
                          key này sẽ bị từ chối ngay (401 KEY_REVOKED). Không
                          hoàn tác được.
                        </div>
                        <button
                          type="button"
                          className="btn btn-s btn-sm"
                          onClick={cancelRevoke}
                        >
                          Huỷ
                        </button>
                        <button
                          type="button"
                          className="btn btn-dfill btn-sm"
                          onClick={confirmRevoke}
                        >
                          Thu hồi
                        </button>
                      </div>
                    </>
                  )}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(320px, 1fr))",
                      gap: "32px",
                      marginTop: "20px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "18px",
                      }}
                    >
                      <div>
                        <label className="flabel" htmlFor="kd-name">
                          Tên key
                        </label>
                        <input
                          id="kd-name"
                          className="inp inp-t"
                          value={kd.name}
                          readOnly=""
                        />
                      </div>
                      <div>
                        <div className="flabel">Webhook URL được phép</div>
                        <div
                          className="muted"
                          style={{
                            fontSize: "13px",
                            marginTop: "-4px",
                            marginBottom: "8px",
                          }}
                        >
                          AIHub gửi kết quả Chấm chữa Speaking (async) và sự
                          kiện cập nhật lộ trình tới URL này.
                        </div>

                        {Boolean(kd.hasWebhook) && (
                          <>
                            <div
                              className="mono"
                              style={{
                                background: "#F7F7FB",
                                borderRadius: "8px",
                                padding: "10px 12px",
                                fontSize: "13px",
                                display: "flex",
                                justifyContent: "space-between",
                                gap: "8px",
                              }}
                            >
                              <span style={{ wordBreak: "break-all" }}>
                                {kd.webhook}
                              </span>
                              <span className="pill p-ok">Đã xác minh</span>
                            </div>
                          </>
                        )}

                        {Boolean(kd.noWebhook) && (
                          <>
                            <div className="muted" style={{ fontSize: "13px" }}>
                              Chưa có webhook nào.
                            </div>
                          </>
                        )}

                        <button
                          type="button"
                          className="btn-link"
                          style={{ marginTop: "8px" }}
                          onClick={toastSoon}
                        >
                          + Thêm webhook
                        </button>
                      </div>
                      <div>
                        <div className="flabel">Giới hạn IP (tuỳ chọn)</div>
                        <div className="muted" style={{ fontSize: "13px" }}>
                          Chưa giới hạn — mọi IP có key đều gọi được.
                        </div>
                        <button
                          type="button"
                          className="btn-link"
                          style={{ marginTop: "8px" }}
                          onClick={toastSoon}
                        >
                          + Thêm dải IP
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "18px",
                      }}
                    >
                      <div>
                        <h2
                          className="h"
                          style={{ fontSize: "16px", lineHeight: "22px" }}
                        >
                          Thông tin
                        </h2>
                        <dl
                          style={{
                            display: "grid",
                            gridTemplateColumns: "140px 1fr",
                            gap: "10px 12px",
                            margin: "12px 0 0",
                            fontSize: "14px",
                          }}
                        >
                          <dt className="muted">Key ID</dt>
                          <dd className="mono" style={{ margin: "0" }}>
                            {kd.prefix}
                          </dd>
                          <dt className="muted">Ngày tạo</dt>
                          <dd style={{ margin: "0" }}>{kd.created}</dd>
                          <dt className="muted">Hạn dùng</dt>
                          <dd style={{ margin: "0" }}>{kd.expires}</dd>
                          <dt className="muted">Dùng gần nhất</dt>
                          <dd style={{ margin: "0" }}>{kd.lastUsed}</dd>
                        </dl>
                      </div>
                      <div>
                        <h2
                          className="h"
                          style={{ fontSize: "16px", lineHeight: "22px" }}
                        >
                          Secret
                        </h2>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            alignItems: "center",
                            marginTop: "10px",
                            background: "#F7F7FB",
                            borderRadius: "8px",
                            padding: "8px 8px 8px 12px",
                          }}
                        >
                          <span
                            className="mono"
                            style={{ flex: "1", letterSpacing: ".1em" }}
                          >
                            ••••••••••••••••••••••••
                          </span>
                          <button
                            type="button"
                            className="btn btn-s btn-sm"
                            onClick={askRotate}
                            disabled={kd.revoked}
                          >
                            Xoay key
                          </button>
                        </div>

                        {Boolean(rotateAsk) && (
                          <>
                            <div
                              style={{
                                marginTop: "10px",
                                padding: "14px",
                                border: "1px solid #E4E4EC",
                                borderRadius: "14px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "10px",
                              }}
                            >
                              <div style={{ fontWeight: "600" }}>
                                Key cũ ngừng hoạt động sau
                              </div>
                              <div
                                className="seg"
                                role="group"
                                aria-label="Thời gian chuyển tiếp"
                              >
                                {graceOpts?.map((g: any, idx_g: number) => (
                                  <React.Fragment key={idx_g}>
                                    <button
                                      type="button"
                                      className={g.cls}
                                      aria-pressed={g.on}
                                      onClick={g.pick}
                                    >
                                      {g.label}
                                    </button>
                                  </React.Fragment>
                                ))}
                              </div>
                              <div
                                className="muted"
                                style={{ fontSize: "13px" }}
                              >
                                Trong thời gian chuyển tiếp cả key cũ và key mới
                                đều gọi được, đủ để bạn deploy key mới.
                              </div>
                              <div style={{ display: "flex", gap: "8px" }}>
                                <button
                                  type="button"
                                  className="btn btn-s btn-sm"
                                  onClick={cancelRotate}
                                >
                                  Huỷ
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-p btn-sm"
                                  onClick={confirmRotate}
                                >
                                  Tạo key mới
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="card" style={{ padding: "24px" }}>
                  <h2
                    className="h"
                    style={{ fontSize: "20px", lineHeight: "26px" }}
                  >
                    Quyền truy cập dịch vụ
                  </h2>
                  <p className="muted" style={{ margin: "4px 0 0" }}>
                    Chọn từng kỹ năng của từng dịch vụ mà key này được gọi. Mỗi
                    ô là một scope dạng{" "}
                    <span className="mono">kỹ_năng.dịch_vụ</span>. Đây là nơi
                    duy nhất cấp quyền; usage tính riêng cho key này.
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(230px, 1fr))",
                      gap: "12px",
                      marginTop: "16px",
                    }}
                  >
                    {kd.svcCards?.map((c: any, idx_c: number) => (
                      <React.Fragment key={idx_c}>
                        <div
                          className={c.cls}
                          style={{ flexDirection: "column", gap: "8px" }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              width: "100%",
                            }}
                          >
                            <span style={{ fontWeight: "600" }}>{c.name}</span>
                            <span
                              className="pill p-neu"
                              style={{ marginLeft: "auto" }}
                            >
                              {c.countText}
                            </span>
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                              gap: "2px 8px",
                              width: "100%",
                            }}
                          >
                            {c.skills?.map((x: any, idx_x: number) => (
                              <React.Fragment key={idx_x}>
                                <label className="skl">
                                  <input
                                    className="cb"
                                    type="checkbox"
                                    checked={x.on}
                                    disabled={x.locked}
                                    onChange={x.toggle}
                                  />
                                  <span>{x.label}</span>
                                </label>
                              </React.Fragment>
                            ))}
                          </div>
                          <div
                            className="mono muted"
                            style={{ fontSize: "11px", lineHeight: "16px" }}
                          >
                            {c.scopeText}
                          </div>

                          {Boolean(c.on) && (
                            <>
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "6px",
                                  width: "100%",
                                }}
                              >
                                <div
                                  className="muted"
                                  style={{ fontSize: "12px" }}
                                >
                                  {c.quotaLabel}:{" "}
                                  <span
                                    className="mono"
                                    style={{ color: "#14152B" }}
                                  >
                                    {c.quotaText}
                                  </span>
                                </div>
                                <div className="track">
                                  <div
                                    className="fill"
                                    style={parseStyle(c.barStyle)}
                                  ></div>
                                </div>
                                <button
                                  type="button"
                                  className="btn-link"
                                  style={{ fontSize: "13px" }}
                                  onClick={c.open}
                                >
                                  Mở trang dịch vụ →
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}

          {/* ============ PAGE: SERVICE ============ */}

          {Boolean(pg.service) && (
            <>
              <div
                className="fade"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <header
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ maxWidth: "780px" }}>
                    <div className="eyebrow-p">{sv.group}</div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        marginTop: "4px",
                        flexWrap: "wrap",
                      }}
                    >
                      <h1
                        className="h"
                        style={{ fontSize: "28px", lineHeight: "34px" }}
                      >
                        {sv.name}{" "}
                        <span style={{ color: "#4547C9" }}>
                          · {sv.skillLabel}
                        </span>
                      </h1>
                      <span className={sv.badgeCls}>{sv.badge}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        alignItems: "center",
                        flexWrap: "wrap",
                        marginTop: "8px",
                        fontSize: "13px",
                      }}
                    >
                      <span className="muted">Đầu vào:</span>

                      {Boolean(chain.hasPrev) && (
                        <>
                          <button
                            type="button"
                            className="btn-link"
                            style={{ fontSize: "13px" }}
                            onClick={chain.goPrev}
                          >
                            {chain.prevName}
                          </button>
                        </>
                      )}

                      <span>{chain.inText}</span>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#5C5D77"
                        strokeWidth="2"
                        strokeLinecap="round"
                        aria-hidden="true"
                      >
                        <path d="M5 12h14M13 6l6 6-6 6"></path>
                      </svg>
                      <span className="muted">Đầu ra dùng cho:</span>

                      {Boolean(chain.hasNext) && (
                        <>
                          <button
                            type="button"
                            className="btn-link"
                            style={{ fontSize: "13px" }}
                            onClick={chain.goNext}
                          >
                            {chain.nextName}
                          </button>
                        </>
                      )}

                      {Boolean(chain.noNext) && (
                        <>
                          <span>App của bạn</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
                  >
                    <a
                      className="btn btn-s"
                      href="https://aihubproduction.com/docs"
                      target="_blank"
                      rel="noopener"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"></path>
                        <path d="M4 19V5"></path>
                      </svg>
                      Tài liệu
                    </a>
                    <a
                      className="btn btn-p"
                      href={sv.demoUrl}
                      target="_blank"
                      rel="noopener"
                    >
                      Xem WebApp Demo
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"></path>
                      </svg>
                    </a>
                  </div>
                </header>

                <div
                  className="card"
                  style={{
                    padding: "14px 18px",
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    borderRadius: "14px",
                  }}
                >
                  <span className="scope">{sv.scope}</span>
                  <p
                    style={{
                      margin: "0",
                      flex: "1",
                      minWidth: "260px",
                      fontSize: "14px",
                      lineHeight: "20px",
                    }}
                  >
                    {sv.desc}
                  </p>

                  {Boolean(sv.notGranted) && (
                    <>
                      <span className="pill p-warn">
                        Chưa có key nào được cấp {sv.scope}
                      </span>
                    </>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  <div
                    role="tablist"
                    aria-label="Mục của dịch vụ"
                    style={{
                      display: "flex",
                      borderBottom: "1px solid #E4E4EC",
                      overflowX: "auto",
                    }}
                  >
                    {tabs?.map((t: any, idx_t: number) => (
                      <React.Fragment key={idx_t}>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={t.on}
                          className={t.cls}
                          onClick={t.go}
                        >
                          {t.label}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>

                  {Boolean(showBanner) && (
                    <>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "14px 16px",
                          borderRadius: "14px",
                          background: "#EDEBFE",
                          flexWrap: "wrap",
                        }}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#4547C9"
                          strokeWidth="2"
                          strokeLinecap="round"
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="12" r="9"></circle>
                          <path d="M12 8h.01M11 12h1v4h1"></path>
                        </svg>
                        <div style={{ flex: "1", minWidth: "220px" }}>
                          <strong>
                            Bạn chưa gọi {sv.name} · {sv.skillLabel} lần nào.
                          </strong>{" "}
                          Làm 2 bước dưới đây để nhận kết quả đầu tiên.
                        </div>
                        <button
                          type="button"
                          className="btn btn-s btn-sm"
                          onClick={setDemoDone}
                        >
                          Tôi đã tích hợp xong
                        </button>
                      </div>
                    </>
                  )}

                  {/* ===== INTEGRATION ===== */}

                  {Boolean(showIntegration) && (
                    <>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "16px",
                        }}
                      >
                        <section
                          className="card"
                          style={{
                            padding: "24px",
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(320px, 1fr))",
                            gap: "24px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "12px",
                            }}
                          >
                            <div className="eyebrow-p">
                              Bước 1 · Làm ngay tại đây
                            </div>
                            <h2
                              className="h"
                              style={{ fontSize: "20px", lineHeight: "26px" }}
                            >
                              {sv.tryTitle}
                            </h2>
                            <p className="muted" style={{ margin: "0" }}>
                              {sv.tryDesc}
                            </p>
                            <div>
                              <label className="flabel" htmlFor="try-input">
                                {sv.tryLabel}
                              </label>
                              <textarea
                                id="try-input"
                                className="inp inp-t"
                                rows={sv.tryRows}
                                style={{
                                  resize: "vertical",
                                  lineHeight: "22px",
                                }}
                                value={tryInput}
                                onChange={onTryInput}
                              ></textarea>
                            </div>
                            <dl
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr auto",
                                gap: "8px 12px",
                                margin: "0",
                                fontSize: "13px",
                              }}
                            >
                              {sv.tryFacts?.map((f: any, idx_f: number) => (
                                <React.Fragment key={idx_f}>
                                  <dt className="muted">{f.l}</dt>
                                  <dd
                                    style={{
                                      margin: "0",
                                      fontWeight: "600",
                                      textAlign: "right",
                                    }}
                                  >
                                    {f.v}
                                  </dd>
                                </React.Fragment>
                              ))}
                            </dl>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                type="button"
                                className="btn btn-p"
                                onClick={runTry}
                                disabled={tryRunning}
                              >
                                {tryCta}
                              </button>
                              <span
                                className="muted"
                                style={{ fontSize: "12px" }}
                              >
                                Lượt chạy thử không tính vào quota.
                              </span>
                            </div>
                          </div>
                          <div
                            style={{
                              border: "1px solid #E4E4EC",
                              borderRadius: "16px",
                              padding: "18px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "12px",
                              minHeight: "280px",
                            }}
                          >
                            <div style={{ fontWeight: "600" }}>
                              Kết quả vừa chạy
                            </div>

                            {Boolean(tryEmpty) && (
                              <>
                                <div
                                  style={{
                                    flex: "1",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    gap: "6px",
                                    textAlign: "center",
                                    background: "#F7F7FB",
                                    borderRadius: "12px",
                                    padding: "24px",
                                  }}
                                >
                                  <div style={{ fontWeight: "600" }}>
                                    Chưa có kết quả
                                  </div>
                                  <div
                                    className="muted"
                                    style={{
                                      fontSize: "13px",
                                      maxWidth: "280px",
                                    }}
                                  >
                                    Bấm “{sv.tryCta}” để xem AIHub trả về gì —
                                    nó sẽ hiện ở đây.
                                  </div>
                                </div>
                              </>
                            )}

                            {Boolean(tryRunning) && (
                              <>
                                <div
                                  style={{
                                    flex: "1",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    gap: "10px",
                                    background: "#F7F7FB",
                                    borderRadius: "12px",
                                  }}
                                >
                                  <div
                                    className="track"
                                    style={{ width: "60%" }}
                                  >
                                    <div
                                      className="fill"
                                      style={{ width: "60%" }}
                                    ></div>
                                  </div>
                                  <div
                                    className="muted"
                                    style={{ fontSize: "13px" }}
                                  >
                                    {sv.tryRunningText}
                                  </div>
                                </div>
                              </>
                            )}

                            {Boolean(tryDone) && (
                              <>
                                <div
                                  className="fade"
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "12px",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "baseline",
                                      gap: "10px",
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <span
                                      className="h"
                                      style={{
                                        fontSize: "30px",
                                        lineHeight: "36px",
                                        color: "#4547C9",
                                      }}
                                    >
                                      {res.headline}
                                    </span>
                                    <span
                                      className="muted"
                                      style={{ fontSize: "13px" }}
                                    >
                                      {res.sub}
                                    </span>
                                  </div>
                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns:
                                        "repeat(2, minmax(0, 1fr))",
                                      gap: "8px",
                                    }}
                                  >
                                    {res.metrics?.map(
                                      (m: any, idx_m: number) => (
                                        <React.Fragment key={idx_m}>
                                          <div
                                            style={{
                                              background: "#F7F7FB",
                                              borderRadius: "10px",
                                              padding: "8px 10px",
                                            }}
                                          >
                                            <div
                                              className="muted"
                                              style={{
                                                fontSize: "12px",
                                                lineHeight: "16px",
                                              }}
                                            >
                                              {m.l}
                                            </div>
                                            <div
                                              className="mono"
                                              style={{ fontWeight: "600" }}
                                            >
                                              {m.v}
                                            </div>
                                          </div>
                                        </React.Fragment>
                                      )
                                    )}
                                  </div>
                                  <p
                                    style={{
                                      margin: "0",
                                      fontSize: "13px",
                                      lineHeight: "19px",
                                    }}
                                  >
                                    {res.comment}
                                  </p>
                                  <div className="eyebrow">
                                    {res.itemsTitle}
                                  </div>

                                  {res.items?.map((it: any, idx_it: number) => (
                                    <React.Fragment key={idx_it}>
                                      <div
                                        style={{
                                          display: "flex",
                                          gap: "10px",
                                          alignItems: "flex-start",
                                          fontSize: "13px",
                                          lineHeight: "18px",
                                        }}
                                      >
                                        <span
                                          className="scope"
                                          style={{ flex: "none" }}
                                        >
                                          {it.code}
                                        </span>
                                        <span style={{ flex: "1" }}>
                                          {it.text}
                                          <span className="muted">
                                            {" "}
                                            · {it.meta}
                                          </span>
                                        </span>
                                      </div>
                                    </React.Fragment>
                                  ))}

                                  {Boolean(chain.hasNext) && (
                                    <>
                                      <button
                                        type="button"
                                        className="btn btn-s btn-sm"
                                        style={{ alignSelf: "flex-start" }}
                                        onClick={chain.goNextIntegrate}
                                      >
                                        {chain.nextCta} →
                                      </button>
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </section>

                        <section
                          className="card"
                          style={{
                            padding: "24px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "16px",
                          }}
                        >
                          <div>
                            <div className="eyebrow-p">
                              Bước 2 · Tích hợp vào hệ thống của bạn
                            </div>
                            <h2
                              className="h"
                              style={{
                                fontSize: "20px",
                                lineHeight: "26px",
                                marginTop: "4px",
                              }}
                            >
                              Thử gọi API ngay tại đây
                            </h2>
                            <p className="muted" style={{ margin: "4px 0 0" }}>
                              {sv.flowDesc}
                            </p>
                          </div>

                          <div
                            style={{
                              background: "#F7F7FB",
                              borderRadius: "14px",
                              padding: "14px 16px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "10px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                gap: "20px",
                                flexWrap: "wrap",
                                alignItems: "flex-end",
                              }}
                            >
                              <div>
                                <div
                                  className="eyebrow"
                                  style={{ marginBottom: "6px" }}
                                >
                                  Chế độ
                                </div>
                                <div
                                  className="seg"
                                  role="group"
                                  aria-label="Chế độ gọi"
                                >
                                  {modeOpts?.map((o: any, idx_o: number) => (
                                    <React.Fragment key={idx_o}>
                                      <button
                                        type="button"
                                        className={o.cls}
                                        aria-pressed={o.on}
                                        onClick={o.pick}
                                      >
                                        {o.label}
                                      </button>
                                    </React.Fragment>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div
                                  className="eyebrow"
                                  style={{ marginBottom: "6px" }}
                                >
                                  Kịch bản
                                </div>
                                <div
                                  className="seg"
                                  role="group"
                                  aria-label="Kịch bản"
                                >
                                  {scenOpts?.map((o: any, idx_o: number) => (
                                    <React.Fragment key={idx_o}>
                                      <button
                                        type="button"
                                        className={o.cls}
                                        aria-pressed={o.on}
                                        onClick={o.pick}
                                      >
                                        {o.label}
                                      </button>
                                    </React.Fragment>
                                  ))}
                                </div>
                              </div>
                              <button
                                type="button"
                                className="btn btn-s btn-sm"
                                style={{ marginLeft: "auto" }}
                                onClick={resetFlow}
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path>
                                  <path d="M3 3v5h5"></path>
                                </svg>
                                Làm lại
                              </button>
                            </div>
                            <div
                              className="muted"
                              style={{ fontSize: "12px", lineHeight: "16px" }}
                            >
                              {modeNote}
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            {stepPills?.map((p: any, idx_p: number) => (
                              <React.Fragment key={idx_p}>
                                <button
                                  type="button"
                                  className={p.cls}
                                  disabled={p.locked}
                                  onClick={p.go}
                                  aria-current={p.ariaCur}
                                >
                                  {Boolean(p.done) && (
                                    <>
                                      <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                      >
                                        <path d="M5 12l5 5 9-10"></path>
                                      </svg>
                                    </>
                                  )}

                                  {p.label}
                                </button>
                              </React.Fragment>
                            ))}

                            <div
                              style={{
                                marginLeft: "auto",
                                display: "flex",
                                gap: "6px",
                              }}
                            >
                              <button
                                type="button"
                                className="btn btn-s btn-sm"
                                onClick={prevStep}
                                disabled={atFirst}
                              >
                                ‹ Trước
                              </button>
                              <button
                                type="button"
                                className="btn btn-s btn-sm"
                                onClick={nextStep}
                                disabled={nextLocked}
                              >
                                Sau ›
                              </button>
                            </div>
                          </div>

                          <div
                            className="fade"
                            style={{
                              border: "2px solid #5B5FEF",
                              borderRadius: "18px",
                              padding: "20px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "14px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "12px",
                              }}
                            >
                              <span
                                style={{
                                  width: "32px",
                                  height: "32px",
                                  borderRadius: "50%",
                                  background: "#5B5FEF",
                                  color: "#fff",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  font: "700 12px/16px 'Plus Jakarta Sans', sans-serif",
                                  flex: "none",
                                }}
                              >
                                {cur.num}
                              </span>
                              <div style={{ flex: "1" }}>
                                <h3
                                  className="h"
                                  style={{
                                    fontSize: "17px",
                                    lineHeight: "24px",
                                  }}
                                >
                                  {cur.title}
                                </h3>
                                <p
                                  className="muted"
                                  style={{
                                    margin: "2px 0 0",
                                    fontSize: "13px",
                                    lineHeight: "19px",
                                  }}
                                >
                                  {cur.desc}
                                </p>
                              </div>
                              <span className={cur.statusCls}>
                                {cur.statusText}
                              </span>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                alignItems: "center",
                                fontSize: "13px",
                                background: "#F7F7FB",
                                borderRadius: "10px",
                                padding: "8px 12px",
                                flexWrap: "wrap",
                              }}
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#5C5D77"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <circle cx="8" cy="15" r="4"></circle>
                                <path d="M11 12l9-9M17 6l3 3"></path>
                              </svg>
                              <span>{keyLine}</span>
                              <button
                                type="button"
                                className="btn-link"
                                style={{ fontSize: "13px" }}
                                onClick={goOverview}
                              >
                                Xem / đổi key
                              </button>
                            </div>

                            {Boolean(cur.isCall) && (
                              <>
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                      "repeat(auto-fit, minmax(300px, 1fr))",
                                    gap: "20px",
                                    alignItems: "start",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "14px",
                                    }}
                                  >
                                    {cur.fields?.map(
                                      (f: any, idx_f: number) => (
                                        <React.Fragment key={idx_f}>
                                          <div>
                                            {Boolean(f.isChips) && (
                                              <>
                                                <div className="flabel">
                                                  {f.label}
                                                </div>
                                                <div
                                                  className="seg"
                                                  role="group"
                                                  aria-label={f.label}
                                                >
                                                  {f.opts?.map(
                                                    (o: any, idx_o: number) => (
                                                      <React.Fragment
                                                        key={idx_o}
                                                      >
                                                        <button
                                                          type="button"
                                                          className={o.cls}
                                                          aria-pressed={o.on}
                                                          onClick={o.pick}
                                                        >
                                                          {o.label}
                                                        </button>
                                                      </React.Fragment>
                                                    )
                                                  )}
                                                </div>
                                              </>
                                            )}

                                            {Boolean(f.isInput) && (
                                              <>
                                                <label
                                                  className="flabel"
                                                  htmlFor={f.domId}
                                                >
                                                  {f.label}
                                                </label>
                                                <input
                                                  id={f.domId}
                                                  className="inp"
                                                  value={f.value}
                                                  onChange={f.onChange}
                                                />
                                              </>
                                            )}

                                            {Boolean(f.isText) && (
                                              <>
                                                <label
                                                  className="flabel"
                                                  htmlFor={f.domId}
                                                >
                                                  {f.label}
                                                </label>
                                                <textarea
                                                  id={f.domId}
                                                  className="inp inp-t"
                                                  rows="5"
                                                  style={{ resize: "vertical" }}
                                                  value={f.value}
                                                  onChange={f.onChange}
                                                ></textarea>
                                              </>
                                            )}

                                            {Boolean(f.hasHelp) && (
                                              <>
                                                <div className="help">
                                                  {f.help}
                                                </div>
                                              </>
                                            )}
                                          </div>
                                        </React.Fragment>
                                      )
                                    )}

                                    <div
                                      style={{
                                        display: "flex",
                                        gap: "10px",
                                        alignItems: "center",
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <button
                                        type="button"
                                        className="btn btn-p"
                                        onClick={runStep}
                                        disabled={running}
                                      >
                                        <svg
                                          width="14"
                                          height="14"
                                          viewBox="0 0 24 24"
                                          fill="currentColor"
                                          aria-hidden="true"
                                        >
                                          <path d="M7 4l13 8-13 8z"></path>
                                        </svg>
                                        {runLabel}
                                      </button>
                                      <span className="scope">
                                        {cur.endpoint}
                                      </span>
                                    </div>

                                    {Boolean(cur.showFix) && (
                                      <>
                                        <div
                                          style={{
                                            background: "#FDECEA",
                                            color: "#7A1B12",
                                            borderRadius: "12px",
                                            padding: "12px 14px",
                                            fontSize: "13px",
                                            lineHeight: "19px",
                                          }}
                                        >
                                          <strong>Cách xử lý:</strong> {cur.fix}
                                        </div>
                                      </>
                                    )}

                                    {Boolean(cur.showSlow) && (
                                      <>
                                        <div
                                          style={{
                                            background: "#FFF4DB",
                                            color: "#5C3B00",
                                            borderRadius: "12px",
                                            padding: "12px 14px",
                                            fontSize: "13px",
                                            lineHeight: "19px",
                                          }}
                                        >
                                          <strong>Phản hồi chậm:</strong>{" "}
                                          {cur.slowNote}
                                        </div>
                                      </>
                                    )}
                                  </div>

                                  <div
                                    style={{
                                      background: "#14152B",
                                      borderRadius: "16px",
                                      overflow: "hidden",
                                      boxShadow:
                                        "0 12px 32px rgba(20,21,43,.14)",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        padding: "10px 14px",
                                        background: "#1E2040",
                                        borderBottom: "1px solid #33355A",
                                      }}
                                    >
                                      <span
                                        style={{
                                          width: "9px",
                                          height: "9px",
                                          borderRadius: "50%",
                                          background: "#F26D6D",
                                        }}
                                      ></span>
                                      <span
                                        style={{
                                          width: "9px",
                                          height: "9px",
                                          borderRadius: "50%",
                                          background: "#F2C46D",
                                        }}
                                      ></span>
                                      <span
                                        style={{
                                          width: "9px",
                                          height: "9px",
                                          borderRadius: "50%",
                                          background: "#6DD39B",
                                        }}
                                      ></span>
                                      <span
                                        className="mono"
                                        style={{
                                          color: "#F3F3FA",
                                          fontSize: "12px",
                                          marginLeft: "6px",
                                        }}
                                      >
                                        API console
                                      </span>
                                      <span
                                        className="badge"
                                        style={{
                                          marginLeft: "auto",
                                          background: "#33355A",
                                          color: "#F3F3FA",
                                        }}
                                      >
                                        {modeBadge}
                                      </span>
                                    </div>
                                    <div
                                      style={{
                                        padding: "14px",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "10px",
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: "flex",
                                          justifyContent: "space-between",
                                          alignItems: "center",
                                        }}
                                      >
                                        <span
                                          className="eyebrow"
                                          style={{ color: "#9C9DC2" }}
                                        >
                                          Request
                                        </span>
                                        <button
                                          type="button"
                                          className="btn-link"
                                          style={{
                                            color: "#8B8EF5",
                                            fontSize: "12px",
                                          }}
                                          onClick={copyReq}
                                        >
                                          Copy cURL
                                        </button>
                                      </div>
                                      <pre
                                        className="code"
                                        style={{
                                          padding: "0",
                                          background: "transparent",
                                        }}
                                      >
                                        {cur.reqText}
                                      </pre>
                                      <div
                                        style={{
                                          borderTop: "1px solid #33355A",
                                          paddingTop: "10px",
                                          display: "flex",
                                          justifyContent: "space-between",
                                          alignItems: "center",
                                        }}
                                      >
                                        <span
                                          className="eyebrow"
                                          style={{ color: "#9C9DC2" }}
                                        >
                                          Response
                                        </span>
                                        <span
                                          className="mono"
                                          style={{
                                            color: "#9C9DC2",
                                            fontSize: "12px",
                                          }}
                                        >
                                          {cur.lat}
                                        </span>
                                      </div>

                                      {Boolean(cur.hasResp) && (
                                        <>
                                          <pre
                                            className="code"
                                            style={parseStyle(
                                              `padding: 0; background: transparent; color: ${cur.respColor};`
                                            )}
                                          >
                                            {cur.respText}
                                          </pre>
                                        </>
                                      )}

                                      {Boolean(running) && (
                                        <>
                                          <div
                                            className="mono"
                                            style={{
                                              color: "#9C9DC2",
                                              fontSize: "13px",
                                            }}
                                          >
                                            Đang gọi…
                                          </div>
                                        </>
                                      )}

                                      {Boolean(cur.noResp) && (
                                        <>
                                          <div
                                            style={{
                                              color: "#9C9DC2",
                                              fontSize: "13px",
                                            }}
                                          >
                                            Chưa gọi. Điền thông tin bên trái
                                            rồi bấm nút chạy, kết quả sẽ hiện ở
                                            đây.
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}

                            {Boolean(cur.isApp) && (
                              <>
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "16px",
                                  }}
                                >
                                  <div
                                    style={{
                                      background: "#F7F6FF",
                                      border: "1px solid #E4E4EC",
                                      borderRadius: "16px",
                                      padding: "16px",
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "12px",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        gap: "12px",
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <div>
                                        <div style={{ fontWeight: "600" }}>
                                          Làm y hệt trong app của bạn
                                        </div>
                                        <div
                                          className="muted"
                                          style={{ fontSize: "12px" }}
                                        >
                                          Đã điền sẵn đúng giá trị bạn vừa chạy
                                          thử.
                                        </div>
                                      </div>
                                      <div
                                        className="seg"
                                        role="group"
                                        aria-label="Định dạng"
                                      >
                                        {codeTabs?.map(
                                          (o: any, idx_o: number) => (
                                            <React.Fragment key={idx_o}>
                                              <button
                                                type="button"
                                                className={o.cls}
                                                aria-pressed={o.on}
                                                onClick={o.pick}
                                              >
                                                {o.label}
                                              </button>
                                            </React.Fragment>
                                          )
                                        )}
                                      </div>
                                    </div>
                                    <pre
                                      className="code"
                                      style={{
                                        maxHeight: "320px",
                                        overflow: "auto",
                                      }}
                                    >
                                      {appCode}
                                    </pre>
                                    <div>
                                      <button
                                        type="button"
                                        className="btn btn-p btn-sm"
                                        onClick={copyApp}
                                      >
                                        {copyAppLabel}
                                      </button>
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "13px",
                                        lineHeight: "19px",
                                      }}
                                    >
                                      <strong>Sau khi copy:</strong>
                                      <ol
                                        style={{
                                          margin: "6px 0 0",
                                          paddingLeft: "20px",
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: "2px",
                                        }}
                                      >
                                        {sv.after?.map(
                                          (a: any, idx_a: number) => (
                                            <React.Fragment key={idx_a}>
                                              <li>{a}</li>
                                            </React.Fragment>
                                          )
                                        )}
                                      </ol>
                                    </div>
                                  </div>
                                  <div
                                    style={{
                                      border: "1px solid #E4E4EC",
                                      borderRadius: "16px",
                                      padding: "16px",
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "12px",
                                    }}
                                  >
                                    <div className="eyebrow">
                                      Dữ liệu vừa trả về
                                    </div>
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "baseline",
                                        gap: "10px",
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <span
                                        className="h"
                                        style={{
                                          fontSize: "26px",
                                          lineHeight: "32px",
                                          color: "#4547C9",
                                        }}
                                      >
                                        {res.headline}
                                      </span>
                                      <span
                                        className="muted"
                                        style={{ fontSize: "13px" }}
                                      >
                                        {res.sub}
                                      </span>
                                    </div>
                                    <div
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns:
                                          "repeat(auto-fit, minmax(150px, 1fr))",
                                        gap: "8px",
                                      }}
                                    >
                                      {res.metrics?.map(
                                        (m: any, idx_m: number) => (
                                          <React.Fragment key={idx_m}>
                                            <div
                                              style={{
                                                background: "#F7F7FB",
                                                borderRadius: "10px",
                                                padding: "8px 10px",
                                              }}
                                            >
                                              <div
                                                className="muted"
                                                style={{
                                                  fontSize: "12px",
                                                  lineHeight: "16px",
                                                }}
                                              >
                                                {m.l}
                                              </div>
                                              <div
                                                className="mono"
                                                style={{ fontWeight: "600" }}
                                              >
                                                {m.v}
                                              </div>
                                            </div>
                                          </React.Fragment>
                                        )
                                      )}
                                    </div>
                                    <div
                                      role="table"
                                      aria-label="Dữ liệu vừa trả về"
                                    >
                                      <div
                                        role="row"
                                        className="trow"
                                        style={{
                                          gridTemplateColumns:
                                            "minmax(150px, 1fr) minmax(0, 2.4fr) minmax(110px, 0.9fr)",
                                        }}
                                      >
                                        <div
                                          role="columnheader"
                                          className="thc"
                                        >
                                          Mã
                                        </div>
                                        <div
                                          role="columnheader"
                                          className="thc"
                                        >
                                          Chi tiết
                                        </div>
                                        <div
                                          role="columnheader"
                                          className="thc"
                                        >
                                          Nhóm
                                        </div>
                                      </div>

                                      {res.items?.map(
                                        (it: any, idx_it: number) => (
                                          <React.Fragment key={idx_it}>
                                            <div
                                              role="row"
                                              className="trow"
                                              style={{
                                                gridTemplateColumns:
                                                  "minmax(150px, 1fr) minmax(0, 2.4fr) minmax(110px, 0.9fr)",
                                              }}
                                            >
                                              <div role="cell" className="tc">
                                                <span className="scope">
                                                  {it.code}
                                                </span>
                                              </div>
                                              <div role="cell" className="tc">
                                                {it.text}
                                              </div>
                                              <div
                                                role="cell"
                                                className="tc muted"
                                              >
                                                {it.meta}
                                              </div>
                                            </div>
                                          </React.Fragment>
                                        )
                                      )}
                                    </div>

                                    {Boolean(chain.hasNext) && (
                                      <>
                                        <div
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "12px",
                                            padding: "12px 14px",
                                            borderRadius: "12px",
                                            background: "#F7F6FF",
                                            flexWrap: "wrap",
                                          }}
                                        >
                                          <span
                                            style={{
                                              flex: "1",
                                              minWidth: "220px",
                                              fontSize: "13px",
                                            }}
                                          >
                                            <strong>
                                              Bước tiếp theo trong chuỗi:
                                            </strong>{" "}
                                            {chain.nextHint}
                                          </span>
                                          <button
                                            type="button"
                                            className="btn btn-p btn-sm"
                                            onClick={chain.goNextIntegrate}
                                          >
                                            {chain.nextCta}
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </section>
                      </div>
                    </>
                  )}

                  {/* ===== OPS OVERVIEW ===== */}

                  {Boolean(showOps) && (
                    <>
                      <div
                        style={{
                          display: "flex",
                          gap: "16px",
                          flexWrap: "wrap",
                          alignItems: "flex-start",
                        }}
                      >
                        <section
                          className="card"
                          style={{
                            flex: "999 1 520px",
                            minWidth: "0",
                            padding: "22px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              gap: "12px",
                              flexWrap: "wrap",
                            }}
                          >
                            <div>
                              <h2
                                className="h"
                                style={{ fontSize: "18px", lineHeight: "24px" }}
                              >
                                {sv.recentTitle}
                              </h2>
                              <p
                                className="muted"
                                style={{ margin: "4px 0 0", fontSize: "13px" }}
                              >
                                Các request gần nhất từ mọi key. Bấm Logs để xem
                                chi tiết từng request.
                              </p>
                            </div>
                            <button
                              type="button"
                              className="btn btn-s btn-sm"
                              onClick={goLogsTab}
                            >
                              Mở Logs
                            </button>
                          </div>
                          <div style={{ overflowX: "auto", marginTop: "10px" }}>
                            <div
                              role="table"
                              aria-label={sv.recentTitle}
                              style={{ minWidth: "720px" }}
                            >
                              <div
                                role="row"
                                className="trow"
                                style={{
                                  gridTemplateColumns:
                                    "130px 120px minmax(140px, 1.3fr) minmax(120px, 1fr) 80px minmax(150px, 1fr)",
                                }}
                              >
                                <div role="columnheader" className="thc">
                                  Thời gian
                                </div>
                                <div role="columnheader" className="thc">
                                  End-user
                                </div>
                                <div role="columnheader" className="thc">
                                  Đầu vào
                                </div>
                                <div role="columnheader" className="thc">
                                  Kết quả
                                </div>
                                <div
                                  role="columnheader"
                                  className="thc"
                                  style={{ textAlign: "right" }}
                                >
                                  Latency
                                </div>
                                <div role="columnheader" className="thc">
                                  Trạng thái
                                </div>
                              </div>

                              {sv.recent?.map((r: any, idx_r: number) => (
                                <React.Fragment key={idx_r}>
                                  <div
                                    role="row"
                                    className="trow b"
                                    style={{
                                      gridTemplateColumns:
                                        "130px 120px minmax(140px, 1.3fr) minmax(120px, 1fr) 80px minmax(150px, 1fr)",
                                    }}
                                  >
                                    <div
                                      role="cell"
                                      className="tc mono"
                                      style={{ fontSize: "13px" }}
                                    >
                                      {r.t}
                                    </div>
                                    <div
                                      role="cell"
                                      className="tc mono"
                                      style={{ fontSize: "13px" }}
                                    >
                                      {r.u}
                                    </div>
                                    <div role="cell" className="tc">
                                      {r.i}
                                    </div>
                                    <div
                                      role="cell"
                                      className="tc"
                                      style={{ fontWeight: "600" }}
                                    >
                                      {r.o}
                                    </div>
                                    <div
                                      role="cell"
                                      className="tc mono"
                                      style={{
                                        textAlign: "right",
                                        fontSize: "13px",
                                      }}
                                    >
                                      {r.l}
                                    </div>
                                    <div role="cell" className="tc">
                                      <span className={r.cls}>{r.s}</span>
                                    </div>
                                  </div>
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginTop: "12px",
                              fontSize: "13px",
                              flexWrap: "wrap",
                              gap: "8px",
                            }}
                          >
                            <span className="muted">Dữ liệu minh hoạ</span>
                            <button
                              type="button"
                              className="btn-link"
                              style={{ fontSize: "13px" }}
                              onClick={goIntegrateTab}
                            >
                              Xem lại hướng dẫn tích hợp →
                            </button>
                          </div>
                        </section>

                        <aside
                          style={{
                            flex: "1 1 300px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                          }}
                          aria-label="Usage"
                        >
                          <div
                            className="card"
                            style={{ padding: "18px", borderRadius: "16px" }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <h2 className="h" style={{ fontSize: "16px" }}>
                                Usage · {sv.skillLabel}
                              </h2>
                              <button
                                type="button"
                                className="btn btn-p btn-sm"
                                onClick={goPricingTab}
                              >
                                Nâng gói
                              </button>
                            </div>
                            <dl
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr auto",
                                gap: "6px",
                                margin: "12px 0 0",
                                fontSize: "13px",
                              }}
                            >
                              <dt className="muted">Gói hiện tại</dt>
                              <dd
                                className="mono"
                                style={{ margin: "0", fontWeight: "600" }}
                              >
                                {sv.plan}
                              </dd>
                              <dt className="muted">Request hôm nay</dt>
                              <dd className="mono" style={{ margin: "0" }}>
                                {sv.todayText}
                              </dd>
                            </dl>
                            <div className="track" style={{ marginTop: "8px" }}>
                              <div
                                className="fill"
                                style={parseStyle(sv.todayBar)}
                              ></div>
                            </div>
                          </div>
                          <div
                            className="card"
                            style={{
                              padding: "18px",
                              borderRadius: "16px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "12px",
                            }}
                          >
                            <div className="eyebrow">Quota</div>

                            {sv.quotas?.map((q: any, idx_q: number) => (
                              <React.Fragment key={idx_q}>
                                <div>
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      fontSize: "13px",
                                    }}
                                  >
                                    <span>{q.l}</span>
                                    <span
                                      className="mono"
                                      style={{ fontWeight: "600" }}
                                    >
                                      {q.pct}
                                    </span>
                                  </div>
                                  <div
                                    className="track"
                                    style={{ margin: "6px 0" }}
                                  >
                                    <div
                                      className={q.fillCls}
                                      style={parseStyle(q.bar)}
                                    ></div>
                                  </div>
                                  <div
                                    className="muted"
                                    style={{ fontSize: "12px" }}
                                  >
                                    {q.text}
                                  </div>
                                </div>
                              </React.Fragment>
                            ))}
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                              gap: "8px",
                            }}
                          >
                            {sv.stats?.map((s: any, idx_s: number) => (
                              <React.Fragment key={idx_s}>
                                <div
                                  className="card"
                                  style={{
                                    padding: "12px 14px",
                                    borderRadius: "14px",
                                  }}
                                >
                                  <div
                                    className="muted"
                                    style={{ fontSize: "12px" }}
                                  >
                                    {s.l}
                                  </div>
                                  <div
                                    className="h"
                                    style={{
                                      fontSize: "20px",
                                      lineHeight: "26px",
                                    }}
                                  >
                                    {s.v}
                                  </div>
                                </div>
                              </React.Fragment>
                            ))}
                          </div>
                          <div
                            className="card"
                            style={{ padding: "18px", borderRadius: "16px" }}
                          >
                            <div className="eyebrow">
                              Key được cấp {sv.scope}
                            </div>
                            <ul
                              style={{
                                listStyle: "none",
                                margin: "10px 0 0",
                                padding: "0",
                                display: "flex",
                                flexDirection: "column",
                                gap: "6px",
                              }}
                            >
                              {svKeys?.map((k: any, idx_k: number) => (
                                <React.Fragment key={idx_k}>
                                  <li>
                                    <button
                                      type="button"
                                      className="btn-link"
                                      style={{
                                        color: "#14152B",
                                        fontWeight: "500",
                                      }}
                                      onClick={k.open}
                                    >
                                      {k.name}
                                    </button>
                                  </li>
                                </React.Fragment>
                              ))}
                            </ul>
                            <button
                              type="button"
                              className="btn-link"
                              style={{ fontSize: "13px", marginTop: "10px" }}
                              onClick={goOverview}
                            >
                              Quản lý quyền ở Tổng quan →
                            </button>
                          </div>
                        </aside>
                      </div>
                    </>
                  )}

                  {/* ===== SPECIAL TAB ===== */}

                  {Boolean(tab.special) && (
                    <>
                      <div>
                        {Boolean(sp.rubric) && (
                          <>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "16px",
                              }}
                            >
                              <section
                                className="card"
                                style={{ padding: "22px" }}
                              >
                                <h2 className="h" style={{ fontSize: "18px" }}>
                                  4 tiêu chí chấm Writing
                                </h2>
                                <p
                                  className="muted"
                                  style={{
                                    margin: "4px 0 12px",
                                    fontSize: "13px",
                                  }}
                                >
                                  Mã tiêu chí xuất hiện trong trường{" "}
                                  <span className="mono">criteria</span> của
                                  response.
                                </p>
                                <div style={{ overflowX: "auto" }}>
                                  <table
                                    className="tbl"
                                    style={{ minWidth: "560px" }}
                                  >
                                    <thead>
                                      <tr>
                                        <th className="th">Mã</th>
                                        <th className="th">Tiêu chí</th>
                                        <th className="th">Áp dụng</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr>
                                        <td className="td">
                                          <span className="scope">TR / TA</span>
                                        </td>
                                        <td className="td">
                                          Task Response (Task 2) / Task
                                          Achievement (Task 1)
                                        </td>
                                        <td className="td">Task 1, Task 2</td>
                                      </tr>
                                      <tr>
                                        <td className="td">
                                          <span className="scope">CC</span>
                                        </td>
                                        <td className="td">
                                          Coherence &amp; Cohesion
                                        </td>
                                        <td className="td">Task 1, Task 2</td>
                                      </tr>
                                      <tr>
                                        <td className="td">
                                          <span className="scope">LR</span>
                                        </td>
                                        <td className="td">Lexical Resource</td>
                                        <td className="td">Task 1, Task 2</td>
                                      </tr>
                                      <tr>
                                        <td className="td">
                                          <span className="scope">GRA</span>
                                        </td>
                                        <td className="td">
                                          Grammatical Range &amp; Accuracy
                                        </td>
                                        <td className="td">Task 1, Task 2</td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </section>
                              <section
                                className="card"
                                style={{ padding: "22px" }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: "12px",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <div>
                                    <h2
                                      className="h"
                                      style={{ fontSize: "18px" }}
                                    >
                                      Mã lỗi
                                    </h2>
                                    <p
                                      className="muted"
                                      style={{
                                        margin: "4px 0 12px",
                                        fontSize: "13px",
                                      }}
                                    >
                                      Mỗi lỗi trong{" "}
                                      <span className="mono">errors[]</span> có
                                      một mã. Phân tích điểm yếu gom các mã này
                                      theo học viên; Tạo bài tập nhận mã này làm
                                      đầu vào.
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    className="btn btn-s btn-sm"
                                    onClick={goWeakness}
                                  >
                                    Mở Phân tích điểm yếu →
                                  </button>
                                </div>
                                <div style={{ overflowX: "auto" }}>
                                  <table
                                    className="tbl"
                                    style={{ minWidth: "560px" }}
                                  >
                                    <thead>
                                      <tr>
                                        <th className="th">Mã lỗi</th>
                                        <th className="th">Tên</th>
                                        <th className="th">Tiêu chí</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr>
                                        <td className="td">
                                          <span className="scope">
                                            inappropriate_word_choice
                                          </span>
                                        </td>
                                        <td className="td">
                                          Dùng từ không phù hợp
                                        </td>
                                        <td className="td">LR</td>
                                      </tr>
                                      <tr>
                                        <td className="td">
                                          <span className="scope">
                                            collocation_error
                                          </span>
                                        </td>
                                        <td className="td">Sai collocation</td>
                                        <td className="td">LR</td>
                                      </tr>
                                      <tr>
                                        <td className="td">
                                          <span className="scope">
                                            lexical_repetition
                                          </span>
                                        </td>
                                        <td className="td">Lặp từ</td>
                                        <td className="td">LR</td>
                                      </tr>
                                      <tr>
                                        <td className="td">
                                          <span className="scope">
                                            spelling_error
                                          </span>
                                        </td>
                                        <td className="td">Sai chính tả</td>
                                        <td className="td">LR</td>
                                      </tr>
                                      <tr>
                                        <td className="td">
                                          <span className="scope">
                                            informal_vocabulary
                                          </span>
                                        </td>
                                        <td className="td">
                                          Từ vựng thiếu trang trọng
                                        </td>
                                        <td className="td">LR</td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                                <div
                                  className="muted"
                                  style={{
                                    fontSize: "12px",
                                    marginTop: "10px",
                                  }}
                                >
                                  Đang hiện các mã nhóm LR lấy từ Lab. Các nhóm
                                  TR/CC/GRA: [bổ sung từ tài liệu API].
                                </div>
                              </section>
                            </div>
                          </>
                        )}

                        {Boolean(sp.webhook) && (
                          <>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "16px",
                              }}
                            >
                              <section
                                className="card"
                                style={{
                                  padding: "22px",
                                  display: "grid",
                                  gridTemplateColumns:
                                    "repeat(auto-fit, minmax(300px, 1fr))",
                                  gap: "24px",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "12px",
                                  }}
                                >
                                  <h2
                                    className="h"
                                    style={{ fontSize: "18px" }}
                                  >
                                    Webhook kết quả chấm Speaking
                                  </h2>
                                  <p
                                    className="muted"
                                    style={{ margin: "0", fontSize: "13px" }}
                                  >
                                    Chấm chữa Speaking chạy bất đồng bộ: request
                                    trả{" "}
                                    <span className="mono">202 + job_id</span>,
                                    kết quả gửi về URL dưới đây khi chấm xong.
                                  </p>
                                  <div>
                                    <label className="flabel" htmlFor="wh-url">
                                      URL nhận sự kiện
                                    </label>
                                    <input
                                      id="wh-url"
                                      className="inp"
                                      value="https://api.wispace.vn/hooks/aihub"
                                      readOnly=""
                                    />
                                  </div>
                                  <div>
                                    <div className="flabel">Signing secret</div>
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: "8px",
                                        alignItems: "center",
                                        background: "#F7F7FB",
                                        borderRadius: "8px",
                                        padding: "8px 8px 8px 12px",
                                      }}
                                    >
                                      <span
                                        className="mono"
                                        style={{ flex: "1" }}
                                      >
                                        whsec_••••••••••••••••
                                      </span>
                                      <button
                                        type="button"
                                        className="btn btn-s btn-sm"
                                        onClick={toastSoon}
                                      >
                                        Hiện
                                      </button>
                                    </div>
                                    <div className="help">
                                      Verify header X-AIHub-Signature
                                      (HMAC-SHA256 trên rawBody).
                                    </div>
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: "8px",
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <button
                                      type="button"
                                      className="btn btn-p btn-sm"
                                      onClick={sendTestHook}
                                    >
                                      Gửi sự kiện thử
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-s btn-sm"
                                      onClick={toastSoon}
                                    >
                                      Đổi URL
                                    </button>
                                  </div>
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "10px",
                                  }}
                                >
                                  <div className="eyebrow">Sự kiện</div>
                                  <div
                                    style={{
                                      border: "1px solid #E4E4EC",
                                      borderRadius: "12px",
                                      padding: "10px 12px",
                                    }}
                                  >
                                    <span className="scope">
                                      speaking.graded
                                    </span>
                                    <div
                                      className="muted"
                                      style={{
                                        fontSize: "13px",
                                        marginTop: "4px",
                                      }}
                                    >
                                      Chấm xong, kèm transcript, band 4 tiêu chí
                                      và lỗi có mã.
                                    </div>
                                  </div>
                                  <div
                                    style={{
                                      border: "1px solid #E4E4EC",
                                      borderRadius: "12px",
                                      padding: "10px 12px",
                                    }}
                                  >
                                    <span className="scope">
                                      speaking.failed
                                    </span>
                                    <div
                                      className="muted"
                                      style={{
                                        fontSize: "13px",
                                        marginTop: "4px",
                                      }}
                                    >
                                      Không chấm được (audio hỏng, quá ngắn,
                                      không nhận diện được giọng nói).
                                    </div>
                                  </div>
                                  <div
                                    className="muted"
                                    style={{ fontSize: "12px" }}
                                  >
                                    Endpoint của bạn cần trả HTTP 200 trong 10
                                    giây. AIHub retry 5 lần, giãn cách tăng dần.
                                  </div>
                                </div>
                              </section>
                              <section
                                className="card"
                                style={{ padding: "22px" }}
                              >
                                <h2 className="h" style={{ fontSize: "18px" }}>
                                  Lần gửi gần đây
                                </h2>
                                <div
                                  style={{
                                    overflowX: "auto",
                                    marginTop: "10px",
                                  }}
                                >
                                  <div
                                    role="table"
                                    aria-label="Lần gửi webhook gần đây"
                                    style={{ minWidth: "660px" }}
                                  >
                                    <div
                                      role="row"
                                      className="trow"
                                      style={{
                                        gridTemplateColumns:
                                          "130px minmax(150px, 1fr) 130px 80px 80px 110px",
                                      }}
                                    >
                                      <div role="columnheader" className="thc">
                                        Thời gian
                                      </div>
                                      <div role="columnheader" className="thc">
                                        Sự kiện
                                      </div>
                                      <div role="columnheader" className="thc">
                                        job_id
                                      </div>
                                      <div role="columnheader" className="thc">
                                        HTTP
                                      </div>
                                      <div role="columnheader" className="thc">
                                        Lần thử
                                      </div>
                                      <div
                                        role="columnheader"
                                        className="thc"
                                      ></div>
                                    </div>

                                    {hooks?.map((h: any, idx_h: number) => (
                                      <React.Fragment key={idx_h}>
                                        <div
                                          role="row"
                                          className="trow b"
                                          style={{
                                            gridTemplateColumns:
                                              "130px minmax(150px, 1fr) 130px 80px 80px 110px",
                                          }}
                                        >
                                          <div
                                            role="cell"
                                            className="tc mono"
                                            style={{ fontSize: "13px" }}
                                          >
                                            {h.t}
                                          </div>
                                          <div role="cell" className="tc">
                                            <span className="scope">{h.e}</span>
                                          </div>
                                          <div
                                            role="cell"
                                            className="tc mono"
                                            style={{ fontSize: "13px" }}
                                          >
                                            {h.j}
                                          </div>
                                          <div role="cell" className="tc">
                                            <span className={h.cls}>{h.c}</span>
                                          </div>
                                          <div role="cell" className="tc mono">
                                            {h.n}
                                          </div>
                                          <div
                                            role="cell"
                                            className="tc"
                                            style={{ textAlign: "right" }}
                                          >
                                            <button
                                              type="button"
                                              className="btn btn-s btn-sm"
                                              onClick={h.retry}
                                            >
                                              Gửi lại
                                            </button>
                                          </div>
                                        </div>
                                      </React.Fragment>
                                    ))}
                                  </div>
                                </div>
                              </section>
                            </div>
                          </>
                        )}

                        {Boolean(sp.bank) && (
                          <>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "16px",
                              }}
                            >
                              <section
                                className="card"
                                style={{ padding: "22px" }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: "12px",
                                    flexWrap: "wrap",
                                    alignItems: "flex-start",
                                  }}
                                >
                                  <div>
                                    <h2
                                      className="h"
                                      style={{ fontSize: "18px" }}
                                    >
                                      {sv.bank.title}
                                    </h2>
                                    <p
                                      className="muted"
                                      style={{
                                        margin: "4px 0 12px",
                                        fontSize: "13px",
                                      }}
                                    >
                                      Mỗi câu sai trong{" "}
                                      <span className="mono">errors[]</span> có{" "}
                                      <span className="mono">code</span> theo
                                      dạng câu hỏi. Phân tích điểm yếu gom các
                                      mã này theo học viên.
                                    </p>
                                  </div>
                                  <span className="pill p-neu">
                                    {sv.bank.tests}
                                  </span>
                                </div>
                                <div style={{ overflowX: "auto" }}>
                                  <div
                                    role="table"
                                    aria-label={sv.bank.title}
                                    style={{ minWidth: "620px" }}
                                  >
                                    <div
                                      role="row"
                                      className="trow"
                                      style={{
                                        gridTemplateColumns:
                                          "minmax(180px, 1.2fr) minmax(200px, 1.3fr) minmax(200px, 1.5fr)",
                                      }}
                                    >
                                      <div role="columnheader" className="thc">
                                        Dạng câu hỏi
                                      </div>
                                      <div role="columnheader" className="thc">
                                        Mã lỗi thường gặp
                                      </div>
                                      <div role="columnheader" className="thc">
                                        Phần chữa trả về
                                      </div>
                                    </div>

                                    {sv.bank.rows?.map(
                                      (b: any, idx_b: number) => (
                                        <React.Fragment key={idx_b}>
                                          <div
                                            role="row"
                                            className="trow"
                                            style={{
                                              gridTemplateColumns:
                                                "minmax(180px, 1.2fr) minmax(200px, 1.3fr) minmax(200px, 1.5fr)",
                                            }}
                                          >
                                            <div
                                              role="cell"
                                              className="tc"
                                              style={{ fontWeight: "600" }}
                                            >
                                              {b.t}
                                            </div>
                                            <div role="cell" className="tc">
                                              <span className="scope">
                                                {b.c}
                                              </span>
                                            </div>
                                            <div
                                              role="cell"
                                              className="tc muted"
                                            >
                                              {b.d}
                                            </div>
                                          </div>
                                        </React.Fragment>
                                      )
                                    )}
                                  </div>
                                </div>
                                <div
                                  className="muted"
                                  style={{
                                    fontSize: "12px",
                                    marginTop: "10px",
                                  }}
                                >
                                  Số đề và bảng mã đầy đủ: [bổ sung từ tài liệu
                                  API].
                                </div>
                              </section>
                              <section
                                className="card"
                                style={{
                                  padding: "22px",
                                  display: "flex",
                                  gap: "12px",
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                }}
                              >
                                <div style={{ flex: "1", minWidth: "240px" }}>
                                  <div style={{ fontWeight: "600" }}>
                                    Dùng đề của bạn
                                  </div>
                                  <div
                                    className="muted"
                                    style={{ fontSize: "13px" }}
                                  >
                                    Upload đề và đáp án riêng để AIHub chấm chữa
                                    bằng <span className="mono">test_id</span>{" "}
                                    của bạn.
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="btn btn-s btn-sm"
                                  onClick={toastSoon}
                                >
                                  Upload đề
                                </button>
                              </section>
                            </div>
                          </>
                        )}

                        {Boolean(sp.profile) && (
                          <>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "16px",
                              }}
                            >
                              <section
                                className="card"
                                style={{ padding: "22px" }}
                              >
                                <h2 className="h" style={{ fontSize: "18px" }}>
                                  Cấu trúc hồ sơ điểm yếu
                                </h2>
                                <p
                                  className="muted"
                                  style={{
                                    margin: "4px 0 12px",
                                    fontSize: "13px",
                                  }}
                                >
                                  Mỗi phần tử trong{" "}
                                  <span className="mono">weaknesses[]</span> gom
                                  các lỗi cùng mã của một học viên qua nhiều bài
                                  Chấm chữa cùng kỹ năng.
                                </p>
                                <div style={{ overflowX: "auto" }}>
                                  <table
                                    className="tbl"
                                    style={{ minWidth: "620px" }}
                                  >
                                    <thead>
                                      <tr>
                                        <th className="th">Trường</th>
                                        <th className="th">Ý nghĩa</th>
                                        <th className="th">
                                          Ví dụ ({sv.skillLabel})
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr>
                                        <td className="td">
                                          <span className="scope">code</span>
                                        </td>
                                        <td className="td">
                                          Mã lỗi, cùng bảng mã với Chấm chữa
                                        </td>
                                        <td
                                          className="td mono"
                                          style={{ fontSize: "13px" }}
                                        >
                                          {sv.ex.code}
                                        </td>
                                      </tr>
                                      <tr>
                                        <td className="td">
                                          <span className="scope">group</span>
                                        </td>
                                        <td className="td">
                                          Tiêu chí (Writing/Speaking) hoặc dạng
                                          câu / Part (Reading/Listening)
                                        </td>
                                        <td
                                          className="td mono"
                                          style={{ fontSize: "13px" }}
                                        >
                                          {sv.ex.group}
                                        </td>
                                      </tr>
                                      <tr>
                                        <td className="td">
                                          <span className="scope">count</span>
                                        </td>
                                        <td className="td">
                                          Số lần xuất hiện trong phạm vi phân
                                          tích
                                        </td>
                                        <td
                                          className="td mono"
                                          style={{ fontSize: "13px" }}
                                        >
                                          {sv.ex.count}
                                        </td>
                                      </tr>
                                      <tr>
                                        <td className="td">
                                          <span className="scope">trend</span>
                                        </td>
                                        <td className="td">
                                          Xu hướng so với kỳ trước: up / flat /
                                          down
                                        </td>
                                        <td
                                          className="td mono"
                                          style={{ fontSize: "13px" }}
                                        >
                                          flat
                                        </td>
                                      </tr>
                                      <tr>
                                        <td className="td">
                                          <span className="scope">
                                            priority
                                          </span>
                                        </td>
                                        <td className="td">
                                          Thứ tự nên luyện trước (1 = cao nhất)
                                        </td>
                                        <td
                                          className="td mono"
                                          style={{ fontSize: "13px" }}
                                        >
                                          1
                                        </td>
                                      </tr>
                                      <tr>
                                        <td className="td">
                                          <span className="scope">
                                            evidence[]
                                          </span>
                                        </td>
                                        <td className="td">
                                          request_id và đoạn trích của các bài
                                          có lỗi
                                        </td>
                                        <td
                                          className="td mono"
                                          style={{ fontSize: "13px" }}
                                        >
                                          {sv.ex.ev}
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </section>
                              <section
                                className="card"
                                style={{
                                  padding: "22px",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "10px",
                                }}
                              >
                                <h2 className="h" style={{ fontSize: "18px" }}>
                                  Quy tắc
                                </h2>
                                <dl
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                      "minmax(180px, 240px) 1fr",
                                    gap: "8px 16px",
                                    margin: "0",
                                    fontSize: "14px",
                                  }}
                                >
                                  <dt className="muted">Lịch sử tối thiểu</dt>
                                  <dd style={{ margin: "0" }}>
                                    3 bài đã qua Chấm chữa cùng kỹ năng
                                  </dd>
                                  <dt className="muted">Phạm vi phân tích</dt>
                                  <dd className="mono" style={{ margin: "0" }}>
                                    last_10 · 30d · 90d
                                  </dd>
                                  <dt className="muted">Cách tính priority</dt>
                                  <dd style={{ margin: "0" }}>
                                    [chốt công thức: tần suất × mức ảnh hưởng
                                    tới band × xu hướng]
                                  </dd>
                                  <dt className="muted">Thời hạn profile_id</dt>
                                  <dd style={{ margin: "0" }}>
                                    Giữ đến khi có phân tích mới cho cùng học
                                    viên và kỹ năng
                                  </dd>
                                </dl>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "8px",
                                    flexWrap: "wrap",
                                    marginTop: "6px",
                                  }}
                                >
                                  <button
                                    type="button"
                                    className="btn btn-s btn-sm"
                                    onClick={goExercise}
                                  >
                                    Sinh bài tập từ điểm yếu →
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-s btn-sm"
                                    onClick={goRoadmap}
                                  >
                                    Tạo lộ trình từ hồ sơ →
                                  </button>
                                </div>
                              </section>
                            </div>
                          </>
                        )}

                        {Boolean(sp.templates) && (
                          <>
                            <section
                              className="card"
                              style={{
                                padding: "22px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "14px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: "12px",
                                  flexWrap: "wrap",
                                }}
                              >
                                <div>
                                  <h2
                                    className="h"
                                    style={{ fontSize: "18px" }}
                                  >
                                    Kho mẫu đã lưu · {sv.skillLabel}
                                  </h2>
                                  <p
                                    className="muted"
                                    style={{
                                      margin: "4px 0 0",
                                      fontSize: "13px",
                                    }}
                                  >
                                    Lưu bộ tham số + dữ liệu tham chiếu hay
                                    dùng, gọi lại bằng{" "}
                                    <span className="mono">template_id</span>{" "}
                                    thay vì gửi lại từng tham số.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  className="btn btn-p btn-sm"
                                  onClick={goIntegrateTab}
                                >
                                  Tạo mẫu từ lần chạy thử
                                </button>
                              </div>
                              <div
                                style={{
                                  border: "1px dashed #C7C7D9",
                                  borderRadius: "14px",
                                  padding: "32px",
                                  textAlign: "center",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "6px",
                                  alignItems: "center",
                                }}
                              >
                                <div style={{ fontWeight: "600" }}>
                                  Kho mẫu trống (0)
                                </div>
                                <div
                                  className="muted"
                                  style={{
                                    fontSize: "13px",
                                    maxWidth: "420px",
                                  }}
                                >
                                  Chạy thử ở tab Tích hợp, rồi bấm “Lưu thành
                                  mẫu” ở bước sinh bài tập. Mẫu lưu ở đây dùng
                                  được cho mọi key của Organization.
                                </div>
                              </div>
                            </section>
                          </>
                        )}

                        {Boolean(sp.roadmapCfg) && (
                          <>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "16px",
                              }}
                            >
                              <section
                                className="card"
                                style={{
                                  padding: "22px",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "12px",
                                }}
                              >
                                <h2 className="h" style={{ fontSize: "18px" }}>
                                  Mặc định cho Organization
                                </h2>
                                <p
                                  className="muted"
                                  style={{ margin: "0", fontSize: "13px" }}
                                >
                                  Áp dụng khi request không truyền tham số tương
                                  ứng.
                                </p>
                                <dl
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                      "minmax(200px, 280px) 1fr auto",
                                    gap: "10px 16px",
                                    margin: "6px 0 0",
                                    fontSize: "14px",
                                    alignItems: "center",
                                  }}
                                >
                                  <dt className="muted">Giờ luyện mỗi tuần</dt>
                                  <dd className="mono" style={{ margin: "0" }}>
                                    6
                                  </dd>
                                  <dd style={{ margin: "0" }}>
                                    <button
                                      type="button"
                                      className="btn-link"
                                      style={{ fontSize: "13px" }}
                                      onClick={toastSoon}
                                    >
                                      Đổi
                                    </button>
                                  </dd>
                                  <dt className="muted">
                                    Gộp lộ trình nhiều kỹ năng
                                  </dt>
                                  <dd style={{ margin: "0" }}>
                                    Một học viên có một lịch tuần chung cho 4 kỹ
                                    năng
                                  </dd>
                                  <dd style={{ margin: "0" }}>
                                    <button
                                      type="button"
                                      className="btn-link"
                                      style={{ fontSize: "13px" }}
                                      onClick={toastSoon}
                                    >
                                      Đổi
                                    </button>
                                  </dd>
                                  <dt className="muted">Thi thử định kỳ</dt>
                                  <dd style={{ margin: "0" }}>Mỗi 4 tuần</dd>
                                  <dd style={{ margin: "0" }}>
                                    <button
                                      type="button"
                                      className="btn-link"
                                      style={{ fontSize: "13px" }}
                                      onClick={toastSoon}
                                    >
                                      Đổi
                                    </button>
                                  </dd>
                                  <dt className="muted">
                                    Tự cập nhật khi có bài chấm mới
                                  </dt>
                                  <dd style={{ margin: "0" }}>
                                    <span className="pill p-ok">Bật</span>
                                  </dd>
                                  <dd style={{ margin: "0" }}>
                                    <button
                                      type="button"
                                      className="btn-link"
                                      style={{ fontSize: "13px" }}
                                      onClick={toastSoon}
                                    >
                                      Tắt
                                    </button>
                                  </dd>
                                </dl>
                              </section>
                              <section
                                className="card"
                                style={{
                                  padding: "22px",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "10px",
                                }}
                              >
                                <h2 className="h" style={{ fontSize: "18px" }}>
                                  Sự kiện webhook
                                </h2>
                                <div
                                  style={{
                                    border: "1px solid #E4E4EC",
                                    borderRadius: "12px",
                                    padding: "10px 12px",
                                  }}
                                >
                                  <span className="scope">roadmap.updated</span>
                                  <div
                                    className="muted"
                                    style={{
                                      fontSize: "13px",
                                      marginTop: "4px",
                                    }}
                                  >
                                    Lộ trình được sắp lại sau một bài chấm mới
                                    hoặc một lần thi thử. Gửi tới Webhook URL
                                    trên API key.
                                  </div>
                                </div>
                                <div
                                  style={{
                                    border: "1px solid #E4E4EC",
                                    borderRadius: "12px",
                                    padding: "10px 12px",
                                  }}
                                >
                                  <span className="scope">
                                    roadmap.off_track
                                  </span>
                                  <div
                                    className="muted"
                                    style={{
                                      fontSize: "13px",
                                      marginTop: "4px",
                                    }}
                                  >
                                    Học viên chậm hơn kế hoạch quá 2 tuần — dùng
                                    để nhắc học viên hoặc giáo viên.
                                  </div>
                                </div>
                              </section>
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  )}

                  {/* ===== USAGE TAB ===== */}

                  {Boolean(tab.usage) && (
                    <>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "16px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: "10px",
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <span className="flabel" style={{ margin: "0" }}>
                            API key
                          </span>
                          <div
                            className="seg"
                            role="group"
                            aria-label="Lọc theo API key"
                          >
                            {usageKeyOpts?.map((o: any, idx_o: number) => (
                              <React.Fragment key={idx_o}>
                                <button
                                  type="button"
                                  className={o.cls}
                                  aria-pressed={o.on}
                                  onClick={o.pick}
                                >
                                  {o.label}
                                </button>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "12px",
                            alignItems: "center",
                            padding: "14px 16px",
                            borderRadius: "14px",
                            background: "#FFF4DB",
                            color: "#5C3B00",
                            flexWrap: "wrap",
                          }}
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M12 3l9.5 17h-19z"></path>
                            <path d="M12 10v4M12 17h.01"></path>
                          </svg>
                          <span style={{ flex: "1", minWidth: "220px" }}>
                            {sv.forecast}
                          </span>
                          <button
                            type="button"
                            className="btn btn-s btn-sm"
                            onClick={goPricingTab}
                          >
                            Xem bảng giá
                          </button>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(260px, 1fr))",
                            gap: "12px",
                          }}
                        >
                          {sv.quotas?.map((q: any, idx_q: number) => (
                            <React.Fragment key={idx_q}>
                              <div
                                className="card"
                                style={{
                                  padding: "18px",
                                  borderRadius: "16px",
                                }}
                              >
                                <div className="eyebrow">{q.l}</div>
                                <div
                                  className="h mono"
                                  style={{
                                    fontSize: "22px",
                                    lineHeight: "28px",
                                    marginTop: "6px",
                                  }}
                                >
                                  {q.big}
                                </div>
                                <div
                                  className="track"
                                  style={{ margin: "10px 0 6px" }}
                                >
                                  <div
                                    className={q.fillCls}
                                    style={parseStyle(q.bar)}
                                  ></div>
                                </div>
                                <div
                                  className="muted"
                                  style={{ fontSize: "12px" }}
                                >
                                  {q.reset}
                                </div>
                              </div>
                            </React.Fragment>
                          ))}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "16px",
                            flexWrap: "wrap",
                            alignItems: "stretch",
                          }}
                        >
                          <section
                            className="card"
                            style={{
                              flex: "999 1 460px",
                              minWidth: "0",
                              padding: "20px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "baseline",
                                gap: "8px",
                              }}
                            >
                              <h2 className="h" style={{ fontSize: "16px" }}>
                                {sv.chartTitle}
                              </h2>
                              <span
                                className="muted"
                                style={{ fontSize: "12px" }}
                              >
                                {usageKeyLabel}
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "flex-end",
                                gap: "6px",
                                height: "160px",
                                marginTop: "16px",
                                borderBottom: "1px solid #E4E4EC",
                              }}
                              role="img"
                              aria-label="Biểu đồ cột lượt gọi 14 ngày gần nhất"
                            >
                              {chart?.map((b: any, idx_b: number) => (
                                <React.Fragment key={idx_b}>
                                  <div
                                    style={{
                                      flex: "1",
                                      display: "flex",
                                      flexDirection: "column",
                                      justifyContent: "flex-end",
                                      height: "100%",
                                    }}
                                  >
                                    <div
                                      className="bar"
                                      style={parseStyle(b.style)}
                                      title={b.tip}
                                    ></div>
                                  </div>
                                </React.Fragment>
                              ))}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                marginTop: "6px",
                              }}
                              className="mono muted"
                            >
                              <span style={{ fontSize: "11px" }}>02/10</span>
                              <span style={{ fontSize: "11px" }}>08/10</span>
                              <span style={{ fontSize: "11px" }}>15/10</span>
                            </div>
                          </section>
                          <section
                            className="card"
                            style={{ flex: "1 1 300px", padding: "20px" }}
                          >
                            <h2 className="h" style={{ fontSize: "16px" }}>
                              Top End-user
                            </h2>
                            <p
                              className="muted"
                              style={{ margin: "4px 0 8px", fontSize: "12px" }}
                            >
                              Dùng để tính phí lại cho học viên của bạn.
                            </p>
                            <div role="table" aria-label="Top End-user">
                              <div
                                role="row"
                                className="trow"
                                style={{ gridTemplateColumns: "1fr auto" }}
                              >
                                <div role="columnheader" className="thc">
                                  end_user_id
                                </div>
                                <div
                                  role="columnheader"
                                  className="thc"
                                  style={{ textAlign: "right" }}
                                >
                                  {sv.unitShort}
                                </div>
                              </div>

                              {sv.topUsers?.map((u: any, idx_u: number) => (
                                <React.Fragment key={idx_u}>
                                  <div
                                    role="row"
                                    className="trow"
                                    style={{ gridTemplateColumns: "1fr auto" }}
                                  >
                                    <div
                                      role="cell"
                                      className="tc mono"
                                      style={{ fontSize: "13px" }}
                                    >
                                      {u.id}
                                    </div>
                                    <div
                                      role="cell"
                                      className="tc mono"
                                      style={{ textAlign: "right" }}
                                    >
                                      {u.n}
                                    </div>
                                  </div>
                                </React.Fragment>
                              ))}
                            </div>
                            <button
                              type="button"
                              className="btn btn-s btn-sm"
                              style={{ marginTop: "12px" }}
                              onClick={exportCsv}
                            >
                              Xuất CSV theo End-user
                            </button>
                          </section>
                        </div>
                      </div>
                    </>
                  )}

                  {/* ===== LOGS TAB ===== */}

                  {Boolean(tab.logs) && (
                    <>
                      <section className="card" style={{ padding: "20px" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "12px",
                            flexWrap: "wrap",
                          }}
                        >
                          <div>
                            <h2 className="h" style={{ fontSize: "18px" }}>
                              Logs · {sv.skillLabel}
                            </h2>
                            <p
                              className="muted"
                              style={{ margin: "4px 0 0", fontSize: "13px" }}
                            >
                              Nội dung bài làm và audio được che mặc định, lưu
                              30 ngày.
                            </p>
                          </div>
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              fontSize: "13px",
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              className="cb"
                              checked={showContent}
                              onChange={toggleContent}
                            />{" "}
                            Hiện nội dung (Owner)
                          </label>
                        </div>
                        <div style={{ overflowX: "auto", marginTop: "12px" }}>
                          <div
                            role="table"
                            aria-label="Logs"
                            style={{ minWidth: "880px" }}
                          >
                            <div
                              role="row"
                              className="trow"
                              style={{
                                gridTemplateColumns:
                                  "130px minmax(240px, 1.7fr) minmax(140px, 1fr) 120px 80px 80px 52px",
                              }}
                            >
                              <div role="columnheader" className="thc">
                                Thời gian
                              </div>
                              <div role="columnheader" className="thc">
                                Request
                              </div>
                              <div role="columnheader" className="thc">
                                API key
                              </div>
                              <div role="columnheader" className="thc">
                                End-user
                              </div>
                              <div role="columnheader" className="thc">
                                Mã
                              </div>
                              <div
                                role="columnheader"
                                className="thc"
                                style={{ textAlign: "right" }}
                              >
                                Latency
                              </div>
                              <div role="columnheader" className="thc"></div>
                            </div>

                            {logRows?.map((l: any, idx_l: number) => (
                              <React.Fragment key={idx_l}>
                                <div>
                                  <div
                                    role="row"
                                    className="trow b"
                                    style={{
                                      gridTemplateColumns:
                                        "130px minmax(240px, 1.7fr) minmax(140px, 1fr) 120px 80px 80px 52px",
                                    }}
                                  >
                                    <div
                                      role="cell"
                                      className="tc mono"
                                      style={{ fontSize: "13px" }}
                                    >
                                      {l.t}
                                    </div>
                                    <div role="cell" className="tc">
                                      <span
                                        className="mono"
                                        style={{
                                          fontSize: "12px",
                                          fontWeight: "600",
                                          color: "#4547C9",
                                        }}
                                      >
                                        {l.m}
                                      </span>{" "}
                                      <span
                                        className="mono"
                                        style={{ fontSize: "13px" }}
                                      >
                                        {l.p}
                                      </span>
                                    </div>
                                    <div role="cell" className="tc">
                                      {l.k}
                                    </div>
                                    <div
                                      role="cell"
                                      className="tc mono"
                                      style={{ fontSize: "13px" }}
                                    >
                                      {l.u}
                                    </div>
                                    <div role="cell" className="tc">
                                      <span className={l.cls}>{l.c}</span>
                                    </div>
                                    <div
                                      role="cell"
                                      className="tc mono"
                                      style={{
                                        textAlign: "right",
                                        fontSize: "13px",
                                      }}
                                    >
                                      {l.l}
                                    </div>
                                    <div
                                      role="cell"
                                      className="tc"
                                      style={{
                                        textAlign: "right",
                                        padding: "8px",
                                      }}
                                    >
                                      <button
                                        type="button"
                                        className="iconbtn"
                                        onClick={l.toggle}
                                        aria-expanded={l.open}
                                        aria-label={`Chi tiết request ${l.rid}`}
                                      >
                                        <svg
                                          width="16"
                                          height="16"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          aria-hidden="true"
                                        >
                                          <path d={l.chev}></path>
                                        </svg>
                                      </button>
                                    </div>
                                  </div>

                                  {Boolean(l.open) && (
                                    <>
                                      <div
                                        className="fade"
                                        style={{
                                          background: "#FAFAFD",
                                          borderBottom: "1px solid #E4E4EC",
                                          padding: "14px 12px",
                                          display: "grid",
                                          gridTemplateColumns:
                                            "repeat(auto-fit, minmax(240px, 1fr))",
                                          gap: "12px",
                                        }}
                                      >
                                        <div>
                                          <div className="eyebrow">
                                            request_id
                                          </div>
                                          <div
                                            className="mono"
                                            style={{
                                              fontSize: "13px",
                                              marginTop: "4px",
                                            }}
                                          >
                                            {l.rid}
                                          </div>
                                          <div
                                            className="eyebrow"
                                            style={{ marginTop: "10px" }}
                                          >
                                            Model
                                          </div>
                                          <div
                                            className="mono"
                                            style={{
                                              fontSize: "13px",
                                              marginTop: "4px",
                                            }}
                                          >
                                            {l.model}
                                          </div>
                                        </div>
                                        <div>
                                          <div className="eyebrow">Input</div>
                                          <pre
                                            className="code"
                                            style={{
                                              marginTop: "4px",
                                              fontSize: "12px",
                                            }}
                                          >
                                            {l.inText}
                                          </pre>
                                        </div>
                                        <div>
                                          <div className="eyebrow">Output</div>
                                          <pre
                                            className="code"
                                            style={{
                                              marginTop: "4px",
                                              fontSize: "12px",
                                            }}
                                          >
                                            {l.outText}
                                          </pre>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      </section>
                    </>
                  )}

                  {/* ===== PRICING TAB ===== */}

                  {Boolean(tab.pricing) && (
                    <>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                        }}
                      >
                        <p className="muted" style={{ margin: "0" }}>
                          Gói tính theo năm, trả bằng credit dùng chung cho cả 4
                          dịch vụ. Hạn mức trong gói dùng chung cho 4 kỹ năng.
                          Quota và giá dưới đây là số minh hoạ, chờ chốt bảng
                          giá.
                        </p>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(220px, 1fr))",
                            gap: "12px",
                          }}
                        >
                          {plans?.map((p: any, idx_p: number) => (
                            <React.Fragment key={idx_p}>
                              <div style={parseStyle(p.box)}>
                                {Boolean(p.current) && (
                                  <>
                                    <div
                                      className="badge b-stable"
                                      style={{ alignSelf: "flex-start" }}
                                    >
                                      Đang dùng
                                    </div>
                                  </>
                                )}

                                <div
                                  className="h"
                                  style={{
                                    fontSize: "20px",
                                    lineHeight: "26px",
                                  }}
                                >
                                  {p.name}
                                </div>
                                <ul
                                  style={{
                                    margin: "0",
                                    paddingLeft: "18px",
                                    fontSize: "13px",
                                    lineHeight: "20px",
                                  }}
                                  className="muted"
                                >
                                  {p.feats?.map((f: any, idx_f: number) => (
                                    <React.Fragment key={idx_f}>
                                      <li>{f}</li>
                                    </React.Fragment>
                                  ))}
                                </ul>
                                <div
                                  className="h"
                                  style={{
                                    fontSize: "18px",
                                    marginTop: "auto",
                                  }}
                                >
                                  {p.price}
                                </div>
                                <button
                                  type="button"
                                  className={p.btnCls}
                                  onClick={p.buy}
                                  disabled={p.current}
                                >
                                  {p.cta}
                                </button>
                              </div>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ============ PAGE: SANDBOX ============ */}

          {Boolean(pg.sandbox) && (
            <>
              <div
                className="fade"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  maxWidth: "760px",
                }}
              >
                <div>
                  <h1
                    className="h"
                    style={{ fontSize: "28px", lineHeight: "34px" }}
                  >
                    Sandbox
                  </h1>
                  <p className="muted" style={{ margin: "4px 0 0" }}>
                    Môi trường miễn phí để thử cả 4 dịch vụ × 4 kỹ năng. Kết quả
                    sandbox giống production về cấu trúc, có giới hạn lượt gọi
                    mỗi ngày.
                  </p>
                </div>
                <section
                  className="card"
                  style={{
                    padding: "22px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                  }}
                >
                  <h2 className="h" style={{ fontSize: "18px" }}>
                    Mời vào môi trường sandbox
                  </h2>
                  <div>
                    <div className="flabel">Môi trường</div>
                    <div className="seg" role="group" aria-label="Môi trường">
                      <button
                        type="button"
                        className="sb on"
                        aria-pressed="true"
                      >
                        Sandbox (khách hàng)
                      </button>
                      <button
                        type="button"
                        className="sb"
                        aria-pressed="false"
                        onClick={toastSoon}
                      >
                        Demo (nội bộ)
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="flabel" htmlFor="sbx-email">
                      Email (để trống để tự mời chính bạn)
                    </label>
                    <input
                      id="sbx-email"
                      className="inp inp-t"
                      placeholder="teammate@yourcompany.com"
                    />
                    <div className="help">
                      Chỉ mời được thành viên đã có trong Organization.
                    </div>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="btn btn-p"
                      onClick={selfGrant}
                    >
                      Tự cấp quyền cho tôi
                    </button>
                  </div>
                </section>
                <section className="card" style={{ padding: "22px" }}>
                  <h2 className="h" style={{ fontSize: "18px" }}>
                    Giới hạn sandbox (mỗi kỹ năng)
                  </h2>
                  <dl
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: "8px 12px",
                      margin: "12px 0 0",
                    }}
                  >
                    <dt className="muted">Chấm chữa</dt>
                    <dd className="mono" style={{ margin: "0" }}>
                      [N] lượt / ngày · Speaking [N] phút
                    </dd>
                    <dt className="muted">Phân tích điểm yếu</dt>
                    <dd className="mono" style={{ margin: "0" }}>
                      [N] lượt / ngày
                    </dd>
                    <dt className="muted">Tạo bài tập</dt>
                    <dd className="mono" style={{ margin: "0" }}>
                      [N] lượt / ngày
                    </dd>
                    <dt className="muted">Lộ trình cá nhân hoá</dt>
                    <dd className="mono" style={{ margin: "0" }}>
                      [N] lộ trình / ngày
                    </dd>
                    <dt className="muted">Hạn của key sandbox</dt>
                    <dd style={{ margin: "0" }}>30 ngày, gia hạn được</dd>
                  </dl>
                </section>
              </div>
            </>
          )}

          {/* ============ PAGE: IDENTITY ============ */}

          {Boolean(pg.identity) && (
            <>
              <div
                className="fade"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  maxWidth: "960px",
                }}
              >
                <div>
                  <h1
                    className="h"
                    style={{ fontSize: "28px", lineHeight: "34px" }}
                  >
                    Xác thực End-user
                  </h1>
                  <p className="muted" style={{ margin: "4px 0 0" }}>
                    Chọn cách AIHub biết request đang xử lý cho học viên nào. Áp
                    dụng cho mọi key, mọi dịch vụ và kỹ năng của Organization.
                  </p>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                    gap: "12px",
                  }}
                >
                  {idOpts?.map((o: any, idx_o: number) => (
                    <React.Fragment key={idx_o}>
                      <button
                        type="button"
                        className={o.cls}
                        style={{
                          flexDirection: "column",
                          textAlign: "left",
                          gap: "8px",
                          cursor: "pointer",
                        }}
                        onClick={o.pick}
                        aria-pressed={o.on}
                      >
                        <span
                          style={{
                            display: "flex",
                            gap: "8px",
                            alignItems: "center",
                            width: "100%",
                          }}
                        >
                          <span style={{ fontWeight: "700", fontSize: "15px" }}>
                            {o.title}
                          </span>
                          <span
                            className={o.tagCls}
                            style={{ marginLeft: "auto" }}
                          >
                            {o.tag}
                          </span>
                        </span>
                        <span
                          className="muted"
                          style={{ fontSize: "13px", lineHeight: "19px" }}
                        >
                          {o.desc}
                        </span>
                        <span
                          className="mono"
                          style={{
                            fontSize: "12px",
                            background: "#F7F7FB",
                            borderRadius: "8px",
                            padding: "6px 8px",
                          }}
                        >
                          {o.header}
                        </span>
                      </button>
                    </React.Fragment>
                  ))}
                </div>

                {Boolean(identityOff) && (
                  <>
                    <div
                      style={{
                        background: "#FFF4DB",
                        color: "#5C3B00",
                        borderRadius: "14px",
                        padding: "14px 16px",
                        fontSize: "13px",
                        lineHeight: "19px",
                      }}
                    >
                      <strong>Đang dùng Declared User ID.</strong> Vẫn chấm
                      được, nhưng ai có API key cũng gửi được request dưới ID
                      của End-user bất kỳ. Nên bật Signed User Assertion trước
                      khi lên Production.
                    </div>
                  </>
                )}

                {Boolean(identityOn) && (
                  <>
                    <section
                      className="card fade"
                      style={{
                        padding: "22px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "14px",
                      }}
                    >
                      <h2 className="h" style={{ fontSize: "18px" }}>
                        Cấu hình Signed User Assertion
                      </h2>
                      <div>
                        <label className="flabel" htmlFor="jwks">
                          JWKS URL (public key của bạn)
                        </label>
                        <input
                          id="jwks"
                          className="inp"
                          placeholder="https://auth.yourapp.com/.well-known/jwks.json"
                        />
                        <div className="help">
                          Backend của bạn ký JWT bằng private key; AIHub dùng
                          public key ở đây để verify.
                        </div>
                      </div>
                      <div>
                        <div className="flabel">Thuật toán</div>
                        <div
                          className="seg"
                          role="group"
                          aria-label="Thuật toán"
                        >
                          <button
                            type="button"
                            className="sb on"
                            aria-pressed="true"
                          >
                            ES256
                          </button>
                          <button
                            type="button"
                            className="sb"
                            aria-pressed="false"
                          >
                            RS256
                          </button>
                        </div>
                      </div>
                      <div>
                        <div className="flabel">Claim bắt buộc</div>
                        <pre className="code">
                          &#123; "sub": "student_001", // end_user_id "aud":
                          "aihub", "iss": "org_01M4XB56SVSWVDR97BC2H640DD",
                          "exp": 1792000000 // tối đa 5 phút &#125;
                        </pre>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          className="btn btn-p"
                          onClick={saveIdentity}
                        >
                          Lưu và bật
                        </button>
                        <button
                          type="button"
                          className="btn btn-s"
                          onClick={toastSoon}
                        >
                          Kiểm tra một assertion
                        </button>
                      </div>
                    </section>
                  </>
                )}
              </div>
            </>
          )}

          {/* ============ PAGE: PLANS ============ */}

          {Boolean(pg.plans) && (
            <>
              <div
                className="fade"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <h1
                      className="h"
                      style={{ fontSize: "28px", lineHeight: "34px" }}
                    >
                      Gói dịch vụ
                    </h1>
                    <p className="muted" style={{ margin: "4px 0 0" }}>
                      So sánh và chọn gói phù hợp với nhu cầu tích hợp.
                    </p>
                  </div>
                  <span className="pill p-neu" style={{ fontSize: "13px" }}>
                    Số dư credit{" "}
                    <span
                      className="mono"
                      style={{ color: "#4547C9", fontWeight: "600" }}
                    >
                      {credit}
                    </span>
                  </span>
                </div>
                <section
                  className="card"
                  style={{
                    padding: "0",
                    display: "flex",
                    flexWrap: "wrap",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      flex: "1 1 360px",
                      padding: "24px",
                      background: "#F7F6FF",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <h2 className="h" style={{ fontSize: "20px" }}>
                      Nạp credit vào ví
                    </h2>
                    <p className="muted" style={{ margin: "0" }}>
                      Dùng chung cho cả 4 dịch vụ và 4 kỹ năng.
                    </p>
                    <ul
                      style={{
                        margin: "0",
                        paddingLeft: "18px",
                        fontSize: "13px",
                        lineHeight: "20px",
                      }}
                    >
                      <li>Mua nhiều dịch vụ cùng lúc bằng credit có sẵn.</li>
                      <li>
                        Tự động gia hạn gói khi hết quota, dịch vụ không bị gián
                        đoạn.
                      </li>
                    </ul>
                    <span
                      className="pill p-neu"
                      style={{ alignSelf: "flex-start" }}
                    >
                      Tỷ lệ quy đổi: [1 credit = ? ₫]
                    </span>
                  </div>
                  <div
                    style={{
                      flex: "1 1 360px",
                      padding: "24px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    <div className="muted" style={{ fontSize: "13px" }}>
                      Số dư hiện tại
                    </div>
                    <div className="h mono" style={{ fontSize: "24px" }}>
                      {credit} credit
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                        gap: "8px",
                      }}
                    >
                      {topups?.map((t: any, idx_t: number) => (
                        <React.Fragment key={idx_t}>
                          <button
                            type="button"
                            className={t.cls}
                            onClick={t.pick}
                            aria-pressed={t.on}
                          >
                            {t.label}
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="btn btn-p"
                      onClick={buyCredit}
                    >
                      Mua ngay
                    </button>
                  </div>
                </section>
                <div
                  role="tablist"
                  aria-label="Gói theo dịch vụ"
                  style={{
                    display: "flex",
                    borderBottom: "1px solid #E4E4EC",
                    overflowX: "auto",
                  }}
                >
                  {planTabs?.map((t: any, idx_t: number) => (
                    <React.Fragment key={idx_t}>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={t.on}
                        className={t.cls}
                        onClick={t.go}
                      >
                        {t.label}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "12px",
                  }}
                >
                  {plans?.map((p: any, idx_p: number) => (
                    <React.Fragment key={idx_p}>
                      <div style={parseStyle(p.box)}>
                        {Boolean(p.current) && (
                          <>
                            <div
                              className="badge b-stable"
                              style={{ alignSelf: "flex-start" }}
                            >
                              Đang dùng
                            </div>
                          </>
                        )}

                        <div
                          className="h"
                          style={{ fontSize: "20px", lineHeight: "26px" }}
                        >
                          {p.name}
                        </div>
                        <ul
                          style={{
                            margin: "0",
                            paddingLeft: "18px",
                            fontSize: "13px",
                            lineHeight: "20px",
                          }}
                          className="muted"
                        >
                          {p.feats?.map((f: any, idx_f: number) => (
                            <React.Fragment key={idx_f}>
                              <li>{f}</li>
                            </React.Fragment>
                          ))}
                        </ul>
                        <div
                          className="h"
                          style={{ fontSize: "18px", marginTop: "auto" }}
                        >
                          {p.price}
                        </div>
                        <button
                          type="button"
                          className={p.btnCls}
                          onClick={p.buy}
                          disabled={p.current}
                        >
                          {p.cta}
                        </button>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ============ PAGE: BILLING ============ */}

          {Boolean(pg.billing) && (
            <>
              <div
                className="fade"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <div>
                  <h1
                    className="h"
                    style={{ fontSize: "28px", lineHeight: "34px" }}
                  >
                    Lịch sử thanh toán
                  </h1>
                  <p className="muted" style={{ margin: "4px 0 0" }}>
                    Nạp credit, gia hạn và nâng gói của Organization.
                  </p>
                </div>
                <section
                  className="card"
                  style={{ padding: "8px 20px 12px", overflowX: "auto" }}
                >
                  <div
                    role="table"
                    aria-label="Lịch sử thanh toán"
                    style={{ minWidth: "800px" }}
                  >
                    <div
                      role="row"
                      className="trow"
                      style={{
                        gridTemplateColumns:
                          "140px minmax(200px, 1.6fr) 160px 130px 120px 90px",
                      }}
                    >
                      <div role="columnheader" className="thc">
                        Thời gian
                      </div>
                      <div role="columnheader" className="thc">
                        Nội dung
                      </div>
                      <div role="columnheader" className="thc">
                        Số tiền / credit
                      </div>
                      <div role="columnheader" className="thc">
                        Phương thức
                      </div>
                      <div role="columnheader" className="thc">
                        Trạng thái
                      </div>
                      <div
                        role="columnheader"
                        className="thc"
                        style={{ textAlign: "right" }}
                      >
                        Hoá đơn
                      </div>
                    </div>

                    {bills?.map((b: any, idx_b: number) => (
                      <React.Fragment key={idx_b}>
                        <div
                          role="row"
                          className="trow b"
                          style={{
                            gridTemplateColumns:
                              "140px minmax(200px, 1.6fr) 160px 130px 120px 90px",
                          }}
                        >
                          <div
                            role="cell"
                            className="tc mono"
                            style={{ fontSize: "13px" }}
                          >
                            {b.t}
                          </div>
                          <div
                            role="cell"
                            className="tc"
                            style={{ fontWeight: "600" }}
                          >
                            {b.c}
                          </div>
                          <div
                            role="cell"
                            className="tc mono"
                            style={{ fontSize: "13px" }}
                          >
                            {b.a}
                          </div>
                          <div role="cell" className="tc">
                            {b.m}
                          </div>
                          <div role="cell" className="tc">
                            <span className={b.cls}>{b.s}</span>
                          </div>
                          <div
                            role="cell"
                            className="tc"
                            style={{ textAlign: "right" }}
                          >
                            <button
                              type="button"
                              className="btn-link"
                              style={{ fontSize: "13px" }}
                              onClick={toastSoon}
                            >
                              Tải PDF
                            </button>
                          </div>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}

          {/* ============ PAGE: MEMBERS ============ */}

          {Boolean(pg.members) && (
            <>
              <div
                className="fade"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <h1
                      className="h"
                      style={{ fontSize: "28px", lineHeight: "34px" }}
                    >
                      Thành viên
                    </h1>
                    <p className="muted" style={{ margin: "4px 0 0" }}>
                      Người có quyền vào Console của Minh test.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-p"
                    onClick={toastSoon}
                  >
                    Mời thành viên
                  </button>
                </div>
                <section
                  className="card"
                  style={{ padding: "8px 20px 12px", overflowX: "auto" }}
                >
                  <div
                    role="table"
                    aria-label="Thành viên"
                    style={{ minWidth: "680px" }}
                  >
                    <div
                      role="row"
                      className="trow"
                      style={{
                        gridTemplateColumns:
                          "minmax(220px, 1.6fr) 140px 170px 130px",
                      }}
                    >
                      <div role="columnheader" className="thc">
                        Thành viên
                      </div>
                      <div role="columnheader" className="thc">
                        Vai trò
                      </div>
                      <div role="columnheader" className="thc">
                        Trạng thái
                      </div>
                      <div role="columnheader" className="thc"></div>
                    </div>

                    {members?.map((m: any, idx_m: number) => (
                      <React.Fragment key={idx_m}>
                        <div
                          role="row"
                          className="trow b"
                          style={{
                            gridTemplateColumns:
                              "minmax(220px, 1.6fr) 140px 170px 130px",
                          }}
                        >
                          <div role="cell" className="tc">
                            <div style={{ fontWeight: "600" }}>{m.n}</div>
                            <div
                              className="muted mono"
                              style={{ fontSize: "12px" }}
                            >
                              {m.e}
                            </div>
                          </div>
                          <div role="cell" className="tc">
                            {m.r}
                          </div>
                          <div role="cell" className="tc">
                            <span className={m.cls}>{m.s}</span>
                          </div>
                          <div
                            role="cell"
                            className="tc"
                            style={{ textAlign: "right" }}
                          >
                            <button
                              type="button"
                              className="btn btn-s btn-sm"
                              onClick={toastSoon}
                            >
                              Đổi vai trò
                            </button>
                          </div>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </section>
                <section className="card" style={{ padding: "20px" }}>
                  <h2 className="h" style={{ fontSize: "16px" }}>
                    Vai trò
                  </h2>
                  <dl
                    style={{
                      display: "grid",
                      gridTemplateColumns: "160px 1fr",
                      gap: "8px 12px",
                      margin: "10px 0 0",
                      fontSize: "13px",
                    }}
                  >
                    <dt style={{ fontWeight: "600" }}>Owner</dt>
                    <dd className="muted" style={{ margin: "0" }}>
                      Toàn quyền, gồm thanh toán và xem nội dung logs.
                    </dd>
                    <dt style={{ fontWeight: "600" }}>Developer</dt>
                    <dd className="muted" style={{ margin: "0" }}>
                      Tạo, xoay key; cấp quyền dịch vụ; xem logs đã che nội
                      dung.
                    </dd>
                    <dt style={{ fontWeight: "600" }}>Kế toán</dt>
                    <dd className="muted" style={{ margin: "0" }}>
                      Xem usage, hoá đơn; nạp credit.
                    </dd>
                  </dl>
                </section>
              </div>
            </>
          )}
        </main>

        {/* ============ MODAL: GRANT ============ */}

        {Boolean(grantOpen) && (
          <>
            <div className="overlay" onClick={closeModal}>
              <div
                className="modal fade"
                role="dialog"
                aria-modal="true"
                aria-labelledby="grant-title"
                onClick={stop}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <h2
                    id="grant-title"
                    className="h"
                    style={{ fontSize: "18px" }}
                  >
                    Quyền dịch vụ · {grantKeyName}
                  </h2>
                  <button
                    type="button"
                    className="iconbtn"
                    onClick={closeModal}
                    aria-label="Đóng"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M6 6l12 12M18 6L6 18"></path>
                    </svg>
                  </button>
                </div>
                <p
                  className="muted"
                  style={{ margin: "6px 0 0", fontSize: "13px" }}
                >
                  Mỗi ô là một scope{" "}
                  <span className="mono">kỹ_năng.dịch_vụ</span>.
                </p>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    marginTop: "14px",
                  }}
                >
                  {grantRows?.map((g: any, idx_g: number) => (
                    <React.Fragment key={idx_g}>
                      <div
                        className={g.cls}
                        style={{ flexDirection: "column", gap: "6px" }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            width: "100%",
                          }}
                        >
                          <span style={{ fontWeight: "600" }}>{g.name}</span>
                          <span
                            className="pill p-neu"
                            style={{ marginLeft: "auto" }}
                          >
                            {g.countText}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(120px, 1fr))",
                            gap: "2px 8px",
                            width: "100%",
                          }}
                        >
                          {g.skills?.map((x: any, idx_x: number) => (
                            <React.Fragment key={idx_x}>
                              <label className="skl">
                                <input
                                  className="cb"
                                  type="checkbox"
                                  checked={x.on}
                                  onChange={x.toggle}
                                />
                                <span>{x.label}</span>
                              </label>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "8px",
                    marginTop: "18px",
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-s"
                    onClick={closeModal}
                  >
                    Huỷ
                  </button>
                  <button
                    type="button"
                    className="btn btn-p"
                    onClick={saveGrant}
                  >
                    Lưu quyền
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ============ MODAL: CREATE KEY ============ */}

        {Boolean(createOpen) && (
          <>
            <div className="overlay" onClick={closeModal}>
              <div
                className="modal fade"
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-title"
                onClick={stop}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <h2
                    id="create-title"
                    className="h"
                    style={{ fontSize: "18px" }}
                  >
                    Tạo API key
                  </h2>
                  <button
                    type="button"
                    className="iconbtn"
                    onClick={closeModal}
                    aria-label="Đóng"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M6 6l12 12M18 6L6 18"></path>
                    </svg>
                  </button>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                    marginTop: "16px",
                  }}
                >
                  <div>
                    <label className="flabel" htmlFor="nk-name">
                      Tên key
                    </label>
                    <input
                      id="nk-name"
                      className="inp inp-t"
                      value={newName}
                      onChange={onNewName}
                      placeholder="VD: Wispace Production"
                    />
                  </div>
                  <div>
                    <div className="flabel">Môi trường</div>
                    <div className="seg" role="group" aria-label="Môi trường">
                      {newEnvOpts?.map((o: any, idx_o: number) => (
                        <React.Fragment key={idx_o}>
                          <button
                            type="button"
                            className={o.cls}
                            aria-pressed={o.on}
                            onClick={o.pick}
                          >
                            {o.label}
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flabel">Hạn dùng</div>
                    <div className="seg" role="group" aria-label="Hạn dùng">
                      {newExpOpts?.map((o: any, idx_o: number) => (
                        <React.Fragment key={idx_o}>
                          <button
                            type="button"
                            className={o.cls}
                            aria-pressed={o.on}
                            onClick={o.pick}
                          >
                            {o.label}
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                  <div className="muted" style={{ fontSize: "13px" }}>
                    Quyền dịch vụ và kỹ năng cấp ngay sau khi tạo.
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "8px",
                    marginTop: "18px",
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-s"
                    onClick={closeModal}
                  >
                    Huỷ
                  </button>
                  <button
                    type="button"
                    className="btn btn-p"
                    onClick={submitCreate}
                    disabled={newNameEmpty}
                  >
                    Tạo key
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ============ MODAL: REVEAL SECRET ============ */}

        {Boolean(revealOpen) && (
          <>
            <div className="overlay">
              <div
                className="modal fade"
                role="dialog"
                aria-modal="true"
                aria-labelledby="reveal-title"
              >
                <h2
                  id="reveal-title"
                  className="h"
                  style={{ fontSize: "18px" }}
                >
                  Lưu key này ngay
                </h2>
                <p className="muted" style={{ margin: "6px 0 14px" }}>
                  Key chỉ hiện một lần. Nếu mất, bạn phải xoay key mới.
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                    background: "#14152B",
                    borderRadius: "12px",
                    padding: "10px 10px 10px 14px",
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      flex: "1",
                      color: "#F3F3FA",
                      fontSize: "13px",
                      wordBreak: "break-all",
                    }}
                  >
                    {revealKey}
                  </span>
                  <button
                    type="button"
                    className="btn btn-s btn-sm"
                    onClick={copyReveal}
                  >
                    Copy
                  </button>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "8px",
                    marginTop: "18px",
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-p"
                    onClick={closeReveal}
                  >
                    {revealCta}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {Boolean(hasToast) && (
          <>
            <div className="toast fade" role="status">
              {toast}
            </div>
          </>
        )}
      </div>
    );
  }
}
