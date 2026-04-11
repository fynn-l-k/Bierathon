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

const ADMIN_PASSWORD = 'bierathon2025';

// ── Navigation ───────────────────────────────────────────────

function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  document.getElementById(name).classList.add('active');
  const labels = ['anmeldung', 'teams', 'admin'];
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
    await addDoc(teamsCol, {
      name: teamname,
      members: [p1, p2, p3, p4].filter(Boolean),
      paid: false,
      registeredAt: new Date().toISOString(),
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

      const badge = team.paid
        ? '<span class="badge-paid">✓ Bezahlt</span>'
        : '<span class="badge-unpaid">Ausstehend</span>';

      card.innerHTML = `
        <div class="team-number">Team #${index + 1}</div>
        <div class="team-card-header">
          <span class="team-name">${escapeHtml(team.name)}</span>
          ${badge}
        </div>
        <ul class="members-list">
          ${team.members.map(m => `<li>${escapeHtml(m)}</li>`).join('')}
        </ul>
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

window.adminLogin = function () {
  const pw = document.getElementById('adminPassword').value;
  const errorEl = document.getElementById('loginError');

  if (pw === ADMIN_PASSWORD) {
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

      card.innerHTML = `
        <div class="team-number">Team #${index + 1} · angemeldet: ${formatDate(team.registeredAt)}</div>
        <div class="admin-team-header">
          <div>
            <div class="admin-team-name">${escapeHtml(team.name)}</div>
            <div class="admin-team-members">${team.members.map(escapeHtml).join(', ')}</div>
          </div>
          <div class="admin-controls">
            <label class="toggle-paid">
              <input type="checkbox" ${team.paid ? 'checked' : ''} data-id="${id}" class="paid-checkbox" />
              <span>${team.paid ? 'Bezahlt' : 'Nicht bezahlt'}</span>
            </label>
            <button class="btn-delete-team" data-id="${id}" title="Team löschen">🗑</button>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    // Event-Listener nach dem Rendern setzen
    container.querySelectorAll('.paid-checkbox').forEach(cb => {
      cb.addEventListener('change', () => togglePaid(cb.dataset.id, cb.checked));
    });
    container.querySelectorAll('.btn-delete-team').forEach(btn => {
      btn.addEventListener('click', () => deleteTeam(btn.dataset.id));
    });
  });
}

async function togglePaid(id, paid) {
  try {
    await updateDoc(doc(db, 'teams', id), { paid });
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

window.confirmDeleteAll = async function () {
  if (!confirm('Wirklich ALLE Teams löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return;
  try {
    const snapshot = await getDocs(teamsCol);
    await Promise.all(snapshot.docs.map(d => deleteDoc(doc(db, 'teams', d.id))));
  } catch (err) {
    console.error('Fehler beim Löschen aller Teams:', err);
  }
};

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
