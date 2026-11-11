/*
 * my.fixed.js — entitlement / trial 响应改写（Surge / Loon / QuantumultX / Shadowrocket / Stash 通用）
 *
 * 触发：http-response + requires-body=1（Loon: requires-body=true / QX: script-response-body）
 * 输入：$response.body（字符串）
 * 输出：改写后的 JSON，**保留原始反 hijack 前缀**（原来有 `while (1) {}` 就一直有）
 *
 * 修掉的坑：
 *  1. try/catch 里 $done({}) 后没有 return —— 后面会继续执行，把 body 拼成 "while (1) {}\nundefined"
 *  2. 原响应没有前缀时也强行加前缀 —— 客户端若用严格 JSON.parse 会直接解析失败
 *  3. $response.body 为空 / 非字符串时 .replace 直接抛异常
 *  4. 原脚本一把删掉 entitlement 里除 status/trial/storage 之外的全部字段（plan、capabilities、product_id…），
 *     客户端一旦读这些字段就白屏；改为“保留原有字段，只覆盖关键字段”
 *  5. storage.limit = 0 在很多 API 里表示“0 字节可用”，不是“不限”；改成 -1（不限），并保留原值兜底
 *
 * 兼容性：不用 ?. / ?? / 箭头函数以外的 ES2020 语法，iOS 12+ JSC 与 QX 老内核都能跑。
 */

(function () {
    var TRIAL_DAYS = 7;

    /* 常见反 hijack 前缀：while(1){}  /  while(true){}  /  for(;;)  /  )]}' */
    var PREFIX_RE = /^(\s*(?:while\s*\(\s*(?:1|true)\s*\)\s*\{\s*\}\s*;?|for\s*\(\s*;\s*;\s*\)\s*(?:\{\s*\}\s*)?;?|\)\]\}'\s*))/i;

    function passThrough() {
        $done({});   // 不改动原响应
    }

    var raw = $response && $response.body;
    if (typeof raw !== "string" || raw.length === 0) {
        return passThrough();
    }

    var m = raw.match(PREFIX_RE);
    var prefix = m ? m[1] : "";
    var jsonStr = (m ? raw.slice(prefix.length) : raw).replace(/^\uFEFF/, "").trim();

    var obj;
    try {
        obj = JSON.parse(jsonStr);
    } catch (e) {
        return passThrough();
    }

    if (!obj || typeof obj !== "object" || !obj.entitlement || typeof obj.entitlement !== "object") {
        // 结构不符合预期：不动它，避免把别的接口打坏
        return passThrough();
    }

    var now = new Date();
    var start = new Date(now.getTime() - 24 * 60 * 60 * 1000);            // 昨天开始
    var end = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000); // 7 天后结束

    var old = obj.entitlement;
    var oldStorage = (old.storage && typeof old.storage === "object") ? old.storage : {};

    var next = {};

    // 1) 先把原有字段搬过来（保住 plan / capabilities / product_id / features 之类）
    for (var k in old) {
        if (Object.prototype.hasOwnProperty.call(old, k)) {
            next[k] = old[k];
        }
    }

    // 2) 再覆盖关键字段
    next.status = "trial";
    next.trial = {
        start: start.toISOString(),
        end: end.toISOString()
    };
    next.storage = {
        used: Number(oldStorage.used) || 0,
        limit: -1,               // -1 = 不限。若这版 API 用别的哨兵值，改成原 back 端约定值
        display_limit: -1,
        warn: 0
    };

    // 3) 清掉“已过期/待删除”这类会让客户端锁死只读的字段
    delete next.expired_date;
    delete next.deletion_date;
    delete next.expired;
    delete next.is_expired;
    delete next.grace_until;

    obj.entitlement = next;
    obj.updated = now.toISOString();

    var body;
    try {
        body = JSON.stringify(obj);
    } catch (e) {
        return passThrough();
    }

    if (prefix) {
        body = prefix + body;   // 原来有前缀才补，绝不凭空加
    }

    $done({ body: body });
})();
