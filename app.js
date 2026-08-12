// ==========================================
// DIRECT SUPABASE CLIENT INITIALIZATION
// ==========================================
const SUPABASE_URL = 'https://uvgkckxaopvujeaegrsh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Xj58FH2kvbXftUgp5JBuPA_VLp8vQle';

// Standalone Supabase client instance
window.spClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ==========================================
// TIME CONVERT HELPER (24-hour -> 12-hour AM/PM)
// ==========================================
function formatTo12Hour(timeStr) {
  if (!timeStr || timeStr === '--:--') return '--:--';
  if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;

  let [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  
  return `${hours}:${String(minutes).padStart(2, '0')} ${period}`;
}

// ==========================================
// FETCH & RENDER CLASSES
// ==========================================
async function loadClasses() {
  const { data: classes, error } = await window.spClient
    .from('classes')
    .select('*');

  if (error) {
    console.error('Error fetching classes:', error.message);
    return;
  }

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

  if (emptyState) emptyState.style.display = 'none';

  // 1. Update Hero Circle badge with 12-hour format
  const nextClass = classes[0];
  const className = nextClass.name || nextClass.title || nextClass.subject || 'Class';
  const displayTime = nextClass.time || nextClass.start_time || '--:--';
  
  if (ringTime) ringTime.textContent = formatTo12Hour(displayTime);
  if (ringLabel) ringLabel.textContent = className;
  if (heroEyebrow) heroEyebrow.textContent = `next up: ${className}`;

  // 2. Render cards onto the schedule grid
  if (scheduleGrid) {
    scheduleGrid.innerHTML = classes.map(cls => {
      const name = cls.name || cls.title || cls.subject || 'Class';
      const loc = cls.location || cls.room || 'TBA';
      const rawDay = cls.day !== undefined && cls.day !== null ? cls.day : cls.day_of_week;
      const dayIndex = parseInt(rawDay, 10);
      const dayName = !isNaN(dayIndex) && DAYS[dayIndex] ? DAYS[dayIndex] : (rawDay || '');
      const timeVal = cls.time || cls.start_time || '';

      return `
        <div class="class-card" style="border: 1px dashed #4a6b57; padding: 14px; margin-bottom: 10px; border-radius: 8px; background: rgba(255,255,255,0.03);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <h3 style="margin: 0; font-size: 1.1rem; color: #e2f1e7;">${name}</h3>
            ${dayName ? `<span style="font-size: 0.8rem; background: #233a2d; padding: 2px 8px; border-radius: 12px; color: #8eb89b;">${dayName}</span>` : ''}
          </div>
          <p style="margin: 4px 0; font-family: monospace; font-size: 0.95rem; color: #a3c9b0;">🕒 ${formatTo12Hour(timeVal)}</p>
          <p style="margin: 0; font-size: 0.85rem; color: #7a9e87;">📍 ${loc}</p>
        </div>
      `;
    }).join('');
  }
}

// ==========================================
// ADD CLASS FORM SUBMIT HANDLER
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

  const rawTime = timeInput.value;
  const formattedTime = formatTo12Hour(rawTime);
  const selectedDayValue = daySelect ? daySelect.value : '1';
  const selectedDayInt = parseInt(selectedDayValue, 10);
  const nameVal = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : 'Class';
  const locVal = (locationInput && locationInput.value.trim()) ? locationInput.value.trim() : 'TBA';

  // Fully populated payload mapping all primary keys to non-null values
  const newClass = {
    name: nameVal,
    title: nameVal,
    subject: nameVal,
    location: locVal,
    room: locVal,
    day: selectedDayInt,
    day_of_week: selectedDayInt,
    time: formattedTime,
    start_time: formattedTime
  };

  const { error } = await window.spClient.from('classes').insert([newClass]);

  if (error) {
    alert('Failed to save class: ' + error.message);
    console.error(error);
  } else {
    event.target.reset();
    loadClasses();
  }
}

// ==========================================
// PAGE INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  loadClasses();

  const notifyBtn = document.getElementById('notifyBtn');
  if (notifyBtn) {
    notifyBtn.addEventListener('click', async () => {
      if ('Notification' in window) {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') alert('Notifications turned on!');
      }
    });
  }

  const form = document.getElementById('classForm') || document.querySelector('form');
  if (form) {
    form.addEventListener('submit', handleAddClass);
  }
});
