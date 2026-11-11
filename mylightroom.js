(function () {
    var STATUS = "subscriber";
    var SUB_YEARS = 10;
    var BUMP_CONFIG = true;
    var DEBUG = true;

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

    var CONFIG_BUMP = {
        max_albums_per_catalog: 9999,
        max_spaces_for_shortening_urls: 999999
    };

    var now = new Date();
    var futureMs = now.getTime() + SUB_YEARS * 365 * 24 * 3600 * 1000;
    var hits = [];

    function log() {
        if (!DEBUG) return;
        try { console.log("[LR4] " + Array.prototype.slice.call(arguments).join(" ")); } catch (e) {}
    }

    function fixAccount(obj) {
        var ent = obj.entitlement;
        var k;

        if (ent.status !== STATUS) {
            hits.push("entitlement.status " + ent.status + " -> " + STATUS);
            ent.status = STATUS;
        }

        var subs = (ent.current_subs && typeof ent.current_subs === "object") ? ent.current_subs : {};
        if (!subs.product_id) subs.product_id = "lightroom";
        if (!subs.store) subs.store = "adobe";
        if (!subs.purchase_date) subs.purchase_date = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();

        var oldSao = (subs.sao && typeof subs.sao === "object") ? subs.sao : {};
        var saoBefore = JSON.stringify(oldSao);
        var sao = {};
        for (k in oldSao) {
            if (Object.prototype.hasOwnProperty.call(oldSao, k)) sao[k] = oldSao[k];
        }
        for (k in SAO) {
            if (Object.prototype.hasOwnProperty.call(SAO, k)) sao[k] = SAO[k];
        }
        subs.sao = sao;
        if (JSON.stringify(sao) !== saoBefore) {
            hits.push("current_subs.sao " + Object.keys(oldSao).length + " -> " + Object.keys(sao).length);
        }

        ent.current_subs = subs;
        if (obj.current_subs === undefined) {
            obj.current_subs = subs;
            hits.push("current_subs 顶层补写");
        }

        if (ent.expired_date !== undefined) {
            delete ent.expired_date;
            hits.push("expired_date 删除");
        }
        if (ent.deletion_date !== undefined) {
            delete ent.deletion_date;
            hits.push("deletion_date 删除");
        }

        var st = (ent.storage && typeof ent.storage === "object") ? ent.storage : {};
        st.used = Number(st.used) || 0;
        if (!(st.limit > 0)) st.limit = 1154487209165;
        if (!(st.display_limit > 0)) st.display_limit = 1099511627776;
        if (!(st.warn > 0)) st.warn = 992137445376;
        ent.storage = st;
    }

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
            if (pa && (pa.family === "LIGHTROOM_MOBILE" || /lightroom_mobile/i.test(String(pa.code || "")))) return true;
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
                hits.push("subscriptions[" + i + "].status " + s.status + " -> ACTIVE");
                s.status = "ACTIVE";
            }
            var endMs = (typeof s.end_timestamp === "number") ? s.end_timestamp : 0;
            if (endMs < now.getTime()) {
                hits.push("subscriptions[" + i + "].end_timestamp 延期");
                s.end_timestamp = futureMs;
            }
            if (isLrmOffer(s)) hasLrm = true;
        }

        if (!hasLrm) {
            subs.push(lrmSub(ownerId));
            hits.push("注入 LRM 套餐");
        }
        cp.subscriptions = subs;
    }

    function fixConfig(obj) {
        if (!BUMP_CONFIG) return;
        var cfg = obj.config;
        if (!cfg || typeof cfg !== "object") return;
        for (var k in CONFIG_BUMP) {
            if (!Object.prototype.hasOwnProperty.call(CONFIG_BUMP, k)) continue;
            if (cfg[k] === undefined) continue;
            if (!(Number(cfg[k]) >= CONFIG_BUMP[k])) {
                hits.push("config." + k + " " + cfg[k] + " -> " + CONFIG_BUMP[k]);
                cfg[k] = (typeof cfg[k] === "string") ? String(CONFIG_BUMP[k]) : CONFIG_BUMP[k];
            }
        }
    }

    var raw = $response && $response.body;
    if (typeof raw !== "string" || raw.length === 0) return $done({});

    var PREFIX_RE = /^(\s*(?:while\s*\(\s*(?:1|true)\s*\)\s*\{\s*\}\s*;?|for\s*\(\s*;\s*;\s*\)\s*(?:\{\s*\}\s*)?;?|\)\]\}'\s*))/i;
    var pm = raw.match(PREFIX_RE);
    var prefix = pm ? pm[1] : "";
    var jsonStr = (pm ? raw.slice(prefix.length) : raw).replace(/^\uFEFF/, "").trim();

    if (jsonStr.charAt(0) !== "{") return $done({});

    var obj;
    try {
        obj = JSON.parse(jsonStr);
    } catch (e) {
        return $done({});
    }

    if (obj.entitlement && typeof obj.entitlement === "object" &&
        (obj.entitlement.status !== undefined || obj.entitlement.current_subs !== undefined ||
            obj.entitlement.storage !== undefined || obj.type === "account")) {
        fixAccount(obj);
    }

    if (obj.commerce_profile && typeof obj.commerce_profile === "object") {
        fixCommerce(obj);
    }

    if (obj.config && typeof obj.config === "object") {
        fixConfig(obj);
    }

    if (hits.length === 0) return $done({});

    var body;
    try {
        body = JSON.stringify(obj);
    } catch (e) {
        return $done({});
    }
    if (prefix) body = prefix + body;

    log("命中 " + hits.length + " 处：" + hits.join(" | "));
    $done({ body: body });
})();
