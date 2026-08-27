import { firebaseConfig } from "./firebase-config.js";

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function listenAdminActions() {

  if (!uid) return;


  onSnapshot(

    doc(
      db,
      "teams",
      uid
    ),

    snapshot => {

      if (
        !snapshot.exists()
      ) {

        /*
          Admin đã xóa đội.
          Xóa dữ liệu trên máy người chơi.
        */

        localStorage.removeItem(
          "aiWordleUid"
        );

        localStorage.removeItem(
          "aiWordleTeamName"
        );

        localStorage.removeItem(
          "aiWordleState"
        );

        location.reload();

        return;

      }


      const data =
        snapshot.data();


      /* ============================
         RESET THEO LẦN
      ============================ */

      if (
        data.adminAction ===
        "reset"
      ) {

        const targetRound =
          Number(
            data.adminResetRound
          );

        if (
          targetRound >= 1 &&
          targetRound <= 4
        ) {

          /*
            Chỉ thực hiện nếu lần hiện tại
            khác lần BTC yêu cầu.
          */

          if (
            !state ||
            state.currentRound !== targetRound
          ) {

            clearInterval(
              timerInterval
            );


            state = {

              currentRound:
                targetRound,

              selectedQuestion:
                null,

              guessRow:
                0,

              status:
                "playing",

              roundDeadline:
                null,

              lockedRounds:
                [],

              round4LockedQuestions:
                []

            };


            saveState();


            alert(
              `BTC đã reset đội về Lần ${targetRound}.`
            );


            location.reload();

          }

        }

      }


      /* ============================
         MỞ KHÓA THEO LẦN
      ============================ */

      if (
        data.adminAction ===
        "unlock"
      ) {

        const targetRound =
          Number(
            data.adminUnlockRound
          );


        if (
          targetRound >= 1 &&
          targetRound <= 4
        ) {

          if (
            !state ||
            state.currentRound !== targetRound ||
            state.status === "locked"
          ) {

            clearInterval(
              timerInterval
            );


            state.currentRound =
              targetRound;

            state.status =
              "playing";

            state.locked =
              false;

            state.roundDeadline =
              null;


            saveState();


            alert(
              `BTC đã mở khóa Lần ${targetRound}.`
            );


            location.reload();

          }

        }

      }

    }

  );

}
/* =====================================================
   FIREBASE
===================================================== */

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);


/* =====================================================
   DỮ LIỆU GAME

   Bạn có thể thay các đáp án này sau.

   LƯU Ý:
   - Không dấu
   - Không khoảng trắng
   - Tối đa khoảng 15 ký tự
===================================================== */

