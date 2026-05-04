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

// --- 4. Dashboard Logic ---
async function fetchData() {
    if (!apiUrl) return;
    try {
        const response = await fetch(apiUrl);
        const result = await response.json();
        if (result.status === 'success') {
            trainingData = result.data;
            renderDashboard();
        }
    } catch (e) { console.error("Fetch failed", e); }
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
        data: { labels: l, datasets: [{ data: d, borderColor: '#39ff14', backgroundColor: 'rgba(57, 255, 20, 0.1)', fill: true, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { display: false }, x: { grid: { display: false }, ticks: { color: '#888888', font: { size: 10 } } } } }
    });
}

function renderDistributionChart(l, s) {
    const ctx = document.getElementById('distributionChart');
    if (!ctx) return;
    if (distChart) distChart.destroy();
    const colors = ['#39ff14', '#32e312', '#2bc810', '#24ad0e', '#1d920c', '#16770a'];
    distChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: { labels: l, datasets: s.map((set, i) => ({ label: `Set ${i+1}`, data: set, backgroundColor: colors[i], borderRadius: 4 })) },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { stacked: true, grid: { display: false }, ticks: { color: '#888888', font: { size: 10 } } }, y: { stacked: true, display: false } } }
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
