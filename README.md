# 缘的考研舱

个人考研专属桌面应用，使用 Electron 构建。项目功能与网页版一致，不依赖浏览器窗口运行。

## 本地运行

需要先安装 Node.js。

```bash
npm install
npm start
```

Windows 下也可以直接双击 `启动考研舱.bat`，脚本会自动检查并安装依赖，然后以桌面应用方式启动。

## 云数据库

数据统一保存在项目内置的 Supabase 云数据库中，用户账号和业务数据都会同步到云端，用户无需自己创建或配置云数据库。建表 SQL 见 `supabase-schema.sql`。

## 打包安装程序

```bash
npm run dist
```

生成的 Windows 安装程序位于 `release/` 目录。

## 从 GitHub 获取应用

仓库配置了 GitHub Actions。推送 `v*` 标签后会自动构建 Windows 安装包并发布到 Releases 页面，别人可以直接下载安装程序，无需安装 Node.js 或执行任何命令。

当前版本也直接包含在仓库中：下载项目压缩包后，运行 `release/KaoYanApp-Setup-1.1.0.exe` 即可安装使用。
