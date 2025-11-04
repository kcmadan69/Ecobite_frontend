import {
  listPosts, createPost, claimPost, approveClaim, rejectClaim,
  computeStats, getUser
} from './api.js';

/* ---------- SIDEBAR ACTIVATION ---------- */
export function navActivate(key) {
  const link = document.querySelector(`.nav a[data-nav="${key}"]`);
  if (link) {
    document.querySelectorAll('.nav a').forEach(x => x.classList.remove('active'));
    link.classList.add('active');
  }

  const u = getUser();
  const sbN = document.getElementById('sbUser');
  const sbE = document.getElementById('sbEmail');
  if (sbN) sbN.textContent = u.name || 'Eco Member';
  if (sbE) sbE.textContent = u.email;
}

/* ---------- FEED RENDER ---------- */
export async function renderFeed() {
  hydrateUserOnSidebar();
  const state = { scope: 'available' };

  // Tab Switching (Available / Claimed / Expired)
  document.querySelectorAll('.scope-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.scope-tab').forEach(x => x.classList.remove('is-active'));
      btn.classList.add('is-active');
      state.scope = btn.dataset.scope;
      draw();
    });
  });

  // Toolbar Filters
  ['search', 'type', 'sort'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', draw);
  });

  draw();

  async function draw() {
    const { available, total, shared, savedKg, list } = computeStats();
    set('#stAvailable', available);
    set('#stTotal', total);
    set('#stShared', shared);
    set('#stWaste', `${savedKg}kg`);

    const q = (val('search') || '').toLowerCase();
    const type = val('type') || 'all';
    const scope = state.scope;

    let items = list.filter(p => {
      const matchScope = scope === 'available'
        ? p.status === 'available'
        : scope === 'claimed'
          ? p.status === 'claimed'
          : p.status === 'expired';

      const matchType =
        type === 'all' ? true : (p.category === type || p.category === singular(type));

      const matchQuery =
        !q ||
        (p.title || '').toLowerCase().includes(q) ||
        (p.location || '').toLowerCase().includes(q);

      return matchScope && matchType && matchQuery;
    });

    // Sort logic
    if (val('sort') === 'new') {
      items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    const feed = byId('feed');
    const empty = byId('emptyFeed');
    feed.innerHTML = '';

    if (items.length === 0) {
      if (empty) empty.style.display = 'block';
      return;
    } else if (empty) {
      empty.style.display = 'none';
    }

    items.forEach(p => {
      feed.appendChild(
        mediaCard(p, {
          cta:
            p.status === 'available'
              ? { label: 'Request to Claim', click: () => claimPost(p.id).then(draw) }
              : null,
          showOwner: true
        })
      );
    });
  }
}

/* ---------- CREATE POST ---------- */
export function bindCreate() {
  hydrateUserOnSidebar();
  const form = byId('createForm');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(form);
    const diet = fd.getAll('diet');
    const data = {
      title: fd.get('title').trim(),
      category: fd.get('category'),
      qty: fd.get('qty'),
      diet,
      location: fd.get('location').trim(),
      expires: fd.get('expires')
    };
    await createPost(data);
    location.href = 'index.html';
  });
}

/* ---------- MY POSTS ---------- */
export async function renderMyPosts() {
  hydrateUserOnSidebar();
  const user = getUser();
  const list = (await listPosts()).filter(p => p.ownerEmail === user.email);
  const wrap = byId('myPosts');
  wrap.innerHTML = '';

  list.forEach(p => {
    const pending = (p.claims || []).filter(c => c.status === 'pending');
    const first = pending[0];
    wrap.appendChild(
      mediaCard(p, {
        extra: first
          ? buttons([
              { label: 'Approve', type: 'primary', click: () => approveClaim(p.id, first.id).then(() => location.reload()) },
              { label: 'Reject', click: () => rejectClaim(p.id, first.id).then(() => location.reload()) }
            ])
          : null
      })
    );
  });

  byId('emptyMine').style.display = list.length ? 'none' : 'block';
}

/* ---------- REQUESTS ---------- */
export async function renderRequests() {
  hydrateUserOnSidebar();
  const user = getUser();
  const list = await listPosts();

  const pending = [];
  const history = [];
  list.forEach(p => {
    (p.claims || []).forEach(c => {
      if (c.byEmail === user.email) {
        const item = { ...p, _claim: c };
        (c.status === 'pending' ? pending : history).push(item);
      }
    });
  });

  const pWrap = byId('reqPending');
  const hWrap = byId('reqHistory');
  pWrap.innerHTML = '';
  hWrap.innerHTML = '';

  pending.forEach(p => {
    pWrap.appendChild(mediaCard(p, { extra: tag('span', 'badge', '⏳ Pending') }));
  });

  history.forEach(p => {
    const status = p._claim.status === 'approved' ? '✅ Approved' : '❌ Rejected';
    hWrap.appendChild(mediaCard(p, { extra: tag('span', 'badge', status) }));
  });
}

/* ---------- PROFILE ---------- */
export async function renderProfile() {
  hydrateUserOnSidebar();
  const user = getUser();
  set('#pfName', user.name || 'Eco Member');
  set('#pfEmail', user.email);

  const { shared, savedKg, list } = computeStats();
  const mine = list.filter(p => p.ownerEmail === user.email);
  set('#kPosts', mine.length);
  set('#kFed', shared);
  set('#kSaved', `${savedKg}kg`);
  set('#kStreak', '0 days');
  set('#impactCO2', `${savedKg} kg`);
  set('#impactMeals', shared);

  const pts = mine.length * 10 + shared * 20;
  set('#levelPts', `${pts} total points`);
  byId('levelBar').style.width = Math.min(100, (pts / 50) * 100) + '%';

  const act = byId('pfActivity');
  act.innerHTML = '';
  mine.slice(0, 4).forEach(p => act.appendChild(mediaCard(p)));
}

