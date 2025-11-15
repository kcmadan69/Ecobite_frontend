// ===== EcoBite dummy API (localStorage-only) =====

const LS_POSTS = "ecobite_posts";
const LS_USER  = "ecobite_user";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}
function nowISO() {
  return new Date().toISOString();
}

function readPosts() {
  try {
    return JSON.parse(localStorage.getItem(LS_POSTS)) || [];
  } catch {
    return [];
  }
}

function writePosts(list) {
  localStorage.setItem(LS_POSTS, JSON.stringify(list));
}

/**
 * Ensure any posts whose expiry time has passed are marked as "expired".
 * Used by both listPosts() and computeStats() so everything stays in sync.
 */
function refreshExpiry(list) {
  const now = new Date();
  let changed = false;

  list.forEach((p) => {
    if (
      p.status === "available" &&
      p.expires &&
      new Date(p.expires) < now
    ) {
      p.status = "expired";
      changed = true;
    }
  });

  if (changed) writePosts(list);
  return list;
}

/* ---------- USER ---------- */

export function getUser() {
  // simple default demo user if nothing stored yet
  return JSON.parse(
    localStorage.getItem(LS_USER) ||
      '{"name":"Student","email":"student@campus.edu"}'
  );
}

/* ---------- POSTS CRUD ---------- */

export async function listPosts() {
  const list = readPosts();
  return refreshExpiry(list);
}

export async function createPost(data) {
  const user = getUser();

  // give each post a fake distance so "Closest to Me" sort has effect
  // between ~0.1km and ~15km
  const distanceMeters = Math.round((0.1 + Math.random() * 15) * 1000);

  const post = {
    id: uid(),
    ownerEmail: user.email,
    ownerName: user.name || user.email.split("@")[0],

    title: data.title,
    category: data.category,      // e.g. "Meals", "Snacks" etc.
    qty: data.qty || "",
    diet: data.diet || [],        // array of dietary tags

    location: data.location,
    expires: data.expires,        // ISO date string
    createdAt: nowISO(),

    status: "available",          // available | claimed | expired
    claims: [],                   // {id, byEmail, status, createdAt}

    // extra field used by UI for "Closest to Me"
    distanceMeters
  };

  const list = readPosts();
  list.unshift(post);
  writePosts(list);
  return post;
}

export async function claimPost(postId) {
  const user = getUser();
  const list = readPosts();
  const p = list.find((x) => x.id === postId);
  if (!p) throw new Error("Not found");

  p.claims.push({
    id: uid(),
    byEmail: user.email,
    status: "pending",
    createdAt: nowISO()
  });

  writePosts(list);
  return p;
}

export async function approveClaim(postId, claimId) {
  const list = readPosts();
  const p = list.find((x) => x.id === postId);
  if (!p) throw new Error("Not found");

  const c = p.claims.find((c) => c.id === claimId);
  if (!c) throw new Error("Claim not found");

  c.status = "approved";
  p.status = "claimed";

  // (optional) auto-reject any other pending claims on this post
  p.claims.forEach((cl) => {
    if (cl.id !== claimId && cl.status === "pending") {
      cl.status = "rejected";
    }
  });

  writePosts(list);
  return p;
}

export async function rejectClaim(postId, claimId) {
  const list = readPosts();
  const p = list.find((x) => x.id === postId);
  const c = p?.claims.find((c) => c.id === claimId);
  if (c) {
    c.status = "rejected";
    writePosts(list);
  }
  return p;
}

/* ---------- STATS ---------- */

export function computeStats() {
  // always work on an up-to-date list (expired status refreshed)
  const list = refreshExpiry(readPosts());

  const available = list.filter((p) => p.status === "available").length;
  const total = list.length;
  const shared = list.filter((p) => p.status === "claimed").length;

  // pretend each claimed post rescues ~1.2kg of food
  const savedKg = (shared * 1.2).toFixed(1);

  return { available, total, shared, savedKg, list };
}
