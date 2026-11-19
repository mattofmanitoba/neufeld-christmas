'use strict';
/* =====================================================================
   NEUFELD CHRISTMAS — data layer, rendering, edit mode, password gate
   ---------------------------------------------------------------------
   PASSWORD GATE: this site is public, so the shared password is only a
   casual gate to keep casual visitors out. It is NOT real security —
   anyone who views the page source can find the password, and the data
   itself is public. Do not treat it as protection for anything
   sensitive.
   ===================================================================== */

/* ---------------------------------------------------------------------
   FIREBASE CONFIG — paste the real values here after the Firebase
   project is created (console.firebase.google.com → Project settings →
   "Your apps" → Web app). Until this is filled in, the site runs in
   PREVIEW MODE: it shows the bundled seed data and saves edits to this
   browser's localStorage only (edits will NOT show for everyone).
   To go live, replace `null` with an object like:
     const FIREBASE_CONFIG = {
       apiKey: "AIza...",
       authDomain: "neufeld-christmas.firebaseapp.com",
       databaseURL: "https://neufeld-christmas-default-rtdb.firebaseio.com",
       projectId: "neufeld-christmas",
       storageBucket: "neufeld-christmas.appspot.com",
       messagingSenderId: "1234567890",
       appId: "1:1234567890:web:abcdef"
     };
   And in the Realtime Database rules, allow read/write (the site is
   public and has no accounts):
     { "rules": { ".read": true, ".write": true } }
   ------------------------------------------------------------------ */
const FIREBASE_CONFIG = null;

const DB_PATH = 'neufeld-christmas';
const LS_KEY = 'nxmas-data-v1';
const UNLOCK_KEY = 'nxmas-unlocked';
const PASSWORD = (window.SEED_DATA && window.SEED_DATA.password) || 'family';
const AVATAR_DIR = 'assets/avatars/';

/* ---------------- helpers ---------------- */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }
function $(sel, root) { return (root || document).querySelector(sel); }
function personById(data, id) { return data.people.find(function (p) { return p.id === id; }); }
function avatarPath(p) { return AVATAR_DIR + p.avatar; }

/* ---------------- inline SVG clip art (no emoji) ---------------- */
const SVG = {
  star: '<svg viewBox="0 0 24 24" class="ic star" fill="currentColor" aria-hidden="true"><path d="M12 1.8l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 16.7 6.1 19.8l1.2-6.5L2.5 8.7l6.6-.9z"/></svg>',
  snowflake: '<svg viewBox="0 0 24 24" class="ic" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9L4.9 19.1"/></svg>',
  cane: '<svg viewBox="0 0 24 24" class="ic" fill="none" stroke-linecap="round" aria-hidden="true"><path d="M9 21V9a3.5 3.5 0 0 1 7 0" stroke="#c1272d" stroke-width="3.4"/><path d="M6.6 15.4l4.8-2M7.2 11.8l4.8-2M8.6 8.4l3.6-1.4" stroke="#fff" stroke-width="1.5"/></svg>',
  bauble: '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><rect x="10.6" y="1.5" width="2.8" height="3" fill="#d9a441"/><circle cx="12" cy="14" r="8" fill="#c1272d"/><circle cx="9" cy="11" r="2.2" fill="#fff" opacity=".55"/></svg>',
  reindeer: '<svg viewBox="0 0 64 64" class="ic" aria-hidden="true"><path d="M14 22L8 8M14 22l6-14M50 22l6-14M50 22l-6-14" stroke="#7b4a21" stroke-width="4" stroke-linecap="round" fill="none"/><circle cx="32" cy="38" r="18" fill="#a9743f"/><circle cx="25" cy="34" r="2.4" fill="#222"/><circle cx="39" cy="34" r="2.4" fill="#222"/><circle cx="32" cy="46" r="5" fill="#c1272d"/></svg>',
  tree: '<svg viewBox="0 0 64 64" class="gate-tree" aria-hidden="true"><path d="M32 4L50 28H42L56 46H8L22 28H14z" fill="#1e7a34"/><rect x="28" y="46" width="8" height="10" fill="#6b4423"/><path d="M32 0l1.8 3.6 3.9.6-2.8 2.8.7 3.9L32 9.1l-3.6 1.8.7-3.9-2.8-2.8 3.9-.6z" fill="#d9a441"/></svg>',
  trash: '<svg viewBox="0 0 24 24" class="ic" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0l-.8 12.1a1 1 0 0 1-1 .9H7.8a1 1 0 0 1-1-.9L6 7m4 4v6m4-6v6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" class="ic" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  link: '<svg viewBox="0 0 24 24" class="ic" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M14 4h6v6M20 4L10 14M9 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" class="ic" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M17 3l4 4L8 20l-5 1 1-5z"/></svg>'
};

