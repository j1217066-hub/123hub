/* mainEngine.js - 完全修復版 */
function MainEngine(canvas, data) {
    // 參數驗證
    if (!canvas || !data || !Array.isArray(data) || data.length === 0) {
        console.error('MainEngine: 無效的參數');
        // 返回一個安全的物件
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
            const rawX = e.clientX - rect.left;
            const barW = canvas.offsetWidth / (plotCount + 2);
            const colIdx = Math.round((rawX - barW/2) / barW);
            mouseX = (colIdx >= 0 && colIdx <= plotCount) ? colIdx * barW + barW/2 : rawX;
            if (this.onMouseMove) this.onMouseMove();
        } catch (error) {
            console.error('滑鼠移動事件錯誤:', error);
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
            const rawX = touch.clientX - rect.left;
            const barW = canvas.offsetWidth / (plotCount + 2);
            const colIdx = Math.round((rawX - barW/2) / barW);
            mouseX = (colIdx >= 0 && colIdx <= plotCount) ? colIdx * barW + barW/2 : rawX;
            if (this.onMouseMove) this.onMouseMove();
        } catch (error) {
            console.error('觸控事件錯誤:', error);
        }
    });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        try {
            const rect = canvas.getBoundingClientRect();
            const touch = e.touches[0];
            const rawX = touch.clientX - rect.left;
            const barW = canvas.offsetWidth / (plotCount + 2);
            const colIdx = Math.round((rawX - barW/2) / barW);
            mouseX = (colIdx >= 0 && colIdx <= plotCount) ? colIdx * barW + barW/2 : rawX;
            if (this.onMouseMove) this.onMouseMove();
        } catch (error) {
            console.error('觸控移動事件錯誤:', error);
        }
    });

    this.render = (pct, chks) => {
        try {
            // 參數檢查
            if (typeof pct !== 'number' || isNaN(pct)) {
                pct = 0;
            }
            
            // 確保chks物件有所有必要的屬性
            if (!chks || typeof chks !== 'object') {
                chks = { lrc9: true, lsma25: true, bbmid: true, bbup: true, bbdn: true };
            }
            
            // 確保所有屬性都存在（布林值）
            const defaultChks = { lrc9: true, lsma25: true, bbmid: true, bbup: true, bbdn: true };
            chks = { 
                lrc9: chks.lrc9 !== undefined ? !!chks.lrc9 : defaultChks.lrc9,
                lsma25: chks.lsma25 !== undefined ? !!chks.lsma25 : defaultChks.lsma25,
                bbmid: chks.bbmid !== undefined ? !!chks.bbmid : defaultChks.bbmid,
                bbup: chks.bbup !== undefined ? !!chks.bbup : defaultChks.bbup,
                bbdn: chks.bbdn !== undefined ? !!chks.bbdn : defaultChks.bbdn
            };
            
            const lastData = data[data.length - 1];
            if (!lastData) {
                throw new Error('沒有有效的資料');
            }
            
            const simClose = lastData.close * (1 + pct / 100);
            const simPrices = [...data.map(d => d.close), simClose];
            const lastDateObj = new Date(data[data.length-1].time * 1000);
            lastDateObj.setDate(lastDateObj.getDate() + 1);
            const allData = [...data, { 
                time: lastDateObj.getTime()/1000, 
                open: lastData.close, 
                close: simClose, 
                high: Math.max(lastData.close, simClose), 
                low: Math.min(lastData.close, simClose) 
            }];

            // 計算指標
            const lrc = Indicators.getLSMA(simPrices, 9);
            const lsma = Indicators.getLSMA(simPrices, 25);
            const bb = Indicators.getBollinger(simPrices, 20);

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('無法取得Canvas Context');
            }
            
            const canvasWidth = canvas.offsetWidth;
            const canvasHeight = canvas.offsetHeight || 280;
            
            canvas.width = canvasWidth * dpr; 
            canvas.height = canvasHeight * dpr; 
            ctx.scale(dpr, dpr);
            
            const barW = canvasWidth / (plotCount + 2);
            const plotSlice = data.slice(-plotCount);
            
            // 計算最大值和最小值
            const validHighs = plotSlice.map(d => d.high).filter(v => v !== null && !isNaN(v));
            const validLows = plotSlice.map(d => d.low).filter(v => v !== null && !isNaN(v));
            
            let maxP = Math.max(...validHighs, simClose);
            let minP = Math.min(...validLows, simClose);
            
            // 如果勾選了布林通道，需要考慮其範圍
            if (chks.bbup && bb && bb.up) {
                const validBBUp = bb.up.slice(-plotCount-1).filter(v => v !== null && !isNaN(v));
                if (validBBUp.length > 0) maxP = Math.max(maxP, ...validBBUp);
            }
            
            if (chks.bbdn && bb && bb.dn) {
                const validBBDn = bb.dn.slice(-plotCount-1).filter(v => v !== null && !isNaN(v));
                if (validBBDn.length > 0) minP = Math.min(minP, ...validBBDn);
            }
            
            maxP = maxP * 1.01;
            minP = minP * 0.99;
            
            // 避免最大值等於最小值
            if (maxP <= minP) {
                maxP = minP + 1;
            }
            
            const getY = (p) => {
                if (p === null || isNaN(p)) return 0;
                const plotHeight = canvasHeight - 80; // 為文字留出空間
                return (1 - (p - minP) / (maxP - minP)) * plotHeight + 60;
            };

            // 清空畫布
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            ctx.strokeStyle = "#ccc"; 
            ctx.lineWidth = 1; 
            ctx.strokeRect(0, 0, canvasWidth, canvasHeight);

            // 畫歷史 K 線
            plotSlice.forEach((d, i) => {
                if (d.open === null || d.close === null || d.high === null || d.low === null ||
                    isNaN(d.open) || isNaN(d.close) || isNaN(d.high) || isNaN(d.low)) {
                    return;
                }
                
                const color = d.close >= d.open ? "#e53935" : "#2e7d32";
                ctx.strokeStyle = ctx.fillStyle = color;
                ctx.beginPath(); 
                ctx.moveTo(i*barW+barW/2, getY(d.high)); 
                ctx.lineTo(i*barW+barW/2, getY(d.low)); 
                ctx.stroke();
                
                const openY = getY(d.open);
                const closeY = getY(d.close);
                const barHeight = Math.max(1, Math.abs(closeY - openY));
                const barTop = Math.min(openY, closeY);
                
                ctx.fillRect(i*barW+barW*0.1, barTop, barW*0.8, barHeight);
            });

            // 畫明日預估虛線 K 線
            if (Math.abs(pct) > 0.01) {
                const i = plotCount;
                ctx.setLineDash([3, 3]); 
                ctx.strokeStyle = simClose >= lastData.close ? "#e53935" : "#2e7d32";
                ctx.strokeRect(i*barW + barW*0.1, getY(Math.max(lastData.close, simClose)), barW*0.8, Math.max(2, Math.abs(getY(lastData.close)-getY(simClose))));
                ctx.beginPath(); 
                ctx.moveTo(i*barW+barW/2, getY(simClose)); 
                ctx.lineTo(i*barW+barW/2, getY(lastData.close)); 
                ctx.stroke(); 
                ctx.setLineDash([]);
            }

            let hoverIdx = Math.floor(mouseX / barW);
            let targetIdx = allData.length - 2;
            
            if (mouseX > 0 && hoverIdx >= 0 && hoverIdx <= plotCount) {
                targetIdx = (allData.length - 2) - (plotCount - 1 - hoverIdx);
                if (hoverIdx === plotCount) targetIdx = allData.length - 1;
                
                ctx.setLineDash([5, 5]); 
                ctx.strokeStyle = "#000"; 
                ctx.beginPath();
                ctx.moveTo(mouseX, 0); 
                ctx.lineTo(mouseX, canvasHeight); 
                ctx.stroke(); 
                ctx.setLineDash([]);
            }

            const curr = allData[targetIdx];
            const prev = allData[targetIdx - 1];
            
            if (curr && prev) {
                const d = new Date(curr.time * 1000);
                const diff = curr.close - prev.close;
                const sCol = diff > 0.001 ? "#e53935" : (diff < -0.001 ? "#2e7d32" : "#333");
                
                // 放大文字到跟小框框一樣大 (14px)
                ctx.font = "bold 14px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                let sX = 10;
                
                const drawText = (label, value, color = "#333") => {
                    ctx.fillStyle = "#777"; 
                    ctx.fillText(label, sX, 20); 
                    sX += ctx.measureText(label).width + 5;
                    ctx.fillStyle = color; 
                    ctx.fillText(value, sX, 20); 
                    sX += ctx.measureText(value).width + 15;
                };
                
                // 顯示日期和價格資訊
                const dateStr = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
                drawText("日期", dateStr);
                drawText("開", curr.open.toFixed(2)); 
                drawText("高", curr.high.toFixed(2)); 
                drawText("低", curr.low.toFixed(2));
                drawText("收", curr.close.toFixed(2), sCol);
                
                const sign = diff >= 0 ? "+" : "";
                const percent = prev.close !== 0 ? (diff/prev.close*100).toFixed(2) : "0.00";
                drawText(`${sign}${diff.toFixed(2)}`, `(${sign}${percent}%)`, sCol);
            }

            // 繪製指標線條 - 完全修復版本
            const drawLine = (pts, col, w) => {
                if (!pts || pts.length === 0) return;
                
                ctx.strokeStyle = col; 
                ctx.lineWidth = w; 
                ctx.beginPath();
                
                let firstPoint = true;
                pts.slice(-plotCount - 1).forEach((p, i) => {
                    if (p !== null && !isNaN(p)) {
                        const y = getY(p);
                        if (firstPoint) {
                            ctx.moveTo(i*barW+barW/2, y);
                            firstPoint = false;
                        } else {
                            ctx.lineTo(i*barW+barW/2, y);
                        }
                    }
                });
                ctx.stroke();
            };
            
            // 根據勾選狀態繪製線條 - 完全修復
            // 只有當chks為true且指標存在時才繪製
            if (chks.bbup === true && bb && bb.up) drawLine(bb.up, "rgba(33, 150, 243, 0.4)", 1.2);
            if (chks.bbmid === true && bb && bb.mid) drawLine(bb.mid, "#ff9800", 1.8);
            if (chks.bbdn === true && bb && bb.dn) drawLine(bb.dn, "rgba(33, 150, 243, 0.4)", 1.2);
            if (chks.lrc9 === true && lrc) drawLine(lrc, "#333", 2);
            if (chks.lsma25 === true && lsma) drawLine(lsma, "#2196f3", 2);

            const getValue = (arr, idx) => {
                if (!arr || idx < 0 || idx >= arr.length) {
                    return { v: "-", t: "", c: "#333" };
                }
                
                const current = arr[idx];
                const previous = arr[idx - 1];
                
                if (current === undefined || current === null || isNaN(current)) {
                    return { v: "-", t: "", c: "#333" };
                }
                
                if (previous === undefined || previous === null || isNaN(previous)) {
                    return { v: current.toFixed(2), t: "", c: "#333" };
                }
                
                const isUp = current > previous;
                return { 
                    v: current.toFixed(2), 
                    t: isUp ? "▲" : "▼", 
                    c: isUp ? "#e53935" : "#2e7d32" 
                };
            };
            
            return { 
                lrc9: getValue(lrc, targetIdx), 
                lsma25: getValue(lsma, targetIdx), 
                bbup: getValue(bb.up, targetIdx), 
                bbmid: getValue(bb.mid, targetIdx), 
                bbdn: getValue(bb.dn, targetIdx) 
            };
            
        } catch (error) {
            console.error('MainEngine.render 錯誤:', error);
            
            // 顯示錯誤訊息
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
                ctx.fillStyle = "#d05a6e";
                ctx.font = "bold 14px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                ctx.fillText("圖表渲染錯誤", 10, 20);
                ctx.font = "12px -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
                ctx.fillText(error.message.substring(0, 50), 10, 40);
            }
            
            return null;
        }
    };
}