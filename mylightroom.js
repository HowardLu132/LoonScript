(function () {
    var STATUS = "subscriber";

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

    if (ent.status !== STATUS) {
        hits.push("status " + ent.status + " -> " + STATUS);
        ent.status = STATUS;
    }

    if (ent.expired_date !== undefined) {
        delete ent.expired_date;
        hits.push("expired_date 删除");
    }

    if (ent.deletion_date !== undefined) {
        delete ent.deletion_date;
        hits.push("deletion_date 删除");
    }

    if (hits.length === 0) return $done({});

    var body = JSON.stringify(obj);
    if (prefix) body = prefix + body;

    try { console.log("[LR6] " + hits.join(" | ")); } catch (e) {}
    $done({ body: body });
})();
