// Constants & State
let currentCount = 0;
let dailyTotal = parseInt(localStorage.getItem('dailyTotal') || '0');
let apiUrl = localStorage.getItem('pushup_apiUrl') || '';
let trainingData = [];
let scoreChart = null;
let distChart = null;

// DOM Elements
const currentInputEl = document.getElementById('currentInput');
const dailyTotalEl = document.getElementById('dailyTotal');
const submitBtn = document.getElementById('submitBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const apiUrlInput = document.getElementById('apiUrl');
const toast = document.getElementById('toast');

// --- 1. Event Listeners (Attached Immediately) ---
if (submitBtn) submitBtn.addEventListener('click', logPushups);
if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
window.onclick = function(event) {
    if (event.target == settingsModal) settingsModal.style.display = 'none';
};

// --- 2. Initialization ---
function init() {
    if (dailyTotalEl) dailyTotalEl.textContent = dailyTotal;
    if (apiUrlInput) apiUrlInput.value = apiUrl;
    
    checkNewDay();
    if (apiUrl) fetchData();
}

function checkNewDay() {
    const lastDate = localStorage.getItem('lastLogDate');
    const today = new Date().toDateString();
    if (lastDate !== today) {
        localStorage.setItem('dailyTotal', '0');
        localStorage.setItem('lastLogDate', today);
        dailyTotal = 0;
        if (dailyTotalEl) dailyTotalEl.textContent = '0';
    }
}

// --- 3. Logger Logic ---
function adjustCount(amount) {
    currentCount = Math.max(0, currentCount + amount);
    if (currentInputEl) currentInputEl.textContent = currentCount;
}

function resetCount() {
    currentCount = 0;
    if (currentInputEl) currentInputEl.textContent = '0';
}

function showToast(message, isError = false) {
    if (!toast) return;
    toast.textContent = message;
    toast.style.borderColor = isError ? 'var(--error)' : 'var(--accent-color)';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

async function logPushups() {
    if (currentCount <= 0) return;
    if (!apiUrl) {
        showToast("Please set API URL in settings", true);
        openSettings();
        return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add('syncing');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'SYNCING...';

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            body: JSON.stringify({ count: currentCount })
        });
        const result = await response.json();
        
        if (result.status === 'success') {
            dailyTotal += currentCount;
            localStorage.setItem('dailyTotal', dailyTotal);
            if (dailyTotalEl) dailyTotalEl.textContent = dailyTotal;
            showToast(`Logged ${currentCount}!`);
            resetCount();
            fetchData();
        } else {
            showToast(result.message || "Error", true);
        }
    } catch (error) {
        console.error(error);
        showToast("Connection failed", true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('syncing');
        submitBtn.textContent = originalText;
    }
}

// --- 4. Dashboard & Sync Logic ---
async function fetchData() {
    if (!apiUrl) return;
    try {
        const response = await fetch(apiUrl);
        const text = await response.text(); 
        
        try {
            const result = JSON.parse(text);
            if (result.status === 'success') {
                trainingData = result.data;
                renderDashboard();
                syncDailyTotalFromSheet();
            }
        } catch (e) {
            console.error("JSON parse failed. Response was:", text);
            // This happens if the user didn't deploy as a "New Deployment"
            showToast("⚠️ 請重新部署 Apps Script (選擇新版本)", true);
        }
    } catch (e) { 
        console.error("Fetch failed", e); 
        showToast("Network error", true); 
    }
}

function syncDailyTotalFromSheet() {
    if (!trainingData.length) return;
    
    const today = new Date();
    let todayReps = 0;
    
    // Find today's row (search from bottom up)
    for (let i = trainingData.length - 1; i >= 0; i--) {
        const rowDateStr = trainingData[i][0];
        if (!rowDateStr) continue;

        const rowDate = new Date(rowDateStr);
        // Compare year, month, date
        if (!isNaN(rowDate.getTime()) && 
            rowDate.getFullYear() === today.getFullYear() && 
            rowDate.getMonth() === today.getMonth() && 
            rowDate.getDate() === today.getDate()) {
            
            // Sum sets (Columns B to G -> Indices 1 to 6)
            for(let c=1; c<=6; c++) {
                todayReps += parseInt(trainingData[i][c]) || 0;
            }
            break; // Found today's record
        }
    }
    
    // Update local variables and UI to match the sheet
    dailyTotal = todayReps;
    localStorage.setItem('dailyTotal', dailyTotal);
    if (dailyTotalEl) dailyTotalEl.textContent = dailyTotal;
}

function renderDashboard() {
    if (!trainingData.length || typeof Chart === 'undefined') return;

    let totalReps = 0, maxSet = 0, sessions = trainingData.length;
    let currentRank = trainingData[trainingData.length - 1][9] || '-';
    const labels = [], scores = [], dist = [[],[],[],[],[],[]];

    trainingData.forEach((row, index) => {
        const date = row[0];
        const score = row[8] || 0;
        let rowReps = 0;
        for(let i=1; i<=6; i++) {
            const v = parseInt(row[i]) || 0;
            rowReps += v;
            dist[i-1].push(v);
            if (v > maxSet) maxSet = v;
        }
        totalReps += rowReps;
        labels.push(date.split('/')[1] + '/' + date.split('/')[2]);
        scores.push(score);
    });

    document.getElementById('totalReps').textContent = totalReps;
    document.getElementById('maxSet').textContent = maxSet;
    document.getElementById('sessionsDone').textContent = sessions;
    document.getElementById('currentRank').textContent = currentRank;
    
    // Render History
    const historyHtml = trainingData.slice(-10).reverse().map(row => {
        let rSum = 0; for(let i=1; i<=6; i++) rSum += (parseInt(row[i]) || 0);
        return `<div class="history-item"><div><div class="history-date">${row[0]}</div><div class="history-reps">${rSum} reps</div></div><div class="history-score">${row[8]||0}</div></div>`;
    }).join('');
    document.getElementById('historyItems').innerHTML = historyHtml;

    renderScoreChart(labels, scores);
    renderDistributionChart(labels, dist);
}

function renderScoreChart(l, d) {
    const ctx = document.getElementById('scoreChart');
    if (!ctx) return;
    if (scoreChart) scoreChart.destroy();
    scoreChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: { labels: l, datasets: [{ data: d, borderColor: '#E45C10', backgroundColor: 'rgba(228, 92, 16, 0.1)', fill: true, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { display: false }, x: { grid: { display: false }, ticks: { color: '#4B5D16', font: { size: 10 } } } } }
    });
}

