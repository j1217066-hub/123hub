/* subEngine.js */
function SubEngine(canvas, data) {
    // 參數驗證
    if (!canvas || !data || !Array.isArray(data) || data.length === 0) {
        console.error('SubEngine: 無效的參數');
        // 返回一個安全的物件
        this.render = function() { return { obv: 0, ma30: 0, ma60: 0 }; };
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
            console.error('副圖滑鼠移動錯誤:', error);
        }
    });
    
    canvas.addEventListener('mouseleave', () => { 
        mouseX = -1; 
        if (this.onMouseMove) this.onMouseMove(); 
    });

    this.render = (pct, sharedX, obvDays = 120) => {
        try {
            const lastData = data[data.length - 1];
            if (!lastData) {
                throw new Error('沒有有效的資料');
            }
            
            const simPrices = [...data.map(d => d.close), lastData.close * (1 + pct / 100)];
            const simVolumes = [...data.map(d => d.volume), 0];
            
            // 使用指定的天數計算OBV（預設120天）
            const obv = Indicators.calcOBV(simPrices, simVolumes, obvDays);
            const o30 = Indicators.getSMA(obv, 30);
            const o60 = Indicators.getSMA(obv, 60);

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('無法取得Canvas Context');
            }
            
            canvas.width = canvas.offsetWidth * dpr; 
            canvas.height = 120 * dpr; 
            ctx.scale(dpr, dpr);
            const barW = canvas.offsetWidth / (plotCount + 2);
            
            // 清空畫布
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.offsetWidth, 120);
            ctx.strokeStyle = "#ccc"; 
            ctx.lineWidth = 1; 
            ctx.strokeRect(0, 0, canvas.offsetWidth, 120);

            const oSlice = obv.slice(-plotCount);
            const m30 = o30.slice(-plotCount);
            const m60 = o60.slice(-plotCount);
            
            // 收集所有有效數值
            const allValues = [
                ...oSlice.filter(v => v !== null && !isNaN(v)),
                ...m30.filter(v => v !== null && !isNaN(v)),
                ...m60.filter(v => v !== null && !isNaN(v))
            ];
            
            if (allValues.length === 0) {
                return { obv: 0, ma30: 0, ma60: 0 };
            }
            
            const maxO = Math.max(...allValues);
            const minO = Math.min(...allValues);
            
            // 避免除以零
            const range = Math.max(1, maxO - minO);
            const getOY = (v) => {
                if (v === null || isNaN(v)) return 60; // 中間位置
                return (1 - (v - minO) / range) * 100 + 10;
            };

            const drawLine = (pts, col, w) => {
                if (!pts || pts.length === 0) return;
                
                ctx.strokeStyle = col; 
                ctx.lineWidth = w; 
                ctx.beginPath();
                
                let firstPoint = true;
                pts.forEach((v, i) => {
                    if (v !== null && !isNaN(v)) {
                        if (firstPoint) {
                            ctx.moveTo(i*barW+barW/2, getOY(v));
                            firstPoint = false;
                        } else {
                            ctx.lineTo(i*barW+barW/2, getOY(v));
                        }
                    }
                });
                ctx.stroke();
            };
            
            drawLine(oSlice, "#fbc02d", 2);
            drawLine(m30, "#2196f3", 1.2);
            drawLine(m60, "#9c27b0", 1.2);

            const curX = sharedX > 0 ? sharedX : mouseX;
            if (curX > 0) { 
                ctx.setLineDash([5, 5]); 
                ctx.strokeStyle = "#000"; 
                ctx.beginPath(); 
                ctx.moveTo(curX, 0); 
                ctx.lineTo(curX, 120); 
                ctx.stroke(); 
                ctx.setLineDash([]); 
            }
            
            let hoverIdx = Math.floor(curX / barW);
            let tIdx = obv.length - 1;
            
            if (curX > 0 && hoverIdx >= 0 && hoverIdx <= plotCount) {
                tIdx = (obv.length - 1) - (plotCount - hoverIdx);
            }
            
            return { 
                obv: obv[tIdx] || 0, 
                ma30: o30[tIdx] || 0, 
                ma60: o60[tIdx] || 0 
            };
            
        } catch (error) {
            console.error('SubEngine.render 錯誤:', error);
            return { obv: 0, ma30: 0, ma60: 0 };
        }
    };
}