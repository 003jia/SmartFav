// SmartFav Background - 后台脚本

// 监听安装事件
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // 初始化默认设置
    const defaultSettings = {
      apiProvider: 'minimax',
      apiKey: '',
      model: 'MiniMax-M2.5',
      categories: ['视频', '编程', '工具', '学习', '资讯', '其他']
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
    const { favorites = [] } = chrome.storage.local.get(['favorites']);
    favorites.unshift(message.favorite);
    chrome.storage.local.set({ favorites });
    sendResponse({ success: true });
    return true;
  }
});
