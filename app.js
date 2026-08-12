// ==========================================
// CONFIGURATION & INITIALIZATION
// ==========================================
// Reuses existing 'supabase' or 'supabaseClient' initialized in config.js
const db = window.supabaseClient || (typeof supabase !== 'undefined' ? supabase : window.supabase.createClient('https://uvgkckxaopvujeaegrsh.supabase.co', 'sb_publishable_Xj58FH2kvbXftUgp5JBuPA_VLp8vQle'));

// Days array for mapping day numbers
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ==========================================
// TIME CONVERT HELPER (24-hour -> 12-hour AM/PM)
// ==========================================
function formatTo12Hour(timeStr) {
  if (!timeStr || timeStr === '--:--') return '--:--';
  if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;

  let [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12; // Converts 0/12 to 12
  
  return `${hours}:${String(minutes).padStart(2, '0')} ${period}`;
}

// ==========================================
// UI & DISPLAY FUNCTIONS
// ==========================================
async function loadClasses() {
  const { data: classes, error } = await db
    .from('classes')
    .select('*')
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Error fetching classes:', error.message);
    return;
  }

  // Exact elements from your HTML index
  const ringTime = document.getElementById('ringTime');
  const ringLabel = document.getElementById('ringLabel');
  const heroEyebrow = document.getElementById('heroEyebrow');
  const scheduleGrid = document.getElementById('scheduleGrid');
  const emptyState = document.getElementById('emptyState');

  if (!classes || classes.length === 0) {
    if (ringTime) ringTime.textContent = '--:--';
    if (ringLabel) ringLabel.textContent = 'add your first class';
    if (heroEyebrow) heroEyebrow.textContent = 'no classes on the board yet';
    if (emptyState) emptyState.style.display = 'block';
    if (scheduleGrid) scheduleGrid.innerHTML = '';
    return;
  }

  // Hide empty state paragraph
  if (emptyState) emptyState.style.display = 'none';

  // 1. Update the Big Hero Circle with the upcoming/first class
  const nextClass = classes[0];
  const className = nextClass.name || nextClass.title || nextClass.subject || 'Class';
  
  if (ringTime) ringTime.textContent = formatTo12Hour(nextClass.start_time);
  if (ringLabel) ringLabel.textContent = className;
  if (heroEyebrow) heroEyebrow.textContent = `next up: ${className}`;

  // 2. Render schedule cards into #scheduleGrid
  if (scheduleGrid) {
    scheduleGrid.innerHTML = classes.map(cls => {
      const name = cls.name || cls.title || cls.subject || 'Class';
      const loc = cls.location || cls.room || 'TBA';
      const dayName = cls.day_of_week !== undefined && cls.day_of_week !== null ? DAYS[cls.day_of_week] : '';

      return `
        <div class="class-card" style="border: 1px dashed #4a6b57; padding: 14px; margin-bottom: 10px; border-radius: 8px; background: rgba(255,255,255,0.03);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <h3 style="margin: 0; font-size: 1.1rem; color: #e2f1e7;">${name}</h3>
            ${dayName ? `<span style="font-size: 0.8rem; background: #233a2d; padding: 2px 8px; border-radius: 12px; color: #8eb89b;">${dayName}</span>` : ''}
          </div>
          <p style="margin: 4px 0; font-family: monospace; font-size: 0.95rem; color: #a3c9b0;">🕒 ${formatTo12Hour(cls.start_time)}</p>
          <p style="margin: 0; font-size: 0.85rem; color: #7a9e87;">📍 ${loc}</p>
        </div>
      `;
    }).join('');
  }
}

// ==========================================
// ADD CLASS FORM HANDLER
// ==========================================
async function handleAddClass(event) {
  event.preventDefault();

  const nameInput = document.getElementById('name');
  const locationInput = document.getElementById('location');
  const daySelect = document.getElementById('day');
  const timeInput = document.getElementById('time');

  if (!timeInput || !timeInput.value) {
    alert('Please select a start time!');
    return;
  }

  const rawTime = timeInput.value; // e.g. "13:30"
  const formattedTime = formatTo12Hour(rawTime); // "1:30 PM"

  const newClass = {
    name: nameInput ? nameInput.value : 'Class',
    title: nameInput ? nameInput.value : 'Class',
    subject: nameInput ? nameInput.value : 'Class',
    location: locationInput ? locationInput.value : '',
    room: locationInput ? locationInput.value : '',
    day_of_week: daySelect ? parseInt(daySelect.value, 10) : 1,
    start_time: formattedTime
  };

  const { error } = await db.from('classes').insert([newClass]);

  if (error) {
    alert('Failed to save class: ' + error.message);
    console.error(error);
  } else {
    event.target.reset();
    loadClasses();
  }
}

// ==========================================
// NOTIFICATION PERMISSION REQUEST
// ==========================================
async function requestNotificationPermission() {
  if ('Notification' in window) {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      alert('Notifications turned on!');
    }
  }
}

// ==========================================
// INITIALIZATION ON PAGE LOAD
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  loadClasses();

  const notifyBtn = document.getElementById('notifyBtn');
  if (notifyBtn) {
    notifyBtn.addEventListener('click', requestNotificationPermission);
  }

  const form = document.getElementById('classForm') || document.querySelector('form');
  if (form) {
    form.addEventListener('submit', handleAddClass);
  }
});
