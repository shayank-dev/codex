const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const STORAGE_KEY = 'weather-check';

// WMO weather interpretation codes -> [description, day icon, night icon]
const WMO = {
  0: ['Clear sky', '☀️', '🌙'],
  1: ['Mainly clear', '🌤️', '🌙'],
  2: ['Partly cloudy', '⛅', '☁️'],
  3: ['Overcast', '☁️', '☁️'],
  45: ['Fog', '🌫️', '🌫️'],
  48: ['Freezing fog', '🌫️', '🌫️'],
  51: ['Light drizzle', '🌦️', '🌧️'],
  53: ['Drizzle', '🌦️', '🌧️'],
  55: ['Heavy drizzle', '🌧️', '🌧️'],
  56: ['Freezing drizzle', '🌧️', '🌧️'],
  57: ['Heavy freezing drizzle', '🌧️', '🌧️'],
  61: ['Light rain', '🌦️', '🌧️'],
  63: ['Rain', '🌧️', '🌧️'],
  65: ['Heavy rain', '🌧️', '🌧️'],
  66: ['Freezing rain', '🌧️', '🌧️'],
  67: ['Heavy freezing rain', '🌧️', '🌧️'],
  71: ['Light snow', '🌨️', '🌨️'],
  73: ['Snow', '🌨️', '🌨️'],
  75: ['Heavy snow', '❄️', '❄️'],
  77: ['Snow grains', '🌨️', '🌨️'],
  80: ['Light showers', '🌦️', '🌧️'],
  81: ['Showers', '🌧️', '🌧️'],
  82: ['Violent showers', '⛈️', '⛈️'],
  85: ['Snow showers', '🌨️', '🌨️'],
  86: ['Heavy snow showers', '❄️', '❄️'],
  95: ['Thunderstorm', '⛈️', '⛈️'],
  96: ['Thunderstorm with hail', '⛈️', '⛈️'],
  99: ['Severe thunderstorm with hail', '⛈️', '⛈️'],
};

const $ = (id) => document.getElementById(id);

const state = {
  unit: 'celsius',
  place: null, // { name, label, latitude, longitude }
  data: null,
};

// ---------- persistence ----------

function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (saved.unit === 'celsius' || saved.unit === 'fahrenheit') state.unit = saved.unit;
    if (saved.place && typeof saved.place.latitude === 'number') return saved.place;
  } catch { /* storage unavailable or corrupt */ }
  return null;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ unit: state.unit, place: state.place }));
  } catch { /* ignore */ }
}

// ---------- formatting ----------

const imperial = () => state.unit === 'fahrenheit';
const fmtTemp = (c) => `${Math.round(imperial() ? c * 9 / 5 + 32 : c)}°`;
const fmtWind = (kmh) => (imperial() ? `${Math.round(kmh * 0.621371)} mph` : `${Math.round(kmh)} km/h`);
const fmtPrecip = (mm) => (imperial() ? `${(mm / 25.4).toFixed(2)} in` : `${mm.toFixed(1)} mm`);

function compass(deg) {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];
}

function describe(code, isDay = true) {
  const [text, day, night] = WMO[code] || ['Unknown', '❔', '❔'];
  return { text, icon: isDay ? day : night };
}

// Open-Meteo returns local times without an offset ("2026-10-14T15:00");
// parse the parts directly so the browser's own timezone never shifts them.
function parseLocal(iso) {
  const [date, time = '00:00'] = iso.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm));
}

const hourFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', timeZone: 'UTC' });
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
const timeFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ---------- UI state ----------

function setStatus(message, isError = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', isError);
}

function setUnit(unit) {
  state.unit = unit;
  document.querySelectorAll('.units button').forEach((b) => {
    b.classList.toggle('active', b.dataset.unit === unit);
  });
  save();
  if (state.data) render();
}

// ---------- API ----------

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    let reason = `${res.status} ${res.statusText}`;
    try { reason = (await res.json()).reason || reason; } catch { /* not JSON */ }
    throw new Error(reason);
  }
  return res.json();
}

