const { createClient } = supabase;
const db = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RING_CIRCUMFERENCE = 2 * Math.PI * 88;

const form = document.getElementById("classForm");
const grid = document.getElementById("scheduleGrid");
const emptyState = document.getElementById("emptyState");
const notifyBtn = document.getElementById("notifyBtn");
const toast = document.getElementById("toast");

let classes = [];

// ---------- Toast ----------

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("visible");
  setTimeout(() => toast.classList.remove("visible"), 2600);
}

// ---------- Data ----------

async function loadClasses() {
  const { data, error } = await db
    .from("classes")
    .select("*")
    .order("day", { ascending: true })
    .order("time", { ascending: true });

  if (error) {
    showToast("Couldn't load your schedule — check config.js");
    console.error(error);
    return;
  }
  classes = data || [];
  renderSchedule();
  renderHero();
}

async function addClass(payload) {
  const { error } = await db.from("classes").insert(payload);
  if (error) {
    showToast("Couldn't save that class");
    console.error(error);
    return false;
  }
  return true;
}

async function removeClass(id) {
  const { error } = await db.from("classes").delete().eq("id", id);
  if (error) {
    showToast("Couldn't remove that class");
    console.error(error);
    return;
  }
  classes = classes.filter((c) => c.id !== id);
  renderSchedule();
  renderHero();
}

// ---------- Rendering: schedule board ----------

function renderSchedule() {
  grid.innerHTML = "";

  if (classes.length === 0) {
    emptyState.classList.add("visible");
    return;
  }
  emptyState.classList.remove("visible");

  const today = new Date().getDay();

  classes.forEach((cls) => {
    const card = document.createElement("div");
    card.className = "day-card" + (cls.day === today ? " today" : "");

    card.innerHTML = `
      <div class="day-card-main">
        <span class="day-card-day">${DAY_NAMES[cls.day]}</span>
        <span class="day-card-name">${escapeHTML(cls.name)}</span>
        <span class="day-card-meta">${cls.time}${cls.location ? " · " + escapeHTML(cls.location) : ""}</span>
      </div>
      <button class="remove-btn" title="Remove" aria-label="Remove ${escapeHTML(cls.name)}">✕</button>
    `;

    card.querySelector(".remove-btn").addEventListener("click", () => removeClass(cls.id));
    grid.appendChild(card);
  });
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Rendering: hero countdown ----------

function nextOccurrence(cls, now) {
  const [h, m] = cls.time.split(":").map(Number);
  const target = new Date(now);
  target.setSeconds(0, 0);
  const dayDiff = (cls.day - now.getDay() + 7) % 7;
  target.setDate(now.getDate() + dayDiff);
  target.setHours(h, m, 0, 0);
  if (target < now) target.setDate(target.getDate() + 7);
  return target;
}

function renderHero() {
  const heroEyebrow = document.getElementById("heroEyebrow");
  const ringTime = document.getElementById("ringTime");
  const ringLabel = document.getElementById("ringLabel");
  const heroSub = document.getElementById("heroSub");
  const ringFill = document.getElementById("ringFill");

  ringFill.style.strokeDasharray = RING_CIRCUMFERENCE;

  if (classes.length === 0) {
    heroEyebrow.textContent = "no classes on the board yet";
    ringTime.textContent = "--:--";
    ringLabel.textContent = "add your first class";
    heroSub.textContent = "Alerts fire 30 minutes before roll call.";
    ringFill.style.strokeDashoffset = RING_CIRCUMFERENCE;
    return;
  }

  const now = new Date();
  let next = null;
  let nextTarget = null;

  classes.forEach((cls) => {
    const t = nextOccurrence(cls, now);
    if (!nextTarget || t < nextTarget) {
      nextTarget = t;
      next = cls;
    }
  });

  const msAway = nextTarget - now;
  const minsAway = Math.floor(msAway / 60000);
  const hoursAway = Math.floor(minsAway / 60);
  const daysAway = Math.floor(hoursAway / 24);

  heroEyebrow.textContent = daysAway > 0 ? "coming up" : "next class today";
  ringTime.textContent = next.time;
  ringLabel.textContent = next.name;

  if (daysAway > 0) {
    heroSub.textContent = `${DAY_NAMES[next.day]} · ${daysAway} day${daysAway > 1 ? "s" : ""} away`;
    ringFill.style.strokeDashoffset = RING_CIRCUMFERENCE;
    ringFill.classList.remove("urgent");
  } else {
    heroSub.textContent = hoursAway > 0
      ? `${hoursAway}h ${minsAway % 60}m away`
      : `${minsAway}m away`;
    const windowMs = 3 * 60 * 60 * 1000;
    const progress = Math.max(0, Math.min(1, 1 - msAway / windowMs));
    ringFill.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);
    ringFill.classList.toggle("urgent", minsAway <= 30);
  }
}

// ---------- Push notifications ----------

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function updateNotifyButton() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    notifyBtn.textContent = "Push not supported here";
    notifyBtn.disabled = true;
    return;
  }
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  notifyBtn.textContent = sub ? "Alerts on" : "Turn on alerts";
  notifyBtn.classList.toggle("active", !!sub);
}

async function enablePush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    showToast("This browser doesn't support push notifications");
    return;
  }
  if (!CONFIG.VAPID_PUBLIC_KEY || CONFIG.VAPID_PUBLIC_KEY.startsWith("YOUR-")) {
    showToast("Add your VAPID public key to config.js first");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    showToast("Notifications blocked — enable them in browser settings");
    return;
  }

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(CONFIG.VAPID_PUBLIC_KEY),
    });
  }

  const { error } = await db.from("push_subscriptions").insert({
    endpoint: sub.endpoint,
    subscription: sub.toJSON(),
  });

  if (error && error.code !== "23505") {
    showToast("Couldn't save subscription");
    console.error(error);
    return;
  }

  showToast("Alerts are on — 30 min heads up, coming right up");
  updateNotifyButton();
}

notifyBtn.addEventListener("click", enablePush);

// ---------- Form ----------

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const payload = {
    name: fd.get("name").trim(),
    location: fd.get("location").trim(),
    day: Number(fd.get("day")),
    time: fd.get("time"),
  };
  if (!payload.name || !payload.time) return;

  const ok = await addClass(payload);
  if (ok) {
    form.reset();
    showToast("Pinned to the board");
    loadClasses();
  }
});

// ---------- Boot ----------

async function init() {
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("service-worker.js");
    } catch (err) {
      console.error("Service worker registration failed:", err);
    }
  }
  await loadClasses();
  await updateNotifyButton();
  setInterval(renderHero, 30000);
}

init();
