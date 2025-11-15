import {
  listPosts,
  createPost,
  claimPost,
  approveClaim,
  rejectClaim,
  computeStats,
  getUser,
} from "./api.js";

/* -------------------------------------------------
   SIDEBAR NAV HIGHLIGHT
---------------------------------------------------*/
export function navActivate(key) {
  const link = document.querySelector(`.nav a[data-nav="${key}"]`);
  if (link) {
    document
      .querySelectorAll(".nav a")
      .forEach((x) => x.classList.remove("active"));
    link.classList.add("active");
  }

  const u = getUser();
  const sbN = document.getElementById("sbUser");
  const sbE = document.getElementById("sbEmail");
  if (sbN) sbN.textContent = u.name || "Eco Member";
  if (sbE) sbE.textContent = u.email;
}

/* -------------------------------------------------
   FEED (HOME)
---------------------------------------------------*/
export async function renderFeed() {
  hydrateUserOnSidebar();

  const state = {
    scope: "available", // available | claimed | expired
    search: "",
    type: "all",        // typeOptions.value
    sort: "newest",     // newest | expiring | closest
    diet: [],           // ["Vegetarian", "Vegan", ...]
  };

  const typeOptions = [
    { value: "all",          label: "All Types",   icon: "🍽" },
    { value: "Meals",        label: "Meals",       icon: "🍱" },
    { value: "Snacks",       label: "Snacks",      icon: "🍿" },
    { value: "Beverages",    label: "Beverages",   icon: "🥤" },
    { value: "Baked Goods",  label: "Baked Goods", icon: "🍪" },
    { value: "Fruits",       label: "Fruits",      icon: "🍎" },
    { value: "Other",        label: "Other",       icon: "🧁" },
  ];

  const sortOptions = [
    { value: "newest",   label: "Newest First" },
    { value: "expiring", label: "Expiring Soon" },
    { value: "closest",  label: "Closest to Me" },
  ];

  const dietOptions = [
    "Vegetarian",
    "Vegan",
    "Gluten-Free",
    "Dairy-Free",
    "Nut-Free",
    "Halal",
    "Kosher",
  ];

  /* ---------- Scope tabs ---------- */
  document.querySelectorAll(".scope-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".scope-tab")
        .forEach((x) => x.classList.remove("is-active"));
      btn.classList.add("is-active");
      state.scope = btn.dataset.scope || "available";
      draw();
    });
  });

  /* ---------- Search ---------- */
  const searchInput = document.getElementById("search");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      state.search = searchInput.value.trim().toLowerCase();
      draw();
    });
  }

  /* ---------- Dropdown menus (single shared outside-click handler) ---------- */
  let openMenu = null;

  function closeMenus() {
    document
      .querySelectorAll(".filter-menu")
      .forEach((m) => (m.style.display = "none"));
    openMenu = null;
  }

  function toggleMenu(menu) {
    if (openMenu && openMenu !== menu) {
      openMenu.style.display = "none";
    }
    const showing = menu.style.display === "block";
    menu.style.display = showing ? "none" : "block";
    openMenu = showing ? null : menu;
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".dropdownish") && !e.target.closest(".filter-menu")) {
      closeMenus();
    }
  });

  /* ---------- TYPE MENU ---------- */
  function buildTypeMenu() {
    const btn = document.getElementById("typeBtn");
    const labelSpan = document.getElementById("typeLabel");
    if (!btn) return;

    const menu = document.createElement("div");
    menu.className = "filter-menu";

    typeOptions.forEach((opt) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "filter-menu-item";
      item.dataset.value = opt.value;
      item.innerHTML = `
        <span>${opt.icon || ""}</span>
        <span>${opt.label}</span>
        <span class="fm-check">✓</span>
      `;

      item.addEventListener("click", () => {
        state.type = opt.value;
        if (labelSpan) labelSpan.textContent = opt.label;
        updateMenuSelection(menu, state.type);
        closeMenus();
        draw();
      });

      menu.appendChild(item);
    });

    btn.parentElement.style.position = "relative";
    btn.parentElement.appendChild(menu);

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMenu(menu);
    });

    updateMenuSelection(menu, state.type);
    const startOpt =
      typeOptions.find((o) => o.value === state.type) || typeOptions[0];
    if (labelSpan) labelSpan.textContent = startOpt.label;
  }

  /* ---------- SORT MENU ---------- */
  function buildSortMenu() {
    const btn = document.getElementById("sortBtn");
    const labelSpan = document.getElementById("sortLabel");
    if (!btn) return;

    const menu = document.createElement("div");
    menu.className = "filter-menu";

    sortOptions.forEach((opt) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "filter-menu-item";
      item.dataset.value = opt.value;
      item.textContent = opt.label;

      const check = document.createElement("span");
      check.className = "fm-check";
      check.textContent = "✓";
      item.appendChild(check);

      item.addEventListener("click", () => {
        state.sort = opt.value;
        if (labelSpan) labelSpan.textContent = opt.label;
        updateMenuSelection(menu, state.sort);
        closeMenus();
        draw();
      });

      menu.appendChild(item);
    });

    btn.parentElement.style.position = "relative";
    btn.parentElement.appendChild(menu);

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMenu(menu);
    });

    updateMenuSelection(menu, state.sort);
    const startOpt =
      sortOptions.find((o) => o.value === state.sort) || sortOptions[0];
    if (labelSpan) labelSpan.textContent = startOpt.label;
  }

  /* ---------- DIET MENU (chips) ---------- */
  function dietEmoji(name) {
    switch (name) {
      case "Vegetarian": return "🥦";
      case "Vegan": return "🌱";
      case "Gluten-Free": return "📦";
      case "Dairy-Free": return "🥛";
      case "Nut-Free": return "🥜";
      case "Halal": return "🕋";
      case "Kosher": return "✡️";
      default: return "";
    }
  }

  function buildDietMenu() {
    const btn = document.getElementById("dietBtn");
    const labelSpan = document.getElementById("dietLabel");
    if (!btn) return;

    const menu = document.createElement("div");
    menu.className = "filter-menu dropdown-menu-wide";

    const heading = document.createElement("div");
    heading.className = "dd-heading";
    heading.textContent = "Select dietary filters";
    menu.appendChild(heading);

    const wrap = document.createElement("div");
    wrap.className = "diet-chips";

    dietOptions.forEach((name) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "diet-chip";
      chip.dataset.value = name;
      chip.innerHTML = `${dietEmoji(name)} ${name}`;

      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = state.diet.indexOf(name);
        if (idx === -1) state.diet.push(name);
        else state.diet.splice(idx, 1);
        chip.classList.toggle("is-on", idx === -1);
        updateDietButtonLabel();
        draw();
      });

      wrap.appendChild(chip);
    });

    menu.appendChild(wrap);
    btn.parentElement.style.position = "relative";
    btn.parentElement.appendChild(menu);

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMenu(menu);
    });

    // initial label, no chips active
    updateDietButtonLabel();

    function updateDietButtonLabel() {
      if (!labelSpan) return;
      if (!state.diet.length) labelSpan.textContent = "Dietary";
      else if (state.diet.length === 1) labelSpan.textContent = state.diet[0];
      else labelSpan.textContent = `${state.diet.length} filters`;
    }

    // expose for outer scope
    renderFeed.updateDietButtonLabel = updateDietButtonLabel;
  }

  function updateMenuSelection(menu, value) {
    menu.querySelectorAll(".filter-menu-item").forEach((item) => {
      const isSel = item.dataset.value === value;
      item.classList.toggle("is-selected", isSel);
    });
  }

  // small helper so we can call it after diet changes
  function updateDietButtonLabel() {
    if (typeof renderFeed.updateDietButtonLabel === "function") {
      renderFeed.updateDietButtonLabel();
    }
  }

  buildTypeMenu();
  buildSortMenu();
  buildDietMenu();

  /* ---------- first draw ---------- */
  draw();

  /* ---------- draw() ---------- */
  async function draw() {
    const { available, total, shared, savedKg, list } = computeStats();

    setText("#stAvailable", available);
    setText("#stTotal", total);
    setText("#stShared", shared);
    setText("#stWaste", `${savedKg}kg`);

    const feed = byId("feed");
    const empty = byId("emptyFeed");
    if (!feed) return;
    feed.innerHTML = "";

    const q = state.search;

    let items = list.filter((p) => {
      // scope
      const matchScope =
        state.scope === "available"
          ? p.status === "available"
          : state.scope === "claimed"
          ? p.status === "claimed"
          : p.status === "expired";

      if (!matchScope) return false;

      // type
      const t = state.type;
      if (
        t !== "all" &&
        p.category !== t &&
        p.category !== t.replace(/s$/, "")
      )
        return false;

      // search text
      if (q) {
        const hay =
          (p.title || "") +
          " " +
          (p.location || "") +
          " " +
          (p.category || "");
        if (!hay.toLowerCase().includes(q)) return false;
      }

      // diet
      if (state.diet.length) {
        const postDiet = Array.isArray(p.diet) ? p.diet : [];
        const hasAll = state.diet.every((d) => postDiet.includes(d));
        if (!hasAll) return false;
      }

      return true;
    });

    // sorting
    if (state.sort === "newest") {
      items.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
    } else if (state.sort === "expiring") {
      items.sort(
        (a, b) => new Date(a.expires || 0) - new Date(b.expires || 0)
      );
    } else if (state.sort === "closest") {
      items.sort((a, b) => {
        const da =
          a.distanceMeters ??
          (a.distanceKm != null ? a.distanceKm * 1000 : Infinity);
        const db =
          b.distanceMeters ??
          (b.distanceKm != null ? b.distanceKm * 1000 : Infinity);
        return da - db;
      });
    }

    if (!items.length) {
      if (empty) empty.style.display = "block";
      return;
    }
    if (empty) empty.style.display = "none";

    items.forEach((p) => {
      feed.appendChild(
        mediaCard(p, {
          cta:
            p.status === "available"
              ? {
                  label: "Request to Claim",
                  click: () => claimPost(p.id).then(draw),
                }
              : null,
          showOwner: true,
        })
      );
    });
  }
}

