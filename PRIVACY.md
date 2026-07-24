# SmartFav Privacy Policy / SmartFav 隐私政策

**Effective date / 生效日期: July 24, 2026 / 2026 年 7 月 24 日**

[English](#english) · [简体中文](#简体中文)

## English

SmartFav is a local-first favorites organizer for Microsoft Edge. This policy explains what information the extension accesses, how it is used, when information may be sent to a service selected by the user, and the controls available to the user.

### 1. Information SmartFav accesses

Depending on the features you use, SmartFav may access:

- The active page URL, title, favicon URL, meta description or a short text excerpt, and page keywords. This information is used to suggest a favorites category.
- Favorites that you save in SmartFav, including the page URL, title, description excerpt, category, tags, classification summary, and creation time.
- Your Microsoft Edge favorites when you explicitly enable browser-favorites synchronization, organization, or automatic capture.
- Extension settings, including language, theme, popup size, custom category rules, optional custom background image, AI provider/model choices, and an optional API key.
- Recently deleted SmartFav favorites, which are retained locally for up to seven days so that they can be restored.

### 2. Local processing and storage

By default, classification is performed locally in Microsoft Edge using the category names, keyword rules, and weights stored in the extension. SmartFav does not require an account and does not send local-classification data to the publisher.

Favorites, settings, recently deleted items, custom background images, and any API key are stored in the extension's local browser storage. SmartFav does not operate a publisher-controlled server, analytics service, advertising system, or cross-site tracking service.

### 3. Optional AI services

AI enhancement is off by default. If you explicitly enable it, SmartFav sends a classification request directly from the extension to the provider you select. The request may include:

- Page title and URL.
- Page description or a short page-text excerpt and page keywords.
- Your category names and keyword rules.
- Local classification scores and field weights.
- The model name and the prompt needed to return a classification.

For cloud providers, your API key is sent only to that provider as authentication for the request. SmartFav currently supports OpenRouter, MiniMax, DeepSeek, and OpenAI, as well as a local Ollama service. Cloud-provider processing is governed by the selected provider's own terms and privacy policy. Requests to a local Ollama service stay on the device or local network endpoint configured by the user.

The publisher does not receive your AI prompts, page information, API key, or provider responses.

### 4. Microsoft Edge favorites access

The extension requests the `bookmarks` permission so that optional favorites features can work. All related controls are off by default.

- **Sync with browser favorites:** writes SmartFav items to the managed `SmartFav / Category` folders and removes matching managed entries when the user deletes a synced SmartFav item.
- **Allow browser-favorites organization:** reads existing URL favorites and, only after the user enables the option, moves them into matching managed category folders.
- **Automatically capture browser favorites:** detects new favorites created by the user and adds them to SmartFav; organization occurs only when the separate organization option is enabled.

SmartFav does not upload Microsoft Edge favorites to the publisher. Local classification of favorites remains on the device. Page or favorite information is sent to an AI provider only when AI enhancement is enabled as described above.

### 5. Retention and deletion

- SmartFav data remains in local extension storage until the user deletes it, clears browser extension data, or uninstalls the extension.
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
- Edit category rules, delete SmartFav items, restore or permanently delete recently deleted items, clear extension data, or uninstall the extension.

### 8. Security

Cloud AI requests use HTTPS. API keys are stored in local extension storage and are sent only to the provider selected by the user. A local Ollama endpoint may use HTTP on `localhost`. No method of storage or transmission is completely secure, so users should protect their browser profile and API credentials.

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
- 扩展设置，包括语言、主题、弹窗尺寸、自定义分类规则、可选的自定义背景图、AI 服务商与模型选择，以及可选的 API Key。
- 最近删除的 SmartFav 收藏；这些记录仅在本地保留最多 7 天，以便恢复。

### 2. 本地处理与存储

默认情况下，SmartFav 使用保存在扩展中的分类名称、关键词规则和权重，在 Microsoft Edge 本地完成分类。SmartFav 不要求注册账号，也不会把本地分类数据发送给发布方。

收藏、设置、最近删除内容、自定义背景图和 API Key 均保存在扩展的浏览器本地存储中。SmartFav 不运营发布方控制的服务器、分析服务、广告系统或跨站跟踪服务。

### 3. 可选 AI 服务

AI 增强默认关闭。只有在你明确开启后，SmartFav 才会从扩展直接向你选择的服务商发送分类请求。请求可能包含：

- 网页标题和网址。
- 网页描述或一小段网页文本，以及网页关键词。
- 你的分类名称和关键词规则。
- 本地分类得分、字段权重。
- 模型名称和完成分类所需的提示词。

使用云端服务商时，你的 API Key 只会作为该服务商请求的身份验证信息发送给该服务商。SmartFav 当前支持 OpenRouter、MiniMax、DeepSeek、OpenAI，以及本机 Ollama。云端服务商如何处理信息，受该服务商自己的条款和隐私政策约束。发送到本机 Ollama 的请求仅到达用户配置的设备或本地网络地址。

发布方不会收到你的 AI 提示词、网页信息、API Key 或服务商返回结果。

### 4. Microsoft Edge 收藏夹权限

扩展申请 `bookmarks` 权限，以提供可选的收藏夹功能。所有相关开关默认关闭。

- **同步浏览器收藏夹：**把 SmartFav 收藏写入受管理的 `SmartFav / 分类` 文件夹；用户删除已同步的 SmartFav 收藏时，删除受管理目录中的对应记录。
- **允许整理浏览器收藏夹：**读取现有网址收藏；只有用户主动开启该选项后，才会把收藏移动到匹配的受管理分类文件夹。
- **自动获取浏览器收藏：**识别用户新建的浏览器收藏并加入 SmartFav；只有同时开启独立的整理选项时，才会移动浏览器收藏。

SmartFav 不会把 Microsoft Edge 收藏夹上传给发布方。收藏的本地分类始终在设备上完成。只有按上一节所述开启 AI 增强后，相关网页或收藏信息才会发送给用户选择的 AI 服务商。

### 5. 保留与删除

- SmartFav 数据会保存在扩展本地存储中，直到用户删除、清除浏览器扩展数据或卸载扩展。
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
- 编辑分类规则、删除 SmartFav 收藏、恢复或永久删除最近删除内容、清除扩展数据或卸载扩展。

### 8. 安全

云端 AI 请求使用 HTTPS。API Key 保存在扩展本地存储中，并且只会发送给用户选择的服务商。本机 Ollama 地址可能通过 `localhost` 使用 HTTP。任何存储或传输方式都无法保证绝对安全，用户应妥善保护浏览器配置文件和 API 凭据。

### 9. 儿童

SmartFav 是通用效率工具，并非面向儿童。发布方不会主动收集儿童个人信息。

### 10. 政策更新与联系

当 SmartFav 的数据处理方式或功能发生重大变化时，本政策会同步更新。页面顶部的生效日期表示最新修订时间。

如有隐私问题或请求，请在 SmartFav 公开仓库提交 Issue：

<https://github.com/003jia/SmartFav/issues>
