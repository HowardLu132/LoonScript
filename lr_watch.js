/*
 * lr_watch.js — 只监听、绝不改写的探针
 *
 * 作用：你点一下"高级版功能"，凡是 Adobe 域名下返回 4xx/5xx 的请求，
 *       或者响应体里出现 entitlement / premium / subscription / credit / license 字样的请求，
 *       直接在手机上弹通知 + 写日志，告诉你「到底是哪个接口把功能挡回去了」。
 *
 * 装法见 lightroom_watch.plugin
 *
 * 输出示例：
 *   [LRW] 403 https://lrmobile.adobe.io/v1/premium/check  {"error_code":"NO_ENTITLEMENT"}
 */

(function () {
    var NOTIFY = true;
    var LOG = true;
    var INTEREST = /entitle|premium|subscri|capabilit|license|licence|credit|firefly|quota|paywall/i;
    var NOISE = /(adobedc\.net|demdex\.net|everesttech\.net|2o7\.net|omtrdc\.net|\/ee\/v2\/interact|\.gif|\.png|\.jpg|\.css|\.woff)/i;

    var THROTTLE_MS = 1500;
    var KEY = "lrwatch_last";

    var store = (typeof $persistentStore !== "undefined" && $persistentStore) ? $persistentStore
        : (typeof $prefs !== "undefined" && $prefs) ? {
            read: function (k) { return $prefs.valueForKey(k); },
            write: function (v, k) { $prefs.setValueForKey(v, k); }
        } : null;

    function log() {
        if (!LOG) return;
        try { console.log("[LRW] " + Array.prototype.slice.call(arguments).join(" ")); } catch (e) {}
    }

    function notify(t, s, b) {
        if (!NOTIFY) return;
        try { $notification.post(t, s, b); } catch (e) {}
    }

    function throttled() {
        var t = Date.now();
        var last = 0;
        try { last = Number(store ? store.read(KEY) : 0) || 0; } catch (e) { last = 0; }
        if (t - last < THROTTLE_MS) return true;
        try { if (store) store.write(String(t), KEY); } catch (e) {}
        return false;
    }

    var url = ($request && $request.url) || "";
    if (!url || NOISE.test(url)) return $done({});

    var body = ($response && $response.body) || "";
    var code = 0;
    try { code = Number(($response && ($response.status || $response.statusCode)) || 0) || 0; } catch (e) {}

    var m = url.match(/^https?:\/\/([^\/]+)(\/[^?#]*)?/i);
    var host = m ? m[1] : url;
    var path = (m && m[2]) ? m[2] : "/";

    var snippet = "";
    if (typeof body === "string") {
        snippet = body.length > 400 ? body.slice(0, 400) : body;
        snippet = snippet.replace(/\s+/g, " ");
    }

    var isErr = code >= 400;
    var isInteresting = typeof body === "string" && INTEREST.test(body);

    // 排除已经处理好的 account 报文，避免刷屏
    var isAccount = /photos\.adobe\.io\/v2\/accounts/i.test(url);

    if (isErr && !isAccount) {
        log(code + " " + url + "  " + snippet);
        if (!throttled()) {
            notify("LR 被拦：" + code, host + path, snippet.slice(0, 160));
        }
    } else if (isInteresting && !isAccount) {
        log(code + " " + url + "  " + snippet);
        if (!throttled()) {
            notify("LR 授权相关：" + (code || "?"), host + path, snippet.slice(0, 160));
        }
    }

    $done({});   // 原样放行
})();
