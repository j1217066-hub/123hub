/* strategies.js - 選股策略檢查邏輯 */
const Strategies = {
    check(prices, mode) {
        if (!prices || prices.length < 30) return false;
        
        const lrc9 = Indicators.getLSMA(prices, 9);
        const lsma25 = Indicators.getLSMA(prices, 25);
        const ma20 = Indicators.getSMA(prices, 20);
        
        const lastIdx = prices.length - 1;
        
        // 檢查指標是否有效
        if (lrc9[lastIdx] === null || lsma25[lastIdx] === null || ma20[lastIdx] === null ||
            isNaN(lrc9[lastIdx]) || isNaN(lsma25[lastIdx]) || isNaN(ma20[lastIdx])) {
            return false;
        }
        
        const curL = lrc9[lastIdx];
        const curM = lsma25[lastIdx];
        const curS = ma20[lastIdx];
        
        switch(mode) {
            case 'A': // LRC轉折
                // 檢查今日是否突破且轉折向上
                if (lastIdx < 2) return false;
                const prevL1 = lrc9[lastIdx-1];
                const prevL2 = lrc9[lastIdx-2];
                const curP = prices[lastIdx];
                const prevP1 = prices[lastIdx-1];
                const prevP2 = prices[lastIdx-2];
                
                return (curL > prevL1 && prevL1 <= prevL2 && 
                        curP > prevP1 && prevP1 <= prevP2);
                
            case 'B': // LSMA轉折
                // 檢查今日是否突破且轉折向上
                if (lastIdx < 2) return false;
                const prevM1 = lsma25[lastIdx-1];
                const prevM2 = lsma25[lastIdx-2];
                const curP_B = prices[lastIdx];
                const prevP1_B = prices[lastIdx-1];
                const prevP2_B = prices[lastIdx-2];
                
                return (curM > prevM1 && prevM1 <= prevM2 && 
                        curP_B > prevP1_B && prevP1_B <= prevP2_B);
                
            case 'C': // 今日多頭
                return (curL > curM && curM > curS);
                
            case 'D': // 多頭第一天
                if (lastIdx < 1) return false;
                const prevL_D = lrc9[lastIdx-1];
                const prevM_D = lsma25[lastIdx-1];
                const prevS_D = ma20[lastIdx-1];
                
                const wasNotBullish = !(prevL_D > prevM_D && prevM_D > prevS_D);
                const isNowBullish = (curL > curM && curM > curS);
                
                return (wasNotBullish && isNowBullish);
                
            case 'F': // DMI多頭
                // DMI邏輯在 app.js 中單獨處理
                return false; // 實際DMI檢查在app.js中進行
                
            case 'G': // OBV轉折
                // OBV轉折策略
                return Strategies.checkOBVTrendReversal(prices);
                
            default:
                return false;
        }
    },
    
    // OBV轉折策略檢查
    checkOBVTrendReversal(prices, volumes) {
        try {
            if (!prices || prices.length < 60 || !volumes || volumes.length < 60) {
                return false;
            }
            
            // 計算OBV
            const obv = Indicators.calcOBV(prices, volumes, 120);
            const obv30 = Indicators.getSMA(obv, 30);
            const obv60 = Indicators.getSMA(obv, 60);
            
            const lastIdx = obv.length - 1;
            if (lastIdx < 10) return false;
            
            // 檢查OBV和OBV指標是否有效
            if (obv[lastIdx] === null || obv30[lastIdx] === null || obv60[lastIdx] === null ||
                isNaN(obv[lastIdx]) || isNaN(obv30[lastIdx]) || isNaN(obv60[lastIdx])) {
                return false;
            }
            
            const currentOBV = obv[lastIdx];
            const currentOBV30 = obv30[lastIdx];
            const currentOBV60 = obv60[lastIdx];
            
            // 條件1：OBV突破30日均線
            const break30 = (currentOBV > currentOBV30);
            
            // 條件2：30日均線突破60日均線（或即將突破）
            const break60 = (currentOBV30 > currentOBV60) || 
                           (Math.abs(currentOBV30 - currentOBV60) / currentOBV60 < 0.01); // 接近突破
            
            // 條件3：OBV呈V型反轉（最近5天最低點，然後回升）
            let minOBV = Infinity;
            let minIdx = -1;
            const lookback = Math.min(20, lastIdx);
            
            for (let i = lastIdx - lookback; i <= lastIdx; i++) {
                if (obv[i] !== null && obv[i] < minOBV) {
                    minOBV = obv[i];
                    minIdx = i;
                }
            }
            
            // 檢查是否有低點且在低點後有上升
            const hasBottom = (minIdx >= 0 && minIdx < lastIdx - 2);
            const risingFromBottom = hasBottom ? (currentOBV > minOBV * 1.02) : false; // 從底部上升至少2%
            
            // 綜合條件：突破均線且呈V型反轉
            return (break30 && break60 && risingFromBottom);
            
        } catch (error) {
            console.error('OBV轉折檢查錯誤:', error);
            return false;
        }
    },
    
    // 其他輔助方法
    checkDMIBullish(pdiSeries, mdiSeries, adxSeries, adxrSeries) {
        if (!pdiSeries || !mdiSeries || !adxSeries || !adxrSeries) return false;
        
        const lastIdx = pdiSeries.length - 1;
        if (lastIdx < 1) return false;
        
        const curPDI = pdiSeries[lastIdx];
        const curMDI = mdiSeries[lastIdx];
        const curADX = adxSeries[lastIdx];
        const curADXR = adxrSeries[lastIdx];
        const prevPDI = pdiSeries[lastIdx-1];
        const prevMDI = mdiSeries[lastIdx-1];
        const prevADX = adxSeries[lastIdx-1];
        const prevADXR = adxrSeries[lastIdx-1];
        
        // DMI多頭條件：
        // 1. +DI > -DI
        // 2. ADX > ADXR（趨勢強於平均）
        // 3. +DI上升、-DI下降（多方增強、空方減弱）
        // 4. ADX上升（趨勢增強）
        return (curPDI !== null && curMDI !== null && curADX !== null && curADXR !== null &&
                curPDI > curMDI && 
                curADX > curADXR &&
                curPDI > prevPDI && 
                curMDI < prevMDI && 
                curADX > prevADX);
    }
};