let body = $response.body;
let jsonStr = body.replace(/^while\s*\(\s*1\s*\)\s*\{\s*\}\s*/i, '').trim();
let obj;
try {
    obj = JSON.parse(jsonStr);
} catch (e) {
    $done({});
}
if (obj && obj.entitlement) {
    const now = new Date();
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    obj.entitlement = {
        status: "trial",
        trial: {
            start: start.toISOString(),
            end: end.toISOString()
        },
        storage: {
            used: obj.entitlement.storage?.used || 0,
            limit: 0,
            display_limit: 0,
            warn: 0
        }
    };
    delete obj.entitlement.expired_date;
    delete obj.entitlement.deletion_date;
    obj.updated = now.toISOString();
}
body = "while (1) {}\n" + JSON.stringify(obj);
$done({ body });