/* =========================================================
   MEDIA CARD (Base44-like) — image on right, pills & chips
   ========================================================= */
function mediaCard(p, opts = {}) {
  // compute helper strings
  const qtyStr = p.qty ? `${p.qty}` : '—';
  const kmStr =
    p.distanceMeters != null
      ? `${(p.distanceMeters / 1000).toFixed(1)}km away`
      : (p.distanceKm != null ? `${p.distanceKm.toFixed(1)}km away` : null);
  const status = (p.status || 'available').toLowerCase();

  // ---- root ----
  const root = tag('article', 'post-card');

  // status pill (absolute in left area)
  const statusPill = tag(
    'span',
    `pill status-pill ${status === 'expired' ? 'expired' : ''}`,
    status === 'expired' ? 'Expired' : status === 'claimed' ? 'Claimed' : 'Available'
  );
  root.appendChild(statusPill);

  // ---- left body ----
  const body = tag('div', 'post-body');
  root.appendChild(body);

  // title
  const title = tag('h5', 'post-title', `${p.title || '(no title)'}`);
  body.appendChild(title);

  // quick chips: qty + category
  const quick = tag(
    'div',
    'post-meta',
    `<span class="chip"><span class="i">🎁</span> ${qtyStr}</span>
     <span class="chip"><span class="i">🍽</span> ${p.category || 'Other'}</span>`
  );
  body.appendChild(quick);

  // location + distance
  const locRow = tag(
    'div',
    'post-meta',
    `<span><span class="i">📍</span> ${p.location || '—'}</span>
     ${kmStr ? `<span class="chip"><span class="i">📏</span> ${kmStr}</span>` : ''}`
  );
  body.appendChild(locRow);

  // expiry
  const expRow = tag(
    'div',
    'post-meta',
    status === 'expired'
      ? `<span class="pill expired"><span class="i">⏱</span> ${relativeExpiry(p.expires, true)}</span>`
      : `<span class="pill"><span class="i">⏱</span> ${relativeExpiry(p.expires)}</span>`
  );
  body.appendChild(expRow);

  // posted by
  if (opts.showOwner) {
    body.appendChild(tag('div', 'post-foot', `<span class="i">👤</span> Posted by ${p.ownerName || p.ownerEmail || 'Eco member'}`));
  }

  // CTA / extra
  if (opts.cta && status === 'available') {
    const actions = tag('div', 'post-foot');
    actions.appendChild(btn(opts.cta.label || 'Request to Claim', 'primary', opts.cta.click));
    if (opts.extra) actions.appendChild(opts.extra);
    body.appendChild(actions);
  } else if (opts.extra) {
    body.appendChild(opts.extra);
  }

  // ---- right media ----
  const media = tag('div', 'post-media');
  root.appendChild(media);

  const img = new Image();
  img.alt = p.title || '';
  img.src =
    p.photoUrl || p.imageUrl ||
    'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?q=80&w=1200&auto=format&fit=crop';
  media.appendChild(img);

  const open = tag('a', 'media-open', '↗');
  open.href = p.photoUrl || p.imageUrl || '#';
  open.target = '_blank';
  media.appendChild(open);

  return root;
}

/* ---------- UI UTILITIES ---------- */
function btn(label, type = 'ghost', click) {
  const b = tag('button', `btn ${type}`, label);
  if (click) b.onclick = click;
  return b;
}
function buttons(arr) {
  const w = tag('div', 'actions');
  arr.forEach(d => w.appendChild(btn(d.label, d.type, d.click)));
  return w;
}
function tag(el, cls, content) {
  const e = document.createElement(el);
  if (cls) e.className = cls;
  if (content !== undefined) e.innerHTML = content;
  return e;
}
function set(sel, v) {
  const el = byId(sel.slice(1));
  if (el) el.textContent = v;
}
function val(id) {
  const el = byId(id);
  return el ? el.value : '';
}
function byId(id) {
  return document.getElementById(id);
}
function singular(s) {
  return s.replace(/s$/, '');
}
function formatDT(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/* relative expiry text like: "Expires in 2h" or "Expired 3 days ago" */
function relativeExpiry(iso, forcePastLabel = false) {
  try {
    const d = new Date(iso).getTime();
    const now = Date.now();
    const diff = d - now; // ms
    const abs = Math.abs(diff);

    const MIN = 60 * 1000, HR = 60 * MIN, DAY = 24 * HR;
    let txt;
    if (abs < HR) txt = `${Math.max(1, Math.round(abs / MIN))} min`;
    else if (abs < DAY) txt = `${Math.round(abs / HR)} hour${abs >= 2 * HR ? 's' : ''}`;
    else txt = `${Math.round(abs / DAY)} day${abs >= 2 * DAY ? 's' : ''}`;

    if (diff >= 0 && !forcePastLabel) return `Expires in ${txt}`;
    return `Expired ${txt} ago`;
  } catch {
    return 'Expiry unknown';
  }
}

/* ---------- USER HYDRATION ---------- */
function hydrateUserOnSidebar() {
  const u = getUser();
  const observer = new MutationObserver(() => {
    const n = document.getElementById('sbUser');
    const e = document.getElementById('sbEmail');
    if (n && e) {
      n.textContent = u.name || 'Eco Member';
      e.textContent = u.email;
      observer.disconnect();
    }
  });
  observer.observe(document.body, { subtree: true, childList: true });
}
