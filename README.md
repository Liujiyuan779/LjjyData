# 缘的考研舱

个人考研专属桌面应用，使用 Electron 构建。项目功能与网页版一致，不依赖浏览器窗口运行。

## 本地运行

需要先安装 Node.js。

```bash
npm install
npm start
```

Windows 下也可以直接双击 `启动考研舱.bat`，脚本会自动检查并安装依赖，然后以桌面应用方式启动。

## 打包安装程序

```bash
npm run dist
```

生成的 Windows 安装程序位于 `release/` 目录。

## 从 GitHub 获取应用

仓库配置了 GitHub Actions。推送 `v*` 标签后会自动构建 Windows 安装包并发布到 Releases 页面，别人可以直接下载安装程序，无需安装 Node.js 或执行任何命令。
