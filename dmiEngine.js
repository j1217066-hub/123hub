/* dmiEngine.js - DMI 圖形引擎 (包含數值顯示) */
function DMIEngine(canvas, data) {
    // 參數驗證
    if (!canvas || !data || !Array.isArray(data) || data.length === 0) {
        console.error('DMIEngine: 無效的參數');
        this.render = function() { return null; };
        this.getMouseX = function() { return -1; };
        return;
    }
    
    const dpr = window.devicePixelRatio || 1;
    const plotCount = 80;
    let mouseX = -1;
    
    this.getMouseX = function() { return mouseX; };
    
    canvas.addEventListener('mousemove', (e) => {
        try {
            const rect = canvas.getBoundingClientRect();
            mouseX = e.clientX - rect.left;
            if (this.onMouseMove) this.onMouseMove();
        } catch (error) {
            console.error('DMI圖形滑鼠移動錯誤:', error);
        }
    });
    
    canvas.addEventListener('mouseleave', () => { 
        mouseX = -1; 
        if (this.onMouseMove) this.onMouseMove(); 
    });
    
    // 為觸控設備添加事件
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        try {
            const rect = canvas.getBoundingClientRect();
            const touch = e.touches[0];
            mouseX = touch.clientX - rect.left;
            if (this.onMouseMove) this.onMouseMove();
        } catch (error) {
            console.error('DMI觸控事件錯誤:', error);
        }
    });
    
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        try {
            const rect = canvas.getBoundingClientRect();
            const touch = e.touches[0];
            mouseX = touch.clientX - rect.left;
            if (this.onMouseMove) this.onMouseMove();
        } catch (error) {
            console.error('DMI觸控移動事件錯誤:', error);
        }
    });

    this.render = (pdiSeries, mdiSeries, adxSeries, adxrSeries, currentPDI, currentMDI, currentADX, currentADXR, sharedX) => {
        try {
            // 檢查參數
            if (!Array.isArray(pdiSeries) || !Array.isArray(mdiSeries)) {
                console.warn('DMIEngine: 缺少必要的DMI數據序列');
                return;
            }
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('無法取得Canvas Context');
            }
            
            const canvasWidth = canvas.offsetWidth;
            const canvasHeight = canvas.offsetHeight || 120;
            
            canvas.width = canvasWidth * dpr; 
            canvas.height = canvasHeight * dpr; 
            ctx.scale(dpr, dpr);
            
            const barW = canvasWidth / (plotCount + 2);
            
            // 清空畫布
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            ctx.strokeStyle = "#ccc"; 
            ctx.lineWidth = 1; 
            ctx.strokeRect(0, 0, canvasWidth, canvasHeight);
            
            // 取得要顯示的數據切片 - 確保有足夠的數據
            const startIdx = Math.max(0, pdiSeries.length - plotCount);
            const pdiSlice = pdiSeries.slice(startIdx);
            const mdiSlice = mdiSeries.slice(startIdx);
            const adxSlice = adxSeries ? adxSeries.slice(startIdx) : [];
            const adxrSlice = adxrSeries ? adxrSeries.slice(startIdx) : [];
            
            // 收集所有有效數值
            const allValues = [
                ...pdiSlice.filter(v => v !== null && !isNaN(v)),
                ...mdiSlice.filter(v => v !== null && !isNaN(v)),
                ...adxSlice.filter(v => v !== null && !isNaN(v)),
                ...adxrSlice.filter(v => v !== null && !isNaN(v))
            ];
            
            if (allValues.length === 0) {
                // 顯示無數據訊息
                ctx.fillStyle = "#7f8c8d";
                ctx.font = "12px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                ctx.textAlign = "center";
                ctx.fillText("計算DMI需要更多數據", canvasWidth / 2, canvasHeight / 2);
                ctx.textAlign = "left";
                return;
            }
            
            // 計算最大值和最小值
            let maxVal = Math.max(...allValues);
            let minVal = Math.min(...allValues);
            
            // 確保有足夠的範圍
            const range = maxVal - minVal;
            if (range < 10) {
                maxVal = maxVal + 5;
                minVal = Math.max(0, minVal - 5);
            }
            
            const finalRange = Math.max(1, maxVal - minVal);
            
            // 計算Y座標
            const getY = (v) => {
                if (v === null || isNaN(v)) return null;
                const plotHeight = canvasHeight - 40; // 為文字留出更多空間
                return canvasHeight - 30 - ((v - minVal) / finalRange * plotHeight);
            };
            
            // 繪製網格線
            ctx.strokeStyle = "#f0f0f0";
            ctx.lineWidth = 0.5;
            
            // 繪製水平線
            for (let i = 0; i <= 4; i++) {
                const y = 30 + (i * (canvasHeight - 60) / 4);
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvasWidth, y);
                ctx.stroke();
            }
            
            // 繪製 DMI 線條
            const drawLine = (pts, color, lineWidth = 1.5, dash = false) => {
                if (!pts || pts.length === 0) return;
                
                ctx.strokeStyle = color;
                ctx.lineWidth = lineWidth;
                
                // 設置虛線（用於ADXR）
                if (dash) {
                    ctx.setLineDash([3, 2]);
                } else {
                    ctx.setLineDash([]);
                }
                
                ctx.beginPath();
                
                let firstPoint = true;
                pts.forEach((v, i) => {
                    const y = getY(v);
                    if (y !== null && !isNaN(y)) {
                        const x = i * barW + barW / 2;
                        if (firstPoint) {
                            ctx.moveTo(x, y);
                            firstPoint = false;
                        } else {
                            ctx.lineTo(x, y);
                        }
                    }
                });
                ctx.stroke();
                
                // 重置虛線
                if (dash) {
                    ctx.setLineDash([]);
                }
            };
            
            // 繪製所有 DMI 線條 - 使用指定的顏色
            drawLine(pdiSlice, "#fbc02d", 2);            // +DI: 黃色 (#fbc02d)
            drawLine(mdiSlice, "#2196f3", 2);           // -DI: 藍色 (#2196f3)
            
            // ADX和ADXR可能沒有足夠數據，有數據才繪製
            if (adxSlice.length > 0) {
                drawLine(adxSlice, "#e91e63", 2);       // ADX: 粉紅色 (#e91e63)
            }
            
            if (adxrSlice && adxrSlice.length > 0) {
                drawLine(adxrSlice, "#757575", 1.5, true);  // ADXR: 灰色 (#757575) 虛線
            }
            
            // 繪製垂直參考線
            const curX = sharedX > 0 ? sharedX : mouseX;
            if (curX > 0) { 
                ctx.setLineDash([3, 3]); 
                ctx.strokeStyle = "#666"; 
                ctx.lineWidth = 0.8;
                ctx.beginPath(); 
                ctx.moveTo(curX, 30); 
                ctx.lineTo(curX, canvasHeight - 10); 
                ctx.stroke(); 
                ctx.setLineDash([]); 
                
                // 顯示當前位置的數值
                const hoverIdx = Math.min(Math.floor(curX / barW), pdiSlice.length - 1);
                
                // 計算實際的數據索引
                const actualIdx = startIdx + hoverIdx;
                const prevIdx = actualIdx - 1;
                
                // 獲取當前值
                const pdiVal = hoverIdx >= 0 && actualIdx < pdiSeries.length ? pdiSeries[actualIdx] : null;
                const mdiVal = hoverIdx >= 0 && actualIdx < mdiSeries.length ? mdiSeries[actualIdx] : null;
                const adxVal = hoverIdx >= 0 && actualIdx < adxSeries.length ? adxSeries[actualIdx] : null;
                const adxrVal = hoverIdx >= 0 && actualIdx < adxrSeries.length ? adxrSeries[actualIdx] : null;
                
                // 獲取前一日值
                const prevPdiVal = prevIdx >= 0 && prevIdx < pdiSeries.length ? pdiSeries[prevIdx] : null;
                const prevMdiVal = prevIdx >= 0 && prevIdx < mdiSeries.length ? mdiSeries[prevIdx] : null;
                const prevAdxVal = prevIdx >= 0 && prevIdx < adxSeries.length ? adxSeries[prevIdx] : null;
                const prevAdxrVal = prevIdx >= 0 && prevIdx < adxrSeries.length ? adxrSeries[prevIdx] : null;
                
                // 清除頂部區域
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvasWidth, 25);
                
                // 顯示當前滑鼠位置的數值，比較前一天漲跌
                if (pdiVal !== null && !isNaN(pdiVal)) {
                    const isUp = prevPdiVal !== null && !isNaN(prevPdiVal) && pdiVal > prevPdiVal;
                    const arrow = isUp ? "▲" : "▼";
                    const arrowColor = isUp ? "#e53935" : "#2e7d32";
                    
                    ctx.fillStyle = "#fbc02d";  // 黃色
                    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                    
                    // 顯示數值和箭頭
                    const text = `+DI: ${pdiVal.toFixed(1)}`;
                    ctx.fillText(text, 5, 18);
                    
                    // 顯示箭頭
                    const textWidth = ctx.measureText(text).width;
                    ctx.fillStyle = arrowColor;
                    ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                    ctx.fillText(arrow, 5 + textWidth + 2, 18);
                }
                
                if (mdiVal !== null && !isNaN(mdiVal)) {
                    const isUp = prevMdiVal !== null && !isNaN(prevMdiVal) && mdiVal > prevMdiVal;
                    const arrow = isUp ? "▲" : "▼";
                    const arrowColor = isUp ? "#e53935" : "#2e7d32";
                    
                    ctx.fillStyle = "#2196f3";  // 藍色
                    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                    
                    // 顯示數值和箭頭
                    const text = `-DI: ${mdiVal.toFixed(1)}`;
                    ctx.fillText(text, canvasWidth / 4, 18);
                    
                    // 顯示箭頭
                    const textWidth = ctx.measureText(text).width;
                    ctx.fillStyle = arrowColor;
                    ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                    ctx.fillText(arrow, canvasWidth / 4 + textWidth + 2, 18);
                }
                
                if (adxVal !== null && !isNaN(adxVal)) {
                    const isUp = prevAdxVal !== null && !isNaN(prevAdxVal) && adxVal > prevAdxVal;
                    const arrow = isUp ? "▲" : "▼";
                    const arrowColor = isUp ? "#e53935" : "#2e7d32";
                    
                    ctx.fillStyle = "#e91e63";  // 粉紅色
                    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                    
                    // 顯示數值和箭頭
                    const text = `ADX: ${adxVal.toFixed(1)}`;
                    ctx.fillText(text, canvasWidth / 2, 18);
                    
                    // 顯示箭頭
                    const textWidth = ctx.measureText(text).width;
                    ctx.fillStyle = arrowColor;
                    ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                    ctx.fillText(arrow, canvasWidth / 2 + textWidth + 2, 18);
                }
                
                if (adxrVal !== null && !isNaN(adxrVal)) {
                    const isUp = prevAdxrVal !== null && !isNaN(prevAdxrVal) && adxrVal > prevAdxrVal;
                    const arrow = isUp ? "▲" : "▼";
                    const arrowColor = isUp ? "#e53935" : "#2e7d32";
                    
                    ctx.fillStyle = "#757575";  // 灰色
                    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                    
                    // 顯示數值和箭頭
                    const text = `ADXR: ${adxrVal.toFixed(1)}`;
                    ctx.fillText(text, canvasWidth * 3 / 4, 18);
                    
                    // 顯示箭頭
                    const textWidth = ctx.measureText(text).width;
                    ctx.fillStyle = arrowColor;
                    ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                    ctx.fillText(arrow, canvasWidth * 3 / 4 + textWidth + 2, 18);
                }
            } else {
                // 清除頂部區域
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvasWidth, 25);
                
                // 顯示最新數值，比較前一天漲跌
                // 計算前一日索引
                const lastIdx = pdiSeries.length - 1;
                const prevIdx = lastIdx - 1;
                
                // 獲取最新值
                const curPdiVal = pdiSeries[lastIdx];
                const curMdiVal = mdiSeries[lastIdx];
                const curAdxVal = adxSeries ? adxSeries[lastIdx] : null;
                const curAdxrVal = adxrSeries ? adxrSeries[lastIdx] : null;
                
                // 獲取前一日值
                const prevPdiVal = prevIdx >= 0 ? pdiSeries[prevIdx] : null;
                const prevMdiVal = prevIdx >= 0 ? mdiSeries[prevIdx] : null;
                const prevAdxVal = adxSeries && prevIdx >= 0 ? adxSeries[prevIdx] : null;
                const prevAdxrVal = adxrSeries && prevIdx >= 0 ? adxrSeries[prevIdx] : null;
                
                // 顯示最新數值
                if (curPdiVal !== null && !isNaN(curPdiVal) && curPdiVal > 0) {
                    const isUp = prevPdiVal !== null && !isNaN(prevPdiVal) && curPdiVal > prevPdiVal;
                    const arrow = isUp ? "▲" : "▼";
                    const arrowColor = isUp ? "#e53935" : "#2e7d32";
                    
                    ctx.fillStyle = "#fbc02d";  // 黃色
                    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                    
                    // 顯示數值和箭頭
                    const text = `+DI: ${curPdiVal.toFixed(1)}`;
                    ctx.fillText(text, 5, 18);
                    
                    // 顯示箭頭
                    const textWidth = ctx.measureText(text).width;
                    ctx.fillStyle = arrowColor;
                    ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                    ctx.fillText(arrow, 5 + textWidth + 2, 18);
                } else {
                    ctx.fillStyle = "#fbc02d";
                    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                    ctx.fillText(`+DI: -`, 5, 18);
                }
                
                if (curMdiVal !== null && !isNaN(curMdiVal) && curMdiVal > 0) {
                    const isUp = prevMdiVal !== null && !isNaN(prevMdiVal) && curMdiVal > prevMdiVal;
                    const arrow = isUp ? "▲" : "▼";
                    const arrowColor = isUp ? "#e53935" : "#2e7d32";
                    
                    ctx.fillStyle = "#2196f3";  // 藍色
                    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                    
                    // 顯示數值和箭頭
                    const text = `-DI: ${curMdiVal.toFixed(1)}`;
                    ctx.fillText(text, canvasWidth / 4, 18);
                    
                    // 顯示箭頭
                    const textWidth = ctx.measureText(text).width;
                    ctx.fillStyle = arrowColor;
                    ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                    ctx.fillText(arrow, canvasWidth / 4 + textWidth + 2, 18);
                } else {
                    ctx.fillStyle = "#2196f3";
                    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                    ctx.fillText(`-DI: -`, canvasWidth / 4, 18);
                }
                
                if (curAdxVal !== null && !isNaN(curAdxVal) && curAdxVal > 0) {
                    const isUp = prevAdxVal !== null && !isNaN(prevAdxVal) && curAdxVal > prevAdxVal;
                    const arrow = isUp ? "▲" : "▼";
                    const arrowColor = isUp ? "#e53935" : "#2e7d32";
                    
                    ctx.fillStyle = "#e91e63";  // 粉紅色
                    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                    
                    // 顯示數值和箭頭
                    const text = `ADX: ${curAdxVal.toFixed(1)}`;
                    ctx.fillText(text, canvasWidth / 2, 18);
                    
                    // 顯示箭頭
                    const textWidth = ctx.measureText(text).width;
                    ctx.fillStyle = arrowColor;
                    ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                    ctx.fillText(arrow, canvasWidth / 2 + textWidth + 2, 18);
                } else {
                    ctx.fillStyle = "#e91e63";
                    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                    ctx.fillText(`ADX: -`, canvasWidth / 2, 18);
                }
                
                if (curAdxrVal !== null && !isNaN(curAdxrVal) && curAdxrVal > 0) {
                    const isUp = prevAdxrVal !== null && !isNaN(prevAdxrVal) && curAdxrVal > prevAdxrVal;
                    const arrow = isUp ? "▲" : "▼";
                    const arrowColor = isUp ? "#e53935" : "#2e7d32";
                    
                    ctx.fillStyle = "#757575";  // 灰色
                    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                    
                    // 顯示數值和箭頭
                    const text = `ADXR: ${curAdxrVal.toFixed(1)}`;
                    ctx.fillText(text, canvasWidth * 3 / 4, 18);
                    
                    // 顯示箭頭
                    const textWidth = ctx.measureText(text).width;
                    ctx.fillStyle = arrowColor;
                    ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                    ctx.fillText(arrow, canvasWidth * 3 / 4 + textWidth + 2, 18);
                } else {
                    ctx.fillStyle = "#757575";
                    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                    ctx.fillText(`ADXR: -`, canvasWidth * 3 / 4, 18);
                }
            }
            
        } catch (error) {
            console.error('DMIEngine.render 錯誤:', error);
            
            // 顯示錯誤訊息
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
                ctx.fillStyle = "#d05a6e";
                ctx.font = "bold 12px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                ctx.fillText("DMI圖形錯誤", 10, 20);
                ctx.font = "10px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                ctx.fillText(error.message.substring(0, 40), 10, 35);
            }
        }
    };
}