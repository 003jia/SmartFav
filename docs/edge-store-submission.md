# SmartFav Microsoft Edge Add-ons 提交清单

本清单对应 SmartFav 1.13.0。商店填写内容必须与扩展实际行为和 [隐私政策](../PRIVACY.md) 保持一致。

建议英文商店名称使用 **SmartFav - Bookmark Organizer**，中文名称继续使用 **SmartFav - 智能收藏夹**。这样既保留现有品牌，也能让英语用户直接理解用途，避免与大量泛化的 “AI Bookmark Organizer” 名称混在一起。

## 1. 商店图片

### 促销瓷砖

- 小型促销瓷砖，`440 × 280` PNG：[`smartfav-small-promo-440x280.png`](store-assets/smartfav-small-promo-440x280.png)
- 大型促销瓷砖，`1400 × 560` PNG：[`smartfav-large-promo-1400x560.png`](store-assets/smartfav-large-promo-1400x560.png)

### 功能截图

当前上传页支持最多 5 张截图，按以下顺序上传这组 `1280 × 800` PNG：

1. [`smartfav-store-01-local-classification-1280x800.png`](store-assets/smartfav-store-01-local-classification-1280x800.png) — 本地规则一键分类
2. [`smartfav-store-02-favorites-management-1280x800.png`](store-assets/smartfav-store-02-favorites-management-1280x800.png) — 收藏管理、排序与跨分类移动
3. [`smartfav-store-03-browser-sync-1280x800.png`](store-assets/smartfav-store-03-browser-sync-1280x800.png) — 浏览器收藏夹同步
4. [`smartfav-store-04-custom-rules-1280x800.png`](store-assets/smartfav-store-04-custom-rules-1280x800.png) — 自定义分类文件夹与关键词
5. [`smartfav-store-05-layout-backup-1280x800.png`](store-assets/smartfav-store-05-layout-backup-1280x800.png) — 整理前布局备份与还原

如需为 English 商店列表先提供一张全英文截图，可继续使用
[`smartfav-edge-store-en-1280x800.png`](store-assets/smartfav-edge-store-en-1280x800.png)；中文概览图为
[`smartfav-edge-store-zh-1280x800.png`](store-assets/smartfav-edge-store-zh-1280x800.png)。

全部成品已汇总到 `docs/store-assets/SmartFav-Store-Assets-1.13.0.zip`。可编辑排版源文件是
[`store-assets.html`](store-assets/store-assets.html)，真实插件界面素材位于 `store-assets/source/`。

## 2. 发布方联系邮箱

这属于 Partner Center 发布者账号信息，不在扩展包或仓库中配置。

1. 打开 Partner Center，点击右上角齿轮。
2. 进入 `Developer settings / 开发人员设置`。
3. 打开 `Contact info / 联系信息`，点击 `Update / 更新`。
4. 输入发布方真实可收信的联系邮箱并保存。
5. 回到 `Account verification / 账号验证` 或 `Legal info / 法律信息`，点击开始验证、验证邮箱或重新发送验证邮件。
6. 打开 Microsoft 发来的邮件并完成验证链接；同时检查垃圾邮件目录。
7. 返回 Partner Center，确认邮箱或账号状态已经显示为 `Verified / 已验证`，再继续发布。

如果发布者是公司账号，应使用公司域名邮箱，并确保联系人信息与公司资料一致。修改公司账号联系信息可能让验证状态暂时回到 `Pending / 待处理`。

## 3. 隐私政策

提交到 GitHub 后，在 Partner Center 的 `Privacy policy URL / 隐私权政策 URL` 填写：

<https://github.com/003jia/SmartFav/blob/main/PRIVACY.md>

该地址必须在未登录 GitHub 的情况下仍能打开。不要填写本地文件路径、`localhost` 地址、仓库内相对路径或需要登录的页面。

SmartFav 会访问当前网页信息和浏览器收藏，并且在用户主动开启 AI 后可能把必要信息发送到所选 AI 服务商。因此，在“是否访问、收集或传输个人信息”一项应选择 **是**，不要选择“否”。

## 4. Privacy 页面建议填写内容

### Single Purpose Description / 单一用途说明

中文：