function renderDistributionChart(l, s) {
    const ctx = document.getElementById('distributionChart');
    if (!ctx) return;
    if (distChart) distChart.destroy();
    
    // Palette colors for the 6 sets
    const colors = ['#ECE2CE', '#F2B635', '#E45C10', '#9E5B13', '#4B5D16', '#223300'];
    
    distChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: { labels: l, datasets: s.map((set, i) => ({ label: `Set ${i+1}`, data: set, backgroundColor: colors[i], borderRadius: 4 })) },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { stacked: true, grid: { display: false }, ticks: { color: '#4B5D16', font: { size: 10 } } }, y: { stacked: true, display: false } } }
    });
}

// --- 5. Navigation ---
function switchView(view) {
    const logger = document.getElementById('loggerView');
    const stats = document.getElementById('statsView');
    const navL = document.getElementById('nav-logger');
    const navS = document.getElementById('nav-stats');

    if (view === 'logger') {
        logger.style.display = 'block';
        stats.style.display = 'none';
        navL.classList.add('active');
        navS.classList.remove('active');
    } else {
        logger.style.display = 'none';
        stats.style.display = 'block';
        navL.classList.remove('active');
        navS.classList.add('active');
        fetchData();
    }
}

function openSettings() { settingsModal.style.display = 'flex'; }
function saveSettings() {
    apiUrl = apiUrlInput.value.trim();
    localStorage.setItem('pushup_apiUrl', apiUrl);
    settingsModal.style.display = 'none';
    showToast("Saved!");
    fetchData();
}

// Start App
init();
