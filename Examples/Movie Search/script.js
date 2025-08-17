/* ========= CONFIG ========= */
const WM_API_KEY = "XiqsgYmgEV0TuiSIGrDJ58yKcczKPQhjgqagYOzK"; // <- put your key here
const WM_BASE    = "https://api.watchmode.com/v1";
const REGION     = "AU"; // change to your country code if you like (see /regions) 

/* ========= DOM ========= */
const form     = document.getElementById("searchForm");
const input    = document.getElementById("queryInput");
const grid     = document.getElementById("results");
const statusEl = document.getElementById("status");

const chips = {
  all:   document.getElementById("typeAll"),
  movie: document.getElementById("typeMovie"),
  show:  document.getElementById("typeShow"),
};
const clearBtn = document.getElementById("clearBtn");

/* Modal */
const modal       = document.getElementById("detailsModal");
const modalClose  = document.getElementById("modalClose");
const modalPoster = document.getElementById("modalPoster");
const modalTitle  = document.getElementById("modalTitle");
const modalMeta   = document.getElementById("modalMeta");
const modalPlot   = document.getElementById("modalPlot");

/* ========= STATE ========= */
let currentType   = "all"; // "all" | "movie" | "show"
let lastResults   = [];    // results from autocomplete (titles)

/* ========= Helpers ========= */
function setStatus(msg = "") { statusEl.textContent = msg; }
function setChipActive(which) {
  currentType = which;
  Object.entries(chips).forEach(([k, el]) => el.classList.toggle("chip-active", k === which));
}

const NO_IMG = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="300" height="450">
    <rect width="100%" height="100%" fill="#111"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
      fill="#aaa" font-family="Arial, sans-serif" font-size="20">No Image</text>
  </svg>
`)}`;

const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);
const yearOf = (y) => (y && String(y).slice(0,4)) || "—";

/* Watchmode type strings can be: "movie", "tv_series", "tv_miniseries" etc. */
function isMovie(type) { return type === "movie"; }
function isTV(type)    { return type && type.startsWith("tv"); }

/* Filter by active chip */
function filtered(results){
  if (currentType === "movie") return results.filter(r => isMovie(r.type));
  if (currentType === "show")  return results.filter(r => isTV(r.type));
  return results;
}

/* Build one result tile */
function tileMarkup(rec){
  const img   = rec.image_url || NO_IMG;
  const title = rec.name || "Untitled";
  const year  = yearOf(rec.year);
  const type  = rec.type === "movie" ? "Movie" : "TV";
  const rating = rec.user_rating != null ? rec.user_rating : "—"; // may be undefined in autocomplete

  return `
    <article class="tile" data-id="${rec.id}" tabindex="0" aria-label="${title}">
      <div class="poster-wrap">
        <img src="${img}" alt="${title} poster" loading="lazy" />
      </div>
      <div class="meta">
        <h3 class="title" title="${title}">${title}</h3>
        <p class="sub">${year} • ${type}</p>
      </div>
    </article>
  `;
}

/* Render grid */
function render(results){
  const list = filtered(results);
  if (!list.length){
    grid.innerHTML = "";
    setStatus(currentType === "movie"
      ? "No results (try All/TV or another title)."
      : "No results.");
    return;
  }
  setStatus("");
  grid.innerHTML = list.map(tileMarkup).join("");
}

/* ========= API calls ========= */

/* Fast search with poster thumbs:
   /v1/autocomplete-search?search_value=...&search_type=2 (titles only) */
async function wmAutocompleteTitles(query){
  const url = new URL(`${WM_BASE}/autocomplete-search/`);
  url.searchParams.set("apiKey", WM_API_KEY);
  url.searchParams.set("search_value", query);
  url.searchParams.set("search_type", 2); // titles only
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Network error");
  const data = await res.json();
  // Only keep title results (result_type === "title")
  // The object already includes: name, type, id, year, image_url
  return (data.results || []).filter(r => r.result_type === "title");
}

/* Details + streaming sources:
   /v1/title/{id}/details?append_to_response=sources&regions=NZ */
async function wmTitleDetailsWithSources(id){
  const url = new URL(`${WM_BASE}/title/${id}/details/`);
  url.searchParams.set("apiKey", WM_API_KEY);
  url.searchParams.set("append_to_response", "sources"); // include sources
  url.searchParams.set("regions", REGION);               // filter to your country
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Details not found");
  return await res.json();
}

/* ========= Modal rendering ========= */

