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

    const data = {
        count: currentCount,
        notes: "" // Optional
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            body: JSON.stringify(data)
        });

        // Apps Script returns JSON if successful
        const result = await response.json();
        
        if (result.status === 'success') {
            dailyTotal += currentCount;
            localStorage.setItem('dailyTotal', dailyTotal);
            dailyTotalEl.textContent = dailyTotal;
            
            showToast(`Set logged: ${currentCount}!`);
            resetCount();
        } else {
            showToast(result.message || "Failed to log", true);
        }
    } catch (error) {
        // Fallback for CORS issues (Apps Script can be tricky)
        // If we get a CORS error but the data actually reached the sheet
        // we might not know. However, standard fetch with JSON usually works
        // if the Apps Script is set up correctly as 'Anyone'.
        console.error(error);
        showToast("Sync error. Check settings.", true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('syncing');
        submitBtn.textContent = 'LOG PUSHUPS';
    }
}

function openSettings() {
    settingsModal.style.display = 'flex';
}

function saveSettings() {
    apiUrl = apiUrlInput.value.trim();
    localStorage.setItem('pushup_apiUrl', apiUrl);
    settingsModal.style.display = 'none';
    showToast("Settings saved");
}

// Event Listeners
submitBtn.addEventListener('click', logPushups);
settingsBtn.addEventListener('click', openSettings);

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target == settingsModal) {
        settingsModal.style.display = 'none';
    }
}

// Reset daily total if it's a new day
const lastDate = localStorage.getItem('lastLogDate');
const today = new Date().toDateString();
if (lastDate !== today) {
    localStorage.setItem('dailyTotal', '0');
    localStorage.setItem('lastLogDate', today);
    dailyTotal = 0;
    dailyTotalEl.textContent = '0';
}
