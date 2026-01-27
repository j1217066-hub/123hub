/* indicators.js */
const Indicators = {
    getSMA(d, n) {
        // 參數驗證
        if (!Array.isArray(d) || d.length === 0 || n <= 0) {
            return [];
        }
        
        let r = [];
        for (let i = 0; i < d.length; i++) {
            if (i < n - 1) {
                r.push(null);
                continue;
            }
            
            let s = 0;
            let validCount = 0;
            
            for (let j = 0; j < n; j++) {
                const value = d[i - j];
                if (value !== null && value !== undefined && !isNaN(value)) {
                    s += value;
                    validCount++;
                }
            }
            
            if (validCount > 0) {
                r.push(s / validCount);
            } else {
                r.push(null);
            }
        }
        return r;
    },
    
    getLSMA(d, n) {
        // 參數驗證
        if (!Array.isArray(d) || d.length === 0 || n <= 1) {
            return [];
        }
        
        let r = [];
        for (let i = 0; i < d.length; i++) {
            if (i < n - 1) { 
                r.push(null); 
                continue; 
            }
            
            let sX = 0, sY = 0, sXY = 0, sX2 = 0;
            let validCount = 0;
            
            for (let j = 0; j < n; j++) {
                let y = d[i - (n - 1 - j)];
                let x = j;
                
                if (y !== null && y !== undefined && !isNaN(y)) {
                    sX += x;
                    sY += y;
                    sXY += x * y;
                    sX2 += x * x;
                    validCount++;
                }
            }
            
            // 需要至少2個有效點才能計算回歸
            if (validCount < 2) {
                r.push(null);
                continue;
            }
            
            const denominator = validCount * sX2 - sX * sX;
            
            // 避免除以零
            if (Math.abs(denominator) < 0.000001) {
                r.push(null);
                continue;
            }
            
            const m = (validCount * sXY - sX * sY) / denominator;
            const b = (sY - m * sX) / validCount;
            
            const result = m * (n - 1) + b;
            
            // 檢查結果是否有效
            if (isNaN(result) || !isFinite(result)) {
                r.push(null);
            } else {
                r.push(result);
            }
        }
        return r;
    },
    
    getBollinger(d, n = 20, k = 2) {
        // 參數驗證
        if (!Array.isArray(d) || d.length === 0) {
            return { up: [], mid: [], dn: [] };
        }
        
        const sma = this.getSMA(d, n);
        let up = [], dn = [];
        
        for (let i = 0; i < d.length; i++) {
            if (i < n - 1 || sma[i] === null) { 
                up.push(null); 
                dn.push(null); 
                continue; 
            }
            
            let sq = 0;
            let validCount = 0;
            
            for (let j = 0; j < n; j++) {
                const value = d[i - j];
                if (value !== null && value !== undefined && !isNaN(value)) {
                    sq += Math.pow(value - sma[i], 2);
                    validCount++;
                }
            }
            
            if (validCount <= 1) {
                up.push(null);
                dn.push(null);
                continue;
            }
            
            const sd = Math.sqrt(sq / validCount);
            const upper = sma[i] + k * sd;
            const lower = sma[i] - k * sd;
            
            // 檢查結果是否有效
            up.push(isNaN(upper) || !isFinite(upper) ? null : upper);
            dn.push(isNaN(lower) || !isFinite(lower) ? null : lower);
        }
        
        return { up, mid: sma, dn };
    },
    
    calcOBV(p, v, days = 120) {
        // 參數驗證
        if (!Array.isArray(p) || !Array.isArray(v) || p.length !== v.length) {
            return [];
        }
        
        // 如果資料少於指定天數，使用全部資料
        const startIdx = Math.max(0, p.length - days);
        
        let o = [0];
        for (let i = startIdx + 1; i < p.length; i++) {
            const prevPrice = p[i - 1];
            const currPrice = p[i];
            const currVolume = v[i];
            
            // 檢查數據是否有效
            if (prevPrice === null || currPrice === null || 
                isNaN(prevPrice) || isNaN(currPrice) ||
                currVolume === null || isNaN(currVolume)) {
                o.push(o[o.length - 1]);
                continue;
            }
            
            if (currPrice > prevPrice) {
                o.push(o[o.length - 1] + currVolume);
            } else if (currPrice < prevPrice) {
                o.push(o[o.length - 1] - currVolume);
            } else {
                o.push(o[o.length - 1]);
            }
        }
        
        // 在前面補上 null 以保持陣列長度一致
        const nullArray = Array(startIdx).fill(null);
        return [...nullArray, ...o];
    },
    
    // 修正：DMI (Directional Movement Index) 計算
    getDMI(highs, lows, closes, period = 14) {
        // 參數驗證
        if (!Array.isArray(highs) || !Array.isArray(lows) || !Array.isArray(closes) ||
            highs.length !== lows.length || highs.length !== closes.length) {
            return { 
                pdi: null, mdi: null, adx: null, adxr: null,
                pdiSeries: [], mdiSeries: [], adxSeries: [], adxrSeries: [] 
            };
        }
        
        const length = highs.length;
        
        // DMI需要至少 period*2 的資料才能計算完整的ADX和ADXR
        const minLength = period * 2;
        if (length < minLength) {
            console.warn(`DMI計算：資料不足，需要至少${minLength}天，目前只有${length}天`);
            return { 
                pdi: null, mdi: null, adx: null, adxr: null,
                pdiSeries: [], mdiSeries: [], adxSeries: [], adxrSeries: [] 
            };
        }
        
        // 計算真實波動範圍 (TR)
        const tr = new Array(length).fill(null);
        for (let i = 1; i < length; i++) {
            const high = highs[i];
            const low = lows[i];
            const prevClose = closes[i - 1];
            
            if (high === null || low === null || prevClose === null ||
                isNaN(high) || isNaN(low) || isNaN(prevClose)) {
                tr[i] = null;
                continue;
            }
            
            const tr1 = high - low;  // 當日高點 - 當日低點
            const tr2 = Math.abs(high - prevClose);  // 當日高點 - 前日收盤
            const tr3 = Math.abs(low - prevClose);   // 當日低點 - 前日收盤
            
            tr[i] = Math.max(tr1, tr2, tr3);
        }
        
        // 計算方向性移動 (+DM 和 -DM)
        const plusDM = new Array(length).fill(null);
        const minusDM = new Array(length).fill(null);
        
        for (let i = 1; i < length; i++) {
            const high = highs[i];
            const low = lows[i];
            const prevHigh = highs[i - 1];
            const prevLow = lows[i - 1];
            
            if (high === null || low === null || prevHigh === null || prevLow === null ||
                isNaN(high) || isNaN(low) || isNaN(prevHigh) || isNaN(prevLow)) {
                plusDM[i] = null;
                minusDM[i] = null;
                continue;
            }
            
            const upMove = high - prevHigh;
            const downMove = prevLow - low;
            
            if (upMove > downMove && upMove > 0) {
                plusDM[i] = upMove;
                minusDM[i] = 0;
            } else if (downMove > upMove && downMove > 0) {
                plusDM[i] = 0;
                minusDM[i] = downMove;
            } else {
                plusDM[i] = 0;
                minusDM[i] = 0;
            }
        }
        
        // 計算平滑的 TR、+DM、-DM（使用 Wilder's Smoothing）
        const smoothedTR = new Array(length).fill(null);
        const smoothedPlusDM = new Array(length).fill(null);
        const smoothedMinusDM = new Array(length).fill(null);
        
        // 第一個平滑值是前 period 個值的簡單加總
        let sumTR = 0;
        let sumPlusDM = 0;
        let sumMinusDM = 0;
        let validCount = 0;
        
        for (let i = 1; i <= period && i < length; i++) {
            if (tr[i] !== null && plusDM[i] !== null && minusDM[i] !== null) {
                sumTR += tr[i];
                sumPlusDM += plusDM[i];
                sumMinusDM += minusDM[i];
                validCount++;
            }
        }
        
        if (validCount >= period - 1) { // 寬鬆檢查，至少需要 period-1 個有效值
            smoothedTR[period] = sumTR;
            smoothedPlusDM[period] = sumPlusDM;
            smoothedMinusDM[period] = sumMinusDM;
        }
        
        // 後續值使用 Wilder's Smoothing 公式：前一日平滑值 - (前一日平滑值/period) + 今日值
        for (let i = period + 1; i < length; i++) {
            if (smoothedTR[i - 1] !== null && tr[i] !== null &&
                smoothedPlusDM[i - 1] !== null && plusDM[i] !== null &&
                smoothedMinusDM[i - 1] !== null && minusDM[i] !== null) {
                
                smoothedTR[i] = smoothedTR[i - 1] - (smoothedTR[i - 1] / period) + tr[i];
                smoothedPlusDM[i] = smoothedPlusDM[i - 1] - (smoothedPlusDM[i - 1] / period) + plusDM[i];
                smoothedMinusDM[i] = smoothedMinusDM[i - 1] - (smoothedMinusDM[i - 1] / period) + minusDM[i];
            }
        }
        
        // 計算方向性指標 (+DI 和 -DI)
        const plusDI = new Array(length).fill(null);
        const minusDI = new Array(length).fill(null);
        
        for (let i = period; i < length; i++) {
            if (smoothedTR[i] !== null && smoothedPlusDM[i] !== null && smoothedMinusDM[i] !== null &&
                smoothedTR[i] > 0) {
                plusDI[i] = (smoothedPlusDM[i] / smoothedTR[i]) * 100;
                minusDI[i] = (smoothedMinusDM[i] / smoothedTR[i]) * 100;
            }
        }
        
        // 計算方向性指數 (DX)
        const dx = new Array(length).fill(null);
        for (let i = period; i < length; i++) {
            if (plusDI[i] !== null && minusDI[i] !== null) {
                const sum = plusDI[i] + minusDI[i];
                if (sum > 0) {
                    dx[i] = Math.abs(plusDI[i] - minusDI[i]) / sum * 100;
                }
            }
        }
        
        // 計算平均方向性指數 (ADX)
        const adx = new Array(length).fill(null);
        
        // ADX的開始位置是 period*2
        const adxStart = period * 2;
        if (dx.length >= adxStart) {
            // 第一個 ADX 是前 period 個 DX 的平均
            let sum = 0;
            let validCount = 0;
            
            for (let i = period; i < adxStart; i++) {
                if (dx[i] !== null) {
                    sum += dx[i];
                    validCount++;
                }
            }
            
            if (validCount >= period - 1) { // 寬鬆檢查
                adx[adxStart] = sum / validCount;
            }
            
            // 後續 ADX 使用 Wilder's Smoothing
            for (let i = adxStart + 1; i < length; i++) {
                if (adx[i - 1] !== null && dx[i] !== null) {
                    adx[i] = (adx[i - 1] * (period - 1) + dx[i]) / period;
                }
            }
        }
        
        // 計算 ADXR（ADX的移動平均）
        const adxr = new Array(length).fill(null);
        const adxrStart = period * 2 + period; // ADXR需要ADX計算出來後再計算
        if (adx.length >= adxrStart) {
            for (let i = adxrStart; i < length; i++) {
                if (adx[i] !== null && adx[i - period] !== null) {
                    adxr[i] = (adx[i] + adx[i - period]) / 2;
                }
            }
        }
        
        // 返回結果
        const lastIdx = length - 1;
        
        // 檢查是否有有效的ADX和ADXR值
        let finalADX = null;
        let finalADXR = null;
        
        // 從後往前找第一個有效的ADX值
        for (let i = Math.min(lastIdx, adx.length - 1); i >= 0; i--) {
            if (adx[i] !== null && !isNaN(adx[i])) {
                finalADX = adx[i];
                break;
            }
        }
        
        // 從後往前找第一個有效的ADXR值
        for (let i = Math.min(lastIdx, adxr.length - 1); i >= 0; i--) {
            if (adxr[i] !== null && !isNaN(adxr[i])) {
                finalADXR = adxr[i];
                break;
            }
        }
        
        return {
            pdi: plusDI[lastIdx],
            mdi: minusDI[lastIdx],
            adx: finalADX,
            adxr: finalADXR,
            pdiSeries: plusDI,
            mdiSeries: minusDI,
            adxSeries: adx,
            adxrSeries: adxr
        };
    }
};