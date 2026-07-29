# SmartFav Privacy Policy / SmartFav 隐私政策

**Effective date / 生效日期: July 27, 2026 / 2026 年 7 月 27 日**

[English](#english) · [简体中文](#简体中文)

## English

SmartFav is a local-first favorites organizer for Microsoft Edge. This policy explains what information the extension accesses, how it is used, when information may be sent to a service selected by the user, and the controls available to the user.

### 1. Information SmartFav accesses

Depending on the features you use, SmartFav may access:

- The active page URL, title, favicon URL, meta description or a short text excerpt, and page keywords. This information is used to suggest a favorites category.
- Favorites that you save in SmartFav, including the page URL, title, description excerpt, category, tags, classification summary, and creation time.
- Your Microsoft Edge favorites when you explicitly enable browser-favorites synchronization, organization, or automatic capture.
- Pre-organization layout backups for bookmarks still outside SmartFav, including bookmark IDs, titles, URLs, original folder paths, and ordering.
- Extension settings, including language, theme, popup size, custom category rules, optional custom background image, AI provider/model choices, an optional custom API endpoint, and an optional API key.
- Recently deleted SmartFav favorites, which are retained locally for up to seven days so that they can be restored.

### 2. Local processing and storage

By default, classification is performed locally in Microsoft Edge using the category names, keyword rules, and weights stored in the extension. SmartFav does not require an account and does not send local-classification data to the publisher.

Favorites, settings, recently deleted items, pre-organization layout backups, custom background images, and any API key are stored in the extension's local browser storage. Layout backups can be exported by the user as a JSON file and imported later. SmartFav does not operate a publisher-controlled server, analytics service, advertising system, or cross-site tracking service.

### 3. Optional AI services

AI enhancement is off by default. If you explicitly enable it, SmartFav sends a classification request directly from the extension to the provider you select. The request may include:

- Page title and URL.
- Page description or a short page-text excerpt and page keywords.
- Your category names and keyword rules.
- Local classification scores and field weights.
- The model name and the prompt needed to return a classification.

For cloud providers, your API key is sent only to that provider as authentication for the request. SmartFav supports OpenRouter, MiniMax, DeepSeek, OpenAI, a local Ollama service, and user-configured endpoints that use the OpenAI Chat Completions or Anthropic Messages request format. When a custom endpoint is used, the endpoint operator selected by the user receives the request and API key. Its processing is governed by that operator's own terms and privacy policy.

Custom remote endpoints must use HTTPS. When the user saves or tests a compatible API configuration, SmartFav asks the browser for access only to the configured API host. HTTP custom endpoints are accepted only on `localhost` or `127.0.0.1`.

The publisher does not receive your AI prompts, page information, API key, or provider responses.

### 4. Microsoft Edge favorites access

The extension requests the `bookmarks` permission so that optional favorites features can work. All related controls are off by default.

- **Sync with browser favorites:** writes SmartFav items to the managed `SmartFav / Category` folders and removes matching managed entries when the user deletes a synced SmartFav item. Moving a SmartFav item to another category can move its managed browser copy, and moving a browser favorite between managed SmartFav category folders updates the local SmartFav category. When the user deletes the last browser favorite with a matching URL, the corresponding SmartFav item is moved to Recently deleted; deleting one of several matching browser copies does not remove the SmartFav item.
- **Allow browser-favorites organization:** reads existing URL favorites and, only after the user enables the option, moves them into matching managed category folders.
- **Automatically capture browser favorites:** detects new favorites created by the user, classifies them, and adds them to SmartFav; organization occurs only when the separate organization option is enabled. After classification, SmartFav may display a local system notification naming the destination category.

Before organizing existing favorites or automatically moving a new favorite, SmartFav saves a local layout backup for bookmarks that are still outside SmartFav. If that backup cannot be saved, the extension does not move the favorites. Bookmarks already inside SmartFav can be read, but the browser does not expose their earlier locations. A restore operation moves only bookmarks that still exist and match the stored browser bookmark IDs, recreates missing folder paths when needed, and attempts to restore the recorded order. It does not delete bookmarks added after the backup and does not recreate bookmarks the user has deleted.

The `notifications` permission is used only to display the local classification result on the user's device. Notification content is not sent to the publisher. SmartFav does not upload Microsoft Edge favorites to the publisher. Local classification of favorites remains on the device. Page or favorite information is sent to an AI provider only when AI enhancement is enabled as described above.

### 5. Retention and deletion

- SmartFav data remains in local extension storage until the user deletes it, clears browser extension data, or uninstalls the extension.
- Local layout backups are deleted when extension data is cleared or the extension is uninstalled. Browsers do not allow the extension to run an automatic restore after uninstallation. A JSON backup exported by the user remains wherever the user saved it until the user deletes it.
- Deleted SmartFav favorites remain in “Recently deleted” for up to seven days unless the user restores or permanently deletes them sooner.
- Browser favorites created or moved at the user's request remain in Microsoft Edge until the user removes or reorganizes them.
- Information sent to a selected AI provider is retained according to that provider's policy; SmartFav does not control the provider's retention.

### 6. Sharing, sale, and tracking

SmartFav does not sell personal information. It does not share information with the publisher or third parties for advertising, analytics, credit scoring, or cross-site tracking. Information is disclosed only to an AI provider selected and enabled by the user, as necessary to perform the requested AI classification.

### 7. User controls

Users can:

- Keep AI disabled and use local classification only.
- Select or change an AI provider, remove the API key, or turn AI off at any time.
- Independently enable or disable browser-favorites synchronization, organization, and automatic capture.
- Scan or update a pre-organization layout backup, preview a restore, restore existing bookmarks to recorded folders, and export or import a layout-backup JSON file.
- Edit category rules, delete SmartFav items, restore or permanently delete recently deleted items, clear extension data, or uninstall the extension.

### 8. Security

Cloud AI requests use HTTPS. API keys and custom endpoint settings are stored in local extension storage and are sent only to the selected provider or user-configured endpoint. A local Ollama or compatible endpoint may use HTTP only on `localhost` or `127.0.0.1`. No method of storage or transmission is completely secure, so users should protect their browser profile and API credentials.

### 9. Children

SmartFav is a general productivity tool and is not directed to children. The publisher does not knowingly collect children's personal information.

### 10. Changes and contact

This policy will be updated when SmartFav's data practices or features materially change. The effective date at the top identifies the latest revision.

For privacy questions or requests, open an issue in the public SmartFav repository:

<https://github.com/003jia/SmartFav/issues>

---

## 简体中文

SmartFav 是一款以本地处理为优先的 Microsoft Edge 收藏整理扩展。本政策说明扩展会访问哪些信息、如何使用这些信息、何时可能把信息发送到用户选择的服务，以及用户可以使用哪些控制选项。

### 1. SmartFav 访问的信息

根据你使用的功能，SmartFav 可能访问：

- 当前网页的网址、标题、网站图标地址、Meta 描述或一小段网页文本，以及网页关键词，用于建议收藏分类。
- 你保存在 SmartFav 中的收藏，包括网址、标题、描述摘要、分类、标签、分类说明和创建时间。
- 当你明确开启浏览器收藏夹同步、整理或自动获取功能时，访问 Microsoft Edge 收藏夹。
- 为仍在 SmartFav 外的书签创建的整理前布局备份，包括书签 ID、标题、网址、原文件夹路径和顺序。
- 扩展设置，包括语言、主题、弹窗尺寸、自定义分类规则、可选的自定义背景图、AI 服务商与模型选择、可选的自定义 API 地址，以及可选的 API Key。
- 最近删除的 SmartFav 收藏；这些记录仅在本地保留最多 7 天，以便恢复。

### 2. 本地处理与存储

默认情况下，SmartFav 使用保存在扩展中的分类名称、关键词规则和权重，在 Microsoft Edge 本地完成分类。SmartFav 不要求注册账号，也不会把本地分类数据发送给发布方。

收藏、设置、最近删除内容、整理前布局备份、自定义背景图和 API Key 均保存在扩展的浏览器本地存储中。用户可以把布局备份导出为 JSON 文件并在之后重新导入。SmartFav 不运营发布方控制的服务器、分析服务、广告系统或跨站跟踪服务。

### 3. 可选 AI 服务

AI 增强默认关闭。只有在你明确开启后，SmartFav 才会从扩展直接向你选择的服务商发送分类请求。请求可能包含：

- 网页标题和网址。
- 网页描述或一小段网页文本，以及网页关键词。
- 你的分类名称和关键词规则。
- 本地分类得分、字段权重。
- 模型名称和完成分类所需的提示词。

使用云端服务商时，你的 API Key 只会作为请求身份验证信息发送给该服务商。SmartFav 支持 OpenRouter、MiniMax、DeepSeek、OpenAI、本机 Ollama，以及用户配置的 OpenAI Chat Completions 或 Anthropic Messages 格式接口。使用自定义接口时，用户选择的接口运营方会收到请求内容和 API Key，其处理方式受该运营方自身的条款和隐私政策约束。

自定义远程接口必须使用 HTTPS。用户保存或测试兼容 API 配置时，SmartFav 只向浏览器请求所填写 API 主机的访问权限。HTTP 自定义接口仅允许使用 `localhost` 或 `127.0.0.1`。

发布方不会收到你的 AI 提示词、网页信息、API Key 或服务商返回结果。

### 4. Microsoft Edge 收藏夹权限

扩展申请 `bookmarks` 权限，以提供可选的收藏夹功能。所有相关开关默认关闭。

- **同步浏览器收藏夹：**把 SmartFav 收藏写入受管理的 `SmartFav / 分类` 文件夹；用户删除已同步的 SmartFav 收藏时，删除受管理目录中的对应记录。SmartFav 内跨分类移动可以同步移动受管理的浏览器副本；用户在浏览器受管理分类之间移动书签时，也会更新 SmartFav 本地分类。用户在浏览器删除最后一条同网址书签时，对应 SmartFav 收藏会移入“最近删除”；如果仍有同网址浏览器副本，则不会删除 SmartFav 收藏。
- **允许整理浏览器收藏夹：**读取现有网址收藏；只有用户主动开启该选项后，才会把收藏移动到匹配的受管理分类文件夹。
- **自动获取浏览器收藏：**识别用户新建的浏览器收藏，完成分类并加入 SmartFav；只有同时开启独立的整理选项时，才会移动浏览器收藏。分类完成后，SmartFav 可以通过本机系统通知显示目标分类。

SmartFav 在整理现有收藏或自动移动新收藏前，会先为仍在 SmartFav 外的书签保存本地布局备份；如果备份无法保存，扩展不会移动收藏。已经位于 SmartFav 分类内的书签仍可读取，但浏览器不提供其更早位置。还原时只移动仍然存在且浏览器书签 ID 与记录匹配的书签，按需重建缺失的文件夹路径，并尝试恢复记录顺序。备份之后新增的书签不会被删除，用户已经删除的书签不会被重新创建。

`notifications` 权限仅用于在用户设备上显示本地分类结果，通知内容不会发送给发布方。SmartFav 不会把 Microsoft Edge 收藏夹上传给发布方。收藏的本地分类始终在设备上完成。只有按上一节所述开启 AI 增强后，相关网页或收藏信息才会发送给用户选择的 AI 服务商。

### 5. 保留与删除

- SmartFav 数据会保存在扩展本地存储中，直到用户删除、清除浏览器扩展数据或卸载扩展。
- 清除扩展数据或卸载扩展会删除本地布局备份；浏览器不允许扩展在卸载后自动执行还原。用户主动导出的 JSON 备份会保留在用户选择的位置，直到用户自行删除。
- 删除的 SmartFav 收藏会在“最近删除”中保留最多 7 天，除非用户提前恢复或永久删除。
- 按用户要求创建或移动的浏览器收藏，会保留在 Microsoft Edge 中，直到用户自行删除或重新整理。
- 发送给所选 AI 服务商的信息按照该服务商的政策保留；SmartFav 无法控制服务商的保留期限。

### 6. 共享、出售与跟踪

SmartFav 不出售个人信息，也不会为了广告、分析、信用评估或跨站跟踪而向发布方或第三方共享信息。只有在用户选择并开启 AI 服务后，SmartFav 才会为完成用户请求的 AI 分类而向该服务商披露必要信息。

### 7. 用户控制

用户可以：

- 始终关闭 AI，仅使用本地分类。
- 随时选择或更换 AI 服务商、删除 API Key 或关闭 AI。
- 分别开启或关闭浏览器收藏夹同步、整理和自动获取。
- 扫描或更新整理前布局备份、预览还原、把现有书签还原到记录的文件夹，以及导入或导出布局备份 JSON。
- 编辑分类规则、删除 SmartFav 收藏、恢复或永久删除最近删除内容、清除扩展数据或卸载扩展。

### 8. 安全

云端 AI 请求使用 HTTPS。API Key 和自定义接口设置保存在扩展本地，并且只会发送给用户选择的服务商或自定义接口。本机 Ollama 或兼容接口仅可通过 `localhost` 或 `127.0.0.1` 使用 HTTP。任何存储或传输方式都无法保证绝对安全，用户应妥善保护浏览器配置文件和 API 凭据。

### 9. 儿童

SmartFav 是通用效率工具，并非面向儿童。发布方不会主动收集儿童个人信息。

### 10. 政策更新与联系

当 SmartFav 的数据处理方式或功能发生重大变化时，本政策会同步更新。页面顶部的生效日期表示最新修订时间。

如有隐私问题或请求，请在 SmartFav 公开仓库提交 Issue：

<https://github.com/003jia/SmartFav/issues>
