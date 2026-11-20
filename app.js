// そらのツール箱 共通スクリプト：金額の読みやすい表示・給与明細の集計シート・ツール間のデータ共有
(function () {
  const SHARED = "sora.shared.2026", SLIP = "sora.payslip.2026";
  const num = v => { const x = Number(v); return isFinite(x) ? x : 0; };
  const yen = v => Math.round(v).toLocaleString("ja-JP");
  function readable(v) {
    const x = Math.round(num(v)); if (!x) return "";
    const a = Math.abs(x), sign = x < 0 ? "−" : "";
    if (a < 10000) return sign + a.toLocaleString("ja-JP") + "円";
    const man = Math.floor(a / 10000), rest = a % 10000;
    return sign + man.toLocaleString("ja-JP") + "万" + (rest ? rest.toLocaleString("ja-JP") : "") + "円";
  }
  const load = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  // ---- 金額入力の下に「494万2,724円」と表示 ----
  function isMoney(el) {
    return el.type === "number" && el.getAttribute("inputmode") === "numeric" && !el.hasAttribute("data-nomoney")
      && Number(el.getAttribute("step") || 1) >= 10;
  }
  function hintFor(el) {
    let h = el.nextElementSibling;
    if (!h || !h.classList || !h.classList.contains("yen-hint")) {
      const box = document.createElement("span"); box.className = "inp";
      el.parentNode.insertBefore(box, el); box.appendChild(el);
      h = document.createElement("span"); h.className = "yen-hint"; box.appendChild(h);
    }
    return h;
  }
  function refresh(root) {
    (root || document).querySelectorAll("input[type=number]").forEach(el => {
      if (!isMoney(el)) return;
      hintFor(el).textContent = readable(el.value);
    });
  }
  document.addEventListener("input", e => { const el = e.target; if (el && el.matches && el.matches("input[type=number]") && isMoney(el)) hintFor(el).textContent = readable(el.value); }, true);
  let raf = 0;
  new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => refresh()); })
    .observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", () => refresh());
  setTimeout(() => refresh(), 300);

  // ---- ツール間で共有する基本情報（給与・家族・保険・払戻金）----
  const SHARE_KEYS = ["salary", "socialInsurance", "withheld", "selfDisability", "selfStatus", "selfStudent", "housingLoan", "spouse", "dependents", "insurance", "other"];
  function saveShared(state, from) {
    const s = load(SHARED) || {};
    SHARE_KEYS.forEach(k => { if (state[k] !== undefined) s[k] = JSON.parse(JSON.stringify(state[k])); });
    s._from = from; s._at = Date.now(); store(SHARED, s);
  }
  function getShared() { return load(SHARED); }

  // ---- 給与明細の集計シート ----
  const css = `
.slip{position:fixed;inset:0;z-index:60;background:var(--bg);display:none;flex-direction:column}
.slip.on{display:flex}
.slip-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:calc(env(safe-area-inset-top) + 10px) 16px 10px;background:#fff;border-bottom:1px solid var(--line)}
.slip-bar b{font-size:16px}
.slip-bar button{font:inherit;font-size:15px;font-weight:600;border:0;background:none;color:var(--primary);cursor:pointer}
.slip-body{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:12px 12px 20px}
.slip-body .lead2{font-size:12.5px;color:var(--sub);line-height:1.7;margin:2px 4px 10px}
.slip-grid{background:#fff;border:1px solid var(--line);border-radius:var(--r-lg);padding:4px 10px 8px;max-width:600px;margin:0 auto}
.slip-row{display:grid;grid-template-columns:44px 1fr 1fr 1fr;gap:6px;align-items:center;padding:5px 0;border-top:1px solid var(--line)}
.slip-row:first-child{border-top:none}
.slip-row.head{font-size:11px;color:var(--faint);font-weight:600;text-align:right}
.slip-row.head span:first-child{text-align:left}
.slip-row label{font-size:13px;font-weight:600}
.slip-row input{width:100%;font-size:15px;padding:8px 6px}
.slip-row.est input{background:#fff;border:1px dashed var(--line);color:var(--faint)}
.slip-sep{font-size:12px;font-weight:700;color:var(--sub);padding:12px 0 4px}
.slip-opt{display:flex;align-items:center;gap:8px;font-size:13px;padding:10px 0 2px}
.slip-ot{display:grid;grid-template-columns:1fr 130px;gap:10px;align-items:center;padding:9px 0;border-top:1px solid var(--line)}
.slip-ot label{font-size:13px;font-weight:600}
.slip-ot small{display:block;font-size:11px;color:var(--faint);font-weight:400;margin-top:2px;line-height:1.4}
.slip-ot input{width:100%}
.slip-ot .inp{width:100%}
.slip-sum{position:sticky;bottom:0;background:#fff;border-top:1px solid var(--line);padding:12px 16px calc(12px + env(safe-area-inset-bottom))}
.slip-sum .in{max-width:600px;margin:0 auto}
.slip-sum table{font-size:13px;margin-bottom:10px}
.inp{display:inline-flex;flex-direction:column;align-items:flex-end;gap:2px}
.yen-hint{font-size:11px;color:var(--faint);font-variant-numeric:tabular-nums;min-height:14px;line-height:14px}
.slip-open{display:flex;width:100%;align-items:center;justify-content:center;font:inherit;font-size:14px;font-weight:600;border:1px solid #B9C7DD;border-radius:var(--r-md);padding:11px;background:#fff;color:var(--primary);margin:4px 0 4px;cursor:pointer}
`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  function payslip(opts) {
    opts = opts || {};
    let d = load(SLIP) || {};
    d.months = d.months || Array.from({ length: 12 }, () => ({}));
    d.bonus = d.bonus || [{}, {}, {}];
    if (d.decSame === undefined) d.decSame = true;
    const el = document.createElement("div"); el.className = "slip on";
    const cell = (k, i, f, v) => `<input type="number" inputmode="numeric" step="1" data-nomoney data-k="${k}" data-i="${i}" data-f="${f}" value="${v || ""}">`;
    const rows = d.months.map((m, i) => `<div class="slip-row" data-m="${i}"><label>${i + 1}月</label>${cell("months", i, "pay", m.pay)}${cell("months", i, "si", m.si)}${cell("months", i, "tax", m.tax)}</div>`).join("");
    const brows = d.bonus.map((m, i) => `<div class="slip-row"><label>賞与${i + 1}</label>${cell("bonus", i, "pay", m.pay)}${cell("bonus", i, "si", m.si)}${cell("bonus", i, "tax", m.tax)}</div>`).join("");
    el.innerHTML = `<div class="slip-bar"><button type="button" data-x>閉じる</button><b>給与明細から集計</b><span style="width:52px"></span></div>
      <div class="slip-body">
        <p class="lead2">明細ごとに<b>課税される支給額</b>（総支給額−通勤手当などの非課税分）、<b>社会保険料</b>（健康保険・介護・子育て支援金・厚生年金・雇用保険の合計）、<b>所得税</b>を入れます。住民税は入れません。入力はこの端末に保存され、ほかのツールでも使えます。</p>
        <div class="slip-grid">
          <div class="slip-row head"><span>月</span><span>支給額</span><span>社会保険料</span><span>所得税</span></div>
          ${rows}
          <div class="slip-sep">賞与（ボーナス）</div>
          ${brows}
          <label class="slip-opt"><input type="checkbox" id="slipDec" ${d.decSame ? "checked" : ""}> 未入力の月は、入力済みの最後の月をもとに見込む</label>
          <div id="slipOt">
            <div class="slip-ot"><label><span id="otLastLabel">最後の月</span>の残業代<small>明細の「割増手当」「残業手当」などの合計</small></label><input type="number" inputmode="numeric" step="100" id="otLast" value="${d.otLast || ""}"></div>
            <div class="slip-ot"><label>見込む月の残業代（1か月あたり）<small>残業がなければ0。基本給・手当は最後の月と同じで計算します</small></label><input type="number" inputmode="numeric" step="100" id="otEst" value="${d.otEst || ""}"></div>
          </div>
        </div>
      </div>
      <div class="slip-sum"><div class="in"><table id="slipTotal"></table><button class="btn" type="button" data-apply style="width:100%">この合計を入力する</button></div></div>`;
    document.body.appendChild(el);
    document.body.style.overflow = "hidden";
    function totals() {
      const filled = d.months.map(m => num(m.pay) > 0);
      const last = filled.lastIndexOf(true);
      let pay = 0, si = 0, tax = 0, est = 0;
      d.months.forEach((m, i) => {
        if (!filled[i] && d.decSame && last >= 0 && i > last) {
          const L = d.months[last], lp = num(L.pay);
          const ep = Math.max(0, lp - num(d.otLast) + num(d.otEst));
          const base = lp - num(L.si), eb = ep - num(L.si);
          pay += ep; si += num(L.si); tax += base > 0 ? Math.round(num(L.tax) * Math.max(0, eb) / base / 10) * 10 : num(L.tax); est++;
          return;
        }
        pay += num(m.pay); si += num(m.si); tax += num(m.tax);
      });
      d.bonus.forEach(b => { pay += num(b.pay); si += num(b.si); tax += num(b.tax); });
      return { pay, si, tax, est, last };
    }
    function paint() {
      const t = totals();
      const showOt = d.decSame && t.last >= 0 && t.last < 11;
      el.querySelector("#slipOt").style.display = showOt ? "" : "none";
      if (showOt) el.querySelector("#otLastLabel").textContent = (t.last + 1) + "月";
      el.querySelectorAll(".slip-row[data-m]").forEach((r, i) => r.classList.toggle("est", d.decSame && t.last >= 0 && i > t.last && !(num(d.months[i].pay) > 0)));
      el.querySelector("#slipTotal").innerHTML =
        `<tr><td>給与・賞与の合計${t.est ? `（${t.est}か月分は見込み）` : ""}</td><td>${yen(t.pay)}円</td></tr>
         <tr><td>社会保険料の合計</td><td>${yen(t.si)}円</td></tr>
         <tr><td>所得税の合計</td><td>${yen(t.tax)}円</td></tr>`;
    }
    el.addEventListener("input", e => {
      const i = e.target.dataset; if (!i.k || !d[i.k]) return;
      d[i.k][+i.i][i.f] = e.target.value === "" ? "" : Number(e.target.value); store(SLIP, d); paint();
    });
    ["otLast", "otEst"].forEach(id => el.querySelector("#" + id).addEventListener("input", e => { d[id] = e.target.value === "" ? "" : Number(e.target.value); store(SLIP, d); paint(); }));
    el.querySelector("#slipDec").onchange = e => { d.decSame = e.target.checked; store(SLIP, d); paint(); };
    const close = () => { el.remove(); document.body.style.overflow = ""; };
    el.querySelector("[data-x]").onclick = close;
    el.querySelector("[data-apply]").onclick = () => { const t = totals(); close(); if (opts.onApply) opts.onApply(t); };
    paint();
  }

  // ---- noteのフォロー案内（各ツールの一番下）----
  const NOTE_URL = "https://note.com/tmsora8496";
  function followCard() {
    const wrap = document.querySelector(".wrap");
    if (!wrap || document.getElementById("soraFollow")) return;
    const d = document.createElement("aside");
    d.id = "soraFollow"; d.className = "follow no-print";
    d.innerHTML = '<div><b>新しいツールはnoteでお知らせしています</b><span>税金や手続きのルールが変わったときの更新情報も、noteに書いています。</span></div><a href="' + NOTE_URL + '" target="_blank" rel="noopener">noteでフォローする</a>';
    wrap.appendChild(d);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", followCard); else followCard();

  window.SoraUI = { readable, refresh, payslip, saveShared, getShared };
})();