const ROUNDS = [

  {
    round: 1,
    seconds: 180,
    words: [
      "COMAYBIETTUDUY",
      "TRITUEVUOTCONNGUOI",
      "KHANANGMAYVOHAN",
      "HETHONGBIETHOCHOI",
      "MAYMOCHIEUVANVAT"
    ]
  },

  {
    round: 2,
    seconds: 300,
    words: [
      "ROBOT",
      "VOICE",
      "IMAGE",
      "AUDIO",
      "SMART"
    ]
  },

  {
    round: 3,
    seconds: 420,
    words: [
      "LEARNING",
      "TRAINING",
      "NEURAL",
      "LOGIC",
      "CHIP"
    ]
  },

  {
    round: 4,
    seconds: 600,
    words: [
      "CHATBOT",
      "DEEPMIND",
      "TRITUENHANTAO",
      "MACHINELEARN",
      "COMPUTERVISION"
    ]
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

let busy = false;

let authReady = false;


/* =====================================================
   TIỆN ÍCH
===================================================== */

function normalizeWord(text) {

  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/\s+/g, "")
    .toUpperCase();

}


function saveState() {

  localStorage.setItem(
    "aiWordleState",
    JSON.stringify(state)
  );

}


function clearLocalGame() {

  localStorage.removeItem(
    "aiWordleUid"
  );

  localStorage.removeItem(
    "aiWordleTeamName"
  );

  localStorage.removeItem(
    "aiWordleState"
  );

  uid = "";

  teamName = "";

  state = null;

}


function formatTime(seconds) {

  const safeSeconds =
    Math.max(0, seconds);

  const minutes =
    Math.floor(safeSeconds / 60)
      .toString()
      .padStart(2, "0");

  const secs =
    (safeSeconds % 60)
      .toString()
      .padStart(2, "0");

  return `${minutes}:${secs}`;

}


/* =====================================================
   CHUYỂN MÀN HÌNH
===================================================== */

function showScreen(screen) {

  const screens = [

    joinScreen,
    roundSelectScreen,
    questionSelectScreen,
    gameScreen,
    transitionScreen,
    finishScreen

  ];

  screens.forEach(item => {

    if (item) {
      item.classList.remove("active");
    }

  });


  if (screen) {
    screen.classList.add("active");
  }

}


/* =====================================================
   FIREBASE SAVE
===================================================== */

async function saveTeam(extra = {}) {

  if (!uid || !state) return;

  try {

    await updateDoc(
      doc(db, "teams", uid),
      {

        teamName,

        status:
          state.status || "playing",

        currentRound:
          state.currentRound + 1,

        currentQuestion:
          state.selectedQuestion !== null
            ? state.selectedQuestion + 1
            : null,

        lockedRounds:
          state.lockedRounds || [],

        round4LockedQuestions:
          state.round4LockedQuestions || [],

        lastActive:
          serverTimestamp(),

        ...extra

      }
    );

  } catch (error) {

    console.error(
      "Lỗi lưu Firebase:",
      error
    );

  }

}


/* =====================================================
   KIỂM TRA ĐỘI CÒN TỒN TẠI
===================================================== */

async function checkExistingTeam() {

  if (!auth.currentUser) {
    return false;
  }


  const teamRef =
    doc(
      db,
      "teams",
      auth.currentUser.uid
    );


  const teamSnap =
    await getDoc(teamRef);


  /*
     ADMIN ĐÃ XÓA ĐỘI
  */

  if (!teamSnap.exists()) {

    clearLocalGame();

    showScreen(joinScreen);

    return false;

  }


  return teamSnap;

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


  if (!authReady) {

    joinMessage.textContent =
      "Đang kết nối Firebase...";

    return;

  }


  joinBtn.disabled = true;

  joinMessage.textContent =
    "Đang khởi tạo đội chơi...";


  try {

    let user =
      auth.currentUser;


    if (!user) {

      const credential =
        await signInAnonymously(auth);

      user =
        credential.user;

    }


    uid =
      user.uid;

    teamName =
      name;


    state = {

      currentRound: 0,

      selectedQuestion: null,

      guessRow: 0,

      status: "playing",

      lockedRounds: [],

      round4LockedQuestions: [],

      roundDeadline: null

    };


    localStorage.setItem(
      "aiWordleUid",
      uid
    );


    localStorage.setItem(
      "aiWordleTeamName",
      teamName
    );


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

      }
    );


    showRoundSelection();


  } catch (error) {

    console.error(error);

    joinMessage.textContent =
      "Không thể kết nối Firebase. Kiểm tra Authentication và Firestore Rules.";

    joinBtn.disabled =
      false;

  }

}


/* =====================================================
   HIỂN THỊ 4 LẦN CHƠI
===================================================== */