/* -------------------------------------------------
   CREATE POST
---------------------------------------------------*/
export function bindCreate() {
  hydrateUserOnSidebar();
  const form = byId("createForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const diet = fd.getAll("diet");
    const data = {
      title: fd.get("title").trim(),
      category: fd.get("category"),
      qty: fd.get("qty"),
      diet,
      location: fd.get("location").trim(),
      expires: fd.get("expires"),
    };
    await createPost(data);
    location.href = "index.html";
  });
}

/* -------------------------------------------------
   MY POSTS
---------------------------------------------------*/
export async function renderMyPosts() {
  hydrateUserOnSidebar();
  const user = getUser();
  const list = (await listPosts()).filter(
    (p) => p.ownerEmail === user.email
  );
  const wrap = byId("myPosts");
  if (!wrap) return;
  wrap.innerHTML = "";

  list.forEach((p) => {
    const pending = (p.claims || []).filter(
      (c) => c.status === "pending"
    );
    const first = pending[0];
    wrap.appendChild(
      mediaCard(p, {
        extra: first
          ? buttons([
              {
                label: "Approve",
                type: "primary",
                click: () =>
                  approveClaim(p.id, first.id).then(() =>
                    location.reload()
                  ),
              },
              {
                label: "Reject",
                click: () =>
                  rejectClaim(p.id, first.id).then(() =>
                    location.reload()
                  ),
              },
            ])
          : null,
      })
    );
  });

  const empty = byId("emptyMine");
  if (empty) empty.style.display = list.length ? "none" : "block";
}

