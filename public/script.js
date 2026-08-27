import { firebaseConfig } from "./firebase-config.js";

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


/* =====================================================
   DỮ LIỆU GAME
===================================================== */

const ROUNDS = [

  {
    round: 1,
    seconds: 180,
    words: ["AGENT", "MODEL", "TOKEN", "PROMT", "CLOUD"]
  },

  {
    round: 2,
    seconds: 300,
    words: ["ROBOT", "VOICE", "IMAGE", "AUDIO", "SMART"]
  },

  {
    round: 3,
    seconds: 420,
    words: ["LEARN", "TRAIN", "BRAIN", "LOGIC", "CHIPS"]
  },

  {
    round: 4,
    seconds: 600,
    words: ["PIXEL", "DEPTH", "LLAMA", "GEMMA", "CODEX"]
  }

];


/* =====================================================
   DOM
===================================================== */

const joinScreen =
  document.getElementById("joinScreen");

const roundSelectScreen =
  document.getElementById("roundSelectScreen");

const questionSelectScreen =
  document.getElementById("questionSelectScreen");

const gameScreen =
  document.getElementById("gameScreen");

const transitionScreen =
  document.getElementById("transitionScreen");

const finishScreen =
  document.getElementById("finishScreen");


const teamNameInput =
  document.getElementById("teamName");

const joinBtn =
  document.getElementById("joinBtn");

const joinMessage =
  document.getElementById("joinMessage");


const roundList =
  document.getElementById("roundList");

const questionList =
  document.getElementById("questionList");

const roundTeamName =
  document.getElementById("roundTeamName");

const questionRoundLabel =
  document.getElementById("questionRoundLabel");

const questionTime =
  document.getElementById("questionTime");

const backRoundBtn =
  document.getElementById("backRoundBtn");


const board =
  document.getElementById("board");

const keyboard =
  document.getElementById("keyboard");

const timerEl =
  document.getElementById("timer");

const teamDisplay =
  document.getElementById("teamDisplay");

const roundLabel =
  document.getElementById("roundLabel");

const roundInfo =
  document.getElementById("roundInfo");

const statusBanner =
  document.getElementById("statusBanner");

const continueBtn =
  document.getElementById("continueBtn");


/* =====================================================
   STATE
===================================================== */

let uid =
  localStorage.getItem("aiWordleUid") || "";

let teamName =
  localStorage.getItem("aiWordleTeamName") || "";

let state =
  JSON.parse(
    localStorage.getItem("aiWordleState") || "null"
  );


let currentInput = "";

let timerInterval = null;

let roundDeadline = null;

let busy = false;


/* =====================================================
   SAVE LOCAL
===================================================== */

function saveState() {

  localStorage.setItem(
    "aiWordleState",
    JSON.stringify(state)
  );

}


/* =====================================================
   SCREEN
===================================================== */

function showScreen(screen) {

  [
    joinScreen,
    roundSelectScreen,
    questionSelectScreen,
    gameScreen,
    transitionScreen,
    finishScreen
  ].forEach(item => {

    if (item) {
      item.classList.remove("active");
    }

  });

  screen.classList.add("active");

}


/* =====================================================
   TIME
===================================================== */

function formatTime(seconds) {

  const minutes =
    Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");

  const secs =
    (seconds % 60)
      .toString()
      .padStart(2, "0");

  return `${minutes}:${secs}`;

}


/* =====================================================
   FIREBASE SAVE
===================================================== */

async function saveTeam(extra = {}) {

  if (!uid) return;

  try {

    await updateDoc(
      doc(db, "teams", uid),
      {

        teamName,

        status:
          state?.status || "playing",

        currentRound:
          state?.currentRound + 1 || 1,

        currentQuestion:
          state?.selectedQuestion !== null
            ? state.selectedQuestion + 1
            : null,

        lockedRounds:
          state?.lockedRounds || [],

        round4LockedQuestions:
          state?.round4LockedQuestions || [],

        lastActive:
          serverTimestamp(),

        ...extra

      }
    );

  } catch (error) {

    console.error(error);

  }

}


/* =====================================================
   JOIN GAME
===================================================== */

