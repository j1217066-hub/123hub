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
            
            if (!['A', 'B', 'C', 'D', 'E', 'F'].includes(mode)) {
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

                case 'F': // DMI多頭：+DI > -DI 且 ADX > ADXR 且 今日指標大於昨日
                    // 需要至少29天的價格數據來計算DMI（因為需要前一日數據）
                    if (prices.length < 29) return false;
                    
                    // 計算DMI指標
                    // 由於Indicators.getDMI需要highs, lows, closes，我們使用價格數據模擬
                    // 實際應用中應該使用完整的高低收數據，這裡為簡化使用收盤價
                    const highs = prices.map(p => p * 1.01); // 假設高點為收盤價的1.01倍
                    const lows = prices.map(p => p * 0.99);  // 假設低點為收盤價的0.99倍
                    
                    const dmiResult = Indicators.getDMI(highs, lows, prices, 14);
                    
                    // 檢查是否有有效的DMI數據
                    if (!dmiResult || 
                        dmiResult.pdi === null || dmiResult.mdi === null || 
                        dmiResult.adx === null || dmiResult.adxr === null) {
                        return false;
                    }
                    
                    // 取得今日和昨日的DMI值
                    const lastIdx = prices.length - 1;
                    
                    // 從序列中取得今日和昨日值
                    const curPDI = dmiResult.pdiSeries[lastIdx];
                    const curMDI = dmiResult.mdiSeries[lastIdx];
                    const curADX = dmiResult.adxSeries[lastIdx];
                    const curADXR = dmiResult.adxrSeries[lastIdx];
                    
                    const prePDI = dmiResult.pdiSeries[lastIdx - 1];
                    const preMDI = dmiResult.mdiSeries[lastIdx - 1];
                    const preADX = dmiResult.adxSeries[lastIdx - 1];
                    const preADXR = dmiResult.adxrSeries[lastIdx - 1];
                    
                    // 檢查所有值是否有效
                    if (!isValid(curPDI, curMDI, curADX, curADXR, prePDI, preMDI, preADX, preADXR)) {
                        return false;
                    }
                    
                    // 檢查DMI多頭條件：
                    // 1. +DI 大於 -DI
                    // 2. ADX 大於 ADXR
                    // 3. 今日+DI 大於 昨日+DI
                    // 4. 今日ADX 大於 昨日ADX
                    // 5. 今日ADXR 大於 昨日ADXR
                    const isDMIBullish = 
                        curPDI > curMDI &&          // +DI > -DI
                        curADX > curADXR &&         // ADX > ADXR
                        curPDI > prePDI &&          // 今日+DI > 昨日+DI
                        curADX > preADX &&          // 今日ADX > 昨日ADX
                        curADXR > preADXR;          // 今日ADXR > 昨日ADXR
                    
                    return isDMIBullish;

                default:
                    return false;
            }
        } catch (error) {
            console.error('策略檢查錯誤:', error);
            return false;
        }
    }
};