/* -------------------------------------------------
   MY REQUESTS
---------------------------------------------------*/
export async function renderRequests() {
  hydrateUserOnSidebar();
  const user = getUser();
  const list = await listPosts();

  const pending = [];
  const history = [];

  list.forEach((p) => {
    (p.claims || []).forEach((c) => {
      if (c.byEmail === user.email) {
        const item = { ...p, _claim: c };
        (c.status === "pending" ? pending : history).push(item);
      }
    });
  });

  const pWrap = byId("reqPending");
  const hWrap = byId("reqHistory");
  if (pWrap) pWrap.innerHTML = "";
  if (hWrap) hWrap.innerHTML = "";

  pending.forEach((p) => {
    pWrap.appendChild(
      mediaCard(p, { extra: tag("span", "badge", "⏳ Pending") })
    );
  });

  history.forEach((p) => {
    const status =
      p._claim.status === "approved" ? "✅ Approved" : "❌ Rejected";
    hWrap.appendChild(
      mediaCard(p, { extra: tag("span", "badge", status) })
    );
  });
}

/* -------------------------------------------------
   PROFILE
---------------------------------------------------*/
export async function renderProfile() {
  hydrateUserOnSidebar();
  const user = getUser();
  setText("#pfName", user.name || "Eco Member");
  setText("#pfEmail", user.email);

  const { shared, savedKg, list } = computeStats();
  const mine = list.filter((p) => p.ownerEmail === user.email);

  setText("#kPosts", mine.length);
  setText("#kFed", shared);
  setText("#kSaved", `${savedKg}kg`);
  setText("#kStreak", "0 days");
  setText("#impactCO2", `${savedKg} kg`);
  setText("#impactMeals", shared);

  const pts = mine.length * 10 + shared * 20;
  setText("#levelPts", `${pts} total points`);
  const bar = byId("levelBar");
  if (bar) bar.style.width = Math.min(100, (pts / 50) * 100) + "%";

  const act = byId("pfActivity");
  if (act) {
    act.innerHTML = "";
    mine.slice(0, 4).forEach((p) => act.appendChild(mediaCard(p)));
  }
}