async function joinGame() {

  const name =
    teamNameInput.value.trim();


  if (!name) {

    joinMessage.textContent =
      "Vui lòng nhập tên đội.";

    return;

  }


  joinBtn.disabled = true;

  joinMessage.textContent =
    "Đang kết nối hệ thống...";


  try {

    const credential =
      await signInAnonymously(auth);


    uid =
      credential.user.uid;


    teamName =
      name;


    localStorage.setItem(
      "aiWordleUid",
      uid
    );


    localStorage.setItem(
      "aiWordleTeamName",
      teamName
    );


    state = {

      currentRound: 0,

      selectedQuestion: null,

      guessRow: 0,

      status: "playing",

      lockedRounds: [],

      round4LockedQuestions: [],

      roundDeadline: null

    };


    saveState();


    await setDoc(
      doc(db, "teams", uid),
      {

        teamName,

        status: "playing",

        currentRound: 1,

        currentQuestion: null,

        lockedRounds: [],

        round4LockedQuestions: [],

        joinedAt:
          serverTimestamp(),

        lastActive:
          serverTimestamp()

      },
      {
        merge: true
      }
    );


    showRoundSelection();


  } catch (error) {

    console.error(error);

    joinMessage.textContent =
      "Không thể kết nối Firebase.";

    joinBtn.disabled = false;

  }

}


/* =====================================================
   ROUND SELECT
===================================================== */

function showRoundSelection() {

  clearInterval(timerInterval);

  roundTeamName.textContent =
    teamName;


  roundList.innerHTML = "";


  ROUNDS.forEach((round, index) => {

    const card =
      document.createElement("div");


    card.className =
      "round-card";


    const isLocked =
      state.lockedRounds.includes(index);


    const isCurrent =
      index === state.currentRound;


    if (isLocked) {

      card.classList.add("locked");

    }


    if (isCurrent) {

      card.classList.add("active");

    }


    let statusText =
      "🔒 KHÓA";


    if (isLocked) {

      statusText =
        "🔒 ĐÃ THẤT BẠI";

    } else if (isCurrent) {

      statusText =
        "🟢 CÓ THỂ CHƠI";

    }


    card.innerHTML = `

      <h3>LẦN ${index + 1}</h3>

      <span class="round-time">
        ${formatTime(round.seconds)}
      </span>

      <span class="round-status">
        ${statusText}
      </span>

    `;


    if (isCurrent && !isLocked) {

      card.onclick = () => {

        showQuestionSelection(index);

      };

    }


    roundList.appendChild(card);

  });


  showScreen(
    roundSelectScreen
  );


  saveTeam();

}


/* =====================================================
   QUESTION SELECT
===================================================== */

function showQuestionSelection(roundIndex) {

  if (roundIndex !== state.currentRound) {
    return;
  }


  const round =
    ROUNDS[roundIndex];


  questionRoundLabel.textContent =
    `LẦN ${roundIndex + 1}`;


  questionTime.textContent =
    `THỜI GIAN: ${formatTime(round.seconds)}`;


  questionList.innerHTML = "";


  round.words.forEach((word, index) => {

    const card =
      document.createElement("div");


    card.className =
      "question-card";


    const locked =
      roundIndex === 3 &&
      state.round4LockedQuestions.includes(index);


    if (locked) {

      card.classList.add("locked");

    }


    card.innerHTML = `

      <strong>
        CÂU ${index + 1}
      </strong>

      <span>
        ${locked
          ? "ĐÃ KHÓA"
          : "SẴN SÀNG"}
      </span>

    `;


    if (!locked) {

      card.onclick = () => {

        startQuestion(
          roundIndex,
          index
        );

      };

    }


    questionList.appendChild(card);

  });


  showScreen(
    questionSelectScreen
  );

}


/* =====================================================
   START QUESTION
===================================================== */

