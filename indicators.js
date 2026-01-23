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
    }
};