/* ---------------- data store ----------------
   Firebase when configured, otherwise localStorage + bundled seed. */
const Store = {
  data: null,
  firebaseReady: false,
  dbRef: null,
  listeners: [],
  onChange: function (fn) { this.listeners.push(fn); },
  emit: function () { var self = this; this.listeners.forEach(function (fn) { fn(self.data); }); },

  init: function () {
    var self = this;
    if (FIREBASE_CONFIG && FIREBASE_CONFIG.databaseURL) {
      return this.initFirebase().then(function (ok) {
        if (ok) return self.data;
        return self.initLocal();
      });
    }
    return Promise.resolve(this.initLocal());
  },

  initLocal: function () {
    try {
      var raw = localStorage.getItem(LS_KEY);
      this.data = raw ? JSON.parse(raw) : deepCopy(window.SEED_DATA);
    } catch (e) {
      this.data = deepCopy(window.SEED_DATA);
    }
    return this.data;
  },

  initFirebase: function () {
    var self = this;
    return loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
      .then(function () { return loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js'); })
      .then(function () {
        firebase.initializeApp(FIREBASE_CONFIG);
        var db = firebase.database();
        self.dbRef = db.ref(DB_PATH);
        return self.dbRef.once('value');
      })
      .then(function (snap) {
        if (snap.exists()) {
          self.data = snap.val();
        } else {
          self.data = deepCopy(window.SEED_DATA);
          self.dbRef.set(self.data);
        }
        self.firebaseReady = true;
        // Live updates from other family members.
        self.dbRef.on('value', function (snap) {
          if (!snap.exists()) return;
          self.data = snap.val();
          self.emit();
        });
        return true;
      })
      .catch(function (err) {
        console.warn('Firebase unavailable, staying in preview mode:', err);
        self.firebaseReady = false;
        self.dbRef = null;
        return false;
      });
  },

  save: function () {
    if (this.firebaseReady && this.dbRef) {
      this.dbRef.set(this.data);
    } else {
      try { localStorage.setItem(LS_KEY, JSON.stringify(this.data)); } catch (e) { /* storage full */ }
    }
  }
};

function loadScript(src) {
  return new Promise(function (resolve, reject) {
    var s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* ---------------- app ---------------- */
const App = {
  page: 'index',
  personId: null,
  editing: false,
  draft: null,        // person draft while editing a person page
  eventDraft: null,   // event draft while editing the event card
  pendingRemote: false,

  start: function (page) {
    this.page = page;
    if (page === 'person') {
      this.personId = new URLSearchParams(location.search).get('id') || '';
    }
    this.setupGate();
    if (sessionStorage.getItem(UNLOCK_KEY) === 'yes') {
      this.unlock();
    }
  },

  setupGate: function () {
    var form = $('#gate-form');
    var self = this;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var val = $('#gate-input').value.trim();
      if (val === PASSWORD) {
        sessionStorage.setItem(UNLOCK_KEY, 'yes');
        self.unlock();
      } else {
        $('#gate-error').hidden = false;
        $('#gate-input').select();
      }
    });
  },

  unlocked: function () { return sessionStorage.getItem(UNLOCK_KEY) === 'yes'; },

  unlock: function () {
    var self = this;
    $('#gate').hidden = true;
    $('#app').hidden = false;
    Store.init().then(function () {
      Store.onChange(function () {
        if (self.editing) { self.pendingRemote = true; return; }
        self.render();
      });
      self.render();
    });
  },

  render: function () {
    if (this.page === 'index') this.renderIndex();
    else this.renderPerson();
    this.renderStatus();
  },

  renderStatus: function () {
    var el = $('#status-pill');
    if (!el) return;
    if (Store.firebaseReady) {
      el.innerHTML = '<b>Live mode</b> — edits save for everyone instantly.';
    } else {
      el.innerHTML = '<b>Preview mode</b> — edits save on this device only. ' +
        'Add the Firebase config in app.js to go live for the whole family.';
    }
  },

  /* ---------- index page ---------- */
  renderIndex: function () {
    var d = Store.data;
    var ev = d.event;
    var card = $('#event-card');
    if (this.editing && this.eventDraft) {
      var e = this.eventDraft;
      card.innerHTML =
        '<div class="event-form">' +
        '<h2 class="event-title">Edit the celebration</h2>' +
        '<label>Title</label><input data-efield="title" value="' + esc(e.title) + '">' +
        '<label>Date</label><input data-efield="date" value="' + esc(e.date) + '">' +
        '<label>Short date (shown on the trees)</label><input data-efield="dateShort" value="' + esc(e.dateShort) + '">' +
        '<label>Location</label><input data-efield="location" value="' + esc(e.location) + '">' +
        '<label>Time</label><input data-efield="time" value="' + esc(e.time) + '">' +
        '<label>Year</label><input data-efield="year" type="number" value="' + esc(e.year) + '">' +
        '<div class="btn-row"><button class="btn" data-action="save-event">Save</button>' +
        '<button class="btn ghost" data-action="cancel-event">Cancel</button></div>' +
        '<p class="hint">Next Christmas is just an edit — change the date, place and time here.</p>' +
        '</div>';
    } else {
      card.innerHTML =
        '<button class="btn small event-edit" data-action="edit-event">' + SVG.pencil + ' Edit event</button>' +
        '<h2 class="event-title">' + esc(ev.title) + '</h2>' +
        '<p class="event-date">' + esc(ev.date) + '</p>' +
        '<p class="event-meta">' + esc(ev.time) + ' &middot; ' + esc(ev.location) + '</p>';
    }

    $('#trees').innerHTML = d.trees.map(function (t) { return treeHTML(d, t); }).join('');

    $('#roster').innerHTML =
      '<h2>' + SVG.bauble + ' Everyone</h2>' +
      '<div class="roster-faces">' +
      d.people.map(function (p) { return faceChip(d, p.id); }).join('') +
      '</div>' +
      '<p class="hint">Tap any face to see what they give, what they receive, and their wish list.</p>';
  },

  /* ---------- person page ---------- */
  renderPerson: function () {
    var d = Store.data;
    var root = $('#person-root');
    var p = personById(d, this.personId);
    if (!p) {
      root.innerHTML = '<div class="card"><h2>Whoops — no such person</h2>' +
        '<p>Pick someone from the list:</p><div class="roster-faces">' +
        d.people.map(function (pp) { return faceChip(d, pp.id); }).join('') +
        '</div></div>';
      return;
    }
    if (this.editing && this.draft && this.draft.id === p.id) {
      root.innerHTML = personEditHTML(d, this.draft);
      return;
    }
    root.innerHTML = personViewHTML(d, p);
  },

  /* ---------- edit helpers ---------- */
  collectPersonDraft: function () {
    var form = $('#person-edit');
    if (!form) return;
    var d = this.draft;
    d.name = $('[data-field="name"]', form).value.trim() || d.name;
    d.role = $('[data-field="role"]', form).value.trim();
    d.givesTo = collectRelRows(form, 'gives');
    d.receivesFrom = collectRelRows(form, 'receives');
    d.wishlist = collectWishRows(form);
  },
  collectEventDraft: function () {
    var form = $('#event-card');
    if (!form || !this.eventDraft) return;
    var e = this.eventDraft;
    ['title', 'date', 'dateShort', 'location', 'time'].forEach(function (k) {
      var inp = $('[data-efield="' + k + '"]', form);
      if (inp) e[k] = inp.value.trim();
    });
    var y = $('[data-efield="year"]', form);
    if (y) e.year = parseInt(y.value, 10) || e.year;
  }
};

/* ---------- rendering helpers ---------- */
function faceChip(data, id, opts) {
  opts = opts || {};
  var p = personById(data, id);
  if (!p) return '';
  return '<a class="face-chip" href="person.html?id=' + esc(p.id) + '" title="' + esc(p.name) + '">' +
    '<img class="face' + (opts.big ? ' big' : '') + '" src="' + esc(avatarPath(p)) + '" alt="' + esc(p.name) + '">' +
    '<span class="face-name">' + esc(p.name) + '</span>' +
    (opts.note ? '<span class="face-note">' + esc(opts.note) + '</span>' : '') +
    '</a>';
}

function pyramid(n) {
  var rows = [], remaining = n, size = 1;
  while (remaining > 0) {
    var take = Math.min(size, remaining);
    rows.push(take); remaining -= take; size++;
  }
  return rows;
}

function treeHTML(data, tree) {
  var rows = pyramid(tree.ornaments.length);
  var idx = 0;
  var rowHTML = rows.map(function (n) {
    var items = tree.ornaments.slice(idx, idx + n); idx += n;
    return '<div class="tree-row">' + items.map(function (id) { return faceChip(data, id); }).join('') + '</div>';
  }).join('');
  return '<section class="tree-card card">' +
    '<div class="tree-top">' + SVG.star +
    '<div class="tree-toppers">' + tree.toppers.map(function (id) { return faceChip(data, id, { big: true }); }).join('') + '</div></div>' +
    '<div class="tree-body">' + rowHTML + '</div>' +
    '<div class="tree-trunk"></div>' +
    '<h3 class="tree-label">' + esc(tree.label) + '</h3>' +
    '</section>';
}

function relListHTML(data, rels) {
  if (!rels || rels.length === 0) return '<p class="empty-note">Nobody yet — the grandkids give as they are willing and able.</p>';
  return '<div class="give-list">' +
    rels.map(function (r) { return faceChip(data, r.person, { note: r.note || '' }); }).join('') +
    '</div>';
}

function wishListHTML(wishlist) {
  if (!wishlist || wishlist.length === 0) {
    return '<p class="empty-note">No wishes yet — check back soon, or add one with the Edit button.</p>';
  }
  return '<ul class="wishlist">' + wishlist.map(function (item) {
    var text = esc(item.text || '');
    if (item.url) {
      text = '<a class="wish-link" href="' + esc(item.url) + '" target="_blank" rel="noopener">' + text + ' ' + SVG.link + '</a>';
    }
    return '<li>' + text + (item.note ? '<span class="wish-note">' + esc(item.note) + '</span>' : '') + '</li>';
  }).join('') + '</ul>';
}

function photosHTML(photos) {
  if (!photos || photos.length === 0) {
    return '<p class="empty-note">No photos yet — add some with the Edit button.</p>';
  }
  return '<div class="photo-grid">' + photos.map(function (src) {
    return '<figure class="photo"><img src="' + esc(src) + '" alt="Wish list photo"></figure>';
  }).join('') + '</div>';
}

function personViewHTML(data, p) {
  return '<div class="card"><div class="person-hero">' +
    '<img class="person-avatar" src="' + esc(avatarPath(p)) + '" alt="' + esc(p.name) + '">' +
    '<div><h2>' + esc(p.name) + '</h2>' +
    (p.role ? '<p class="person-role">' + esc(p.role) + '</p>' : '') + '</div>' +
    '<div class="person-actions"><button class="btn" data-action="edit-person">' + SVG.pencil + ' Edit</button></div>' +
    '</div></div>' +
    '<div class="card"><h2>' + SVG.bauble + ' Giving to</h2>' + relListHTML(data, p.givesTo) + '</div>' +
    '<div class="card"><h2>' + SVG.bauble + ' Receiving from</h2>' + relListHTML(data, p.receivesFrom) + '</div>' +
    '<div class="card"><h2>' + SVG.star + ' Wish list</h2>' + wishListHTML(p.wishlist) + '</div>' +
    '<div class="card"><h2>' + SVG.cane + ' Photos</h2>' + photosHTML(p.photos) +
    '<p class="hint">Spotted a mistake or want to add a wish? Hit Edit — anyone in the family can change this page.</p></div>';
}

/* ---------- edit forms ---------- */
function personOptions(data, selectedId, excludeId) {
  return data.people
    .filter(function (pp) { return pp.id !== excludeId; })
    .map(function (pp) {
      return '<option value="' + esc(pp.id) + '"' + (pp.id === selectedId ? ' selected' : '') + '>' + esc(pp.name) + '</option>';
    }).join('');
}

function relRowsHTML(data, draft, kind, rels) {
  return (rels || []).map(function (r, i) {
    return '<div class="edit-row" data-kind="' + kind + '" data-index="' + i + '">' +
      '<select data-field="person">' + personOptions(data, r.person, draft.id) + '</select>' +
      '<input data-field="note" placeholder="Note (optional)" value="' + esc(r.note || '') + '">' +
      '<button type="button" class="icon-btn" data-action="del-' + kind + '" data-index="' + i + '" title="Remove">' + SVG.trash + '</button>' +
      '</div>';
  }).join('');
}

function wishRowsHTML(draft) {
  return (draft.wishlist || []).map(function (item, i) {
    return '<div class="edit-row" data-kind="wish" data-index="' + i + '">' +
      '<input class="wide" data-field="text" placeholder="Wish" value="' + esc(item.text || '') + '">' +
      '<input data-field="url" placeholder="Link (optional)" value="' + esc(item.url || '') + '">' +
      '<input data-field="note" placeholder="Note (optional)" value="' + esc(item.note || '') + '">' +
      '<button type="button" class="icon-btn" data-action="del-wish" data-index="' + i + '" title="Remove">' + SVG.trash + '</button>' +
      '</div>';
  }).join('');
}

function personEditHTML(data, draft) {
  return '<div class="card" id="person-edit">' +
    '<div class="person-hero">' +
    '<img class="person-avatar" src="' + esc(avatarPath(draft)) + '" alt="' + esc(draft.name) + '">' +
    '<div style="flex:1;min-width:200px">' +
    '<div class="edit-field"><label>Name</label><input data-field="name" value="' + esc(draft.name) + '"></div>' +
    '<div class="edit-field"><label>Role / age (optional)</label><input data-field="role" value="' + esc(draft.role || '') + '"></div>' +
    '</div></div>' +
    '<p class="edit-label">Giving to</p>' + relRowsHTML(data, draft, 'gives', draft.givesTo) +
    '<button type="button" class="btn small secondary" data-action="add-give">+ Add a recipient</button>' +
    '<p class="edit-label">Receiving from</p>' + relRowsHTML(data, draft, 'receives', draft.receivesFrom) +
    '<button type="button" class="btn small secondary" data-action="add-recv">+ Add a giver</button>' +
    '<p class="edit-label">Wish list</p><div id="wish-rows">' + wishRowsHTML(draft) + '</div>' +
    '<button type="button" class="btn small secondary" data-action="add-wish">+ Add a wish</button>' +
    '<p class="edit-label">Photos</p>' +
    '<div class="photo-grid">' +
    (draft.photos || []).map(function (src, i) {
      return '<figure class="photo"><img src="' + esc(src) + '" alt="Wish list photo">' +
        '<button type="button" class="photo-del" data-action="del-photo" data-index="' + i + '" title="Delete photo">' + SVG.trash + '</button></figure>';
    }).join('') +
    '<label class="photo-add">' + SVG.plus + '<span>Add photo</span>' +
    '<input type="file" id="photo-input" accept="image/*" hidden></label>' +
    '</div>' +
    '<div class="btn-row"><button class="btn" data-action="save-person">Save changes</button>' +
    '<button class="btn ghost" data-action="cancel-person">Cancel</button></div>' +
    '</div>';
}

function collectRelRows(form, kind) {
  var rows = form.querySelectorAll('.edit-row[data-kind="' + kind + '"]');
  var out = [];
  rows.forEach(function (row) {
    var person = $('[data-field="person"]', row).value;
    var note = $('[data-field="note"]', row).value.trim();
    var entry = { person: person };
    if (note) entry.note = note;
    out.push(entry);
  });
  return out;
}

function collectWishRows(form) {
  var rows = form.querySelectorAll('.edit-row[data-kind="wish"]');
  var out = [];
  rows.forEach(function (row) {
    var text = $('[data-field="text"]', row).value.trim();
    if (!text) return;
    var item = { text: text };
    var url = $('[data-field="url"]', row).value.trim();
    var note = $('[data-field="note"]', row).value.trim();
    if (url) item.url = url;
    if (note) item.note = note;
    out.push(item);
  });
  return out;
}

/* Shrink a user photo so it stays small in the database (max 900px, JPEG). */
function downscalePhoto(file) {
  return new Promise(function (resolve, reject) {
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function () {
      var max = 900;
      var w = img.naturalWidth, h = img.naturalHeight;
      var scale = Math.min(1, max / Math.max(w, h));
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

/* ---------------- events ---------------- */
document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-action]');
  if (!el) return;
  var action = el.dataset.action;
  var idx = parseInt(el.dataset.index, 10);

  if (action === 'edit-event') {
    App.editing = true;
    App.eventDraft = deepCopy(Store.data.event);
    App.render();
  } else if (action === 'save-event') {
    App.collectEventDraft();
    Store.data.event = App.eventDraft;
    Store.save();
    App.editing = false; App.eventDraft = null;
    App.render();
  } else if (action === 'cancel-event') {
    App.editing = false; App.eventDraft = null;
    if (App.pendingRemote) { App.pendingRemote = false; }
    App.render();
  } else if (action === 'edit-person') {
    App.editing = true;
    App.draft = deepCopy(personById(Store.data, App.personId));
    App.render();
  } else if (action === 'save-person') {
    App.collectPersonDraft();
    var i = Store.data.people.findIndex(function (p) { return p.id === App.draft.id; });
    if (i >= 0) Store.data.people[i] = App.draft;
    Store.save();
    App.editing = false; App.draft = null;
    App.render();
  } else if (action === 'cancel-person') {
    App.editing = false; App.draft = null;
    App.render();
  } else if (action === 'add-give' || action === 'add-recv') {
    App.collectPersonDraft();
    var list = action === 'add-give' ? App.draft.givesTo : App.draft.receivesFrom;
    var firstOther = Store.data.people.find(function (p) { return p.id !== App.draft.id; });
    list.push({ person: firstOther ? firstOther.id : '' });
    App.render();
  } else if (action === 'del-give' || action === 'del-recv') {
    App.collectPersonDraft();
    var l = action === 'del-give' ? App.draft.givesTo : App.draft.receivesFrom;
    l.splice(idx, 1);
    App.render();
  } else if (action === 'add-wish') {
    App.collectPersonDraft();
    App.draft.wishlist.push({ text: '' });
    App.render();
  } else if (action === 'del-wish') {
    App.collectPersonDraft();
    App.draft.wishlist.splice(idx, 1);
    App.render();
  } else if (action === 'del-photo') {
    App.collectPersonDraft();
    App.draft.photos.splice(idx, 1);
    App.render();
  }
});

document.addEventListener('change', function (e) {
  if (e.target && e.target.id === 'photo-input' && e.target.files.length) {
    App.collectPersonDraft();
    var files = Array.prototype.slice.call(e.target.files);
    var done = Promise.resolve();
    files.forEach(function (file) {
      done = done.then(function () { return downscalePhoto(file); })
        .then(function (dataUrl) { App.draft.photos.push(dataUrl); });
    });
    done.then(function () { App.render(); });
  }
});