function showRoundSelection() {

  clearInterval(
    timerInterval
  );


  if (!state) {

    showScreen(
      joinScreen
    );

    return;

  }


  if (!roundList) {

    console.error(
      "Không tìm thấy roundList trong HTML."
    );

    return;

  }


  if (roundTeamName) {

    roundTeamName.textContent =
      teamName;

  }


  roundList.innerHTML =
    "";


  ROUNDS.forEach(
    (round, index) => {

      const card =
        document.createElement("div");


      card.className =
        "round-card";


      const isLocked =
        state.lockedRounds.includes(
          index
        );


      const isCurrent =
        index ===
        state.currentRound;


      const isPast =
        index <
        state.currentRound;


      if (isLocked) {

        card.classList.add(
          "locked"
        );

      }


      if (isCurrent) {

        card.classList.add(
          "active"
        );

      }


      let statusText =
        "🔒 CHƯA MỞ";


      if (isLocked) {

        statusText =
          "🔒 ĐÃ THẤT BẠI";

      }

      else if (isCurrent) {

        statusText =
          "🟢 CÓ THỂ CHƠI";

      }

      else if (isPast) {

        statusText =
          "🔒 ĐÃ KHÓA";

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


      if (
        isCurrent &&
        !isLocked
      ) {

        card.onclick =
          () => {

            showQuestionSelection(
              index
            );

          };

      }


      roundList.appendChild(
        card
      );

    }
  );


  showScreen(
    roundSelectScreen
  );


  saveTeam();

}


/* =====================================================
   CHỌN 1 TRONG 5 CÂU
===================================================== */

function showQuestionSelection(
  roundIndex
) {

  if (
    !state ||
    roundIndex !==
    state.currentRound
  ) {
    return;
  }


  const round =
    ROUNDS[roundIndex];


  if (questionRoundLabel) {

    questionRoundLabel.textContent =
      `LẦN ${roundIndex + 1}`;

  }


  if (questionTime) {

    questionTime.textContent =
      `THỜI GIAN: ${formatTime(round.seconds)}`;

  }


  questionList.innerHTML =
    "";


  round.words.forEach(
    (word, index) => {

      const card =
        document.createElement("div");


      card.className =
        "question-card";


      /*
         LẦN 4:
         Câu nào thất bại
         chỉ khóa câu đó
      */

      const locked =
        roundIndex === 3 &&
        state.round4LockedQuestions.includes(
          index
        );


      if (locked) {

        card.classList.add(
          "locked"
        );

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

        card.onclick =
          () => {

            startQuestion(
              roundIndex,
              index
            );

          };

      }


      questionList.appendChild(
        card
      );

    }
  );


  showScreen(
    questionSelectScreen
  );

}


/* =====================================================
   LẤY ĐÁP ÁN HIỆN TẠI
===================================================== */

function getCurrentAnswer() {

  if (
    !state ||
    state.selectedQuestion === null
  ) {
    return "";
  }


  const answer =
    ROUNDS[
      state.currentRound
    ].words[
      state.selectedQuestion
    ];


  return normalizeWord(
    answer
  );

}


/* =====================================================
   BẮT ĐẦU CÂU
===================================================== */

function startQuestion(
  roundIndex,
  questionIndex,
  restoring = false
) {

  clearInterval(
    timerInterval
  );


  if (
    roundIndex !==
    state.currentRound
  ) {
    return;
  }


  state.currentRound =
    roundIndex;


  state.selectedQuestion =
    questionIndex;


  /*
     Nếu không restore
     thì bắt đầu lại lượt đoán
  */

  if (!restoring) {

    state.guessRow =
      0;

    state.roundDeadline =
      Date.now() +
      (
        ROUNDS[roundIndex]
          .seconds * 1000
      );

  }


  state.status =
    "playing";


  currentInput =
    "";


  busy =
    false;


  saveState();


  if (teamDisplay) {

    teamDisplay.textContent =
      teamName;

  }


  if (roundLabel) {

    roundLabel.textContent =
      `LẦN ${roundIndex + 1}`;

  }


  /*
     Chỉ hiển thị LẦN chơi
     Không còn lỗi CÂU nah/5
  */

  if (roundInfo) {

    roundInfo.textContent =
      "ĐANG CHƠI";

  }


  updateProgressDots(
    roundIndex
  );


  buildBoard();


  clearKeyboard();


  statusBanner.textContent =
    "HÃY DỰ ĐOÁN TỪ KHÓA";


  statusBanner.className =
    "status-banner";


  showScreen(
    gameScreen
  );


  startTimer();


  saveTeam();

}


/* =====================================================
   TIẾN TRÌNH 4 LẦN
===================================================== */

function updateProgressDots(
  currentRound
) {

  document
    .querySelectorAll(
      ".progress-dot"
    )
    .forEach(
      (dot, index) => {

        dot.classList.toggle(
          "active",
          index === currentRound
        );


        dot.classList.toggle(
          "done",
          index < currentRound
        );

      }
    );

}


/* =====================================================
   TIMER
===================================================== */

function startTimer() {

  clearInterval(
    timerInterval
  );


  const tick =
    () => {

      if (
        !state ||
        !state.roundDeadline
      ) {
        return;
      }


      const remaining =
        Math.max(
          0,
          Math.ceil(
            (
              state.roundDeadline -
              Date.now()
            ) / 1000
          )
        );


      timerEl.textContent =
        formatTime(
          remaining
        );


      if (remaining <= 0) {

        clearInterval(
          timerInterval
        );


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
   TẠO BOARD
   TỰ ĐỘNG THEO ĐỘ DÀI ĐÁP ÁN
===================================================== */

function buildBoard() {

  const answer =
    getCurrentAnswer();


  const wordLength =
    answer.length;


  board.innerHTML =
    "";


  if (!wordLength) {
    return;
  }


  for (
    let rowIndex = 0;
    rowIndex < 6;
    rowIndex++
  ) {

    const row =
      document.createElement(
        "div"
      );


    row.className =
      "board-row";


    row.dataset.row =
      rowIndex;


    row.style.gridTemplateColumns =
      `repeat(${wordLength}, minmax(0, 1fr))`;


    for (
      let col = 0;
      col < wordLength;
      col++
    ) {

      const tile =
        document.createElement(
          "div"
        );


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


/* =====================================================
   HIỂN THỊ INPUT
===================================================== */

function renderInput() {

  if (!state) return;


  const row =
    board.querySelector(
      `[data-row="${state.guessRow}"]`
    );


  if (!row) return;


  [...row.children].forEach(
    (tile, index) => {

      tile.textContent =
        currentInput[index] ||
        "";


      tile.classList.toggle(
        "filled",
        Boolean(
          currentInput[index]
        )
      );

    }
  );

}


/* =====================================================
   KEYBOARD
===================================================== */

function clearKeyboard() {

  if (!keyboard) return;


  keyboard
    .querySelectorAll(
      "button"
    )
    .forEach(
      button => {

        button.classList.remove(
          "correct",
          "present",
          "absent"
        );

      }
    );

}


function updateKeyboard(
  guess,
  colors
) {

  if (!keyboard) return;


  const priority = {

    absent: 1,

    present: 2,

    correct: 3

  };


  colors.forEach(
    (color, index) => {

      const letter =
        guess[index];


      const button =
        keyboard.querySelector(
          `[data-key="${letter}"]`
        );


      if (!button) return;


      const old =
        [
          "absent",
          "present",
          "correct"
        ].find(
          item =>
            button.classList.contains(
              item
            )
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

  guess =
    normalizeWord(
      guess
    );

  answer =
    normalizeWord(
      answer
    );

  // Kết quả luôn có số lượng phần tử
  // bằng đúng số ký tự của đáp án
  const result =
    Array(
      answer.length
    ).fill(
      "absent"
    );


  /* =====================================
     ĐẾM SỐ LẦN XUẤT HIỆN CỦA TỪNG KÝ TỰ
  ===================================== */

  const letterCount =
    {};

  for (
    const letter of answer
  ) {

    letterCount[letter] =
      (
        letterCount[letter] ||
        0
      ) + 1;

  }


  /* =====================================
     BƯỚC 1

     ĐÚNG KÝ TỰ
     + ĐÚNG VỊ TRÍ

     MÀU XANH
  ===================================== */

  for (
    let i = 0;
    i < answer.length;
    i++
  ) {

    if (
      guess[i] ===
      answer[i]
    ) {

      result[i] =
        "correct";

      letterCount[
        guess[i]
      ]--;

    }

  }


  /* =====================================
     BƯỚC 2

     ĐÚNG KÝ TỰ
     NHƯNG SAI VỊ TRÍ

     MÀU VÀNG
  ===================================== */

  for (
    let i = 0;
    i < answer.length;
    i++
  ) {

    // Nếu đã xanh thì bỏ qua
    if (
      result[i] ===
      "correct"
    ) {

      continue;

    }


    const letter =
      guess[i];


    if (
      letter &&
      letterCount[letter] > 0
    ) {

      result[i] =
        "present";

      letterCount[
        letter
      ]--;

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
    !state ||
    state.status !==
    "playing"
  ) {
    return;
  }


  const answer =
    getCurrentAnswer();


  if (
    currentInput.length !==
    answer.length
  ) {

    statusBanner.textContent =
      `TỪ DỰ ĐOÁN PHẢI CÓ ĐỦ ${answer.length} KÝ TỰ`;


    statusBanner.className =
      "status-banner error";


    return;

  }


  const colors =
    colorGuess(
      currentInput,
      answer
    );


  const row =
    board.querySelector(
      `[data-row="${state.guessRow}"]`
    );


  if (!row) return;


  busy =
    true;


  [...row.children].forEach(
    (tile, index) => {

      tile.textContent =
        currentInput[index];


      setTimeout(
        () => {

          tile.classList.add(
            colors[index]
          );


          /*
             ĐÃ LẬT HẾT Ô
          */

          if (
            index ===
            colors.length - 1
          ) {

            updateKeyboard(
              currentInput,
              colors
            );


            if (
              currentInput ===
              answer
            ) {

              handleSuccess();

            }

            else {

              handleWrongGuess();

            }

          }

        },

        index * 120

      );

    }
  );

}


/* =====================================================
   SAI 1 LƯỢT
===================================================== */

function handleWrongGuess() {

  /*
     6 hàng:
     0 1 2 3 4 5
  */

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


  saveTeam();

}


/* =====================================================
   THẮNG
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


  const finishTitle =
    document.getElementById(
      "finishTitle"
    );


  const finishText =
    document.getElementById(
      "finishText"
    );


  if (finishTitle) {

    finishTitle.textContent =
      "CHÚC MỪNG! BẠN ĐÃ GIẢI ĐÚNG";

  }


  if (finishText) {

    finishText.textContent =
      `Đội ${teamName} đã hoàn thành thử thách tại Lần ${state.currentRound + 1}.`;

  }


  showScreen(
    finishScreen
  );

}


/* =====================================================
   THẤT BẠI
===================================================== */

function handleFailure() {

  clearInterval(
    timerInterval
  );


  busy =
    true;


  const round =
    state.currentRound;


  state.status =
    "playing";


  state.roundDeadline =
    null;


  /*
     LẦN 1 - 3
  */

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


    /*
       CHUYỂN LẦN TIẾP THEO
    */

    state.currentRound =
      round + 1;


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


  /*
     =========================
     LẦN 4
     CHỈ KHÓA CÂU ĐÃ CHƠI
     =========================
  */

  const question =
    state.selectedQuestion;


  if (
    !state.round4LockedQuestions.includes(
      question
    )
  ) {

    state.round4LockedQuestions.push(
      question
    );

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


  busy =
    false;


  showScreen(
    transitionScreen
  );

}


/* =====================================================
   CONTINUE
===================================================== */

function continueGame() {

  busy =
    false;


  /*
     Nếu đang Lần 4
     và chưa chọn câu
  */

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
   NHẬP BÀN PHÍM
===================================================== */

function handleKey(key) {

  if (
    !gameScreen ||
    !gameScreen.classList.contains(
      "active"
    )
  ) {
    return;
  }


  if (busy) {
    return;
  }


  const answer =
    getCurrentAnswer();


  if (
    key === "ENTER"
  ) {

    submitGuess();

    return;

  }


  if (
    key === "BACK"
  ) {

    currentInput =
      currentInput.slice(
        0,
        -1
      );


    renderInput();

    return;

  }


  if (
    /^[A-Z]$/.test(
      key
    )
  ) {

    if (
      currentInput.length <
      answer.length
    ) {

      currentInput +=
        key;


      renderInput();

    }

  }

}


/* =====================================================
   KHÔI PHỤC GAME SAU REFRESH
===================================================== */

async function restoreGame() {

  if (
    !uid ||
    !teamName ||
    !state
  ) {

    showScreen(
      joinScreen
    );

    return;

  }


  try {

    const teamSnap =
      await checkExistingTeam();


    /*
       ADMIN ĐÃ XÓA ĐỘI
    */

    if (!teamSnap) {

      return;

    }


    /*
       GAME ĐÃ HOÀN THÀNH
    */

    if (
      state.status ===
      "finished"
    ) {

      showScreen(
        finishScreen
      );

      return;

    }


    /*
       ĐANG CHƠI VÀ CÒN THỜI GIAN
    */

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

      return;

    }


    /*
       HẾT GIỜ TRONG LÚC REFRESH
    */

    if (
      state.selectedQuestion !== null &&
      state.roundDeadline &&
      Date.now() >=
      state.roundDeadline
    ) {

      handleFailure();

      return;

    }


    state.selectedQuestion =
      null;


    state.roundDeadline =
      null;


    saveState();


    showRoundSelection();


  } catch (error) {

    console.error(
      "Lỗi khôi phục game:",
      error
    );


    showScreen(
      joinScreen
    );

  }

}


/* =====================================================
   AUTH STATE
===================================================== */

onAuthStateChanged(
  auth,

  async user => {

    authReady =
      true;


    /*
       Nếu chưa đăng nhập
       thì chỉ hiện màn nhập tên.

       Khi bấm bắt đầu
       mới tạo Anonymous User.
    */

    if (!user) {

      showScreen(
        joinScreen
      );

      return;

    }


    /*
       Nếu đã có tài khoản Anonymous
    */

    if (
      uid &&
      teamName &&
      state
    ) {

      await restoreGame();

    }

    else {

      showScreen(
        joinScreen
      );

    }

  }

);


/* =====================================================
   EVENTS
===================================================== */

joinBtn.addEventListener(
  "click",
  joinGame
);


teamNameInput.addEventListener(
  "keydown",

  event => {

    if (
      event.key ===
      "Enter"
    ) {

      joinGame();

    }

  }

);


if (keyboard) {

  keyboard.addEventListener(
    "click",

    event => {

      const key =
        event.target.dataset.key;


      if (key) {

        handleKey(
          key
        );

      }

    }

  );

}


document.addEventListener(
  "keydown",

  event => {

    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) {
      return;
    }


    /*
       Không nhập vào game
       khi đang gõ tên đội
    */

    if (
      document.activeElement ===
      teamNameInput
    ) {
      return;
    }


    if (
      event.key ===
      "Enter"
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
        .test(
          event.key
        )
    ) {

      handleKey(
        event.key.toUpperCase()
      );

    }

  }

);


if (continueBtn) {

  continueBtn.addEventListener(
    "click",
    continueGame
  );

}


if (backRoundBtn) {

  backRoundBtn.addEventListener(
    "click",
    showRoundSelection
  );

}


/* =====================================================
   ADMIN MODAL
   CLICK TIÊU ĐỀ 5 LẦN
===================================================== */

let titleClicks =
  0;

let titleTimer;


const mainTitle =
  document.querySelector(
    "#joinScreen h1"
  );


if (mainTitle) {

  mainTitle.addEventListener(
    "click",

    () => {

      titleClicks++;


      clearTimeout(
        titleTimer
      );


      titleTimer =
        setTimeout(
          () => {

            titleClicks =
              0;

          },

          1500
        );


      if (
        titleClicks >= 5
      ) {

        titleClicks =
          0;


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

}


/* =====================================================
   ĐÓNG ADMIN MODAL
===================================================== */

const closeAdminModal =
  document.getElementById(
    "closeAdminModal"
  );


if (closeAdminModal) {

  closeAdminModal.onclick =
    () => {

      document
        .getElementById(
          "adminModal"
        )
        .classList.remove(
          "show"
        );

    };

}


/* =====================================================
   RESET 1 - 4
===================================================== */

const adminCommandBtn =
  document.getElementById(
    "adminCommandBtn"
  );


if (adminCommandBtn) {

  adminCommandBtn.onclick =
    async () => {

      const input =
        document.getElementById(
          "adminCommandInput"
        );


      const msg =
        document.getElementById(
          "adminCommandMessage"
        );


      const cmd =
        input.value
          .trim()
          .toLowerCase();


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


      /*
         MỞ KHÓA
         TỪ VÒNG RESET
      */

      state.lockedRounds =
        state.lockedRounds.filter(
          round =>
            round <
            targetRound
        );


      /*
         Reset lần 4
      */

      if (
        targetRound === 3
      ) {

        state.round4LockedQuestions =
          [];

      }


      saveState();


      await saveTeam({
        status:
          "playing"
      });


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

}x