async function searchCities(name) {
  const params = new URLSearchParams({ name, count: '6', language: 'en', format: 'json' });
  const data = await getJSON(`${GEO_URL}?${params}`);
  return (data.results || []).map((r) => ({
    name: r.name,
    label: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

async function fetchForecast({ latitude, longitude }) {
  const params = new URLSearchParams({
    latitude,
    longitude,
    timezone: 'auto',
    forecast_days: '7',
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m',
    hourly: 'temperature_2m,precipitation_probability,weather_code,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
  });
  return getJSON(`${FORECAST_URL}?${params}`);
}

// ---------- actions ----------

let loadToken = 0;

async function loadPlace(place) {
  const token = ++loadToken;
  state.place = place;
  setStatus(`Loading weather for ${place.label}…`);
  try {
    const data = await fetchForecast(place);
    if (token !== loadToken) return; // a newer request superseded this one
    state.data = data;
    save();
    setStatus('');
    render();
  } catch (err) {
    if (token !== loadToken) return;
    setStatus(`Couldn't load weather: ${err.message}`, true);
  }
}

function showResults(places) {
  const list = $('results');
  list.replaceChildren();
  for (const place of places) {
    const li = el('li');
    const btn = el('button', null, place.label);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      list.hidden = true;
      $('query').value = place.name;
      loadPlace(place);
    });
    li.append(btn);
    list.append(li);
  }
  list.hidden = places.length === 0;
}

async function onSearch(event) {
  event.preventDefault();
  const query = $('query').value.trim();
  if (!query) return;
  $('results').hidden = true;
  setStatus('Searching…');
  try {
    const places = await searchCities(query);
    if (places.length === 0) {
      setStatus(`No places found for "${query}".`, true);
    } else if (places.length === 1) {
      loadPlace(places[0]);
    } else {
      setStatus('Pick a location:');
      showResults(places);
    }
  } catch (err) {
    setStatus(`Search failed: ${err.message}`, true);
  }
}

function onLocate() {
  if (!navigator.geolocation) {
    setStatus('Geolocation is not supported by this browser.', true);
    return;
  }
  setStatus('Finding your location…');
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      const lat = coords.latitude.toFixed(2);
      const lon = coords.longitude.toFixed(2);
      loadPlace({
        name: 'My location',
        label: `My location (${lat}, ${lon})`,
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    },
    (err) => setStatus(`Couldn't get your location: ${err.message}`, true),
    { timeout: 10000, maximumAge: 600000 },
  );
}

// ---------- rendering ----------

function render() {
  const { current, hourly, daily } = state.data;

  const now = describe(current.weather_code, current.is_day === 1);
  $('place').textContent = state.place.label;
  $('updated').textContent = `Local time ${timeFmt.format(parseLocal(current.time))}`;
  $('icon').textContent = now.icon;
  $('temp').textContent = fmtTemp(current.temperature_2m);
  $('summary').textContent = `${now.text} · H ${fmtTemp(daily.temperature_2m_max[0])} L ${fmtTemp(daily.temperature_2m_min[0])}`;
  $('feels').textContent = fmtTemp(current.apparent_temperature);
  $('humidity').textContent = `${current.relative_humidity_2m}%`;
  $('wind').textContent = `${fmtWind(current.wind_speed_10m)} ${compass(current.wind_direction_10m)}`;
  $('precip').textContent = fmtPrecip(current.precipitation);

  // Hourly: start at the current hour (times are same-format local strings, so compare lexically).
  const currentHour = current.time.slice(0, 13);
  let start = hourly.time.findIndex((t) => t.slice(0, 13) >= currentHour);
  if (start < 0) start = 0;
  const hours = $('hourly');
  hours.replaceChildren();
  for (let i = start; i < Math.min(start + 24, hourly.time.length); i++) {
    const w = describe(hourly.weather_code[i], hourly.is_day[i] === 1);
    const cell = el('div', 'hour');
    cell.title = w.text;
    cell.append(
      el('div', null, i === start ? 'Now' : hourFmt.format(parseLocal(hourly.time[i]))),
      el('span', 'h-icon', w.icon),
      el('div', null, fmtTemp(hourly.temperature_2m[i])),
      el('div', 'h-pop', hourly.precipitation_probability[i] ? `${hourly.precipitation_probability[i]}%` : ' '),
    );
    hours.append(cell);
  }

  // Daily: bars positioned on a shared scale across the whole week.
  const weekMin = Math.min(...daily.temperature_2m_min);
  const weekMax = Math.max(...daily.temperature_2m_max);
  const span = weekMax - weekMin || 1;
  const days = $('daily');
  days.replaceChildren();
  daily.time.forEach((t, i) => {
    const w = describe(daily.weather_code[i]);
    const lo = daily.temperature_2m_min[i];
    const hi = daily.temperature_2m_max[i];
    const pop = daily.precipitation_probability_max[i];

    const fill = el('span');
    fill.style.left = `${((lo - weekMin) / span) * 100}%`;
    fill.style.right = `${((weekMax - hi) / span) * 100}%`;
    const bar = el('div', 'bar');
    bar.append(fill);
    const range = el('div', 'range');
    range.append(el('span', 'lo', fmtTemp(lo)), bar, el('span', 'hi', fmtTemp(hi)));

    const icon = el('span', null, w.icon);
    icon.title = w.text;
    const row = el('li', 'day');
    row.append(
      el('span', null, i === 0 ? 'Today' : dayFmt.format(parseLocal(t))),
      icon,
      el('span', 'd-pop', pop ? `${pop}%` : ''),
      range,
    );
    days.append(row);
  });

  $('weather').hidden = false;
}

// ---------- init ----------

$('search').addEventListener('submit', onSearch);
$('locate').addEventListener('click', onLocate);
document.querySelectorAll('.units button').forEach((b) => {
  b.addEventListener('click', () => setUnit(b.dataset.unit));
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.results, .search')) $('results').hidden = true;
});

const savedPlace = loadSaved();
setUnit(state.unit);
if (savedPlace) {
  $('query').value = savedPlace.name;
  loadPlace(savedPlace);
} else {
  setStatus('Search for a city or use your location.');
}