/* -------------------------------------------------
   CARD COMPONENT
---------------------------------------------------*/
function mediaCard(p, opts = {}) {
  const qtyStr = p.qty ? `${p.qty}` : "—";
  const kmStr =
    p.distanceMeters != null
      ? `${(p.distanceMeters / 1000).toFixed(1)}km away`
      : p.distanceKm != null
      ? `${p.distanceKm.toFixed(1)}km away`
      : null;
  const status = (p.status || "available").toLowerCase();

  const root = tag("article", "post-card");

  const statusPill = tag(
    "span",
    `pill status-pill ${
      status === "expired" ? "expired" : status === "claimed" ? "claimed" : ""
    }`,
    status === "expired"
      ? "Expired"
      : status === "claimed"
      ? "Claimed"
      : "Available"
  );
  root.appendChild(statusPill);

  const body = tag("div", "post-body");
  root.appendChild(body);

  const title = tag(
    "h5",
    "post-title",
    `${p.title || "(no title)"}`
  );
  body.appendChild(title);

  const quick = tag(
    "div",
    "post-meta",
    `<span class="chip"><span class="i">🎁</span> ${qtyStr}</span>
     <span class="chip"><span class="i">🍽</span> ${p.category || "Other"}</span>`
  );
  body.appendChild(quick);

  const locRow = tag(
    "div",
    "post-meta",
    `<span><span class="i">📍</span> ${p.location || "—"}</span>
     ${kmStr ? `<span class="chip"><span class="i">📏</span> ${kmStr}</span>` : ""}`
  );
  body.appendChild(locRow);

  const expRow = tag(
    "div",
    "post-meta",
    status === "expired"
      ? `<span class="pill expired"><span class="i">⏱</span> ${relativeExpiry(
          p.expires,
          true
        )}</span>`
      : `<span class="pill"><span class="i">⏱</span> ${relativeExpiry(
          p.expires
        )}</span>`
  );
  body.appendChild(expRow);

  // diet chips
  if (Array.isArray(p.diet) && p.diet.length) {
    const dietRow = tag("div", "post-meta");
    p.diet.forEach((d) => {
      dietRow.appendChild(
        tag("span", "chip", `<span class="i">🥗</span> ${d}`)
      );
    });
    body.appendChild(dietRow);
  }

  if (opts.showOwner) {
    body.appendChild(
      tag(
        "div",
        "post-foot",
        `<span class="i">👤</span> Posted by ${
          p.ownerName || p.ownerEmail || "Eco member"
        }`
      )
    );
  }

  if (opts.cta && status === "available") {
    const actions = tag("div", "post-foot");
    actions.appendChild(
      btn(opts.cta.label || "Request to Claim", "primary", opts.cta.click)
    );
    if (opts.extra) actions.appendChild(opts.extra);
    body.appendChild(actions);
  } else if (opts.extra) {
    body.appendChild(opts.extra);
  }

  const media = tag("div", "post-media");
  root.appendChild(media);

  const img = new Image();
  img.alt = p.title || "";
  img.src =
    p.photoUrl ||
    p.imageUrl ||
    "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?q=80&w=1200&auto=format&fit=crop";
  media.appendChild(img);

  const open = tag("a", "media-open", "↗");
  open.href = p.photoUrl || p.imageUrl || "#";
  open.target = "_blank";
  media.appendChild(open);

  return root;
}

