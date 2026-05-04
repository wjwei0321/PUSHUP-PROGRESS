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
        const dateStr = row[0];
        const dateObj = new Date(dateStr);
        // Format to MM/DD for labels, safely fallback to string if invalid
        const labelDate = !isNaN(dateObj.getTime()) ? `${dateObj.getMonth()+1}/${dateObj.getDate()}` : String(dateStr).substring(5,10);
        
        const score = parseFloat(row[8]) || 0;
        let rowReps = 0;
        for(let i=1; i<=6; i++) {
            const v = parseInt(row[i]) || 0;
            rowReps += v;
            dist[i-1].push(v);
            if (v > maxSet) maxSet = v;
        }
        totalReps += rowReps;
        labels.push(labelDate);
        scores.push(score);
    });

    document.getElementById('totalReps').textContent = totalReps;
    document.getElementById('maxSet').textContent = maxSet;
    document.getElementById('sessionsDone').textContent = sessions;
    document.getElementById('currentRank').textContent = currentRank;
    
    // Render History
    const historyHtml = trainingData.slice(-10).reverse().map((row, index) => {
        const dateStr = row[0];
        const dateObj = new Date(dateStr);
        const formattedDate = !isNaN(dateObj.getTime()) ? `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}` : dateStr;
        
        const rank = row[9] || '-';
        let rankColor = '#ccc';
        if (rank === 'A' || rank === 'S') rankColor = '#4caf50';
        else if (rank === 'B') rankColor = '#2196f3';
        else if (rank === 'C') rankColor = '#ff9800';
        else if (rank === 'D') rankColor = '#f44336';

        const rankBadge = `<div class="rank-badge" style="color: ${rankColor}; border-color: ${rankColor}; background: ${rankColor}15;">${rank}</div>`;
        
        let repsHtml = '';
        for(let i=1; i<=6; i++) {
            const val = parseInt(row[i]);
            if (val > 0) repsHtml += `<span class="rep-pill">${val}</span>`;
        }

        const score = parseFloat(row[8]) || 0;
        
        // Calculate original index to pass to edit/delete
        const originalIndex = trainingData.length - 1 - index;

        return `
            <div class="history-row">
                <div class="col-date">
                    <div class="h-date">${formattedDate}</div>
                    ${rankBadge}
                </div>
                <div class="col-reps">${repsHtml}</div>
                <div class="col-score">${score}</div>
                <div class="col-actions">
                    <svg class="action-icon edit-icon" onclick="editRecord(${originalIndex})" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    <svg class="action-icon delete-icon" onclick="deleteRecord(${originalIndex})" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </div>
            </div>`;
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
        options: { 
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, 
            scales: { 
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#888' } }, 
                x: { grid: { display: false }, ticks: { color: '#888', maxRotation: 45, minRotation: 45 } } 
            } 
        }
    });
}

function renderDistributionChart(l, s) {
    const ctx = document.getElementById('distributionChart');
    if (!ctx) return;
    if (distChart) distChart.destroy();
    
    const colors = ['#ECE2CE', '#F2B635', '#E45C10', '#9E5B13', '#4B5D16', '#223300'];
    
    distChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: { labels: l, datasets: s.map((set, i) => ({ label: `Set ${i+1}`, data: set, backgroundColor: colors[i], borderRadius: 4 })) },
        options: { 
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, 
            scales: { 
                x: { stacked: true, grid: { display: false }, ticks: { color: '#888', maxRotation: 45, minRotation: 45 } }, 
                y: { stacked: true, beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#888' } } 
            } 
        }
    });
}

function editRecord(index) {
    showToast("Edit function requires Google Apps Script update.");
}

function deleteRecord(index) {
    showToast("Delete function requires Google Apps Script update.");
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
