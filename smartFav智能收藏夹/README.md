# SmartFav - AI 智能收藏夹

> Chrome/Edge 浏览器扩展程序 - AI 自动分类网页收藏

## 功能特性

- ⭐ 一键收藏网页
- 🤖 AI 自动分析内容并分类
- 🔑 支持自定义 API Key
- 📁 多种分类文件夹
- 🏷️ 智能标签系统

## 支持的 AI

| 提供商 | 模型 |
|--------|------|
| MiniMax | M2.5 |
| OpenAI | GPT-4o |
| DeepSeek | V3 |

## 安装方法

### 1. 开发模式安装

1. 打开 Chrome/Edge 浏览器
2. 访问 `chrome://extensions/` 或 `edge://extensions/`
3. 开启「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择 `smartFav智能收藏夹` 文件夹

### 2. 使用

1. 点击浏览器工具栏的 ⭐ 图标
2. 等待 AI 分析当前网页
3. 确认分类建议
4. 收藏成功！

## 配置 API

1. 点击 ⚙️ 打开设置
2. 选择 AI 提供商
3. 输入 API Key
4. 保存并测试

## 文件结构

```
smartFav智能收藏夹/
├── manifest.json      # 插件配置
├── popup.html        #  popup.js          #弹出窗口
├── 弹出窗口逻辑
├── popup.css         # 弹出窗口样式
├── background.js     # 后台脚本
├── options.html      # 设置页面
├── options.js       # 设置逻辑
├── styles/          # 样式目录
└── icons/          # 图标目录
```

## 技术栈

- Chrome Extension Manifest V3
- Vanilla JavaScript
- Chrome Storage API

## License

MIT