function startQuestion(
  roundIndex,
  questionIndex,
  restoring = false
) {

  clearInterval(timerInterval);


  state.currentRound =
    roundIndex;


  state.selectedQuestion =
    questionIndex;


  state.guessRow =
    0;


  state.status =
    "playing";


  currentInput =
    "";


  busy =
    false;


  if (
    !restoring ||
    !state.roundDeadline
  ) {

    roundDeadline =
      Date.now() +
      ROUNDS[roundIndex].seconds * 1000;


    state.roundDeadline =
      roundDeadline;

  } else {

    roundDeadline =
      state.roundDeadline;

  }


  saveState();


  teamDisplay.textContent =
    teamName;


  roundLabel.textContent =
    `LẦN ${roundIndex + 1}`;


  roundInfo.textContent =
    `CÂU ${questionIndex + 1}/5`;


  document
    .querySelectorAll(".progress-dot")
    .forEach((dot, index) => {

      dot.classList.toggle(
        "active",
        index === roundIndex
      );

      dot.classList.toggle(
        "done",
        index < roundIndex
      );

    });


  buildBoard();

  clearKeyboard();


  statusBanner.textContent =
    "HÃY NHẬP MỘT TỪ GỒM 5 KÝ TỰ";


  statusBanner.className =
    "status-banner";


  showScreen(
    gameScreen
  );


  startTimer();


  saveTeam();

}


/* =====================================================
   TIMER
===================================================== */

function startTimer() {

  clearInterval(timerInterval);


  const tick = () => {

    const remaining =
      Math.max(
        0,
        Math.ceil(
          (roundDeadline - Date.now()) /
          1000
        )
      );


    timerEl.textContent =
      formatTime(remaining);


    if (remaining <= 0) {

      clearInterval(timerInterval);

      handleFailure();

    }

  };


  tick();


  timerInterval =
    setInterval(
      tick,
      250
    );

}


/* =====================================================
   BOARD
===================================================== */

function buildBoard() {

  board.innerHTML = "";


  for (
    let rowIndex = 0;
    rowIndex < 6;
    rowIndex++
  ) {

    const row =
      document.createElement("div");


    row.className =
      "board-row";


    row.dataset.row =
      rowIndex;


    for (
      let col = 0;
      col < 5;
      col++
    ) {

      const tile =
        document.createElement("div");


      tile.className =
        "tile";


      tile.dataset.col =
        col;


      row.appendChild(
        tile
      );

    }


    board.appendChild(
      row
    );

  }

}


function renderInput() {

  const row =
    board.querySelector(
      `[data-row="${state.guessRow}"]`
    );


  if (!row) return;


  [...row.children].forEach(
    (tile, index) => {

      tile.textContent =
        currentInput[index] || "";


      tile.classList.toggle(
        "filled",
        !!currentInput[index]
      );

    }
  );

}


/* =====================================================
   KEYBOARD
===================================================== */

function clearKeyboard() {

  keyboard
    .querySelectorAll("button")
    .forEach(button => {

      button.disabled =
        false;

      button.classList.remove(
        "correct",
        "present",
        "absent"
      );

    });

}


function updateKeyboard(
  guess,
  colors
) {

  const priority = {

    absent: 1,
    present: 2,
    correct: 3

  };


  colors.forEach(
    (color, index) => {

      const button =
        keyboard.querySelector(
          `[data-key="${guess[index]}"]`
        );


      if (!button) return;


      const old =
        [
          "absent",
          "present",
          "correct"
        ].find(
          item =>
            button.classList.contains(item)
        );


      if (
        !old ||
        priority[color] >
        priority[old]
      ) {

        button.classList.remove(
          "absent",
          "present",
          "correct"
        );


        button.classList.add(
          color
        );

      }

    }
  );

}


/* =====================================================
   WORDLE CHECK
===================================================== */

function colorGuess(
  guess,
  answer
) {

  const result =
    Array(5).fill(
      "absent"
    );


  const remaining =
    answer.split("");


  for (
    let i = 0;
    i < 5;
    i++
  ) {

    if (
      guess[i] === answer[i]
    ) {

      result[i] =
        "correct";

      remaining[i] =
        null;

    }

  }


  for (
    let i = 0;
    i < 5;
    i++
  ) {

    if (
      result[i] ===
      "correct"
    ) continue;


    const index =
      remaining.indexOf(
        guess[i]
      );


    if (index !== -1) {

      result[i] =
        "present";

      remaining[index] =
        null;

    }

  }


  return result;

}


/* =====================================================
   SUBMIT GUESS
===================================================== */

