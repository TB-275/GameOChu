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
    (!search ||
      (t.teamName || "")
        .toLowerCase()
        .includes(search)
    ) &&
    (filter === "all" || t.status === filter)
  );

  if (!list.length) {
    teamsGrid.innerHTML = `
      <p class="team-meta">
        Chưa có đội phù hợp.
      </p>
    `;
    return;
  }

  teamsGrid.innerHTML = list.map(t => {

    const currentRound =
      Number(t.currentRound) || 1;

    return `
      <article class="team-card">

        <span class="badge ${t.status || "playing"}">
          ${labelStatus(t.status)}
        </span>

        <h3>
          ${escapeHtml(t.teamName || "Chưa đặt tên")}
        </h3>

        <div class="team-meta">

          <div>
            Lần chơi hiện tại:
            <strong>LẦN ${currentRound}</strong>
          </div>

          <div>
            Hoạt động gần nhất:
            ${timeText(t.lastActive)}
          </div>

        </div>

        <div class="card-actions">

          <button
            data-id="${t.id}"
            data-action="reset"
          >
            Reset
          </button>

          <button
            data-id="${t.id}"
            data-action="unlock"
          >
            Mở khóa
          </button>

          <button
            class="delete-btn"
            data-id="${t.id}"
            data-action="delete"
          >
            Xóa đội
          </button>

        </div>

      </article>
    `;
  }).join("");

  teamsGrid
    .querySelectorAll("button[data-action]")
    .forEach(btn => {

      btn.onclick = async () => {

        const id = btn.dataset.id;
        const action = btn.dataset.action;

        try {

          /*
          ======================
          MỞ KHÓA
          ======================
          */

          if (action === "unlock") {

            await updateDoc(
              doc(db, "teams", id),
              {
                status: "playing",
                locked: false,
                lastActive: serverTimestamp()
              }
            );

            return;
          }


          /*
          ======================
          RESET
          ======================
          */

          if (action === "reset") {

            const confirmReset = confirm(
              "Reset đội này về Lần 1?"
            );

            if (!confirmReset) return;

            await updateDoc(
              doc(db, "teams", id),
              {
                status: "playing",

                currentRound: 1,

                currentWord: 1,

                locked: false,

                finishedRounds: [],

                lastActive: serverTimestamp()
              }
            );

            alert(
              "Đã reset đội về Lần 1."
            );

            return;
          }


          /*
          ======================
          XÓA ĐỘI
          ======================
          */

          if (action === "delete") {

            const confirmDelete = confirm(
              `Bạn có chắc muốn XÓA hoàn toàn đội "${btn
                .closest(".team-card")
                .querySelector("h3")
                .textContent}" không?\n\nSau khi xóa, đội có thể refresh và đăng ký chơi lại từ đầu.`
            );

            if (!confirmDelete) return;

            await deleteDoc(
              doc(db, "teams", id)
            );

            alert(
              "Đã xóa đội khỏi hệ thống."
            );

            return;
          }

        } catch (error) {

          console.error(error);

          alert(
            "Có lỗi xảy ra. Kiểm tra Firestore Rules."
          );

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
