// ── Firebase-Konfiguration ────────────────────────────────────
// HIER deine eigene firebaseConfig einfügen:
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore, collection, addDoc, getDocs, doc,
  updateDoc, deleteDoc, onSnapshot, query, orderBy
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCXm14QqVrHsPoAKvD22AUN_mnhJUsYa7Y",
  authDomain: "bierathon-db28f.firebaseapp.com",
  projectId: "bierathon-db28f",
  storageBucket: "bierathon-db28f.firebasestorage.app",
  messagingSenderId: "211382102981",
  appId: "1:211382102981:web:f7675093ec1ed8a7d3b9ac"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const teamsCol = collection(db, 'teams');

const ADMIN_HASH = '0755a387dbcbfdebc29e533f47d71a3e3c7f3709a761b85c70ec347c48c5c558';

async function hashPassword(pw) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Navigation ───────────────────────────────────────────────

function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  document.getElementById(name).classList.add('active');
  const labels = ['start', 'anmeldung', 'teams', 'admin'];
  document.querySelectorAll('.nav-btn')[labels.indexOf(name)].classList.add('active');

  if (name === 'teams') subscribeTeamList();
  if (name === 'admin' && isAdminLoggedIn()) subscribeAdminPanel();
}

window.showSection = showSection;

// ── Anmeldung ────────────────────────────────────────────────

document.getElementById('anmeldeForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const teamname = document.getElementById('teamname').value.trim();
  const p1 = document.getElementById('person1').value.trim();
  const p2 = document.getElementById('person2').value.trim();
  const p3 = document.getElementById('person3').value.trim();
  const p4 = document.getElementById('person4').value.trim();
  const errorEl = document.getElementById('formError');
  const submitBtn = this.querySelector('button[type="submit"]');

  errorEl.textContent = '';

  if (!teamname) { errorEl.textContent = 'Bitte einen Teamnamen eingeben.'; return; }
  if (!p1)       { errorEl.textContent = 'Bitte mindestens dich selbst (Person 1) eintragen.'; return; }

  // Doppelten Teamnamen prüfen
  const snapshot = await getDocs(teamsCol);
  const nameTaken = snapshot.docs.some(d => d.data().name.toLowerCase() === teamname.toLowerCase());
  if (nameTaken) { errorEl.textContent = 'Dieser Teamname ist bereits vergeben.'; return; }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Wird angemeldet…';

  try {
    const allDocs = await getDocs(teamsCol);
    const maxNr = allDocs.docs.reduce((max, d) => Math.max(max, d.data().startnummer ?? 0), 0);
    const startnummer = maxNr + 1;

    await addDoc(teamsCol, {
      name: teamname,
      members: [p1, p2, p3, p4].filter(Boolean),
      paid: false,
      registeredAt: new Date().toISOString(),
      startnummer,
    });

    this.reset();
    const msg = document.getElementById('successMsg');
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 3500);
  } catch (err) {
    errorEl.textContent = 'Fehler beim Speichern. Bitte erneut versuchen.';
    console.error(err);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Team anmelden';
  }
});

// ── Teamliste (öffentlich, Echtzeit) ─────────────────────────

let unsubTeamList = null;

