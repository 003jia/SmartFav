# SmartFav 智能收藏夹

<p align="center">
  <img src="docs/github-assets/smartfav-github-hero.jpg" alt="SmartFav 1.12.0 — Local-first bookmark organizer" width="100%">
</p>

<p align="center">
  本地优先、AI 可选增强的 Chrome / Edge 书签整理插件。
  <br>
  A local-first bookmark organizer with optional AI, bilingual UI, browser sync, and layout backup.
</p>

<p align="center">
  <a href="https://github.com/003jia/SmartFav/releases/tag/v1.12.0"><strong>下载 1.12.0</strong></a>
  ·
  <a href="#安装">安装说明</a>
  ·
  <a href="smartFav智能收藏夹/README.md">完整使用文档</a>
  ·
  <a href="PRIVACY.md">隐私政策</a>
</p>

## 产品定位

SmartFav 点击工具栏图标即可打开，不注入网页，也不创建独立窗口。它会根据当前网页的标题、网址、网站标签和描述建议分类；基础分类完全在浏览器本地运行，不要求注册账号或配置 API Key。

需要更智能的判断时，可以按需启用本机 Ollama、现成云服务，或填写兼容 OpenAI Chat Completions / Anthropic Messages 的接口地址、模型与 API Key。AI 始终是可选增强，不会阻断基础收藏流程。

<p align="center">
  <img src="docs/github-assets/smartfav-feature-overview.jpg" alt="SmartFav 本地分类、收藏管理和浏览器同步功能概览" width="100%">
</p>

## 核心能力

### 本地分类与自定义规则

- 无需 AI 即可使用关键词权重或本地向量相似度匹配。
- 可创建、删除分类文件夹，并为每个文件夹单独维护关键词。
- 支持中文逗号、英文逗号、分号和换行输入，保存时自动规范。
- 新增分类或修改规则后，会重新检查已有 SmartFav 收藏。

### 收藏管理

- “我的收藏”和“分类文件夹”使用独立紧凑界面。
- 收藏以卡片展示标题、分类与网站域名。
- 分类文件夹和分类内书签均支持鼠标拖动及 `Alt + 方向键` 排序。
- 删除内容进入“最近删除”，默认保留 7 天，可恢复或立即永久删除。
- 弹窗宽高、五种界面风格、明暗模式和自定义背景图均可调整。

### 浏览器收藏夹同步

- SmartFav 收藏或删除时，可同步维护浏览器 `SmartFav / 分类`。
- 浏览器新建星标后，可自动获取、分类并用系统通知提示目标文件夹。
- 浏览器删除最后一条同网址书签时，对应 SmartFav 收藏会进入“最近删除”。
- 开启同步后，手动调整的分类及书签顺序会写回浏览器收藏夹。
- 批量整理和自动移动前可创建布局备份，支持预览、还原、JSON 导入与导出。

同步和整理默认关闭。SmartFav 只在用户开启相应功能后读取或移动浏览器书签；排序写回仅移动已经存在的 SmartFav 受管项目，不创建空文件夹，也不改动 SmartFav 目录外的书签。

## 下载

推荐从 [GitHub Releases](https://github.com/003jia/SmartFav/releases/tag/v1.12.0) 下载：

- `SmartFav-Edge-1.12.0.zip`：适用于 Microsoft Edge 和 Google Chrome 的 Manifest V3 扩展包。
- `SmartFav-Edge-1.12.0.sha256`：安装包 SHA-256 校验文件。

> 浏览器安全策略不允许把普通 ZIP 当作双击安装程序。GitHub 包适合开发者模式安装和商店提交；面向普通用户发布时，仍建议使用 Edge Add-ons 或 Chrome Web Store。

## 安装

1. 下载 `SmartFav-Edge-1.12.0.zip` 并解压。
2. 打开 `edge://extensions/` 或 `chrome://extensions/`。
3. 开启“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择解压后包含 `manifest.json` 的目录。

安装完成后，点击工具栏中的 SmartFav 图标即可打开插件。普通 `http://` 或 `https://` 网页可以收藏；`edge://`、`chrome://`、扩展商店和其他浏览器保护页面仍可查看已有收藏与设置，但浏览器不允许扩展读取或收藏这些页面。

## 1.12.0 更新

- 分类文件夹和分类内书签均支持鼠标拖动与键盘排序。
- 开启“同步浏览器收藏夹”后，手动顺序同步写回 `SmartFav / 分类`；关闭时只保存 SmartFav 本地顺序。
- 同网址有多个受管副本时保留全部副本及其相对顺序。
- 未匹配书签、未知文件夹和 SmartFav 目录外内容不会被删除或移动。
- 浏览器缺少对应项目或同步失败时，仍保留本地排序并显示明确提示。
- 统一设置页复选框尺寸，并补充当前版本的 GitHub 展示图和 Release 软件包。

完整版本记录见 [扩展使用文档](smartFav智能收藏夹/README.md#版本记录)。

## 中英文与商店发布

- [隐私政策（中英双语）](PRIVACY.md)
- [Microsoft Edge Add-ons 提交清单](docs/edge-store-submission.md)
- [中文商店截图（1280 × 800）](docs/store-assets/smartfav-edge-store-zh-1280x800.png)
- [English store screenshot (1280 × 800)](docs/store-assets/smartfav-edge-store-en-1280x800.png)

公开隐私政策地址：

<https://github.com/003jia/SmartFav/blob/main/PRIVACY.md>

## 开发与验证

扩展源码位于 `smartFav智能收藏夹`，`manifest.json` 位于该目录根部。

```bash
node --check smartFav智能收藏夹/browser-bookmarks.js
node --check smartFav智能收藏夹/background.js
node --check smartFav智能收藏夹/popup.js
node tests/verify-extension.js
unzip -t dist/SmartFav-Edge-1.12.0.zip
```

1.12.0 已通过以上语法检查、扩展自动化验证和 ZIP 完整性检查。
