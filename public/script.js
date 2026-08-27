import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 20 TỪ KHÓA - 5 KÝ TỰ - CHỦ ĐỀ AI.
// Không có backend nên các từ nằm ở frontend.
const ROUNDS = [
  { seconds: 180, words: ["AGENT", "MODEL", "TOKEN", "PROMT", "CLOUD"] },
  { seconds: 300, words: ["ROBOT", "VOICE", "IMAGE", "AUDIO", "SMART"] },
  { seconds: 420, words: ["LEARN", "TRAIN", "BRAIN", "LOGIC", "CHIPS"] },
  { seconds: 600, words: ["PIXEL", "DEPTH", "LLAMA", "GEMMA", "CODEX"] }
];

const joinScreen = document.getElementById("joinScreen");
const gameScreen = document.getElementById("gameScreen");
const transitionScreen = document.getElementById("transitionScreen");
const finishScreen = document.getElementById("finishScreen");
const teamNameInput = document.getElementById("teamName");
const joinBtn = document.getElementById("joinBtn");
const joinMessage = document.getElementById("joinMessage");
const board = document.getElementById("board");
const timerEl = document.getElementById("timer");
const teamDisplay = document.getElementById("teamDisplay");
const roundLabel = document.getElementById("roundLabel");
const roundInfo = document.getElementById("roundInfo");
const statusBanner = document.getElementById("statusBanner");
const keyboard = document.getElementById("keyboard");
const continueBtn = document.getElementById("continueBtn");

let uid = localStorage.getItem("aiWordleUid") || "";
let teamName = localStorage.getItem("aiWordleTeamName") || "";
let state = JSON.parse(localStorage.getItem("aiWordleState") || "null");
let currentInput = "";
let timerInterval = null;
let roundDeadline = null;
let busy = false;

function saveState() {
  localStorage.setItem("aiWordleState", JSON.stringify(state));
}

function showScreen(screen) {
  [joinScreen, gameScreen, transitionScreen, finishScreen].forEach(s => s.classList.remove("active"));
  screen.classList.add("active");
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

async function saveTeam(extra = {}) {
  if (!uid) return;
  await updateDoc(doc(db, "teams", uid), {
    teamName,
    status: state?.status || "playing",
    currentRound: state?.round ?? 0,
    currentWord: state?.word ?? 0,
    locked: !!state?.locked,
    lastActive: serverTimestamp(),
    ...extra
  }).catch(console.error);
}

async function joinGame() {
  const name = teamNameInput.value.trim();
  if (!name) {
    joinMessage.textContent = "Vui lòng nhập tên đội.";
    return;
  }
  joinBtn.disabled = true;
  joinMessage.textContent = "Đang kết nối hệ thống...";
  try {
    const credential = await signInAnonymously(auth);
    uid = credential.user.uid;
    teamName = name;
    localStorage.setItem("aiWordleUid", uid);
    localStorage.setItem("aiWordleTeamName", teamName);

    state = {
      round: 0,
      word: 0,
      guessRow: 0,
      status: "playing",
      locked: false,
      startedAt: Date.now()
    };
    saveState();

    await setDoc(doc(db, "teams", uid), {
      teamName,
      status: "playing",
      currentRound: 1,
      currentWord: 1,
      locked: false,
      joinedAt: serverTimestamp(),
      lastActive: serverTimestamp()
    }, { merge: true });

    startRound();
  } catch (error) {
    console.error(error);
    joinMessage.textContent = "Không thể kết nối Firebase. Hãy kiểm tra firebase-config.js.";
    joinBtn.disabled = false;
  }
}

function restoreOrJoin() {
  if (uid && teamName && state) {
    teamDisplay.textContent = teamName;
    if (state.status === "finished") {
      document.getElementById("finishTitle").textContent = "HOÀN THÀNH THỬ THÁCH!";
      showScreen(finishScreen);
    } else {
      startRound(true);
    }
  } else {
    showScreen(joinScreen);
  }
}

function buildBoard() {
  board.innerHTML = "";
  for (let r = 0; r < 6; r++) {
    const row = document.createElement("div");
    row.className = "board-row";
    row.dataset.row = r;
    for (let c = 0; c < 5; c++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.dataset.col = c;
      row.appendChild(tile);
    }
    board.appendChild(row);
  }
}

function renderInput() {
  const row = board.querySelector(`[data-row="${state.guessRow}"]`);
  if (!row) return;
  [...row.children].forEach((tile, i) => {
    tile.textContent = currentInput[i] || "";
    tile.classList.toggle("filled", !!currentInput[i]);
  });
}

function updateHeader() {
  teamDisplay.textContent = teamName;
  roundLabel.textContent = `VÒNG ${state.round + 1}`;
  roundInfo.textContent = `CÂU ${state.word + 1}/5`;
  document.querySelectorAll(".progress-dot").forEach((dot, i) => {
    dot.classList.toggle("active", i === state.round);
    dot.classList.toggle("done", i < state.round);
  });
}

function clearKeyboard() {
  keyboard.querySelectorAll("button").forEach(b => b.classList.remove("correct", "present", "absent"));
}

function startRound(restoring = false) {
  clearInterval(timerInterval);
  if (state.round >= ROUNDS.length) {
    finishGame();
    return;
  }

  showScreen(gameScreen);
  updateHeader();
  buildBoard();
  clearKeyboard();
  currentInput = "";
  busy = false;

  // Nếu quay lại trang: đồng hồ tiếp tục theo thời gian thực đã lưu.
  if (!restoring || !state.roundDeadline) {
    roundDeadline = Date.now() + ROUNDS[state.round].seconds * 1000;
    state.roundDeadline = roundDeadline;
    state.guessRow = 0;
    state.locked = false;
    state.status = "playing";
    saveState();
  } else {
    roundDeadline = state.roundDeadline;
  }

  if (Date.now() >= roundDeadline) {
    handleTimeExpired();
    return;
  }

  statusBanner.textContent = "HÃY NHẬP MỘT TỪ GỒM 5 KÝ TỰ";
  statusBanner.className = "status-banner";
  startTimer();
  saveTeam();
}

function startTimer() {
  clearInterval(timerInterval);
  const tick = () => {
    const remaining = Math.max(0, Math.ceil((roundDeadline - Date.now()) / 1000));
    timerEl.textContent = formatTime(remaining);
    if (remaining <= 0) {
      clearInterval(timerInterval);
      handleTimeExpired();
    }
  };
  tick();
  timerInterval = setInterval(tick, 250);
}

function colorGuess(guess, answer) {
  const result = Array(5).fill("absent");
  const remaining = answer.split("");

  // Xanh trước.
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) {
      result[i] = "correct";
      remaining[i] = null;
    }
  }
  // Vàng sau để xử lý đúng chữ lặp.
  for (let i = 0; i < 5; i++) {
    if (result[i] === "correct") continue;
    const index = remaining.indexOf(guess[i]);
    if (index !== -1) {
      result[i] = "present";
      remaining[index] = null;
    }
  }
  return result;
}

