/*
 * lightroom_v3.js — Adobe Lightroom 授权改写（Loon / Surge / QuantumultX / Stash）
 * 依据真实抓包（photos.adobe.io account + commerce_profile）重写
 *
 * 同时处理两种报文：
 *   A) account 报文：{ ..., "entitlement": { status, trial, current_subs, storage, expired_date, deletion_date } }
 *   B) commerce 报文：{ "commerce_profile": { "subscriptions": [ { status, offer_details, end_timestamp, ... } ] } }
 *
 * 关键改动（对着真实数据改的）：
 *   1. status: "subscription_expired" → "subscriber"
 *      可选值见下方 STATUS，实测 "trial" 只能骗到 UI 倒计时，开不了功能
 *   2. current_subs 里补齐完整 sao 包标志（inpkg_LRMC / inpkg_LRMP …），
 *      真实报文只有 {"inpkg_LRMC":"1"}，功能开关读的是这一组
 *   3. current_subs 在 entitlement 内和顶层各写一份（老脚本发现两条读取路径都存在）
 *   4. 删除 expired_date / deletion_date（你的 deletion_date 还是 2018 年的残留）
 *   5. commerce_profile.subscriptions：status→ACTIVE，end_timestamp 推到 10 年后；
 *      没有 LRM 套餐就注入一条
 *   6. 保留 while (1) {} 前缀（原本有就补回去）
 */

