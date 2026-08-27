import { firebaseConfig, ADMIN_EMAIL } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loginPanel = document.getElementById("loginPanel");
const dashboard = document.getElementById("dashboard");
const loginMessage = document.getElementById("loginMessage");
const teamsGrid = document.getElementById("teamsGrid");
const searchTeam = document.getElementById("searchTeam");
const statusFilter = document.getElementById("statusFilter");

let allTeams = [];

function isAdmin(user) {
  return user && user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

document.getElementById("loginBtn").onclick = async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  loginMessage.textContent = "";
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    if (!isAdmin(result.user)) {
      await signOut(auth);
      loginMessage.textContent = "Email này không có quyền BTC.";
    }
  } catch (error) {
    loginMessage.textContent = "Đăng nhập không thành công.";
    console.error(error);
  }
};

document.getElementById("logoutBtn").onclick = () => signOut(auth);
searchTeam.addEventListener("input", renderTeams);
statusFilter.addEventListener("change", renderTeams);

onAuthStateChanged(auth, user => {
  if (isAdmin(user)) {
    loginPanel.classList.add("hidden");
    dashboard.classList.remove("hidden");
    listenTeams();
  } else {
    dashboard.classList.add("hidden");
    loginPanel.classList.remove("hidden");
  }
});

function listenTeams() {
  const q = query(collection(db, "teams"), orderBy("lastActive", "desc"));
  onSnapshot(q, snapshot => {
    allTeams = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTeams();
    renderStats();
  }, error => {
    console.error(error);
    teamsGrid.innerHTML = `<p class="message">Không thể đọc dữ liệu. Kiểm tra Firestore Rules và ADMIN_EMAIL.</p>`;
  });
}

function renderStats() {
  document.getElementById("totalTeams").textContent = allTeams.length;
  document.getElementById("activeTeams").textContent = allTeams.filter(t => t.status === "playing").length;
  document.getElementById("finishedTeams").textContent = allTeams.filter(t => t.status === "finished").length;
}

function timeText(ts) {
  if (!ts?.toDate) return "Chưa có dữ liệu";
  return ts.toDate().toLocaleString("vi-VN");
}

function renderTeams() {

  const search = searchTeam.value.trim().toLowerCase();
  const filter = statusFilter.value;

  const list = allTeams.filter(t =>
    (!search || (t.teamName || "").toLowerCase().includes(search)) &&
    (filter === "all" || t.status === filter)
  );

  teamsGrid.innerHTML = list.length
    ? list.map(t => {

      const currentRound = t.currentRound || 1;

      return `
        <article class="team-card">

          <span class="badge ${t.status || "playing"}">
            ${labelStatus(t.status)}
          </span>

          <h3>${escapeHtml(t.teamName || "Chưa đặt tên")}</h3>

          <div class="team-meta">

            Lần chơi hiện tại:
            <strong>LẦN ${currentRound}</strong>

            <br>

            Trạng thái:
            <strong>${labelStatus(t.status)}</strong>

            <br>

            Hoạt động gần nhất:
            ${timeText(t.lastActive)}

          </div>

          <div class="card-actions">

            <button
              data-id="${t.id}"
              data-action="unlock"
            >
              MỞ KHÓA
            </button>

            <button
              data-id="${t.id}"
              data-action="reset"
            >
              RESET
            </button>

            <button
              class="delete-team-btn"
              data-id="${t.id}"
              data-name="${escapeHtml(t.teamName || "")}"
              data-action="delete"
            >
              XÓA ĐỘI
            </button>

          </div>

        </article>
      `;
    }).join("")
    : `<p class="team-meta">Chưa có đội phù hợp.</p>`;

  teamsGrid.querySelectorAll("button[data-action]").forEach(btn => {

    btn.onclick = async () => {

      const id = btn.dataset.id;
      const action = btn.dataset.action;

      /* =========================
         MỞ KHÓA
      ========================= */

      if (action === "unlock") {

        try {

          await updateDoc(doc(db, "teams", id), {

            status: "playing",
            locked: false,
            lastActive: serverTimestamp()

          });

        } catch (error) {

          console.error(error);
          alert("Không thể mở khóa đội.");

        }

      }


      /* =========================
         RESET
      ========================= */

      if (action === "reset") {

        const ok = confirm(
          "Reset đội này về LẦN 1?"
        );

        if (!ok) return;

        try {

          await updateDoc(doc(db, "teams", id), {

            status: "playing",

            currentRound: 1,

            selectedQuestion: null,

            currentWord: 1,

            locked: false,

            finished: false,

            lastActive: serverTimestamp()

          });

          alert("Đã reset đội về Lần 1.");

        } catch (error) {

          console.error(error);

          alert("Không thể reset đội.");

        }

      }


      /* =========================
         XÓA HOÀN TOÀN
      ========================= */

      if (action === "delete") {

        const team = allTeams.find(t => t.id === id);

        const teamName =
          team?.teamName ||
          "đội này";

        const ok = confirm(
          `Bạn có chắc chắn muốn XÓA đội "${teamName}"?\n\n` +
          "Dữ liệu đội sẽ bị xóa hoàn toàn.\n" +
          "Đội có thể nhập lại và chơi từ đầu."
        );

        if (!ok) return;

        try {

          await deleteDoc(
            doc(db, "teams", id)
          );

          alert(
            `Đã xóa đội "${teamName}".`
          );

        } catch (error) {

          console.error(error);

          alert(
            "Không thể xóa đội. Kiểm tra Firestore Rules."
          );

        }

      }

    };

  });

}

function labelStatus(status) {
  return ({ playing:"ĐANG CHƠI", finished:"HOÀN THÀNH", locked:"KHÓA / HẾT GIỜ", "round-complete":"XONG VÒNG" })[status] || "ĐANG CHƠI";
}
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
}