function updateKeyboard(guess, colors) {
  const priority = { absent: 1, present: 2, correct: 3 };
  colors.forEach((color, i) => {
    const btn = keyboard.querySelector(`[data-key="${guess[i]}"]`);
    if (!btn) return;
    const old = ["absent", "present", "correct"].find(c => btn.classList.contains(c));
    if (!old || priority[color] > priority[old]) {
      btn.classList.remove("absent", "present", "correct");
      btn.classList.add(color);
    }
  });
}

function submitGuess() {
  if (busy || state.locked) return;
  if (currentInput.length !== 5) {
    statusBanner.textContent = "TỪ DỰ ĐOÁN PHẢI CÓ ĐỦ 5 KÝ TỰ";
    statusBanner.className = "status-banner error";
    return;
  }

  const answer = ROUNDS[state.round].words[state.word];
  const colors = colorGuess(currentInput, answer);
  const row = board.querySelector(`[data-row="${state.guessRow}"]`);

  busy = true;
  [...row.children].forEach((tile, i) => {
    tile.textContent = currentInput[i];
    setTimeout(() => {
      tile.classList.add(colors[i]);
      if (i === 4) {
        updateKeyboard(currentInput, colors);
        afterGuess(currentInput === answer);
      }
    }, i * 180);
  });
}

function afterGuess(correct) {
  if (correct) {
    statusBanner.textContent = "CHÍNH XÁC! ĐÁP ÁN ĐÚNG.";
    statusBanner.className = "status-banner success";
    setTimeout(nextWord, 800);
    return;
  }

  if (state.guessRow >= 5) {
    statusBanner.textContent = "HẾT LƯỢT. ĐÁP ÁN CỦA CÂU NÀY ĐÃ BỊ KHÓA.";
    statusBanner.className = "status-banner error";
    setTimeout(nextWord, 1000);
    return;
  }

  state.guessRow++;
  currentInput = "";
  busy = false;
  saveState();
  saveTeam();
}

function nextWord() {
  state.word++;
  state.guessRow = 0;
  currentInput = "";
  busy = false;
  clearKeyboard();

  if (state.word >= 5) {
    completeRound();
    return;
  }

  saveState();
  buildBoard();
  updateHeader();
  statusBanner.textContent = "CÂU TIẾP THEO - HÃY NHẬP 5 KÝ TỰ";
  statusBanner.className = "status-banner";
  saveTeam();
}

