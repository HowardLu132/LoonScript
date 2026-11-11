(function () {
    var USED = 123456789012;

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
    if (!obj.entitlement.storage || typeof obj.entitlement.storage !== "object") return $done({});

    var before = obj.entitlement.storage.used;
    if (before === USED) return $done({});

    obj.entitlement.storage.used = USED;

    var body = JSON.stringify(obj);
    if (prefix) body = prefix + body;

    try { console.log("[LR10] storage.used " + before + " -> " + USED + " (其余字段未改动)"); } catch (e) {}

    $done({ body: body });
})();
