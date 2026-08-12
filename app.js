// ==========================================
// CONFIGURATION - SUPABASE KEYS
// ==========================================
const SUPABASE_URL = 'https://uvgkckxaopvujeaegrsh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Xj58FH2kvbXftUgp5JBuPA_VLp8vQle';

// Initialize Supabase Client (uses window.supabase from CDN)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
  const { data: classes, error } = await supabase
    .from('classes')
    .select('*')
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Error fetching classes:', error.message);
    return;
  }

  const circleDisplay = document.querySelector('section main, header div span:last-child, .circle-time');
  const boardContainer = document.querySelector('.board, main section:last-of-type div');

  // Update Next Class in Circle Badge
  if (circleDisplay && classes && classes.length > 0) {
    const nextClassTime = classes[0].start_time;
    circleDisplay.textContent = formatTo12Hour(nextClassTime);
  }

  // Render Schedule Board
  if (boardContainer) {
    if (!classes || classes.length === 0) {
      boardContainer.innerHTML = '<p>Nothing pinned yet — your week starts blank.</p>';
      return;
    }

    boardContainer.innerHTML = classes.map(cls => `
      <div class="class-card" style="border: 1px solid #ccc; padding: 12px; margin-bottom: 8px; border-radius: 8px;">
        <h3 style="margin: 0;">${cls.subject || cls.title || cls.class_name || 'Class'}</h3>
        <p style="margin: 4px 0;"><strong>Time:</strong> ${formatTo12Hour(cls.start_time)}</p>
        <p style="margin: 0;"><strong>Room:</strong> ${cls.room || 'TBA'}</p>
      </div>
    `).join('');
  }
}

// ==========================================
// ADD CLASS FORM HANDLER
// ==========================================
async function handleAddClass(event) {
  event.preventDefault();
  
  const form = event.target;
  const titleInput = form.querySelector('input[type="text"], input[name="subject"], input[name="title"]');
  const timeInput = form.querySelector('input[type="time"]');
  const roomInput = form.querySelector('input[name="room"]');

  if (!timeInput || !timeInput.value) {
    alert('Please select a valid time!');
    return;
  }

  const rawTime = timeInput.value; // e.g. "13:30"
  const formattedTime = formatTo12Hour(rawTime); // "1:30 PM"

  const newClass = {
    title: titleInput ? titleInput.value : 'New Class',
    start_time: formattedTime,
    room: roomInput ? roomInput.value : 'TBA'
  };

  const { error } = await supabase.from('classes').insert([newClass]);

  if (error) {
    alert('Failed to save class: ' + error.message);
  } else {
    form.reset();
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
      console.log('Notification permission granted.');
    }
  }
}

// ==========================================
// INITIALIZATION ON PAGE LOAD
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Load existing classes from database
  loadClasses();

  // Ask for notification permissions
  requestNotificationPermission();

  // Attach listener to Add Class form
  const form = document.querySelector('form');
  if (form) {
    form.addEventListener('submit', handleAddClass);
  }
});
