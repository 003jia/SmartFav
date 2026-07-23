// SmartFav Background - 后台脚本

// 监听安装事件
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // 初始化默认设置
    const defaultSettings = {
      aiEnabled: false,
      apiProvider: 'ollama',
      apiKey: '',
      model: 'qwen2.5:3b',
      categories: ['视频', '编程', '工具', '学习', '资讯', '其他'],
      keywordRules: {
        视频: ['视频', '直播', '电影', '影视', '弹幕', 'bilibili', 'youtube'],
        编程: ['编程', '代码', '开发', 'github', 'gitlab', 'javascript', 'python'],
        工具: ['工具', '效率', '转换', '下载', '插件', '扩展'],
        学习: ['学习', '教程', '课程', '文档', '知识', '教育'],
        资讯: ['新闻', '资讯', '报道', '头条', '快讯'],
        其他: []
      }
    };
    
    chrome.storage.local.set({
      settings: defaultSettings,
      favorites: []
    });
    
    console.log('SmartFav 已安装');
  }
});

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'getFavorites') {
    chrome.storage.local.get(['favorites'], (result) => {
      sendResponse(result.favorites || []);
    });
    return true;
  }
  
  if (message.type === 'saveFavorite') {
    chrome.storage.local.get(['favorites'], (result) => {
      const favorites = Array.isArray(result.favorites) ? result.favorites : [];
      const nextFavorites = [message.favorite, ...favorites.filter((item) => item.url !== message.favorite.url)];
      chrome.storage.local.set({ favorites: nextFavorites }, () => sendResponse({ success: true }));
    });
    return true;
  }
});