function platformBadges(sources){
  if (!Array.isArray(sources) || !sources.length) return "";

  // Prefer subscription/free first; then buy/rent.
  const priority = { sub: 0, free: 1, buy: 2, rent: 3, other: 9 };

  // Deduplicate by 'name' + 'type'
  const seen = new Set();
  const uniq = [];
  for (const s of sources){
    const key = `${s.name}|${s.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(s);
  }

  // Sort by type priority, then by name
  uniq.sort((a, b) => {
    const pa = priority[a.type] ?? 9;
    const pb = priority[b.type] ?? 9;
    if (pa !== pb) return pa - pb;
    return (a.name || "").localeCompare(b.name || "");
  });

  // Limit to 10 to keep UI tidy
  const top = uniq.slice(0, 10);

  return `
    <div class="platforms" style="display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.6rem;">
      ${top.map(s => `
        <a href="${s.web_url || '#'}" target="_blank" rel="noopener"
           class="plat"
           style="display:inline-flex;align-items:center;gap:.4rem;
                  background:#1f1f24;border-radius:999px;padding:.35rem .6rem;
                  text-decoration:none;color:#eaeaea;box-shadow:0 0 0 1px #2d2d34 inset;">
          ${s.logo_100px ? `<img src="${s.logo_100px}" alt="" width="18" height="18" style="border-radius:4px;object-fit:cover;">` : ""}
          <span style="font-size:.9rem;white-space:nowrap;">${s.name}${s.type ? ` • ${s.type}` : ""}</span>
        </a>
      `).join("")}
    </div>
  `;
}

function openModal(details){
  const title   = details.title || details.name || "Untitled";
  const year    = yearOf(details.year);
  const type    = (details.type === "movie") ? "Movie" : "TV";
  const runtime = details.runtime_minutes ? `${details.runtime_minutes} min` : "—";
  const rating  = (details.user_rating != null) ? details.user_rating : "—";
  const genres  = Array.isArray(details.genre_names) ? details.genre_names.join(", ") : "";
  const poster  = details.poster || details.poster_url || details.backdrop || details.image_url || NO_IMG;

  // Plot overview (text); Watchmode returns plot_overview
  const overview = details.plot_overview || "No synopsis available.";

  // Streaming sources array when append_to_response=sources (+ regions filter)
  const sources = details.sources || [];

  modalPoster.src = poster;
  modalPoster.alt = `${title} poster`;
  modalTitle.textContent = title;
  modalMeta.textContent  = `${year} • ${type}${genres ? " • " + genres : ""} • ${runtime} • ⭐ ${rating}`;

  // Fill plot
  modalPlot.textContent  = overview;

  // Insert/replace platforms section under the plot
  let platEl = modal.querySelector(".platforms");
  if (platEl) platEl.remove();
  modalPlot.insertAdjacentHTML("afterend", platformBadges(sources));

  if (typeof modal.showModal === "function") modal.showModal();
  else modal.setAttribute("open", "");
}

function closeModal(){
  if (typeof modal.close === "function") modal.close();
  modal.removeAttribute("open");
}

/* ========= Events ========= */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;

  grid.innerHTML = "";
  setStatus("Searching…");
  try {
    const results = await wmAutocompleteTitles(q);
    lastResults = results;
    render(lastResults);
  } catch (err) {
    setStatus(err.message || "Something went wrong.");
  }
});

clearBtn.addEventListener("click", () => {
  input.value = "";
  lastResults = [];
  grid.innerHTML = "";
  setStatus("Cleared.");
  input.focus();
});

chips.all.addEventListener("click",  () => { setChipActive("all");   render(lastResults); });
chips.movie.addEventListener("click",() => { setChipActive("movie"); render(lastResults); });
chips.show.addEventListener("click", () => { setChipActive("show");  render(lastResults); });

/* Tile click → load details + sources */
grid.addEventListener("click", async (e) => {
  const tile = e.target.closest(".tile");
  if (!tile) return;
  const id = tile.getAttribute("data-id");
  setStatus("Loading details…");
  try{
    const details = await wmTitleDetailsWithSources(id);
    setStatus("");
    openModal(details);
  }catch(err){
    setStatus("Couldn’t load details.");
  }
});

/* Keyboard open (Enter) */
grid.addEventListener("keydown", async (e) => {
  if (e.key !== "Enter") return;
  const tile = e.target.closest(".tile");
  if (!tile) return;
  const id = tile.getAttribute("data-id");
  setStatus("Loading details…");
  try{
    const details = await wmTitleDetailsWithSources(id);
    setStatus("");
    openModal(details);
  }catch(err){
    setStatus("Couldn’t load details.");
  }
});

/* Modal close */
modalClose?.addEventListener("click", closeModal);
modal?.addEventListener("click", (e)=>{
  const body = modal.querySelector(".modal-body");
  if (!body) return;
  const r = body.getBoundingClientRect();
  const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  if (!inside) closeModal();
});
window.addEventListener("keydown", (e)=> { if (e.key === "Escape") closeModal(); });

/* ========= Init ========= */
setChipActive("all");
setStatus("Search for a movie or TV show…");

