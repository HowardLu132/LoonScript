(function () {
    var RECIPE = 1;

    var BASE = [
        "inpkg_CCES", "inpkg_CCLE", "inpkg_CCSN", "inpkg_CCSV",
        "inpkg_LCCC", "inpkg_LPES", "inpkg_LRBRL", "inpkg_LRMAC",
        "inpkg_LRMC", "inpkg_LRMP", "inpkg_LRTB", "inpkg_PHLT",
        "inpkg_PHLT2", "inpkg_PLES"
    ];

    var RECIPES = {
        1: ["inpkg_CCLE"],
        2: ["inpkg_LRMP"],
        3: ["inpkg_CCLE", "inpkg_LRMP", "inpkg_LRMC"]
    };

    function buildSao() {
        var sao = {};
        var i;
        for (i = 0; i < BASE.length; i++) sao[BASE[i]] = "0";
        sao.storage_quota = "100";
        var on = RECIPES[RECIPE] || RECIPES[1];
        for (i = 0; i < on.length; i++) sao[on[i]] = "1";
        return sao;
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

    if (!obj.entitlement || typeof obj.entitlement !== "object") return $done({});

    var ent = obj.entitlement;
    var hits = [];

    if (ent.status !== "subscriber") {
        hits.push("entitlement.status " + ent.status + " -> subscriber");
        ent.status = "subscriber";
    }

    obj.current_subs = {
        product_id: "lightroom",
        store: "adobe",
        purchase_date: "2019-10-10T16:32:10.254954Z",
        sao: buildSao()
    };
    hits.push("顶层 current_subs 注入（recipe " + RECIPE + "）");

    if (!ent.storage || typeof ent.storage !== "object") ent.storage = {};
    if (ent.storage.used !== 0) {
        hits.push("storage.used " + ent.storage.used + " -> 0");
        ent.storage.used = 0;
    }
    if (!(ent.storage.limit > 0)) ent.storage.limit = 1154487209165;
    if (!(ent.storage.display_limit > 0)) ent.storage.display_limit = 1099511627776;
    if (!(ent.storage.warn > 0)) ent.storage.warn = 992137445376;

    if (obj.avatar && typeof obj.avatar === "object") obj.avatar.placeholder = true;

    var body = JSON.stringify(obj);
    if (prefix) body = prefix + body;

    try { console.log("[LR11] " + hits.join(" | ")); } catch (e) {}

    $done({ body: body });
})();
