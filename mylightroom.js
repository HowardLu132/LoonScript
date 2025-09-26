// 最终可靠版本 - 基于已订阅响应结构
body = $response.body.replace(/while\s*\(\d+\)\s*{}\s*/, "");

let obj = JSON.parse(body);

// 1. 核心订阅状态修复
obj.entitlement.status = "subscriber";

// 2. 彻底删除所有过期和试用相关字段
delete obj.entitlement.trial;
delete obj.entitlement.deletion_date;
delete obj.entitlement.expired_date;
delete obj.entitlement.invitationSharing;
 

// 3. 按照已订阅响应的结构设置 current_subs（关键差异！）
obj.entitlement.current_subs = {
    "product_id": "lightroom",
    "store": "adobe",
    "purchase_date": "2024-10-10T16:32:10.254954Z",
    "sao": {
       "inpkg_CCES": "0",
        "inpkg_CCLE": "1", 
        "inpkg_CCSN": "0",
        "inpkg_CCSV": "0",
        "inpkg_LCCC": "0",
        "inpkg_LPES": "0",
        "inpkg_LRBRL": "0",
        "inpkg_LRMAC": "0",
        "inpkg_LRMC": "0",
        "inpkg_LRMP": "0",
        "inpkg_LRTB": "0",
        "inpkg_PHLT": "0",
        "inpkg_PHLT2": "0",
        "inpkg_PLES": "0",
        "storage_quota": "100"
    }
};

// 4. 重置存储使用量为0，使用合理的存储限制（参考已订阅响应）
obj.entitlement.storage = {
    "used": 0,
    "limit": 1154487209165,      // 保持大容量
    "display_limit": 1099511627776,
    "warn": 992137445376
};

// 5. 添加 policies 字段（参考已订阅响应）
obj.policies = {
    "freeStorageDisallowed": true,
   
};

// 6. 更新配置项（参考已订阅响应）
obj.config.hide_lrd_sync_switch = true; // 已订阅账户为true

// 7. 更新 payload（参考已订阅响应）
obj.payload = {
    "lightroom_web": {
        "similarity_data_ready": true
    },
    "universal": {
        "disallow_face_detection": true
    }
};

// 8. 确保头像配置正确
obj.avatar = {
    "placeholder": true
};


// 10. 删除 config 中的免费共享开始日期
delete obj.config.free_sharing_begin_date;

body = JSON.stringify(obj);
$done({body});
