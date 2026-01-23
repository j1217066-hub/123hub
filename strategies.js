/* strategies.js - 選股策略模組 */
const Strategies = {
    /**
     * 檢查是否符合選股條件
     * @param {Array} prices 收盤價陣列
     * @param {String} mode 掃描模式
     * @returns {Boolean}
     */
    check(prices, mode) {
        try {
            // 檢查參數
            if (!prices || !Array.isArray(prices) || prices.length < 30) {
                return false;
            }
            
            if (!['A', 'B', 'C', 'D', 'E'].includes(mode)) {
                return false;
            }
            
            // 計算所有必要指標
            const lrc9 = Indicators.getLSMA(prices, 9);
            const lsma25 = Indicators.getLSMA(prices, 25);
            const ma20 = Indicators.getSMA(prices, 20);

            // 取得今日最新數值
            const curLRC9 = lrc9[lrc9.length - 1];
            const curLSMA25 = lsma25[lsma25.length - 1];
            const curMA20 = ma20[ma20.length - 1];

            // 取得歷史數值 (用於 V 型反轉)
            const preLRC9 = lrc9[lrc9.length - 2];
            const p2LRC9 = lrc9[lrc9.length - 3];
            const preLSMA25 = lsma25[lsma25.length - 2];
            const p2LSMA25 = lsma25[lsma25.length - 3];

            // 檢查數值是否有效
            const isValid = (...values) => {
                return values.every(v => v !== null && v !== undefined && !isNaN(v));
            };

            switch (mode) {
                case 'A': // LRC9 V型反轉
                    if (!isValid(curLRC9, preLRC9, p2LRC9)) return false;
                    return curLRC9 > preLRC9 && preLRC9 < p2LRC9;

                case 'B': // LSMA25 V型反轉
                    if (!isValid(curLSMA25, preLSMA25, p2LSMA25)) return false;
                    return curLSMA25 > preLSMA25 && preLSMA25 < p2LSMA25;

                case 'C': // 今日多頭：LRC9 > LSMA25 > MA20
                    if (!isValid(curLRC9, curLSMA25, curMA20)) return false;
                    return curLRC9 > curLSMA25 && curLSMA25 > curMA20;

                case 'D': // 多頭第一天
                    if (!isValid(curLRC9, curLSMA25, curMA20, preLRC9, preLSMA25, ma20[ma20.length - 2])) return false;
                    const todayBullish = curLRC9 > curLSMA25 && curLSMA25 > curMA20;
                    const yesterdayBullish = preLRC9 > preLSMA25 && preLSMA25 > ma20[ma20.length - 2];
                    return todayBullish && !yesterdayBullish;

                case 'E': // 起漲預測：目前還不是多頭排列，但明日上漲0-3%就會形成多頭排列
                    // 1. 檢查目前是不是多頭排列（必須不是）
                    if (!isValid(curLRC9, curLSMA25, curMA20)) return false;
                    
                    const isCurrentlyBullish = curLRC9 > curLSMA25 && curLSMA25 > curMA20;
                    if (isCurrentlyBullish) {
                        // 如果現在已經是多頭排列，就不符合條件
                        return false;
                    }
                    
                    // 2. 取得今日收盤價
                    const currentClose = prices[prices.length - 1];
                    if (!currentClose || currentClose <= 0) return false;
                    
                    // 3. 檢查明日上漲0-3%是否會形成多頭排列
                    // 使用更細的間隔增加準確性
                    const testPercentages = [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
                    
                    for (const pct of testPercentages) {
                        // 計算明日價格
                        const tomorrowPrice = currentClose * (1 + pct / 100);
                        
                        // 將明日價格加入序列重新計算指標
                        const testPrices = [...prices, tomorrowPrice];
                        const testLRC9 = Indicators.getLSMA(testPrices, 9);
                        const testLSMA25 = Indicators.getLSMA(testPrices, 25);
                        const testMA20 = Indicators.getSMA(testPrices, 20);
                        
                        // 檢查明日是否會形成多頭排列
                        const tomorrowIdx = testLRC9.length - 1;
                        const l = testLRC9[tomorrowIdx];
                        const m = testLSMA25[tomorrowIdx];
                        const s = testMA20[tomorrowIdx];
                        
                        if (l !== null && m !== null && s !== null && l > m && m > s) {
                            // 找到一個漲幅會形成多頭排列
                            return true;
                        }
                    }
                    
                    // 如果所有漲幅都不會形成多頭排列，則不符合條件
                    return false;

                default:
                    return false;
            }
        } catch (error) {
            console.error('策略檢查錯誤:', error);
            return false;
        }
    }
};