/* -------------------------------------------------
   SMALL HELPERS
---------------------------------------------------*/
function btn(label, type = "ghost", click) {
  const b = tag("button", `btn ${type}`, label);
  if (click) b.onclick = click;
  return b;
}
function buttons(arr) {
  const w = tag("div", "actions");
  arr.forEach((d) => w.appendChild(btn(d.label, d.type, d.click)));
  return w;
}
function tag(el, cls, content) {
  const e = document.createElement(el);
  if (cls) e.className = cls;
  if (content !== undefined) e.innerHTML = content;
  return e;
}
function setText(sel, v) {
  const el = document.querySelector(sel);
  if (el != null) el.textContent = v;
}
function byId(id) {
  return document.getElementById(id);
}

/* relative expiry text like: "Expires in 2h" or "Expired 3 days ago" */
function relativeExpiry(iso, forcePastLabel = false) {
  try {
    const d = new Date(iso).getTime();
    const now = Date.now();
    const diff = d - now;
    const abs = Math.abs(diff);

    const MIN = 60 * 1000,
      HR = 60 * MIN,
      DAY = 24 * HR;
    let txt;
    if (abs < HR) txt = `${Math.max(1, Math.round(abs / MIN))} min`;
    else if (abs < DAY) txt = `${Math.round(abs / HR)} hour${
      abs >= 2 * HR ? "s" : ""
    }`;
    else
      txt = `${Math.round(abs / DAY)} day${
        abs >= 2 * DAY ? "s" : ""
      }`;

    if (diff >= 0 && !forcePastLabel) return `Expires in ${txt}`;
    return `Expired ${txt} ago`;
  } catch {
    return "Expiry unknown";
  }
}

/* hydrate sidebar user info after HTML from shared-sidebar is injected */
function hydrateUserOnSidebar() {
  const u = getUser();
  const observer = new MutationObserver(() => {
    const n = document.getElementById("sbUser");
    const e = document.getElementById("sbEmail");
    if (n && e) {
      n.textContent = u.name || "Eco Member";
      e.textContent = u.email;
      observer.disconnect();
    }
  });
  observer.observe(document.body, { subtree: true, childList: true });
}
