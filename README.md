# SmartFav 智能收藏夹

<p align="center">
  本地优先、AI 可选增强的 Chrome / Edge 书签整理插件。
  <br>
  A local-first bookmark organizer with optional AI, bilingual UI, browser sync, and layout backup.
</p>

<p align="center">
  <a href="dist/SmartFav-Edge-1.14.2.zip"><strong>下载 1.14.2</strong></a>
  ·
  <a href="#安装">安装说明</a>
  ·
  <a href="smartFav智能收藏夹/README.md">完整使用文档</a>
  ·
  <a href="docs/ROADMAP.md">更新计划</a>
  ·
  <a href="PRIVACY.md">隐私政策</a>
</p>

## 产品定位

SmartFav 点击工具栏图标即可打开，不注入网页，也不创建独立窗口。它会根据当前网页的标题、网址、网站标签和描述建议分类；基础分类完全在浏览器本地运行，不要求注册账号或配置 API Key。

需要更智能的判断时，可以按需启用本机 Ollama、现成云服务，或填写兼容 OpenAI Chat Completions / Anthropic Messages 的接口地址、模型与 API Key。AI 始终是可选增强，不会阻断基础收藏流程。

## 核心能力

### 本地分类与自定义规则

- 无需 AI 即可使用关键词权重或本地向量相似度匹配。
- 可创建、删除分类文件夹，并为每个文件夹单独维护关键词。
- 支持空格、中文或英文逗号、分号和换行输入；英文双引号可保留带空格词组。
- 本地分类结果会展示匹配依据及“把握高 / 中 / 低”，方便判断是否需要手动调整。
- 手动跨分类移动后，可选择记住该网站的域名归属；规则始终由用户确认后写入。
- 收藏当前网页时若手动修改推荐分类，可默认同时记住网站归属，并在保存后立即撤销。
- 启用外部 AI 后，可按文件夹分析已有收藏并把建议关键词填入匹配字段，检查确认后再保存。
- 新增分类或修改规则后，会重新检查已有 SmartFav 收藏。

### 收藏管理

- “我的收藏”和“分类文件夹”使用独立紧凑界面。
- 收藏以卡片展示标题、分类与网站域名。
- 分类文件夹和分类内书签均支持鼠标拖动及 `Alt + 方向键` 排序。
- 分类内单条书签可通过“移动”菜单跨分类转移。
- 删除内容进入“最近删除”，默认保留 7 天，可恢复或立即永久删除。
- 弹窗宽高、五种界面风格、明暗模式和自定义背景图均可调整。

### 浏览器收藏夹同步

- SmartFav 收藏或删除时，可同步维护浏览器 `SmartFav / 分类`。
- 浏览器新建星标后，可自动获取、分类并用系统通知提示目标文件夹。
- 浏览器删除最后一条同网址书签时，对应 SmartFav 收藏会进入“最近删除”。
- 开启同步后，手动调整的分类及书签顺序会写回浏览器收藏夹。
- 在浏览器 `SmartFav / 分类` 间移动书签时，SmartFav 分类会实时跟随更新。
- 批量整理和自动移动前可创建布局备份，支持预览、还原、JSON 导入与导出。

同步和整理默认关闭。SmartFav 只在用户开启相应功能后读取或移动浏览器书签；排序写回仅移动已经存在的 SmartFav 受管项目，不创建空文件夹，也不改动 SmartFav 目录外的书签。

## 下载

当前仓库提供可直接用于 Edge / Chrome 开发者模式或扩展商店提交的安装包：

- [`SmartFav-Edge-1.14.2.zip`](dist/SmartFav-Edge-1.14.2.zip)：Manifest V3 扩展包。
- 公开仓库只保留当前版本安装包，不长期存放历史二进制文件。

> 浏览器安全策略不允许把普通 ZIP 当作双击安装程序。GitHub 包适合开发者模式安装和商店提交；面向普通用户发布时，仍建议使用 Edge Add-ons 或 Chrome Web Store。

## 安装

1. 下载 `SmartFav-Edge-1.14.2.zip` 并解压。
2. 打开 `edge://extensions/` 或 `chrome://extensions/`。
3. 开启“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择解压后包含 `manifest.json` 的目录。

安装完成后，点击工具栏中的 SmartFav 图标即可打开插件。普通 `http://` 或 `https://` 网页可以收藏；`edge://`、`chrome://`、扩展商店和其他浏览器保护页面仍可查看已有收藏与设置，但浏览器不允许扩展读取或收藏这些页面。

## 1.14.2 更新

- “分类文件夹”新增“AI 分析并填入”，复用当前配置的 Ollama、OpenRouter、OpenAI、Anthropic 兼容接口等服务。
- 每个非空文件夹最多选取 12 条代表性收藏，只发送文件夹名、已有普通关键词、标题、域名和不含查询参数的网址路径。
- 文件夹较多时按 5 个一批调用；只有全部批次成功后才修改界面，失败时原匹配字段保持不变。
- AI 建议会过滤未知分类、完整 URL、`domain:` 规则和重复关键词，并与现有手工规则合并而非覆盖。
- 建议先填入对应匹配字段并显示 `AI +数量`，离开页面或不点击“保存并重新分类”时不会持久化。
- 本地分类仍可完全独立运行；未开启或未配置 AI 时只显示引导提示，不影响收藏和分类。

完整版本记录见 [扩展使用文档](smartFav智能收藏夹/README.md#版本记录)。

## 后续计划

下一版优先继续完善分类学习闭环，包括浏览器移动产生的待确认建议、学习记录管理和长期撤销入口。完整数据备份、搜索去重、批量整理和更深入的语义建议随后逐步推进。

详细顺序、边界和验收标准见 [SmartFav 更新计划](docs/ROADMAP.md)。

## 中英文与商店发布

- [隐私政策（中英双语）](PRIVACY.md)
- [Microsoft Edge Add-ons 提交清单](docs/edge-store-submission.md)

为避免真实收藏、浏览器账号或本机环境信息进入公开仓库，商店截图和促销图片不再随源码保存。提交商店前请使用虚拟测试数据在本地生成素材，检查无个人书签、邮箱、头像、账号名称、本机路径及内部网址后，直接上传到对应商店后台。

公开隐私政策地址：

<https://github.com/003jia/SmartFav/blob/main/PRIVACY.md>

## 开发与验证

扩展源码位于 `smartFav智能收藏夹`，`manifest.json` 位于该目录根部。

```bash
node --check smartFav智能收藏夹/browser-bookmarks.js
node --check smartFav智能收藏夹/background.js
node --check smartFav智能收藏夹/popup.js
node --check smartFav智能收藏夹/classifier.js
node --check smartFav智能收藏夹/ai-keyword-suggestions.js
node --check smartFav智能收藏夹/order-utils.js
node tests/verify-extension.js
unzip -t dist/SmartFav-Edge-1.14.2.zip
```

1.14.2 已通过以上语法检查、扩展自动化验证和 ZIP 完整性检查。
