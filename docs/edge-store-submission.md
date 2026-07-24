# SmartFav Microsoft Edge Add-ons 提交清单

本清单对应 SmartFav 1.8.0。商店填写内容必须与扩展实际行为和 [隐私政策](../PRIVACY.md) 保持一致。

## 1. 商店截图

上传以下 `1280 × 800` PNG 文件：

- 中文（简体）：[`smartfav-edge-store-zh-1280x800.png`](store-assets/smartfav-edge-store-zh-1280x800.png)
- English：[`smartfav-edge-store-en-1280x800.png`](store-assets/smartfav-edge-store-en-1280x800.png)

在 `Store listings / 商店列表` 中分别进入中文和 English 详情页上传对应图片。Partner Center 当前接受 `640 × 480` 或 `1280 × 800` 的截图，最多 6 张。如果页面只要求至少一张，上传对应语言的第一张即可。

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

> 在 Microsoft Edge 本地保存 SmartFav 收藏、分类规则、界面设置、最近删除内容、可选背景图和用户填写的 AI 配置。数据不通过该权限上传给发布方。

`activeTab`

> 仅在用户点击 SmartFav 打开弹窗时访问当前活动网页的标题、网址和网站图标，以生成收藏条目和分类建议。

`scripting`

> 仅在用户打开弹窗时读取当前页面的 Meta 描述、Meta 关键词；页面没有描述时读取最多 320 个字符的短文本摘要，用于本地分类或用户主动开启的 AI 分类。不执行远程脚本。

`bookmarks`

> 为三个默认关闭的可选功能读取和维护 Microsoft Edge 收藏夹：同步 SmartFav 受管理分类、经用户授权整理现有收藏、自动获取用户新建的收藏。

`alarms`

> 每小时触发一次本地清理，永久删除在“最近删除”中已超过 7 天的 SmartFav 记录。

AI 服务域名：

> 仅在用户开启 AI 增强或主动测试连接时，连接用户选择的 Ollama、OpenRouter、MiniMax、DeepSeek 或 OpenAI 服务。请求用于返回分类结果；扩展不会从这些地址加载或执行代码。

### Are you using remote code? / 是否使用远程代码

选择：

> No, I am not using remote code. / 否，我不使用远程代码。

SmartFav 的 JavaScript 全部包含在扩展包内。AI 服务返回的是分类数据，不会作为代码执行。

### Data usage / 数据使用

如表单提供对应选项，应完整披露：

- 当前网页的网址、标题、描述摘要和关键词。
- SmartFav 收藏及 Microsoft Edge 收藏夹信息。
- 用户主动填写并保存在本地的 AI API Key 和设置。
- 用户开启 AI 后，向所选服务商发送的分类请求数据。

同时确认这些数据不用于广告、信用评估、出售、跨站跟踪或与扩展单一用途无关的用途。

## 5. 最终检查

- 扩展包：`dist/SmartFav-Edge-1.8.0.zip`
- 中文与 English 商店列表均填写完整。
- 至少上传一张商店截图；建议两种语言各上传对应截图。
- 发布方联系邮箱已保存且验证状态为已验证。
- 隐私政策 URL 可在无登录、无本地环境的情况下公开访问。
- Privacy 页面填写内容与扩展权限和隐私政策一致。
- `Remote code` 选择“否”。

参考：

- [Publish a Microsoft Edge extension](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)
- [Manage account settings](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/manage-settings)
- [Microsoft Edge Add-ons developer policies](https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies)
