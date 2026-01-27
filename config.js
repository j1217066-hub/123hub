// 應用程式配置設定
const APP_CONFIG = {
    // 掃描模式設定
    SCAN_MODES: {
        'A': { name: 'LRC轉折', color: '#555555' },
        'B': { name: 'LSMA轉折', color: '#6a83a4' },
        'C': { name: '今日多頭', color: '#d05a6e' },
        'D': { name: '多頭第一天', color: '#6b8e23' },
        'E': { name: '起漲預測', color: '#ff9800' },
        'F': { name: 'DMI多頭', color: '#9c27b0' }  // 新增F選項
    },
    
    // API 設定
    API: {
        YAHOO_CHART: 'https://query1.finance.yahoo.com/v8/finance/chart/',
        CORS_PROXY: 'https://corsproxy.io/?',
        PARAMS: 'range=1y&interval=1d'
    },
    
    // 效能設定
    PERFORMANCE: {
        CHUNK_SIZE: 3,      // 並行請求數量
        REQUEST_DELAY: 300, // 請求間隔(ms)
        MIN_DATA_POINTS: 30 // 最少數據點
    },
    
    // 顏色設定
    COLORS: {
        UP: '#e53935',
        DOWN: '#2e7d32',
        WARNING: '#ff9800',
        NEUTRAL: '#7f8c8d',
        PRIMARY: '#6b8e23',
        DMI_BULLISH: '#9c27b0'  // 新增DMI多頭顏色
    },
    
    // 排序選項
    SORT_OPTIONS: [
        { id: 'code', label: '股號' },
        { id: 'change', label: '漲跌幅' },
        { id: 'price', label: '股價' }
    ]
};

// 工具函數
const AppUtils = {
    // 取得模式名稱
    getModeName(mode) {
        return APP_CONFIG.SCAN_MODES[mode]?.name || '未知模式';
    },
    
    // 解析股號數字
    extractStockCodeNumber(code) {
        const matches = code.match(/\d+/g);
        return matches ? parseInt(matches[0], 10) : 0;
    },
    
    // 格式化百分比
    formatPercent(value) {
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(2)}%`;
    },
    
    // 檢查是否為手機
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
};