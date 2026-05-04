let currentCount = 0;
let dailyTotal = parseInt(localStorage.getItem('dailyTotal') || '0');
let apiUrl = localStorage.getItem('pushup_apiUrl') || '';

// DOM Elements
const currentInputEl = document.getElementById('currentInput');
const dailyTotalEl = document.getElementById('dailyTotal');
const submitBtn = document.getElementById('submitBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const apiUrlInput = document.getElementById('apiUrl');
const toast = document.getElementById('toast');

// Initialize
dailyTotalEl.textContent = dailyTotal;
apiUrlInput.value = apiUrl;

function adjustCount(amount) {
    currentCount = Math.max(0, currentCount + amount);
    updateDisplay();
}

function resetCount() {
    currentCount = 0;
    updateDisplay();
}

function updateDisplay() {
    currentInputEl.textContent = currentCount;
}

function showToast(message, isError = false) {
    toast.textContent = message;
    toast.style.borderColor = isError ? 'var(--error)' : 'var(--accent-color)';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Global Data
let trainingData = [];
let scoreChart = null;

async function fetchData() {
    if (!apiUrl) return;
    
    try {
        const response = await fetch(apiUrl);
        const result = await response.json();
        if (result.status === 'success') {
            trainingData = result.data;
            renderDashboard();
        }
    } catch (error) {
        console.error("Fetch error:", error);
    }
}

function renderDashboard() {
    if (!trainingData.length) return;

    let totalReps = 0;
    let maxSet = 0;
    let sessions = trainingData.length;
    let currentRank = trainingData[trainingData.length - 1][9] || '-';
    
    const labels = [];
    const scores = [];
    const historyHtml = [];

    // Process data (Column indices: 0:Date, 1-6:Sets, 7:Max, 8:Score, 9:Rank)
    trainingData.forEach((row, index) => {
        const date = row[0];
        const score = row[8] || 0;
        
        // Sum all sets B-G (indices 1-6)
        let rowReps = 0;
        for(let i=1; i<=6; i++) {
            const val = parseInt(row[i]) || 0;
            rowReps += val;
            if (val > maxSet) maxSet = val;
        }
        totalReps += rowReps;

        labels.push(date.split('/')[1] + '/' + date.split('/')[2]); // MM/DD
        scores.push(score);

        // Add to history list (showing last 10)
        if (index >= trainingData.length - 10) {
            historyHtml.unshift(`
                <div class="history-item">
                    <div>
                        <div class="history-date">${date}</div>
                        <div class="history-reps">Total: ${rowReps} reps</div>
                    </div>
                    <div class="history-score">${score}</div>
                </div>
            `);
        }
    });

    // Update Cards
    document.getElementById('totalReps').textContent = totalReps;
    document.getElementById('maxSet').textContent = maxSet;
    document.getElementById('sessionsDone').textContent = sessions;
    document.getElementById('currentRank').textContent = currentRank;
    document.getElementById('historyItems').innerHTML = historyHtml.join('');

    // Update Chart
    renderChart(labels, scores);
}

function renderChart(labels, data) {
    const ctx = document.getElementById('scoreChart').getContext('2d');
    
    if (scoreChart) scoreChart.destroy();

    scoreChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Score Progression',
                data: data,
                borderColor: '#00f2ff',
                backgroundColor: 'rgba(0, 242, 255, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { display: false },
                x: {
                    grid: { display: false },
                    ticks: { color: '#a0a0ab', font: { size: 10 } }
                }
            }
        }
    });
}

function switchView(view) {
    const loggerView = document.getElementById('loggerView');
    const statsView = document.getElementById('statsView');
    const navLogger = document.getElementById('nav-logger');
    const navStats = document.getElementById('nav-stats');

    if (view === 'logger') {
        loggerView.style.display = 'block';
        statsView.style.display = 'none';
        navLogger.classList.add('active');
        navStats.classList.remove('active');
    } else {
        loggerView.style.display = 'none';
        statsView.style.display = 'block';
        navLogger.classList.remove('active');
        navStats.classList.add('active');
        fetchData(); // Refresh data when opening dashboard
    }
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
    submitBtn.textContent = 'SYNCING...';

    const data = { count: currentCount };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            body: JSON.stringify(data)
        });

        const result = await response.json();
        
        if (result.status === 'success') {
            dailyTotal += currentCount;
            localStorage.setItem('dailyTotal', dailyTotal);
            dailyTotalEl.textContent = dailyTotal;
            
            showToast(`Set logged: ${currentCount}!`);
            resetCount();
            fetchData(); // Update dashboard
        } else {
            showToast(result.message || "Failed to log", true);
        }
    } catch (error) {
        console.error(error);
        showToast("Sync error. Check settings.", true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('syncing');
        submitBtn.textContent = 'LOG SET';
    }
}

// Initial fetch
if (apiUrl) fetchData();
