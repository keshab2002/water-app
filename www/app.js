// Import Capacitor Plugins (These work globally when built for Android)
// Note: On web, some plugins might show warnings.

const STORAGE_KEY = 'water_app_data';

let appData = {
    name: "",
    goal: 4000,
    startTime: "08:00",
    endTime: "23:00",
    current: 0,
    date: new Date().toDateString(),
    history: [0, 0, 0, 0, 0, 0, 0] // Last 7 days
};

// --- INITIALIZATION ---
window.onload = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        appData = JSON.parse(saved);
        checkNewDay();
        showDashboard();
    } else {
        document.getElementById('settings-screen').classList.remove('hidden');
    }
};

// --- CORE LOGIC ---

function saveSettings() {
    const name = document.getElementById('user-name').value;
    const goal = document.getElementById('goal-liters').value;
    const start = document.getElementById('start-time').value;
    const end = document.getElementById('end-time').value;

    if (!name) return alert("Please enter your name");

    appData.name = name;
    appData.goal = parseInt(goal);
    appData.startTime = start;
    appData.endTime = end;
    
    saveData();
    scheduleNotifications(); // Schedule the hourly reminders
    showDashboard();
}

function showDashboard() {
    document.getElementById('settings-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
    
    document.getElementById('display-name').innerText = `Hello, ${appData.name}`;
    updateUI();
    renderChart();
}

function openSettings() {
    document.getElementById('dashboard-screen').classList.add('hidden');
    document.getElementById('settings-screen').classList.remove('hidden');
}

function addWater(amount) {
    appData.current += amount;
    
    // Check Goal
    if (appData.current >= appData.goal && (appData.current - amount) < appData.goal) {
        showSuccessModal();
    }
    
    // Update Today's History
    appData.history[6] = appData.current;
    
    saveData();
    updateUI();
    renderChart();
}

function updateUI() {
    // Update Progress Bar
    const percentage = Math.min((appData.current / appData.goal) * 100, 100);
    document.getElementById('progress-fill').style.width = percentage + "%";
    document.getElementById('progress-text').innerText = `${appData.current} / ${appData.goal} ml`;

    // Calculate Hourly Requirement logic
    const now = new Date();
    const endParts = appData.endTime.split(':');
    const endHour = parseInt(endParts[0]);
    const currentHour = now.getHours();
    
    let msg = "";
    if (currentHour < endHour && appData.current < appData.goal) {
        const remainingHours = endHour - currentHour;
        const remainingWater = appData.goal - appData.current;
        const perHour = Math.round(remainingWater / remainingHours);
        msg = `Try to drink ${perHour}ml this hour to hit your goal!`;
    } else if (appData.current >= appData.goal) {
        msg = "Goal Reached! Great job!";
    } else {
        msg = "Day ended. Try again tomorrow!";
    }
    document.getElementById('message-text').innerText = msg;
}

function checkNewDay() {
    const today = new Date().toDateString();
    if (appData.date !== today) {
        // Shift history: remove first day, add 0 for today
        appData.history.shift();
        appData.history.push(0);
        appData.current = 0;
        appData.date = today;
        saveData();
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

// --- CAPACITOR FEATURES ---

async function scheduleNotifications() {
    // We need to use the Capacitor LocalNotifications plugin
    const { LocalNotifications } = Capacitor.Plugins;

    // Clear old ones
    await LocalNotifications.cancel(await LocalNotifications.getPending());

    const startHour = parseInt(appData.startTime.split(':')[0]);
    const endHour = parseInt(appData.endTime.split(':')[0]);

    let notifications = [];
    let idCounter = 1;

    for (let h = startHour; h < endHour; h++) {
        notifications.push({
            title: "Hydration Check 💧",
            body: `Hey ${appData.name}, have you had water this hour?`,
            id: idCounter++,
            schedule: { 
                on: { hour: h, minute: 0 },
                repeats: true 
            }
        });
    }

    try {
        await LocalNotifications.schedule({ notifications });
        console.log("Notifications scheduled");
    } catch (e) {
        console.log("Notification setup skipped (Web Mode)");
    }
}

// --- SHARING & CHART ---

function renderChart() {
    const ctx = document.getElementById('weeklyChart').getContext('2d');
    
    // Destroy previous chart if exists to avoid overlay
    if (window.myChart) window.myChart.destroy();

    window.myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Today'],
            datasets: [{
                label: 'Intake (ml)',
                data: appData.history,
                backgroundColor: '#00a8cc'
            }]
        }
    });
}

function showSuccessModal() {
    document.getElementById('success-user').innerText = appData.name;
    document.getElementById('success-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('success-modal').classList.add('hidden');
}

async function shareSuccess() {
    const { Share, Filesystem } = Capacitor.Plugins;
    
    // 1. Capture the div as canvas
    const div = document.getElementById('share-area');
    const canvas = await html2canvas(div);
    const base64 = canvas.toDataURL("image/png");

    // 2. Write file to phone storage (Required for sharing images on Android)
    try {
        const fileName = 'hydration-success.png';
        const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: base64,
            directory: 'CACHE' // Save to temporary cache
        });

        // 3. Share
        await Share.share({
            title: 'Goal Reached!',
            text: `I just drank ${appData.goal}ml of water today on WaterTracker!`,
            url: savedFile.uri,
            dialogTitle: 'Share your success'
        });
    } catch (e) {
        console.error("Sharing failed", e);
        alert("Sharing is only available on the actual app, not browser!");
    }
}