(function () {
    /* ================= 配置 ================= */
    var STATUS = "subscriber";   // 备选: "active_subscription" / "trial" / "subscriber"
    var TRIAL_DAYS = 7;
    var SUB_YEARS = 10;
    var SHOW_TRIAL = true;       // 想让 UI 显示"订阅有效"而不是倒计时，把这里改 false
    var DEBUG = true;

    // 完整 Adobe 包标志（来自 lightroom_old.js，全部打开）
    var SAO = {
        inpkg_CCES: "1",
        inpkg_CCLE: "1",
        inpkg_CCSN: "1",
        inpkg_CCSV: "1",
        inpkg_LCCC: "1",
        inpkg_LPES: "1",
        inpkg_LRBRL: "1",
        inpkg_LRMAC: "1",
        inpkg_LRMC: "1",
        inpkg_LRMP: "1",
        inpkg_LRTB: "1",
        inpkg_PHLT: "1",
        inpkg_PHLT2: "1",
        inpkg_PLES: "1",
        storage_quota: "1024"
    };

    var now = new Date();
    var futureMs = now.getTime() + SUB_YEARS * 365 * 24 * 3600 * 1000;
    var trialStart = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
    var trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 3600 * 1000).toISOString();
    var hits = [];

    function log() {
        if (!DEBUG) return;
        try { console.log("[LR] " + Array.prototype.slice.call(arguments).join(" ")); } catch (e) {}
    }

    /* ================= A) account 报文 ================= */
    function fixAccount(obj) {
        var ent = obj.entitlement;

        var before = ent.status;
        if (before !== STATUS) {
            ent.status = STATUS;
            hits.push("entitlement.status: " + before + " → " + STATUS);
        }

        // --- current_subs + 完整 sao ---
        var subs = (ent.current_subs && typeof ent.current_subs === "object") ? ent.current_subs : {};
        if (!subs.product_id) subs.product_id = "lightroom";
        if (!subs.store) subs.store = "adobe";
        if (!subs.purchase_date) subs.purchase_date = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();

        var oldSao = (subs.sao && typeof subs.sao === "object") ? subs.sao : {};
        var sao = {};
        var k;
        for (k in SAO) {
            if (Object.prototype.hasOwnProperty.call(SAO, k)) sao[k] = SAO[k];
        }
        for (k in oldSao) {                       // 保留原报文里的自定义键
            if (Object.prototype.hasOwnProperty.call(oldSao, k)) sao[k] = oldSao[k];
        }
        for (k in SAO) {                          // 但已知包标志一律打开
            if (Object.prototype.hasOwnProperty.call(SAO, k)) sao[k] = SAO[k];
        }
        subs.sao = sao;
        var saoBefore = JSON.stringify(oldSao);
        var saoAfter = JSON.stringify(sao);
        if (saoBefore !== saoAfter) {
            hits.push("current_subs.sao: " + Object.keys(oldSao).length + " 个键 → " + Object.keys(sao).length + " 个键（全开）");
        }

        ent.current_subs = subs;
        if (obj.current_subs === undefined) {
            obj.current_subs = subs;              // 顶层也放一份，兼容老读取路径
            hits.push("current_subs: entitlement 内 + 顶层 双写");
        }

        // --- trial：只在缺失或已过期时才滚动，保证脚本幂等 ---
        if (SHOW_TRIAL) {
            var tEnd = null;
            if (ent.trial && typeof ent.trial === "object" && typeof ent.trial.end === "string") {
                tEnd = Date.parse(ent.trial.end);
            }
            if (!(tEnd > now.getTime())) {
                ent.trial = { start: trialStart, end: trialEnd };
                hits.push("entitlement.trial → 滚动 " + TRIAL_DAYS + " 天");
            }
        }

        // --- 清过期字段 ---
        if (ent.expired_date !== undefined) { delete ent.expired_date; hits.push("entitlement.expired_date 已删除"); }
        if (ent.deletion_date !== undefined) { delete ent.deletion_date; hits.push("entitlement.deletion_date 已删除"); }

        // --- storage 兜底：只保证上限是正数，不动 used ---
        var st = (ent.storage && typeof ent.storage === "object") ? ent.storage : {};
        st.used = Number(st.used) || 0;
        if (!(st.limit > 0)) {
            hits.push("storage.limit " + st.limit + " → 1154487209165");
            st.limit = 1154487209165;
        }
        if (!(st.display_limit > 0)) st.display_limit = 1099511627776;
        if (!(st.warn > 0)) st.warn = 992137445376;
        ent.storage = st;
    }

    /* ================= B) commerce_profile 报文 ================= */
    function lrmOffer() {
        return {
            customer_segment: "INDIVIDUAL",
            product_arrangement: {
                code: "lightroom_mobile_plan_with_no_storage_individual",
                name: "Lightroom Mobile - Premium features only",
                cloud: "CREATIVE",
                family: "LIGHTROOM_MOBILE"
            },
            buying_program: "RETAIL",
            commitment: "MONTH",
            sales_channel: "INDIRECT",
            market_segments: ["COM"],
            term: "MONTHLY",
            offer_id: "26519320434304621CBBD9F81EF90E16"
        };
    }

    function lrmSub(ownerId) {
        var id = "ZZZLRMPREM" + futureMs;
        return {
            status: "ACTIVE",
            offer_details: [lrmOffer()],
            id: id,
            source: { type: "LICENSE", id: id },
            owner_id: ownerId || "",
            end_timestamp: futureMs,
            grace_period: 2419200000
        };
    }

    function isLrmOffer(s) {
        var od = s && s.offer_details;
        if (!Array.isArray(od)) return false;
        for (var i = 0; i < od.length; i++) {
            var pa = od[i] && od[i].product_arrangement;
            if (pa && (pa.family === "LIGHTROOM_MOBILE" ||
                /lightroom_mobile/i.test(String(pa.code || "")))) return true;
        }
        return false;
    }

    function fixCommerce(obj) {
        var cp = obj.commerce_profile;
        var subs = Array.isArray(cp.subscriptions) ? cp.subscriptions : [];
        var ownerId = "";
        var i;

        for (i = 0; i < subs.length; i++) {
            if (subs[i] && subs[i].owner_id) { ownerId = subs[i].owner_id; break; }
        }

        var hasLrm = false;
        for (i = 0; i < subs.length; i++) {
            var s = subs[i];
            if (!s || typeof s !== "object") continue;

            if (s.status !== "ACTIVE") {
                hits.push("subscriptions[" + i + "].status " + s.status + " → ACTIVE");
                s.status = "ACTIVE";
            }

            var endMs = (typeof s.end_timestamp === "number") ? s.end_timestamp : 0;
            if (endMs < now.getTime()) {
                var d = new Date(endMs).toISOString().slice(0, 10);
                s.end_timestamp = futureMs;
                hits.push("subscriptions[" + i + "].end_timestamp " + d + " → " + futureMs + "（10 年后）");
            }

            if (isLrmOffer(s)) hasLrm = true;
        }

        if (!hasLrm) {
            subs.push(lrmSub(ownerId));
            hits.push("commerce_profile: 注入 lightroom_mobile_plan_with_no_storage_individual");
        }

        cp.subscriptions = subs;
    }

    /* ================= 主流程 ================= */
    var raw = $response && $response.body;
    if (typeof raw !== "string" || raw.length === 0) return $done({});

    var PREFIX_RE = /^(\s*(?:while\s*\(\s*(?:1|true)\s*\)\s*\{\s*\}\s*;?|for\s*\(\s*;\s*;\s*\)\s*(?:\{\s*\}\s*)?;?|\)\]\}'\s*))/i;
    var pm = raw.match(PREFIX_RE);
    var prefix = pm ? pm[1] : "";
    var jsonStr = (pm ? raw.slice(prefix.length) : raw).replace(/^\uFEFF/, "").trim();

    var c0 = jsonStr.charAt(0);
    if (c0 !== "{") return $done({});

    var obj;
    try {
        obj = JSON.parse(jsonStr);
    } catch (e) {
        log("JSON 解析失败，放行");
        return $done({});
    }

    if (obj && obj.entitlement && typeof obj.entitlement === "object" &&
        (obj.entitlement.status !== undefined || obj.entitlement.trial !== undefined ||
            obj.entitlement.storage !== undefined || obj.entitlement.current_subs !== undefined ||
            obj.type === "account")) {
        fixAccount(obj);
    }

    if (obj && obj.commerce_profile && typeof obj.commerce_profile === "object") {
        fixCommerce(obj);
    }

    if (hits.length === 0) return $done({});

    var body;
    try {
        body = JSON.stringify(obj);
    } catch (e) {
        return $done({});
    }
    if (prefix) body = prefix + body;

    log("命中 " + hits.length + " 处：\n  " + hits.join("\n  "));
    $done({ body: body });
})();
