// --- CONFIGURATION ---
const KEY = 'water_track_v2';
let data = {
    name: "User",
    goal: 4000,
    start: "08:00",
    end: "23:00",
    current: 0,
    history: [0, 0, 0, 0, 0, 0, 0], // Last 7 days
    lastDate: new Date().toDateString()
};
let myChart = null;

// --- INITIALIZATION ---
window.onload = () => {
    const saved = localStorage.getItem(KEY);
    if (saved) {
        data = JSON.parse(saved);
        checkNewDay(); // Reset if it's a new day
        showDashboard();
    } else {
        document.getElementById('setup-screen').classList.remove('hidden');
    }
    
    // Update the "hourly tip" message every minute
    setInterval(updateHourlyStatus, 60000);
};

// --- CORE FUNCTIONS ---

function saveSetup() {
    data.name = document.getElementById('user-name').value || "Friend";
    data.goal = parseInt(document.getElementById('goal-liters').value);
    data.start = document.getElementById('start-time').value;
    data.end = document.getElementById('end-time').value;
    
    save();
    showDashboard();
}

function showDashboard() {
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
    
    document.getElementById('disp-name').innerText = data.name;
    document.getElementById('disp-date').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric'});
    document.getElementById('goal-display').innerText = data.goal;
    
    updateUI();
    initChart();
}

function addWater(amount) {
    // 1. Check Time Limits
    const now = new Date();
    const currentHour = now.getHours();
    const startHour = parseInt(data.start.split(':')[0]);
    const endHour = parseInt(data.end.split(':')[0]);

    if (currentHour < startHour || currentHour >= endHour) {
        alert(`You set your drinking hours between ${data.start} and ${data.end}. It's rest time!`);
        return;
    }

    // 2. Add Water
    data.current += amount;
    
    // 3. Check Success
    if (data.current >= data.goal && (data.current - amount) < data.goal) {
        showSuccess();
    }

    // 4. Update History (Today is index 6)
    data.history[6] = data.current;

    save();
    updateUI();
}

function updateUI() {
    // Update Numbers
    document.getElementById('current-intake').innerText = data.current;
    
    // Update Chart if it exists
    if (myChart) {
        myChart.data.datasets[0].data = data.history;
        myChart.update();
    }

    updateHourlyStatus();
}

function updateHourlyStatus() {
    if (data.current >= data.goal) {
        document.getElementById('hourly-tip').innerText = "🎉 Daily Goal Complete!";
        document.getElementById('hourly-tip').style.background = "#d4edda";
        document.getElementById('hourly-tip').style.color = "#155724";
        return;
    }

    const now = new Date();
    const endHour = parseInt(data.end.split(':')[0]);
    const currentHour = now.getHours();
    
    if (currentHour >= endHour) {
        document.getElementById('hourly-tip').innerText = "😴 Tracking paused for the night.";
        return;
    }

    const hoursLeft = endHour - currentHour;
    const waterLeft = data.goal - data.current;
    
    // Avoid division by zero
    if (hoursLeft <= 0) return;

    const neededPerHour = Math.round(waterLeft / hoursLeft);
    
    document.getElementById('hourly-tip').innerText = 
        `💡 Tip: Drink ~${neededPerHour}ml this hour to stay on track.`;
    document.getElementById('hourly-tip').style.background = "#e2e8f0";
    document.getElementById('hourly-tip').style.color = "#4a5568";
}

function checkNewDay() {
    const today = new Date().toDateString();
    if (data.lastDate !== today) {
        // Shift array left (remove oldest day, add 0 for new day)
        data.history.shift(); 
        data.history.push(0);
        data.current = 0;
        data.lastDate = today;
        save();
    }
}

function save() {
    localStorage.setItem(KEY, JSON.stringify(data));
}

function openSetup() {
    document.getElementById('dashboard-screen').classList.add('hidden');
    document.getElementById('setup-screen').classList.remove('hidden');
}

// --- CHART.JS LOGIC ---
function initChart() {
    const ctx = document.getElementById('historyChart').getContext('2d');
    
    if (myChart) myChart.destroy(); // Prevent duplicates

    // Create labels for last 7 days (e.g., "Mon", "Tue")
    const labels = [];
    for(let i=6; i>=0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
    }

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'ml Intake',
                data: data.history,
                backgroundColor: '#4FACFE',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { display: false },
                x: { grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// --- SHARING (MODAL) ---
function showSuccess() {
    document.getElementById('success-name').innerText = data.name;
    document.getElementById('success-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('success-modal').classList.add('hidden');
}

async function shareResult() {
    // Basic Web Share API (Works on most modern mobile browsers)
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Hydration Goal!',
                text: `I just crushed my water goal of ${data.goal}ml on HydroTrack! 💧`,
                url: window.location.href
            });
        } catch (err) {
            console.log("Share canceled");
        }
    } else {
        alert("Screenshot this screen to share!");
    }
}