function subscribeTeamList() {
  if (unsubTeamList) unsubTeamList();

  const q = query(teamsCol, orderBy('registeredAt'));
  unsubTeamList = onSnapshot(q, snapshot => {
    const container = document.getElementById('teamList');
    const noTeams = document.getElementById('noTeams');
    container.innerHTML = '';

    if (snapshot.empty) {
      noTeams.classList.remove('hidden');
      return;
    }
    noTeams.classList.add('hidden');

    snapshot.docs.forEach((docSnap, index) => {
      const team = docSnap.data();
      const card = document.createElement('div');
      card.className = 'team-card';

      const badgePaid = team.paid
        ? '<span class="badge-paid">✓ Bezahlt</span>'
        : '<span class="badge-unpaid">Ausstehend</span>';
      const badgeSigned = team.signed
        ? '<span class="badge-paid">✓ Unterschrift</span>'
        : '<span class="badge-unpaid">Keine Unterschrift</span>';

      card.innerHTML = `
        <div class="team-number">Startnummer #${team.startnummer ?? '–'}</div>
        <div class="team-card-header">
          <span class="team-name">${escapeHtml(team.name)}</span>
          <div class="badge-group">
            ${badgePaid}
            ${badgeSigned}
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }, err => {
    console.error('Fehler beim Laden der Teams:', err);
  });
}

// ── Admin ─────────────────────────────────────────────────────

function isAdminLoggedIn() {
  return sessionStorage.getItem('adminLoggedIn') === 'true';
}

window.adminLogin = async function () {
  const pw = document.getElementById('adminPassword').value;
  const errorEl = document.getElementById('loginError');

  const hash = await hashPassword(pw);
  if (hash === ADMIN_HASH) {
    sessionStorage.setItem('adminLoggedIn', 'true');
    document.getElementById('loginCard').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    subscribeAdminPanel();
  } else {
    errorEl.textContent = 'Falsches Passwort.';
    document.getElementById('adminPassword').value = '';
  }
};

document.getElementById('adminPassword').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') window.adminLogin();
});

window.adminLogout = function () {
  sessionStorage.removeItem('adminLoggedIn');
  if (unsubAdminPanel) { unsubAdminPanel(); unsubAdminPanel = null; }
  document.getElementById('adminPanel').classList.add('hidden');
  document.getElementById('loginCard').classList.remove('hidden');
  document.getElementById('adminPassword').value = '';
  document.getElementById('loginError').textContent = '';
};

let unsubAdminPanel = null;

function subscribeAdminPanel() {
  if (unsubAdminPanel) unsubAdminPanel();

  const q = query(teamsCol, orderBy('registeredAt'));
  unsubAdminPanel = onSnapshot(q, snapshot => {
    const container = document.getElementById('adminTeamList');
    const noTeams = document.getElementById('noTeamsAdmin');
    container.innerHTML = '';

    if (snapshot.empty) {
      noTeams.classList.remove('hidden');
      return;
    }
    noTeams.classList.add('hidden');

    snapshot.docs.forEach((docSnap, index) => {
      const team = docSnap.data();
      const id = docSnap.id;
      const card = document.createElement('div');
      card.className = 'admin-team-card';

      const membersEscaped = team.members.map(escapeHtml);
      card.innerHTML = `
        <div class="team-number">Startnummer #${team.startnummer ?? '–'} · angemeldet: ${formatDate(team.registeredAt)}</div>
        <div class="admin-team-header">
          <div class="admin-team-info">
            <div class="admin-team-name">${escapeHtml(team.name)}</div>
            <div class="admin-team-members">${membersEscaped.join(', ')}</div>
          </div>
          <div class="admin-controls">
            <label class="toggle-paid">
              <input type="checkbox" ${team.paid ? 'checked' : ''} data-id="${id}" class="paid-checkbox" />
              <span>${team.paid ? 'Bezahlt' : 'Nicht bezahlt'}</span>
            </label>
            <label class="toggle-paid">
              <input type="checkbox" ${team.signed ? 'checked' : ''} data-id="${id}" class="signed-checkbox" />
              <span>${team.signed ? 'Unterschrieben' : 'Nicht unterschrieben'}</span>
            </label>
            <button class="btn-edit-team" data-id="${id}" title="Team bearbeiten">✏️</button>
            <button class="btn-delete-team" data-id="${id}" title="Team löschen">🗑</button>
          </div>
        </div>
        <div class="edit-form hidden" id="edit-${id}">
          <div class="edit-fields">
            <input class="edit-input" type="text" placeholder="Teamname" value="${escapeHtml(team.name)}" data-field="name" />
            ${[0,1,2,3].map(i => `
              <input class="edit-input" type="text" placeholder="Person ${i+1}${i===0?' *':''}" value="${escapeHtml(team.members[i] || '')}" data-field="member${i}" />
            `).join('')}
          </div>
          <div class="edit-actions">
            <button class="btn-save-team btn-primary-small" data-id="${id}">Speichern</button>
            <button class="btn-cancel-edit btn-secondary-small" data-id="${id}">Abbrechen</button>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    // Event-Listener nach dem Rendern setzen
    container.querySelectorAll('.paid-checkbox').forEach(cb => {
      cb.addEventListener('change', () => togglePaid(cb.dataset.id, cb.checked));
    });
    container.querySelectorAll('.signed-checkbox').forEach(cb => {
      cb.addEventListener('change', () => toggleSigned(cb.dataset.id, cb.checked));
    });
    container.querySelectorAll('.btn-delete-team').forEach(btn => {
      btn.addEventListener('click', () => deleteTeam(btn.dataset.id));
    });
    container.querySelectorAll('.btn-edit-team').forEach(btn => {
      btn.addEventListener('click', () => {
        const form = document.getElementById(`edit-${btn.dataset.id}`);
        form.classList.toggle('hidden');
      });
    });
    container.querySelectorAll('.btn-cancel-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById(`edit-${btn.dataset.id}`).classList.add('hidden');
      });
    });
    container.querySelectorAll('.btn-save-team').forEach(btn => {
      btn.addEventListener('click', () => saveTeamEdit(btn.dataset.id));
    });
  });
}

async function saveTeamEdit(id) {
  const form = document.getElementById(`edit-${id}`);
  const name = form.querySelector('[data-field="name"]').value.trim();
  const members = [0,1,2,3]
    .map(i => form.querySelector(`[data-field="member${i}"]`).value.trim())
    .filter(Boolean);

  if (!name) { alert('Teamname darf nicht leer sein.'); return; }
  if (members.length === 0) { alert('Mindestens eine Person erforderlich.'); return; }

  try {
    await updateDoc(doc(db, 'teams', id), { name, members });
    form.classList.add('hidden');
  } catch (err) {
    alert('Fehler beim Speichern.');
    console.error(err);
  }
}

async function togglePaid(id, paid) {
  try {
    await updateDoc(doc(db, 'teams', id), { paid });
  } catch (err) {
    console.error('Fehler beim Aktualisieren:', err);
  }
}

async function toggleSigned(id, signed) {
  try {
    await updateDoc(doc(db, 'teams', id), { signed });
  } catch (err) {
    console.error('Fehler beim Aktualisieren:', err);
  }
}

async function deleteTeam(id) {
  if (!confirm('Dieses Team wirklich löschen?')) return;
  try {
    await deleteDoc(doc(db, 'teams', id));
  } catch (err) {
    console.error('Fehler beim Löschen:', err);
  }
}

// ── Utilities ────────────────────────────────────────────────

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '';
  }
}

// ── Init ─────────────────────────────────────────────────────

if (isAdminLoggedIn()) {
  document.getElementById('loginCard').classList.add('hidden');
  document.getElementById('adminPanel').classList.remove('hidden');
  subscribeAdminPanel();
}