> SmartFav 在用户打开扩展时读取当前网页的标题、网址、描述摘要和关键词，在 Microsoft Edge 本地按用户可编辑的规则分类并保存收藏；仅在用户明确启用时同步或整理 Edge 收藏夹，或调用用户选择的 AI 服务增强分类。

English:

> SmartFav reads the active page title, URL, description excerpt, and keywords when the user opens the extension, then locally classifies and saves the page using editable rules. It synchronizes or organizes Microsoft Edge favorites and calls a user-selected AI provider only when the user explicitly enables those optional features.

### Permission justification / 权限用途

`storage`

> 在 Microsoft Edge 本地保存 SmartFav 收藏、分类规则、界面设置、最近删除内容、整理前布局备份、可选背景图和用户填写的 AI 配置。布局备份记录书签 ID、标题、网址、原文件夹路径和顺序，用于用户预览或还原整理前布局；数据不通过该权限上传给发布方。

`activeTab`

> 仅在用户点击 SmartFav 打开弹窗时访问当前活动网页的标题、网址和网站图标，以生成收藏条目和分类建议。

`scripting`

> 仅在用户打开弹窗时读取当前页面的 Meta 描述、Meta 关键词；页面没有描述时读取最多 320 个字符的短文本摘要，用于本地分类或用户主动开启的 AI 分类。不执行远程脚本。

`bookmarks`

> 为三个默认关闭的可选功能读取和维护 Microsoft Edge 收藏夹：同步 SmartFav 受管理分类、经用户授权整理现有收藏、自动获取用户新建的收藏。整理或自动移动前先记录原文件夹与顺序；用户可预览并把仍存在的书签移回原位置。启用同步或自动获取后，监听书签删除事件；仅当浏览器中已无同网址副本时，才把对应 SmartFav 收藏移入本地“最近删除”。

`alarms`

> 每小时触发一次本地清理，永久删除在“最近删除”中已超过 7 天的 SmartFav 记录。

`notifications`

> 用户开启自动获取浏览器收藏后，在新建星标完成本地分类时显示一条本机系统通知，告知目标分类文件夹。通知内容不发送给发布方或第三方。

AI 服务域名：

> 仅在用户开启 AI 增强或主动测试连接时，连接用户选择的 Ollama、OpenRouter、MiniMax、DeepSeek、OpenAI，或用户配置的 OpenAI / Anthropic 兼容接口。请求只用于返回分类结果；扩展不会从这些地址加载或执行代码。

可选主机权限：

> OpenAI / Anthropic 兼容接口的域名由用户填写，无法在发布时预先确定。扩展声明可选 HTTPS 主机范围，但只在用户更改兼容接口或点击“测试连接”时，请求所填写 API 主机的访问权限；远程接口必须使用 HTTPS，本机 HTTP 仅限 localhost 或 127.0.0.1。该权限不会用于读取网页或加载远程代码。

### Are you using remote code? / 是否使用远程代码

选择：

> No, I am not using remote code. / 否，我不使用远程代码。

SmartFav 的 JavaScript 全部包含在扩展包内。AI 服务返回的是分类数据，不会作为代码执行。

### Data usage / 数据使用

如表单提供对应选项，应完整披露：

- 当前网页的网址、标题、描述摘要和关键词。
- SmartFav 收藏及 Microsoft Edge 收藏夹信息。
- 整理前保存在本地的布局备份，包括书签 ID、网址、标题、原文件夹路径和顺序。
- 用户主动填写并保存在本地的 AI API Key 和设置。
- 用户开启 AI 后，向所选服务商发送的分类请求数据。

同时确认这些数据不用于广告、信用评估、出售、跨站跟踪或与扩展单一用途无关的用途。

## 5. 最终检查

- 扩展包：`dist/SmartFav-Edge-1.13.0.zip`
- 中文与 English 商店列表均填写完整。
- 上传 5 张中文功能截图；English 商店列表至少上传现有英文概览图。
- 小型与大型促销瓷砖已按上传页标注的精确尺寸准备。
- 发布方联系邮箱已保存且验证状态为已验证。
- 隐私政策 URL 可在无登录、无本地环境的情况下公开访问。
- Privacy 页面填写内容与扩展权限和隐私政策一致。
- `Remote code` 选择“否”。

参考：

- [Publish a Microsoft Edge extension](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)
- [Manage account settings](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/manage-settings)
- [Microsoft Edge Add-ons developer policies](https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies)
