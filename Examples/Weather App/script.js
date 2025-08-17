// ========== CONFIG ==========
const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WX_URL  = "https://api.open-meteo.com/v1/forecast";
const STORAGE_LAST = "wx.lastQuery";
const STORAGE_UNIT = "wx.unit"; // "C" or "F"

// ========== STATE ==========
let unit = localStorage.getItem(STORAGE_UNIT) || "C";
let lastQuery = JSON.parse(localStorage.getItem(STORAGE_LAST) || "null"); // { name, lat, lon, country }

// ========== DOM ==========
const form = document.getElementById("searchForm");
const input = document.getElementById("cityInput");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const placeNameEl = document.getElementById("placeName");
const updatedAtEl = document.getElementById("updatedAt");
const tempEl = document.getElementById("temp");
const feelsEl = document.getElementById("feels");
const unitLabelEl = document.getElementById("unitLabel");
const humidityEl = document.getElementById("humidity");
const windEl = document.getElementById("wind");
const windDirEl = document.getElementById("windDir");
const precipEl = document.getElementById("precip");
const descEl = document.getElementById("desc");

const geoBtn = document.getElementById("geoBtn");
const cBtn = document.getElementById("cBtn");
const fBtn = document.getElementById("fBtn");

// ========== HELPERS ==========
function setStatus(msg){ statusEl.textContent = msg || ""; }

function setUnit(newUnit){
  unit = newUnit;
  localStorage.setItem(STORAGE_UNIT, unit);
  cBtn.classList.toggle("chip-active", unit === "C");
  fBtn.classList.toggle("chip-active", unit === "F");
  unitLabelEl.textContent = unit;
  if (lastQuery) fetchWeather(lastQuery); // re-fetch with new unit params
}

function fmtSpeed(mps){
  if (unit === "F") { // switch to mph when showing °F
    const mph = mps * 2.236936;
    return `${Math.round(mph*10)/10} mph`;
  }
  const kph = mps * 3.6;
  return `${Math.round(kph*10)/10} km/h`;
}

function weatherCodeToText(code){
  const map = {
    0:"Clear sky", 1:"Mainly clear", 2:"Partly cloudy", 3:"Overcast",
    45:"Fog", 48:"Depositing rime fog",
    51:"Light drizzle", 53:"Moderate drizzle", 55:"Dense drizzle",
    61:"Slight rain", 63:"Moderate rain", 65:"Heavy rain",
    71:"Slight snow", 73:"Moderate snow", 75:"Heavy snow",
    80:"Rain showers", 81:"Rain showers", 82:"Violent rain showers",
    95:"Thunderstorm", 96:"Thunderstorm w/ light hail", 99:"Thunderstorm w/ heavy hail"
  };
  return map[code] || "—";
}

function saveLastQuery(info){
  lastQuery = info;
  localStorage.setItem(STORAGE_LAST, JSON.stringify(info));
}

function toggleDayNight(isDay){
  if (isDay) {
    document.body.classList.add("day");
    document.body.classList.remove("night");
  } else {
    document.body.classList.add("night");
    document.body.classList.remove("day");
  }
}

function showResult(data, info){
  resultEl.hidden = false;
  placeNameEl.textContent = info.country ? `${info.name}, ${info.country}` : info.name;

  const { current } = data;

  // 🌞 Switch background
  toggleDayNight(current.is_day === 1);

  updatedAtEl.textContent = `Updated ${new Date(current.time).toLocaleString()}`;

  tempEl.textContent   = current.temperature_2m;
  feelsEl.textContent  = current.apparent_temperature;
  humidityEl.textContent = current.relative_humidity_2m;
  windEl.textContent   = fmtSpeed(current.wind_speed_10m);
  windDirEl.textContent= current.wind_direction_10m;
  precipEl.textContent = current.precipitation || 0;
  descEl.textContent   = weatherCodeToText(current.weather_code);
}

async function geocodeCity(name){
  const url = `${GEO_URL}?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Geocoding failed");
  const j = await res.json();
  if (!j.results || !j.results.length) throw new Error("City not found");
  const r = j.results[0];
  return { name: r.name, lat: r.latitude, lon: r.longitude, country: r.country_code };
}

async function fetchWeather(info){
  const params = new URLSearchParams({
    latitude: info.lat,
    longitude: info.lon,
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "is_day",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "wind_direction_10m"
    ].join(","),
    temperature_unit: unit === "F" ? "fahrenheit" : "celsius",
    wind_speed_unit: unit === "F" ? "mph" : "kmh",
    timezone: "auto"
  });
  const url = `${WX_URL}?${params.toString()}`;

  setStatus("Loading…");
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather error (${res.status})`);
    const data = await res.json();
    setStatus("");
    showResult(data, info);
  } catch (e) {
    setStatus(e.message || "Failed to load weather.");
    resultEl.hidden = true;
  }
}

// ========== EVENTS ==========
form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const query = input.value.trim();
  if (!query) return;
  try{
    const info = await geocodeCity(query);
    saveLastQuery(info);
    await fetchWeather(info);
  }catch(err){
    setStatus(err.message);
    resultEl.hidden = true;
  }
});

geoBtn.addEventListener("click", ()=>{
  if (!navigator.geolocation) { setStatus("Geolocation not supported."); return; }
  setStatus("Getting your location…");
  navigator.geolocation.getCurrentPosition(async pos=>{
    const info = { name: "My location", lat: pos.coords.latitude, lon: pos.coords.longitude, country: "" };
    saveLastQuery(info);
    await fetchWeather(info);
  }, ()=> setStatus("Couldn’t get location permission."));
});

cBtn.addEventListener("click", ()=> setUnit("C"));
fBtn.addEventListener("click", ()=> setUnit("F"));

// ========== INIT ==========
setUnit(unit); // sync unit UI
// Default to night appearance before first fetch
document.body.classList.add("night");

if (lastQuery) {
  fetchWeather(lastQuery);
} else {
  geocodeCity("Auckland").then(info=>{
    saveLastQuery(info);
    fetchWeather(info);
  });
}