function submitGuess() {

  if (
    busy ||
    state.status !== "playing"
  ) return;


  if (
    currentInput.length !== 5
  ) {

    statusBanner.textContent =
      "TỪ DỰ ĐOÁN PHẢI CÓ ĐỦ 5 KÝ TỰ";


    statusBanner.className =
      "status-banner error";


    return;

  }


  const answer =
    ROUNDS[
      state.currentRound
    ].words[
      state.selectedQuestion
    ];


  const colors =
    colorGuess(
      currentInput,
      answer
    );


  const row =
    board.querySelector(
      `[data-row="${state.guessRow}"]`
    );


  busy = true;


  [...row.children].forEach(
    (tile, index) => {

      tile.textContent =
        currentInput[index];


      setTimeout(() => {

        tile.classList.add(
          colors[index]
        );


        if (index === 4) {

          updateKeyboard(
            currentInput,
            colors
          );


          if (
            currentInput === answer
          ) {

            handleSuccess();

          } else {

            handleWrongGuess();

          }

        }

      }, index * 180);

    }
  );

}


/* =====================================================
   WRONG GUESS
===================================================== */

function handleWrongGuess() {

  if (
    state.guessRow >= 5
  ) {

    handleFailure();

    return;

  }


  state.guessRow++;


  currentInput =
    "";


  busy =
    false;


  saveState();

}


/* =====================================================
   SUCCESS
===================================================== */

function handleSuccess() {

  clearInterval(
    timerInterval
  );


  state.status =
    "finished";


  saveState();


  saveTeam({

    status:
      "finished",

    finishedAt:
      serverTimestamp()

  });


  document
    .getElementById(
      "finishTitle"
    )
    .textContent =
      "CHÚC MỪNG! BẠN ĐÃ GIẢI ĐÚNG";


  document
    .getElementById(
      "finishText"
    )
    .textContent =
      `Đội ${teamName} đã hoàn thành thử thách Lần ${state.currentRound + 1}.`;


  showScreen(
    finishScreen
  );

}


/* =====================================================
   FAILURE
===================================================== */

function handleFailure() {

  clearInterval(
    timerInterval
  );


  const round =
    state.currentRound;


  state.status =
    "playing";


  state.roundDeadline =
    null;


  if (round < 3) {

    if (
      !state.lockedRounds.includes(
        round
      )
    ) {

      state.lockedRounds.push(
        round
      );

    }


    state.currentRound =
      round + 1;


    state.selectedQuestion =
      null;


    state.guessRow =
      0;


    saveState();


    saveTeam({

      status:
        "locked"

    });


    document
      .getElementById(
        "transitionIcon"
      )
      .textContent =
        "⏱";


    document
      .getElementById(
        "transitionKicker"
      )
      .textContent =
        "THỬ THÁCH CHƯA THÀNH CÔNG";


    document
      .getElementById(
        "transitionTitle"
      )
      .textContent =
        `LẦN ${round + 1} ĐÃ BỊ KHÓA`;


    document
      .getElementById(
        "transitionText"
      )
      .textContent =
        `Bạn được chuyển sang Lần ${round + 2}.`;


    continueBtn.textContent =
      "TIẾP TỤC";


    showScreen(
      transitionScreen
    );


    return;

  }


  /* =============================
     LẦN 4
  ============================= */

  const question =
    state.selectedQuestion;


  if (
    !state.round4LockedQuestions
      .includes(question)
  ) {

    state.round4LockedQuestions
      .push(question);

  }


  state.selectedQuestion =
    null;


  state.guessRow =
    0;


  saveState();


  saveTeam({

    status:
      "playing"

  });


  document
    .getElementById(
      "transitionIcon"
    )
    .textContent =
      "🔒";


  document
    .getElementById(
      "transitionKicker"
    )
    .textContent =
      "CÂU ĐÃ BỊ KHÓA";


  document
    .getElementById(
      "transitionTitle"
    )
    .textContent =
      `CÂU ${question + 1} KHÔNG THÀNH CÔNG`;


  document
    .getElementById(
      "transitionText"
    )
    .textContent =
      "Bạn vẫn có thể chọn một câu khác trong Lần 4.";


  continueBtn.textContent =
    "CHỌN CÂU KHÁC";


  showScreen(
    transitionScreen
  );

}


/* =====================================================
   CONTINUE
===================================================== */

function continueGame() {

  if (
    state.currentRound === 3 &&
    state.selectedQuestion === null
  ) {

    showQuestionSelection(
      3
    );

    return;

  }


  showRoundSelection();

}


/* =====================================================
   KEYBOARD INPUT
===================================================== */

