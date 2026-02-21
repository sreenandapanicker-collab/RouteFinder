document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('reminder-form');
    const remindersList = document.getElementById('reminders');
    const alarmSound = document.getElementById('alarm-sound');
    const alarmNotification = document.createElement('div');
    alarmNotification.id = 'alarm-notification';
    alarmNotification.innerHTML = `
        <p id="alarm-message"></p>
        <button id="dismiss-alarm">Dismiss</button>
        <button id="snooze-alarm">Snooze</button>
    `;
    document.body.appendChild(alarmNotification);

    let reminders = JSON.parse(localStorage.getItem('reminders')) || [];
    let activeAlarm = null; // To keep track of the currently ringing alarm

    // Theme toggle logic
    const themeToggle = document.getElementById('theme-toggle');
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

    function setTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            themeToggle.checked = true;
        } else {
            document.body.classList.remove('dark-mode');
            themeToggle.checked = false;
        }
        localStorage.setItem('theme', theme);
    }

    // Set initial theme based on local storage or system preference
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme) {
        setTheme(currentTheme);
    } else if (prefersDarkScheme.matches) {
        setTheme('dark');
    } else {
        setTheme('light');
    }

    themeToggle.addEventListener('change', () => {
        if (themeToggle.checked) {
            setTheme('dark');
        } else {
            setTheme('light');
        }
    });

    // Speech alarm toggle logic
    const enableSpeechToggle = document.getElementById('enable-speech');
    let speakAlarmEnabled = JSON.parse(localStorage.getItem('speakAlarmEnabled')) || true; // Default to true

    function setSpeechPreference(enabled) {
        speakAlarmEnabled = enabled;
        enableSpeechToggle.checked = enabled;
        localStorage.setItem('speakAlarmEnabled', JSON.stringify(enabled));
    }

    // Set initial speech preference
    setSpeechPreference(speakAlarmEnabled);

    enableSpeechToggle.addEventListener('change', () => {
        setSpeechPreference(enableSpeechToggle.checked);
    });

    let history = JSON.parse(localStorage.getItem('history')) || [];

    function saveHistory() {
        localStorage.setItem('history', JSON.stringify(history));
    }

    function renderHistory() {
        const historyListElement = document.getElementById('history');
        historyListElement.innerHTML = '';
        history.forEach(entry => {
            const li = document.createElement('li');
            li.textContent = `${new Date(entry.timestamp).toLocaleString()}: ${entry.name} - ${entry.action} ${entry.snoozeDuration ? `(Snoozed for ${entry.snoozeDuration} min)` : ''} (Dosage: ${entry.dosage || 'N/A'})`;
            historyListElement.prepend(li); // Add newest entries first
        });
    }

    document.getElementById('clear-history').addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all history?')) {
            history = [];
            saveHistory();
            renderHistory();
        }
    });

    document.getElementById('export-data').addEventListener('click', () => {
        const data = {
            reminders: reminders,
            history: history
        };
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'medicine_reminder_data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    document.getElementById('import-data').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });

    document.getElementById('import-file').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);
                    if (importedData.reminders && Array.isArray(importedData.reminders)) {
                        reminders = importedData.reminders;
                        saveReminders();
                        renderReminders();
                    }
                    if (importedData.history && Array.isArray(importedData.history)) {
                        history = importedData.history;
                        saveHistory();
                        renderHistory();
                    }
                    alert('Data imported successfully!');
                } catch (error) {
                    alert('Failed to import data: Invalid JSON file.');
                    console.error('Import error:', error);
                }
            };
            reader.readAsText(file);
        }
    });
    
    function saveReminders() {
        localStorage.setItem('reminders', JSON.stringify(reminders));
    }

    function renderReminders() {
        remindersList.innerHTML = '';
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        reminders.forEach((reminder, index) => {
            const li = document.createElement('li');
            li.setAttribute('data-id', index); // Add data-id for styling
            li.style.borderColor = reminder.color; // Apply custom border color
            li.style.backgroundColor = reminder.color + '20'; // Lighten color for background
            li.innerHTML = `
                <div>
                    <span>${reminder.name} at ${reminder.time} ${reminder.repeatDays && reminder.repeatDays.length > 0 ? `(${reminder.repeatDays.map(day => dayNames[day]).join(', ')})` : ''}</span>
                    ${reminder.notes ? `<p class="reminder-notes">${reminder.notes}</p>` : ''}
                    <p class="dosage-info">Dosage: ${reminder.dosage} pills, Stock: <span class="${reminder.stock <= 3 ? 'low-stock' : ''}">${reminder.stock}</span></p>
                </div>
                <button class="delete-btn" data-index="${index}">Delete</button>
            `;
            remindersList.appendChild(li);
        });
        checkLowStock(); // Check stock after rendering
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const medicineName = document.getElementById('medicine-name').value;
        const reminderTime = document.getElementById('reminder-time').value;
        const medicineNotes = document.getElementById('medicine-notes').value;
        const medicineDosage = parseInt(document.getElementById('medicine-dosage').value);
        const medicineStock = parseInt(document.getElementById('medicine-stock').value);
        const snoozeDuration = parseInt(document.getElementById('snooze-duration').value);
        const reminderColor = document.getElementById('reminder-color').value;

        const selectedDays = Array.from(document.querySelectorAll('.form-group-days input[type="checkbox"]:checked'))
                                .map(checkbox => parseInt(checkbox.value));

        reminders.push({ 
            id: Date.now(), 
            name: medicineName, 
            time: reminderTime, 
            notes: medicineNotes, 
            dosage: medicineDosage, 
            stock: medicineStock,
            active: true, 
            repeatDays: selectedDays, // Store selected days
            lastTriggeredDate: null, 
            snoozeDuration: snoozeDuration,
            color: reminderColor
        });
        saveReminders();
        renderReminders();
        form.reset();
        document.querySelectorAll('.form-group-days input[type="checkbox"]').forEach(checkbox => checkbox.checked = false); // Clear checkboxes
    });

    remindersList.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const index = e.target.getAttribute('data-index');
            reminders.splice(index, 1);
            saveReminders();
            renderReminders();
            renderHistory(); // Re-render history on reminder deletion
        }
    });

    function resetRecurringReminders() {
        const today = new Date().toDateString();
        const currentDay = new Date().getDay(); // 0 for Sunday, 6 for Saturday
        reminders.forEach(reminder => {
            // If it's a recurring reminder and today is one of its days, and it hasn't been triggered today
            if (reminder.repeatDays && reminder.repeatDays.includes(currentDay) && reminder.lastTriggeredDate !== today) {
                reminder.active = true;
                reminder.lastTriggeredDate = null; // Reset for the new day
            } else if (!reminder.repeatDays || reminder.repeatDays.length === 0) {
                // One-time reminders should reset active state if needed, but only if they haven't been dismissed
                // This part needs careful consideration depending on desired behavior for one-time reminders across days
                // For now, if active is false, it stays false until re-added.
            }
        });
        saveReminders();
    }

    function checkReminders() {
        resetRecurringReminders(); // Check for new day and recurring reminders
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const today = now.toDateString();
        const currentDay = now.getDay();

        reminders.forEach(reminder => {
            // Check if it's the correct time
            if (reminder.time === currentTime && activeAlarm === null) {
                // If it's a recurring reminder for today and hasn't been triggered yet
                if (reminder.repeatDays && reminder.repeatDays.includes(currentDay) && reminder.lastTriggeredDate !== today) {
                    triggerAlarm(reminder);
                } 
                // If it's a one-time reminder and is active
                else if ((!reminder.repeatDays || reminder.repeatDays.length === 0) && reminder.active) {
                    triggerAlarm(reminder);
                }
            }
        });
    }

    function triggerAlarm(reminder) {
        activeAlarm = reminder;
        alarmSound.loop = true;
        alarmSound.play().catch(error => {
            console.error("Audio playback failed:", error);
            alert(`Time for your medicine: ${reminder.name}!`);
        });

        if (speakAlarmEnabled && 'speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(`Time for your ${reminder.name}! ${reminder.notes ? `Notes: ${reminder.notes}` : ''}`);
            speechSynthesis.speak(utterance);
        }

        document.getElementById('alarm-message').textContent = `Time for your ${reminder.name}!`;
        alarmNotification.classList.add('show');
        
        // Visual feedback for active reminder
        const activeLi = remindersList.querySelector(`li[data-id="${reminders.indexOf(reminder)}"]`);
        if (activeLi) {
            activeLi.classList.add('ringing');
        }
    }

    function stopAlarm() {
        alarmSound.pause();
        alarmSound.currentTime = 0;
        alarmSound.loop = false;
        alarmNotification.classList.remove('show');
        
        if ('speechSynthesis' in window) {
            speechSynthesis.cancel(); // Stop any ongoing speech
        }

        if (activeAlarm) {
            const activeLi = remindersList.querySelector(`li[data-id="${reminders.indexOf(activeAlarm)}"]`);
            if (activeLi) {
                activeLi.classList.remove('ringing');
            }
            activeAlarm = null; // Ensure activeAlarm is cleared
        }
    }

    document.getElementById('dismiss-alarm').addEventListener('click', () => {
        if (activeAlarm) {
            activeAlarm.stock -= activeAlarm.dosage; // Decrement stock
            if (activeAlarm.stock < 0) activeAlarm.stock = 0; // Prevent negative stock
            
            // Mark as triggered for today for recurring reminders
            if (activeAlarm.repeatDays && activeAlarm.repeatDays.length > 0) {
                activeAlarm.lastTriggeredDate = new Date().toDateString(); 
            } else {
                activeAlarm.active = false; // For one-time reminders, deactivate
            }
            history.push({ type: 'dismiss', name: activeAlarm.name, time: activeAlarm.time, dosage: activeAlarm.dosage, timestamp: new Date().toISOString() });
            saveHistory();
            saveReminders();
            renderReminders(); // Re-render to show updated stock and possibly (Daily) status
            renderHistory();
        }
        stopAlarm();
    });

    document.getElementById('snooze-alarm').addEventListener('click', () => {
        if (activeAlarm) {
            // Use custom snooze duration
            const now = new Date();
            now.setMinutes(now.getMinutes() + activeAlarm.snoozeDuration);
            activeAlarm.time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            history.push({ type: 'snooze', name: activeAlarm.name, time: activeAlarm.time, snoozeDuration: activeAlarm.snoozeDuration, timestamp: new Date().toISOString() });
            saveHistory();
            saveReminders();
            checkLowStock(); 
            renderHistory();
        }
        stopAlarm();
    });

    function checkLowStock() {
        reminders.forEach(reminder => {
            if (reminder.stock <= 3 && reminder.stock > 0) { // Warn if 3 or less doses remain
                const li = remindersList.querySelector(`li[data-id="${reminders.indexOf(reminder)}"]`);
                if (li && !li.querySelector('.low-stock-warning')) {
                    const warning = document.createElement('p');
                    warning.classList.add('low-stock-warning');
                    warning.textContent = `Low stock: ${reminder.stock} doses remaining!`;
                    li.appendChild(warning);
                }
            } else {
                const li = remindersList.querySelector(`li[data-id="${reminders.indexOf(reminder)}"]`);
                const warning = li ? li.querySelector('.low-stock-warning') : null;
                if (warning) {
                    warning.remove();
                }
            }
        });
    }

    renderReminders();
    renderHistory(); // Render history on initial load
    setInterval(checkReminders, 1000); // Check every second

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        });
    }
});
