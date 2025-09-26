body = $response.body.replace(/while\s*\(\d+\)\s*{}\s*/, "");
let obj = JSON.parse(body);

// 工具函数：生成今天的日期 + 固定时间
function getTodayPurchaseDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}T17:20:34.556306Z`;
}

// 重写 entitlement
obj.entitlement = {
  "status": "subscriber",
  "current_subs": {
    "product_id": "lightroom",
    "store": "adobe",
    "purchase_date": getTodayPurchaseDate(),
    "sao": {
      "inpkg_LRMC": "1"
    }
  },
  "storage": {
    "limit": 0,
    "display_limit": 0,
    "warn": 0
  }
};

// 保留你之前的 config
obj.config = {
  "create_lrm_renditions_on_server": true,
  "hide_lrm_custom_album_asset_order": true,
  "lrd_sync_collections_by_default": true,
  "notify_daily_in_app_unlimited_import_end": 15,
  "notify_local_quota_reset": 5,
  "notify_local_unlimited_import_end": 7,
  "notify_local_without_app_launch": 14,
  "upload_lrd_originals": false,
  "first_asset_email": true,
  "allow_video_uploads": true,
  "hide_lrd_sync_switch": true, // 订阅者特有
  "disable_lrd_auto_sync_collection": 0,
  "upgrade_lrd_less_65": true,
  "stacks_api": true,
  "storage_schema_version": 2,
  "storage_track": true,
  "one_quota": true,
  "ims_hoolihan_enabled": true,
  "allow_asset_importance_calculation": true,
  "purge_assets_after": 2592000,
  "whitelist_filter_v1_payload": true,
  "sync_down_default_page_size": 100,
  "sync_down_max_page_size": 500,
  "enable_best_frame_scoring": true,
  "allow_best_frame_in_best_photos": true,
  "migration_delay": 120,
  "upgrade_lrd_less_than_version": "13.3",
  "allow_direct_upload": true,
  "mongo_cluster_2": true,
  "server_side_masking": true,
  "pause_320_migration": false,
  "switch_to_ems": true,
  "allow_direct_download_redirect": true,
  "prediction_request_url_timeout": 900,
  "fix_imagecore_ppl_dlq": true,
  "allow_heif_worker_decoding": true,
  "enable_proxy_with_jxl": true,
  "dynamic_renditions": true,
  "enforce_enterprise_sharing": true,
  "enable_invalid_rendition_deletion": true,
  "orbit_erase_end": "43200",
  "orbit_erase_limit": "500",
  "orbit_lensblur_end": "43200",
  "orbit_lensblur_limit": "500",
  "orbit_masking_end": "43200",
  "orbit_masking_limit": "500",
  "orbit_blemish_end": "43200",
  "orbit_blemish_limit": "500",
  "search_index": true,
  "allow_heif": true
};

// 确保头像配置
obj.avatar = { "placeholder": true };

// 删除免费共享开始日期
delete obj.config.free_sharing_begin_date;

body = JSON.stringify(obj);
$done({body});