function handleKey(key) {

  if (
    !gameScreen.classList.contains(
      "active"
    )
  ) return;


  if (busy) return;


  if (
    key === "ENTER"
  ) {

    submitGuess();

  }


  else if (
    key === "BACK"
  ) {

    currentInput =
      currentInput.slice(
        0,
        -1
      );


    renderInput();

  }


  else if (
    /^[A-Z]$/.test(key) &&
    currentInput.length < 5
  ) {

    currentInput +=
      key;


    renderInput();

  }

}


/* =====================================================
   RESTORE
===================================================== */

function restoreOrJoin() {

  if (
    uid &&
    teamName &&
    state
  ) {

    if (
      state.status ===
      "finished"
    ) {

      showScreen(
        finishScreen
      );

      return;

    }


    if (
      state.selectedQuestion !== null &&
      state.roundDeadline &&
      Date.now() <
      state.roundDeadline
    ) {

      startQuestion(
        state.currentRound,
        state.selectedQuestion,
        true
      );

    } else {

      state.selectedQuestion =
        null;

      state.roundDeadline =
        null;

      saveState();

      showRoundSelection();

    }

  }


  else {

    showScreen(
      joinScreen
    );

  }

}


/* =====================================================
   EVENT
===================================================== */

joinBtn.addEventListener(
  "click",
  joinGame
);


teamNameInput.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Enter"
    ) {

      joinGame();

    }

  }
);


keyboard.addEventListener(
  "click",
  event => {

    const key =
      event.target.dataset.key;


    if (key) {

      handleKey(key);

    }

  }
);


document.addEventListener(
  "keydown",
  event => {

    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) return;


    if (
      event.key === "Enter"
    ) {

      handleKey(
        "ENTER"
      );

    }


    else if (
      event.key ===
      "Backspace"
    ) {

      handleKey(
        "BACK"
      );

    }


    else if (
      /^[a-zA-Z]$/
        .test(event.key)
    ) {

      handleKey(
        event.key.toUpperCase()
      );

    }

  }
);


continueBtn.addEventListener(
  "click",
  continueGame
);


backRoundBtn.addEventListener(
  "click",
  showRoundSelection
);


/* =====================================================
   ADMIN RESET
===================================================== */

let titleClicks = 0;

let titleTimer;


document
  .querySelector("#joinScreen h1")
  .addEventListener(
    "click",
    () => {

      titleClicks++;

      clearTimeout(
        titleTimer
      );


      titleTimer =
        setTimeout(
          () => {

            titleClicks = 0;

          },
          1500
        );


      if (
        titleClicks >= 5
      ) {

        titleClicks = 0;

        document
          .getElementById(
            "adminModal"
          )
          .classList.add(
            "show"
          );

      }

    }
  );


document
  .getElementById(
    "closeAdminModal"
  )
  .onclick =
  () => {

    document
      .getElementById(
        "adminModal"
      )
      .classList.remove(
        "show"
      );

  };


document
  .getElementById(
    "adminCommandBtn"
  )
  .onclick =
  () => {

    const cmd =
      document
        .getElementById(
          "adminCommandInput"
        )
        .value
        .trim()
        .toLowerCase();


    const msg =
      document
        .getElementById(
          "adminCommandMessage"
        );


    const match =
      cmd.match(
        /^reset([1-4])$/
      );


    if (
      !match ||
      !state
    ) {

      msg.textContent =
        "Lệnh không hợp lệ.";

      return;

    }


    const targetRound =
      Number(
        match[1]
      ) - 1;


    state.currentRound =
      targetRound;


    state.selectedQuestion =
      null;


    state.guessRow =
      0;


    state.status =
      "playing";


    state.roundDeadline =
      null;


    if (
      targetRound < 3
    ) {

      state.lockedRounds =
        state.lockedRounds.filter(
          round =>
            round < targetRound
        );

    }


    if (
      targetRound === 3
    ) {

      state.round4LockedQuestions =
        [];

    }


    saveState();


    msg.textContent =
      `Đã reset về Lần ${targetRound + 1}.`;


    setTimeout(
      () => {

        document
          .getElementById(
            "adminModal"
          )
          .classList.remove(
            "show"
          );


        showRoundSelection();

      },
      600
    );

  };


restoreOrJoin();