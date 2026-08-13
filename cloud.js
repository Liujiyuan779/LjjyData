(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.KaoYanCloud = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DEFAULT_CONFIG = {
    url: "https://mvqdknksuflzprekjaik.supabase.co",
    anonKey: "sb_publishable_DqadG6tq3II-1qD18MqgUw_hq0y7zzw",
    bucket: "resources"
  };

  function getDefaultConfig() {
    return Object.assign({}, DEFAULT_CONFIG);
  }

  function normalizeUrl(url) {
    return String(url || "").trim()
      .replace(/\/+$/, "")
      .replace(/\/rest\/v1$/, "");
  }

  function isConfigured(config) {
    return !!config &&
      /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(normalizeUrl(config.url)) &&
      !!config.anonKey &&
      !!config.bucket;
  }

  function headers(config) {
    return {
      "apikey": config.anonKey,
      "Authorization": "Bearer " + config.anonKey,
      "Content-Type": "application/json"
    };
  }

  async function checkResponse(res, action) {
    if (!res.ok) {
      const text = await res.text();
      throw new Error(action + " failed: " + res.status + " " + text);
    }
  }

  async function saveState(config, userKey, state) {
    const url = normalizeUrl(config.url) + "/rest/v1/app_data?on_conflict=user_key";
    const res = await fetch(url, {
      method: "POST",
      headers: Object.assign(headers(config), {
        "Prefer": "resolution=merge-duplicates,return=minimal"
      }),
      body: JSON.stringify({
        user_key: userKey,
        data: state,
        updated_at: new Date().toISOString()
      })
    });
    await checkResponse(res, "云数据保存");
  }

  async function loadState(config, userKey) {
    const url = normalizeUrl(config.url) +
      "/rest/v1/app_data?user_key=eq." + encodeURIComponent(userKey) +
      "&select=data,updated_at&limit=1";
    const res = await fetch(url, {
      method: "GET",
      headers: headers(config)
    });
    await checkResponse(res, "云数据读取");
    const rows = await res.json();
    return rows && rows.length ? rows[0].data : null;
  }

  function resourcePath(userKey, fileName) {
    const safeName = String(fileName || "file").replace(/[\\/:*?"<>|]/g, "_");
    return encodeURIComponent(userKey) + "/" + encodeURIComponent(safeName);
  }

  async function uploadResource(config, path, blob) {
    const url = normalizeUrl(config.url) + "/storage/v1/object/" +
      encodeURIComponent(config.bucket) + "/" + path;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + config.anonKey,
        "x-upsert": "true",
        "Content-Type": blob.type || "application/octet-stream"
      },
      body: blob
    });
    await checkResponse(res, "资源上传");
  }

  async function downloadResource(config, path) {
    const url = normalizeUrl(config.url) + "/storage/v1/object/" +
      encodeURIComponent(config.bucket) + "/" + path;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + config.anonKey
      }
    });
    await checkResponse(res, "资源下载");
    return await res.blob();
  }

  async function deleteResource(config, path) {
    const url = normalizeUrl(config.url) + "/storage/v1/object/" +
      encodeURIComponent(config.bucket) + "/" + path;
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        "Authorization": "Bearer " + config.anonKey
      }
    });
    await checkResponse(res, "资源删除");
  }

  return {
    deleteResource: deleteResource,
    downloadResource: downloadResource,
    getDefaultConfig: getDefaultConfig,
    isConfigured: isConfigured,
    loadState: loadState,
    normalizeUrl: normalizeUrl,
    resourcePath: resourcePath,
    saveState: saveState,
    uploadResource: uploadResource
  };
});
