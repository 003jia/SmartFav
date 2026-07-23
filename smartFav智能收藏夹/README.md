# SmartFav 智能收藏夹

SmartFav 是一个本地优先的 Chrome / Edge 收藏扩展。打开弹窗后，它会根据网页标题、网址和描述中的关键词给出分类建议；不配置 AI 也能完整收藏。

## 主要能力

- 本地关键词索引分类，默认不上传网页内容
- 分类建议可在收藏前手动调整
- 自定义分类和关键词规则
- AI 作为可选增强，不影响基础收藏流程
- 支持 Ollama 本机模型、OpenRouter 免费路由、MiniMax、DeepSeek 和 OpenAI
- 同一网址重复收藏时自动更新，避免重复条目

## AI 方案

| 方案 | 是否需要 API Key | 说明 |
| --- | --- | --- |
| Ollama | 否 | 模型在本机运行，需要先安装并启动 Ollama |
| OpenRouter 免费路由 | 是 | 使用 `openrouter/free`，免费模型与额度可能变化 |
| MiniMax / DeepSeek / OpenAI | 是 | 使用自己的 API Key 和模型 |

AI 默认关闭。启用后，也只有点击弹窗中的“AI 优化”才会发送当前网页的标题、网址和描述。

所有设置都在插件弹窗内完成，不再打开独立的大尺寸设置页面。

## 安装

1. 打开 `chrome://extensions/` 或 `edge://extensions/`。
2. 开启开发者模式。
3. 点击“加载已解压的扩展程序”。
4. 选择当前 `smartFav智能收藏夹` 文件夹。

## 本地分类规则

设置页支持按以下格式编辑关键词：

```text
编程=github, 代码, javascript, python
视频=bilibili, youtube, 视频, 直播
```

分类时，标题权重最高，网址次之，页面描述用于补充判断；没有命中时会进入“其他”或最后一个分类。
