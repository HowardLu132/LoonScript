var rawBody = $response.body;

// 删除前缀 "while(1);" 或 "while (1) {}"
var body = rawBody.replace(/^while\s*\(1\)\s*[{;}]*\s*/, "");

try {
  var obj = JSON.parse(body);

  // 强制订阅状态
  obj.entitlement.status = "subscriber";

  // 模拟订阅信息
  obj.entitlement.current_subs = {
    "product_id": "lightroom",
    "store": "adobe",
    "purchase_date": "2019-10-10T16:32:10.254954Z", // 固定一个时间
    "sao": {
      "inpkg_LRMC": "1"  // Lightroom Mobile/CC 核心订阅包
    }
  };

  // 设定存储额度为 ~50GB（和真实订阅一致）
  obj.entitlement.storage = {
    "used": 0,
    "limit": 56371445760,        // ~52.5 GB
    "display_limit": 53687091200, // 50 GB
    "warn": 42949672960           // 40 GB
  };

  // 保持头像正常
  if (!obj.avatar) obj.avatar = {};
  obj.avatar.placeholder = false;

  $done({ body: JSON.stringify(obj) });

} catch (e) {
  console.log("❌ JSON 解析失败:", e.message);
  $done({ body: rawBody });
}