function completeRound() {
  clearInterval(timerInterval);
  if (state.round >= 3) {
    state.status = "finished";
    saveState();
    saveTeam({ status: "finished", finishedAt: serverTimestamp() });
    finishGame();
    return;
  }

  state.status = "round-complete";
  saveState();
  saveTeam();

  document.getElementById("transitionIcon").textContent = "✓";
  document.getElementById("transitionKicker").textContent = "HOÀN THÀNH";
  document.getElementById("transitionTitle").textContent = `BẠN ĐÃ HOÀN THÀNH VÒNG ${state.round + 1}!`;
  document.getElementById("transitionText").textContent = `Chuẩn bị bước vào Vòng ${state.round + 2} với thời gian thử thách mới.`;
  continueBtn.textContent = `BẮT ĐẦU VÒNG ${state.round + 2}`;
  showScreen(transitionScreen);
}

function handleTimeExpired() {
  if (state.locked || busy) return;
  clearInterval(timerInterval);
  state.locked = true;
  state.status = "locked";
  saveState();
  saveTeam({ status: "locked", locked: true });

  // Vòng 1-3: khóa vòng đó và cho phép chuyển sang vòng tiếp theo.
  if (state.round < 3) {
    document.getElementById("transitionIcon").textContent = "⏱";
    document.getElementById("transitionKicker").textContent = "HẾT THỜI GIAN";
    document.getElementById("transitionTitle").textContent = `VÒNG ${state.round + 1} ĐÃ KẾT THÚC`;
    document.getElementById("transitionText").textContent = `Kết quả của vòng này đã được khóa. Bạn được chuyển sang Vòng ${state.round + 2}.`;
    continueBtn.textContent = `BẮT ĐẦU VÒNG ${state.round + 2}`;
    showScreen(transitionScreen);
  } else {
    // Vòng 4: chỉ khóa màn hiện tại, không tự reset hay chuyển đi.
    statusBanner.textContent = "HẾT THỜI GIAN VÒNG 4. MÀN HIỆN TẠI ĐÃ BỊ KHÓA.";
    statusBanner.className = "status-banner error";
    document.querySelectorAll("#keyboard button").forEach(b => b.disabled = true);
    saveTeam();
  }
}

function finishGame() {
  clearInterval(timerInterval);
  showScreen(finishScreen);
}

function continueRound() {
  state.round++;
  state.word = 0;
  state.guessRow = 0;
  state.status = "playing";
  state.locked = false;
  delete state.roundDeadline;
  saveState();
  startRound(false);
}

function handleKey(key) {
  if (!gameScreen.classList.contains("active") || busy || state.locked) return;
  if (key === "ENTER") submitGuess();
  else if (key === "BACK") {
    currentInput = currentInput.slice(0, -1);
    renderInput();
  } else if (/^[A-Z]$/.test(key) && currentInput.length < 5) {
    currentInput += key;
    renderInput();
  }
  saveTeam();
}

joinBtn.addEventListener("click", joinGame);
teamNameInput.addEventListener("keydown", e => { if (e.key === "Enter") joinGame(); });
keyboard.addEventListener("click", e => {
  const key = e.target.dataset.key;
  if (key) handleKey(key);
});
document.addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "Enter") handleKey("ENTER");
  else if (e.key === "Backspace") handleKey("BACK");
  else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toUpperCase());
});
continueBtn.addEventListener("click", continueRound);

// Ô ẩn: click 5 lần vào tiêu đề để hiện ô lệnh reset.
let titleClicks = 0;
let titleTimer;
document.querySelector("#joinScreen h1").addEventListener("click", () => {
  titleClicks++;
  clearTimeout(titleTimer);
  titleTimer = setTimeout(() => titleClicks = 0, 1500);
  if (titleClicks >= 5) {
    titleClicks = 0;
    document.getElementById("adminModal").classList.add("show");
  }
});
document.getElementById("closeAdminModal").onclick = () => document.getElementById("adminModal").classList.remove("show");
document.getElementById("adminCommandBtn").onclick = () => {
  const cmd = document.getElementById("adminCommandInput").value.trim().toLowerCase();
  const msg = document.getElementById("adminCommandMessage");
  const match = cmd.match(/^reset([1-4])$/);
  if (!match || !state) {
    msg.textContent = "Lệnh không hợp lệ.";
    return;
  }
  const targetRound = Number(match[1]) - 1;
  state.round = targetRound;
  state.word = 0;
  state.guessRow = 0;
  state.status = "playing";
  state.locked = false;
  delete state.roundDeadline;
  saveState();
  msg.textContent = `Đã reset về Vòng ${targetRound + 1}.`;
  setTimeout(() => {
    document.getElementById("adminModal").classList.remove("show");
    startRound(false);
  }, 700);
};

restoreOrJoin();
