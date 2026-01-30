/** 
 * Gemini 技術分析選股 - 主應用邏輯
 * 從原 index.html 提取並重構
 * 版本: v.97 (新增OBV轉折)
 */

/** 全域變數：儲存掃描結果 **/
let currentScanResults = [];
let currentSortMode = 'code';
let currentScanMode = ''; // 記錄當前掃描模式

/** 並行掃描邏輯 **/
async function runScan(mode) {
    currentScanMode = mode; // 記錄當前模式
    
    const status = document.getElementById("status"), 
          result = document.getElementById("result"), 
          pBar = document.getElementById("progress-bar"), 
          pCont = document.getElementById("progress-container"),
          sortOptions = document.getElementById("sortOptions"),
          mobileHint = document.getElementById("mobileHint");
    
    const btns = [
        document.getElementById("btnA"), 
        document.getElementById("btnB"), 
        document.getElementById("btnC"), 
        document.getElementById("btnD"),
        document.getElementById("btnE"),
        document.getElementById("btnF"),
        document.getElementById("btnG")  // 新增G按鈕
    ];

    // 清空並重置
    result.innerHTML = ""; 
    pCont.style.display = "block"; 
    pBar.style.width = "0%";
    sortOptions.style.display = "none";
    mobileHint.style.display = "none";
    
    // 禁用按鈕
    btns.forEach(b => {
        if (b) {  // 確保按鈕存在
            b.disabled = true;
            b.style.opacity = "0.7";
        }
    });

    const codes = Object.keys(STOCK_MAP), total = codes.length;
    let scanned = 0, matchCount = 0;
    const chunkSize = 3; // 手機上減少並行請求
    
    // 清空前次結果
    currentScanResults = [];
    
    // 顯示載入狀態
    status.innerHTML = `<span class="loading"></span>準備開始掃描...`;

    for (let i = 0; i < codes.length; i += chunkSize) {
        const chunk = codes.slice(i, i + chunkSize);
        const promises = chunk.map(async (code) => {
            try {
                // 修改這裡：將 query1 改為 query2 (舊版 Yahoo API)
                const r = await fetch("https://corsproxy.io/?" + encodeURIComponent(`https://query2.finance.yahoo.com/v8/finance/chart/${code}?range=1y&interval=1d`));
                const j = await r.json();
                scanned++;
                const pct = Math.round((scanned / total) * 100);
                
                // 更新狀態
                let modeName = "";
                switch(mode) {
                    case 'A': modeName = "LRC轉折"; break;
                    case 'B': modeName = "LSMA轉折"; break;
                    case 'C': modeName = "多頭排列"; break;
                    case 'D': modeName = "多頭第一天"; break;
                    case 'E': modeName = "起漲預測"; break;
                    case 'F': modeName = "DMI多頭"; break;
                    case 'G': modeName = "OBV轉折"; break;  // 新增G模式
                }
                
                status.innerHTML = `<span class="loading"></span>${modeName}掃描中<br>
                                    <small>${scanned}/${total} (${pct}%) | ${code} ${STOCK_MAP[code]}</small>`;
                pBar.style.width = `${pct}%`;

                if (!j.chart.result) return;
                const q = j.chart.result[0].indicators.quote[0];
                const data = j.chart.result[0].timestamp.map((t, idx) => ({ 
                    time: t, 
                    open: q.open[idx], 
                    high: q.high[idx], 
                    low: q.low[idx], 
                    close: q.close[idx], 
                    volume: q.volume[idx] 
                })).filter(x => x.close !== null && !isNaN(x.close));
                
                if (data.length < 30) return;
                
                const prices = data.map(d => d.close);
                const volumes = data.map(d => d.volume);
                let isMatch = false;
                let minRequiredPercent = null;
                let obvData = null;

                if (mode === 'A' || mode === 'B' || mode === 'C' || mode === 'D' || mode === 'F' || mode === 'G') {  // 新增G模式
                    isMatch = Strategies.check(prices, mode);
                    
                    // 對於G模式，計算OBV詳細數據
                    if (mode === 'G' && data.length >= 60) {
                        const obvResult = Indicators.calcOBV(prices, volumes, 120);
                        const obv30 = Indicators.getSMA(obvResult, 30);
                        const obv60 = Indicators.getSMA(obvResult, 60);
                        
                        if (obvResult && obv30 && obv60) {
                            const lastIdx = obvResult.length - 1;
                            obvData = {
                                obv: obvResult[lastIdx],
                                obv30: obv30[lastIdx],
                                obv60: obv60[lastIdx]
                            };
                        }
                    }
                } else if (mode === 'E') {
                    isMatch = checkRisingStartPrediction(prices);
                    if (isMatch) {
                        minRequiredPercent = calculateMinRiseForBullish(prices);
                    }
                }

                if (isMatch) {
                    matchCount++;
                    const lastData = data[data.length - 1];
                    const prevData = data[data.length - 2];
                    let changePercent = 0;
                    
                    if (prevData && prevData.close !== 0 && !isNaN(prevData.close) && !isNaN(lastData.close)) {
                        changePercent = ((lastData.close - prevData.close) / prevData.close * 100);
                    }
                    
                    // 對於F模式，計算DMI詳細數據
                    let dmiData = null;
                    if (mode === 'F' && data.length >= 28) {
                        const highs = data.map(d => d.high);
                        const lows = data.map(d => d.low);
                        const dmiResult = Indicators.getDMI(highs, lows, prices, 14);
                        if (dmiResult) {
                            const lastIdx = prices.length - 1;
                            dmiData = {
                                pdi: dmiResult.pdiSeries[lastIdx],
                                mdi: dmiResult.mdiSeries[lastIdx],
                                adx: dmiResult.adxSeries[lastIdx],
                                adxr: dmiResult.adxrSeries[lastIdx]
                            };
                        }
                    }
                    
                    currentScanResults.push({
                        code: code,
                        name: STOCK_MAP[code],
                        data: data,
                        closePrice: lastData.close,
                        changePercent: changePercent,
                        minRequiredPercent: minRequiredPercent,
                        dmiData: dmiData,
                        obvData: obvData,  // 新增OBV數據
                        codeNumber: extractStockCodeNumber(code)
                    });
                    
                    // 立即顯示前5個結果
                    if (matchCount <= 5) {
                        updateDisplayImmediately();
                    }
                }
            } catch(e) {
                console.error(`處理股票 ${code} 時發生錯誤:`, e);
            }
        });
        
        await Promise.all(promises);
        await new Promise(res => setTimeout(res, 300)); // 增加延遲避免過快請求
    }

    // 啟用按鈕
    btns.forEach(b => {
        if (b) {  // 確保按鈕存在
            b.disabled = false;
            b.style.opacity = "1";
        }
    });
    
    // 顯示所有結果
    displayAllResults();
    
    // 更新狀態
    let modeName = "";
    switch(mode) {
        case 'A': modeName = "LRC轉折"; break;
        case 'B': modeName = "LSMA轉折"; break;
        case 'C': modeName = "今日多頭排列"; break;
        case 'D': modeName = "多頭第一天"; break;
        case 'E': modeName = "起漲預測"; break;
        case 'F': modeName = "DMI多頭排列"; break;
        case 'G': modeName = "OBV轉折"; break;  // 新增G模式
    }
    
    let statusHTML = `${modeName}分析完成！<br>找到 <span class="result-count">${matchCount}</span> 檔標的`;
    
    if (mode === 'E' && matchCount > 0) {
        statusHTML += `<br><small style="color:#ff9800;">${matchCount}檔潛在起漲股票</small>`;
    } else if (mode === 'F' && matchCount > 0) {
        statusHTML += `<br><small style="color:#9c27b0;">${matchCount}檔DMI多頭股票</small>`;
    } else if (mode === 'G' && matchCount > 0) {
        statusHTML += `<br><small style="color:#2196f3;">${matchCount}檔OBV轉折股票</small>`;
    }
    
    status.innerHTML = statusHTML;
    mobileHint.style.display = "block";
    
    setTimeout(() => { 
        pCont.style.display = "none"; 
    }, 2000);
}

