/* obvEngine.js - OBV 圖形引擎 (包含數值顯示) */
function OBVEngine(canvas, data) {
    // 參數驗證
    if (!canvas || !data || !Array.isArray(data) || data.length === 0) {
        console.error('OBVEngine: 無效的參數');
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
            console.error('OBV圖形滑鼠移動錯誤:', error);
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
            console.error('OBV觸控事件錯誤:', error);
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
            console.error('OBV觸控移動事件錯誤:', error);
        }
    });

    this.render = (pct, sharedX) => {
        try {
            const lastData = data[data.length - 1];
            if (!lastData) {
                throw new Error('沒有有效的資料');
            }
            
            const prices = data.map(d => d.close);
            const volumes = data.map(d => d.volume);
            
            // 如果模擬明日漲跌，加入模擬數據
            if (Math.abs(pct) > 0.01) {
                const simClose = lastData.close * (1 + pct / 100);
                prices.push(simClose);
                volumes.push(0); // 明日成交量未知，設為0
            }
            
            // 計算 OBV 指標
            const obv = Indicators.calcOBV(prices, volumes, 120);
            const o30 = Indicators.getSMA(obv, 30);
            const o60 = Indicators.getSMA(obv, 60);

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
            
            // 取得要顯示的數據切片
            const startIdx = Math.max(0, obv.length - plotCount);
            const oSlice = obv.slice(startIdx);
            const m30 = o30.slice(startIdx);
            const m60 = o60.slice(startIdx);
            
            // 收集所有有效數值
            const allValues = [
                ...oSlice.filter(v => v !== null && !isNaN(v)),
                ...m30.filter(v => v !== null && !isNaN(v)),
                ...m60.filter(v => v !== null && !isNaN(v))
            ];
            
            if (allValues.length === 0) {
                // 顯示無數據訊息
                ctx.fillStyle = "#7f8c8d";
                ctx.font = "12px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                ctx.textAlign = "center";
                ctx.fillText("無OBV數據", canvasWidth / 2, canvasHeight / 2);
                ctx.textAlign = "left";
                return;
            }
            
            // 計算最大值和最小值
            let maxO = Math.max(...allValues);
            let minO = Math.min(...allValues);
            
            // 確保有足夠的範圍
            const range = maxO - minO;
            if (range < 1000) {
                maxO = maxO + 500;
                minO = Math.min(0, minO - 500);
            }
            
            const finalRange = Math.max(1, maxO - minO);
            
            // 計算Y座標
            const getOY = (v) => {
                if (v === null || isNaN(v)) return null;
                const plotHeight = canvasHeight - 40; // 為文字留出更多空間
                return canvasHeight - 30 - ((v - minO) / finalRange * plotHeight);
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
            
            // 繪製 OBV 線條
            const drawLine = (pts, color, lineWidth = 1.5) => {
                if (!pts || pts.length === 0) return;
                
                ctx.strokeStyle = color;
                ctx.lineWidth = lineWidth;
                ctx.beginPath();
                
                let firstPoint = true;
                pts.forEach((v, i) => {
                    const y = getOY(v);
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
            };
            
            // 繪製所有 OBV 線條
            drawLine(oSlice, "#fbc02d", 2);  // OBV: 黃色
            drawLine(m30, "#2196f3", 1.5);   // OBV(30): 藍色
            drawLine(m60, "#9c27b0", 1.5);   // OBV(60): 紫色
            
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
                
                // 顯示當前數值
                const hoverIdx = Math.min(Math.floor(curX / barW), oSlice.length - 1);
                const obvVal = hoverIdx >= 0 ? oSlice[hoverIdx] : null;
                const ma30Val = hoverIdx >= 0 ? m30[hoverIdx] : null;
                const ma60Val = hoverIdx >= 0 ? m60[hoverIdx] : null;
                
                if (obvVal !== null && !isNaN(obvVal)) {
                    ctx.fillStyle = "#fbc02d";
                    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                    ctx.fillText(`OBV: ${Math.round(obvVal).toLocaleString()}`, 5, 20);
                }
                
                if (ma30Val !== null && !isNaN(ma30Val)) {
                    ctx.fillStyle = "#2196f3";
                    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                    ctx.fillText(`MA30: ${Math.round(ma30Val).toLocaleString()}`, canvasWidth / 3, 20);
                }
                
                if (ma60Val !== null && !isNaN(ma60Val)) {
                    ctx.fillStyle = "#9c27b0";
                    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                    ctx.fillText(`MA60: ${Math.round(ma60Val).toLocaleString()}`, canvasWidth * 2 / 3, 20);
                }
            } else {
                // 顯示最新數值
                const lastIdx = oSlice.length - 1;
                const obvVal = lastIdx >= 0 ? oSlice[lastIdx] : null;
                const ma30Val = lastIdx >= 0 ? m30[lastIdx] : null;
                const ma60Val = lastIdx >= 0 ? m60[lastIdx] : null;
                
                if (obvVal !== null && !isNaN(obvVal)) {
                    ctx.fillStyle = "#fbc02d";
                    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                    ctx.fillText(`OBV: ${Math.round(obvVal).toLocaleString()}`, 5, 20);
                }
                
                if (ma30Val !== null && !isNaN(ma30Val)) {
                    ctx.fillStyle = "#2196f3";
                    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                    ctx.fillText(`MA30: ${Math.round(ma30Val).toLocaleString()}`, canvasWidth / 3, 20);
                }
                
                if (ma60Val !== null && !isNaN(ma60Val)) {
                    ctx.fillStyle = "#9c27b0";
                    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                    ctx.fillText(`MA60: ${Math.round(ma60Val).toLocaleString()}`, canvasWidth * 2 / 3, 20);
                }
            }
            
        } catch (error) {
            console.error('OBVEngine.render 錯誤:', error);
            
            // 顯示錯誤訊息
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
                ctx.fillStyle = "#d05a6e";
                ctx.font = "bold 12px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                ctx.fillText("OBV圖形錯誤", 10, 20);
                ctx.font = "10px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                ctx.fillText(error.message.substring(0, 40), 10, 35);
            }
        }
    };
}