/** 解析股號數字部分 **/
function extractStockCodeNumber(code) {
    const matches = code.match(/\d+/g);
    if (matches && matches.length > 0) {
        return parseInt(matches[0], 10);
    }
    return 0;
}

/** 立即更新顯示 **/
function updateDisplayImmediately() {
    const sortedResults = [...currentScanResults].sort((a, b) => {
        if (a.codeNumber !== b.codeNumber) {
            return a.codeNumber - b.codeNumber;
        }
        return a.code.localeCompare(b.code);
    });
    
    const resultDiv = document.getElementById("result");
    resultDiv.innerHTML = "";
    
    sortedResults.forEach(stock => {
        addStockItem(stock.code, stock.data, stock.closePrice, stock.changePercent, currentScanMode, stock.minRequiredPercent, stock.dmiData, stock.obvData);
    });
    
    document.getElementById("sortOptions").style.display = "flex";
}

/** 顯示所有結果 **/
function displayAllResults() {
    sortResults(currentSortMode);
    document.getElementById("sortOptions").style.display = "flex";
}

/** 排序結果 **/
function sortResults(sortMode) {
    currentSortMode = sortMode;
    
    // 更新排序標籤
    document.querySelectorAll('.sort-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    const activeTab = document.querySelector(`.sort-tab[onclick="sortResults('${sortMode}')"]`);
    if (activeTab) activeTab.classList.add('active');
    
    let sortedResults;
    
    switch(sortMode) {
        case 'code':
            sortedResults = [...currentScanResults].sort((a, b) => {
                if (a.codeNumber !== b.codeNumber) {
                    return a.codeNumber - b.codeNumber;
                }
                return a.code.localeCompare(b.code);
            });
            break;
        case 'change':
            sortedResults = [...currentScanResults].sort((a, b) => b.changePercent - a.changePercent);
            break;
        case 'price':
            sortedResults = [...currentScanResults].sort((a, b) => b.closePrice - a.closePrice);
            break;
        default:
            sortedResults = currentScanResults;
    }
    
    const resultDiv = document.getElementById("result");
    resultDiv.innerHTML = "";
    
    if (sortedResults.length === 0) {
        resultDiv.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📊</div>
                <div>未找到符合條件的股票</div>
                <div style="margin-top: 10px; font-size: 12px;">請嘗試其他分析模式</div>
            </div>
        `;
        return;
    }
    
    sortedResults.forEach(stock => {
        addStockItem(stock.code, stock.data, stock.closePrice, stock.changePercent, currentScanMode, stock.minRequiredPercent, stock.dmiData, stock.obvData);
    });
}

/** 檢查起漲預測 **/
function checkRisingStartPrediction(prices) {
    try {
        if (!prices || prices.length < 30) return false;
        
        const lrc9 = Indicators.getLSMA(prices, 9);
        const lsma25 = Indicators.getLSMA(prices, 25);
        const ma20 = Indicators.getSMA(prices, 20);
        
        const lastIdx = lrc9.length - 1;
        
        // 檢查目前狀態
        const curLRC9 = lrc9[lastIdx];
        const curLSMA25 = lsma25[lastIdx];
        const curMA20 = ma20[lastIdx];
        
        if (curLRC9 === null || curLSMA25 === null || curMA20 === null ||
            isNaN(curLRC9) || isNaN(curLSMA25) || isNaN(curMA20)) {
            return false;
        }
        
        const isCurrentlyBullish = curLRC9 > curLSMA25 && curLSMA25 > curMA20;
        if (isCurrentlyBullish) return false;
        
        // 檢查明日
        const currentClose = prices[lastIdx];
        if (!currentClose || currentClose <= 0) return false;
        
        for (let pct = 0; pct <= 3.0; pct += 0.5) {
            const tomorrowPrice = currentClose * (1 + pct / 100);
            const testPrices = [...prices.slice(-30), tomorrowPrice];
            
            const testLRC9 = Indicators.getLSMA(testPrices, 9);
            const testLSMA25 = Indicators.getLSMA(testPrices, 25);
            const testMA20 = Indicators.getSMA(testPrices, 20);
            
            const tomorrowIdx = testLRC9.length - 1;
            const l = testLRC9[tomorrowIdx];
            const m = testLSMA25[tomorrowIdx];
            const s = testMA20[tomorrowIdx];
            
            if (l !== null && m !== null && s !== null && l > m && m > s) {
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.error('起漲預測檢查錯誤:', error);
        return false;
    }
}

/** 計算最小漲幅 **/
function calculateMinRiseForBullish(prices) {
    try {
        if (!prices || prices.length < 30) return null;
        
        const currentClose = prices[prices.length - 1];
        if (!currentClose || currentClose <= 0) return null;
        
        for (let pct = 0; pct <= 3.0; pct += 0.5) {
            const tomorrowPrice = currentClose * (1 + pct / 100);
            const testPrices = [...prices.slice(-30), tomorrowPrice];
            
            const testLRC9 = Indicators.getLSMA(testPrices, 9);
            const testLSMA25 = Indicators.getLSMA(testPrices, 25);
            const testMA20 = Indicators.getSMA(testPrices, 20);
            
            const tomorrowIdx = testLRC9.length - 1;
            const l = testLRC9[tomorrowIdx];
            const m = testLSMA25[tomorrowIdx];
            const s = testMA20[tomorrowIdx];
            
            if (l !== null && m !== null && s !== null && l > m && m > s) {
                return parseFloat(pct.toFixed(1));
            }
        }
        
        return null;
    } catch (error) {
        console.error('計算最小漲幅錯誤:', error);
        return null;
    }
}

/** 產生股票顯示卡片 **/
function addStockItem(code, data, closePrice = 0, changePercent = 0, mode = '', minRequiredPercent = null, dmiData = null, obvData = null) {
    const id = Math.random().toString(36).substr(2, 9);
    const div = document.createElement('div');
    div.className = "stock-item";
    div.dataset.id = id;
    
    // 計算顯示
    const arrow = changePercent >= 0 ? '▲' : '▼';
    const arrowClass = changePercent >= 0 ? 'up-arrow' : 'down-arrow';
    const changeClass = changePercent >= 0 ? '' : 'negative';
    const changeColor = changePercent >= 0 ? '#e53935' : '#2e7d32';
    const sign = changePercent >= 0 ? '+' : '';
    
    // 額外資訊
    let extraInfo = '';
    if (mode === 'E' && minRequiredPercent !== null) {
        extraInfo = `<span class="extra-info">需漲${minRequiredPercent}%</span>`;
    } else if (mode === 'F' && dmiData !== null) {
        // 顯示DMI數值
        extraInfo = `<span class="extra-info">+DI:${dmiData.pdi ? dmiData.pdi.toFixed(1) : '-'}</span>`;
    } else if (mode === 'G' && obvData !== null) {
        // 顯示OBV數值
        extraInfo = `<span class="extra-info">OBV:${obvData.obv ? Math.round(obvData.obv).toLocaleString() : '-'}</span>`;
    }
    
    // 修改：合併模擬明日走勢和技術指標到主圖中
    div.innerHTML = `
        <div class="stock-title" onclick="toggleChart('${id}', this)">
            <div class="stock-info-line">
                <span class="stock-code">${code}</span>
                ${extraInfo}
                <span class="stock-name">${STOCK_MAP[code]}</span>
                <span class="stock-price">${closePrice.toFixed(2)}</span>
                <span class="stock-change ${changeClass}" style="color:${changeColor};">
                    <span class="${arrowClass}">${arrow}</span>
                    ${sign}${changePercent.toFixed(2)}%
                </span>
            </div>
            <span class="expand-arrow">▼</span>
        </div>
        <div id="chart-${id}" class="chart-container">
            <!-- 合併的圖表區域 -->
            <div class="chart-combined-wrapper">
                <!-- 技術指標控制區 -->
                <div class="chart-controls">
                    <div class="simulation-section">
                        <div class="simulation-label">模擬明日走勢：</div>
                        <div class="slider-container">
                            <input type="range" class="eval-slider" min="-10" max="10" step="0.5" value="0" 
                                   oninput="updateUI('${id}')"
                                   ontouchstart="this.style.opacity='0.8'"
                                   ontouchend="this.style.opacity='1'">
                            <span class="eval-pct">0%</span>
                        </div>
                    </div>
                    
                    <div class="indicators-section">
                        <div class="indicator-control">
                            <input type="checkbox" checked id="chk-lrc9-${id}" onchange="updateUI('${id}')">
                            <label for="chk-lrc9-${id}">LRC9:</label>
                            <span class="val-lrc9 val-span">-</span>
                        </div>
                        <div class="indicator-control">
                            <input type="checkbox" checked id="chk-lsma25-${id}" onchange="updateUI('${id}')">
                            <label for="chk-lsma25-${id}">LSMA25:</label>
                            <span class="val-lsma25 val-span">-</span>
                        </div>
                        <div class="indicator-control">
                            <input type="checkbox" checked id="chk-bbmid-${id}" onchange="updateUI('${id}')">
                            <label for="chk-bbmid-${id}">布林中:</label>
                            <span class="val-bbmid val-span">-</span>
                        </div>
                        <div class="indicator-control">
                            <input type="checkbox" checked id="chk-bbup-${id}" onchange="updateUI('${id}')">
                            <label for="chk-bbup-${id}">上限:</label>
                            <span class="val-bbup val-span">-</span>
                        </div>
                        <div class="indicator-control">
                            <input type="checkbox" checked id="chk-bbdn-${id}" onchange="updateUI('${id}')">
                            <label for="chk-bbdn-${id}">下限:</label>
                            <span class="val-bbdn val-span">-</span>
                        </div>
                    </div>
                </div>
                
                <!-- 主圖表 -->
                <div class="canvas-wrapper">
                    <canvas id="main-canvas-${id}" class="main-canvas"></canvas>
                </div>
            </div>
            
            <!-- OBV圖形 -->
            <div class="canvas-wrapper">
                <canvas id="obv-canvas-${id}" class="obv-canvas"></canvas>
            </div>
            
            <!-- DMI圖形 -->
            <div class="canvas-wrapper">
                <canvas id="dmi-canvas-${id}" class="dmi-canvas"></canvas>
            </div>
        </div>`;
    
    // 儲存資料
    div.stockData = data;
    div.dmiData = dmiData;
    div.obvData = obvData;
    document.getElementById("result").appendChild(div);
}

/** 展開圖表 **/
function toggleChart(id, el) {
    const c = document.getElementById('chart-'+id);
    const item = el.closest('.stock-item');
    const isVisible = c.style.display === 'block';
    
    // 切換顯示
    c.style.display = isVisible ? 'none' : 'block';
    
    // 切換箭頭
    const arrow = el.querySelector('.expand-arrow');
    if (arrow) {
        arrow.textContent = isVisible ? '▼' : '▲';
        arrow.style.transform = isVisible ? 'none' : 'rotate(180deg)';
    }
    
    // 初始化圖表
    if (!isVisible && !item.mainE) {
        try {
            const mainCanvas = c.querySelector('.main-canvas');
            const obvCanvas = c.querySelector('.obv-canvas');
            const dmiCanvas = c.querySelector('.dmi-canvas');
            
            if (mainCanvas && item.stockData && item.stockData.length > 0) {
                item.mainE = new MainEngine(mainCanvas, item.stockData);
            }
            
            if (obvCanvas && item.stockData && item.stockData.length > 0) {
                item.obvE = new OBVEngine(obvCanvas, item.stockData);
            }
            
            if (dmiCanvas && item.stockData && item.stockData.length > 0) {
                item.dmiE = new DMIEngine(dmiCanvas, item.stockData);
            }
            
            // 設定事件
            if (item.mainE) item.mainE.onMouseMove = () => updateUI(id);
            if (item.obvE) item.obvE.onMouseMove = () => updateUI(id);
            if (item.dmiE) item.dmiE.onMouseMove = () => updateUI(id);
            
            // 初始渲染
            updateUI(id);
        } catch (error) {
            console.error(`初始化圖表錯誤 (${id}):`, error);
            c.innerHTML += `<div style="color: #d05a6e; padding: 10px; background: #ffe6e6; border-radius: 4px; margin-top: 10px;">
                圖表初始化失敗
            </div>`;
        }
    } else if (!isVisible && item.mainE) {
        updateUI(id);
    }
}

/** 更新介面 **/
function updateUI(id) {
    const c = document.getElementById('chart-'+id);
    if (!c) return;
    
    const item = c.parentElement;
    if (!item || !item.mainE) return;
    
    try {
        // 滑桿
        const slider = c.querySelector('.eval-slider');
        const pct = slider ? parseFloat(slider.value) || 0 : 0;
        
        // 百分比顯示
        const pctSpan = c.querySelector('.eval-pct');
        if (pctSpan) {
            pctSpan.textContent = (pct > 0 ? "+" : "") + pct + '%';
            pctSpan.style.color = pct > 0 ? '#e53935' : (pct < 0 ? '#2e7d32' : '#333');
        }
        
        // 勾選狀態
        const chks = { 
            lrc9: document.getElementById(`chk-lrc9-${id}`).checked, 
            lsma25: document.getElementById(`chk-lsma25-${id}`).checked, 
            bbmid: document.getElementById(`chk-bbmid-${id}`).checked, 
            bbup: document.getElementById(`chk-bbup-${id}`).checked, 
            bbdn: document.getElementById(`chk-bbdn-${id}`).checked 
        };
        
        // 渲染主圖表
        const mainValues = item.mainE.render(pct, chks);
        
        // 更新技術指標數值顯示
        if (mainValues) {
            ['lrc9', 'lsma25', 'bbup', 'bbmid', 'bbdn'].forEach(k => { 
                const span = c.querySelector(`.val-${k}`); 
                if (span && mainValues[k]) {
                    span.innerHTML = `${mainValues[k].v} <span style="color:${mainValues[k].c}; font-size:10px;">${mainValues[k].t}</span>`;
                }
            });
        }
        
        // 計算 OBV 值
        const data = item.stockData;
        let obvValues = { obv: 0, obv30: 0, obv60: 0 };
        let obvSeries = { obvSeries: [], obv30Series: [], obv60Series: [] };
        
        if (data && data.length >= 60) { // OBV需要至少60天數據
            const prices = data.map(d => d.close);
            const volumes = data.map(d => d.volume);
            
            // 如果模擬明日漲跌，加入模擬數據
            if (Math.abs(pct) > 0.01) {
                const lastData = data[data.length - 1];
                const simClose = lastData.close * (1 + pct / 100);
                prices.push(simClose);
                volumes.push(0); // 明日成交量未知，設為0
            }
            
            const obvResult = Indicators.calcOBV(prices, volumes, 120);
            const obv30 = Indicators.getSMA(obvResult, 30);
            const obv60 = Indicators.getSMA(obvResult, 60);
            
            if (obvResult && obvResult.length > 0) {
                const lastIdx = obvResult.length - 1;
                obvValues = {
                    obv: obvResult[lastIdx],
                    obv30: obv30[lastIdx],
                    obv60: obv60[lastIdx]
                };
                obvSeries = {
                    obvSeries: obvResult,
                    obv30Series: obv30,
                    obv60Series: obv60
                };
            }
        }
        
        // 計算 DMI 值
        let dmiValues = { pdi: 0, mdi: 0, adx: 0, adxr: 0 };
        let dmiSeries = { pdiSeries: [], mdiSeries: [], adxSeries: [], adxrSeries: [] };
        
        if (data && data.length >= 28) { // DMI需要至少28天數據
            const prices = data.map(d => d.close);
            const highs = data.map(d => d.high);
            const lows = data.map(d => d.low);
            
            // 如果模擬明日漲跌，加入模擬價格
            if (Math.abs(pct) > 0.01) {
                const lastData = data[data.length - 1];
                const simClose = lastData.close * (1 + pct / 100);
                const simHigh = Math.max(lastData.high, simClose);
                const simLow = Math.min(lastData.low, simClose);
                
                prices.push(simClose);
                highs.push(simHigh);
                lows.push(simLow);
            }
            
            const dmiResult = Indicators.getDMI(highs, lows, prices, 14);
            
            // 確保有有效的DMI數據
            if (dmiResult && dmiResult.pdiSeries && dmiResult.pdiSeries.length > 0) {
                dmiValues = {
                    pdi: dmiResult.pdi !== null && !isNaN(dmiResult.pdi) ? dmiResult.pdi : 0,
                    mdi: dmiResult.mdi !== null && !isNaN(dmiResult.mdi) ? dmiResult.mdi : 0,
                    adx: dmiResult.adx !== null && !isNaN(dmiResult.adx) ? dmiResult.adx : 0,
                    adxr: dmiResult.adxr !== null && !isNaN(dmiResult.adxr) ? dmiResult.adxr : 0
                };
                dmiSeries = {
                    pdiSeries: dmiResult.pdiSeries || [],
                    mdiSeries: dmiResult.mdiSeries || [],
                    adxSeries: dmiResult.adxSeries || [],
                    adxrSeries: dmiResult.adxrSeries || []
                };
            }
        }
        
        // 計算共享的滑鼠X位置
        const mx = Math.max(
            item.mainE ? item.mainE.getMouseX() : -1,
            item.obvE ? item.obvE.getMouseX() : -1,
            item.dmiE ? item.dmiE.getMouseX() : -1
        );
        
        // 渲染 OBV 圖形
        if (item.obvE && obvSeries.obvSeries.length > 0) {
            item.obvE.render(pct, mx);
        }
        
        // 渲染 DMI 圖形
        if (item.dmiE && dmiSeries.pdiSeries.length > 0) {
            item.dmiE.render(dmiSeries.pdiSeries, dmiSeries.mdiSeries, 
                            dmiSeries.adxSeries, dmiSeries.adxrSeries, 
                            dmiValues.pdi, dmiValues.mdi, dmiValues.adx, dmiValues.adxr, mx);
        }
        
    } catch (error) {
        console.error(`更新UI錯誤 (${id}):`, error);
    }
}

/** 頁面初始化 **/
window.addEventListener('DOMContentLoaded', () => {
    // 檢查裝置類型
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        document.getElementById('mobileHint').style.display = 'block';
    }
    
    // 檢查模組
    if (typeof STOCK_MAP === 'undefined') {
        document.getElementById('status').innerHTML = 
            '<span style="color:#d05a6e;">錯誤：股票資料庫未載入</span>';
    }
    
    if (typeof Indicators === 'undefined') {
        document.getElementById('status').innerHTML = 
            '<span style="color:#d05a6e;">錯誤：技術指標模組未載入</span>';
    }
    
    if (typeof MainEngine === 'undefined') {
        document.getElementById('status').innerHTML = 
            '<span style="color:#d05a6e;">錯誤：主圖表引擎未載入</span>';
    }
    
    if (typeof OBVEngine === 'undefined') {
        console.warn('OBVEngine 未載入，OBV圖形將無法顯示');
    }
    
    if (typeof DMIEngine === 'undefined') {
        console.warn('DMIEngine 未載入，DMI圖形將無法顯示');
    }
    
    if (typeof Strategies === 'undefined') {
        console.warn('strategies.js 未載入，將使用內建設定');
    }
});

// 防止手機雙擊縮放
let lastTouchEnd = 0;
document.addEventListener('touchend', function(event) {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false);