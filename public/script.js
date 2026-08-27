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


/* =====================================================
   FIREBASE
===================================================== */

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);


/* =====================================================
   DỮ LIỆU GAME

   QUAN TRỌNG:

   currentRound trong GAME:

   0 = Lần 1
   1 = Lần 2
   2 = Lần 3
   3 = Lần 4

   Firebase lưu:

   1 = Lần 1
   2 = Lần 2
   3 = Lần 3
   4 = Lần 4
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

let unsubscribeTeam = null;


/* =====================================================
   TIỆN ÍCH
===================================================== */

function normalizeWord(text) {

  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/\s+/g, "")
    .toUpperCase();

}


function saveState() {

  if (!state) return;

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

  currentInput = "";

  clearInterval(
    timerInterval
  );

}


function formatTime(seconds) {

  const safeSeconds =
    Math.max(
      0,
      Math.ceil(seconds)
    );

  const minutes =
    Math.floor(
      safeSeconds / 60
    )
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

      item.classList.remove(
        "active"
      );

    }

  });

  if (screen) {

    screen.classList.add(
      "active"
    );

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

        /*
          Firebase hiển thị 1 - 4
        */

        currentRound:
          state.currentRound + 1,

        currentQuestion:
          state.selectedQuestion !== null &&
          state.selectedQuestion !== undefined
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
   THEO DÕI ADMIN REALTIME
===================================================== */

function listenAdminActions() {

  if (!uid) return;


  if (unsubscribeTeam) {

    unsubscribeTeam();

  }


  unsubscribeTeam =
    onSnapshot(

      doc(
        db,
        "teams",
        uid
      ),

      snapshot => {

        /*
          BTC XÓA ĐỘI
        */

        if (!snapshot.exists()) {

          clearLocalGame();

          location.reload();

          return;

        }


        const data =
          snapshot.data();


        /* ===============================================
           RESET THEO LẦN
        =============================================== */

        if (
          data.adminAction === "reset"
        ) {

          const targetRoundNumber =
            Number(
              data.adminResetRound
            );


          if (
            targetRoundNumber >= 1 &&
            targetRoundNumber <= 4
          ) {

            const targetRound =
              targetRoundNumber - 1;


            clearInterval(
              timerInterval
            );


            /*
              Chỉ xử lý khi Firebase
              yêu cầu một vòng khác
              hoặc state đang không đúng.
            */

            if (
              !state ||
              state.currentRound !== targetRound ||
              state.status === "finished"
            ) {

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

                /*
                  RESET TOÀN BỘ KHÓA
                */

                lockedRounds:
                  [],

                round4LockedQuestions:
                  []

              };


              currentInput = "";

              busy = false;

              saveState();


              alert(
                `BTC đã reset đội về Lần ${targetRoundNumber}.`
              );


              location.reload();

            }

          }

        }


        /* ===============================================
           MỞ KHÓA THEO LẦN
        =============================================== */

        if (
          data.adminAction === "unlock"
        ) {

          const targetRoundNumber =
            Number(
              data.adminUnlockRound
            );


          if (
            targetRoundNumber >= 1 &&
            targetRoundNumber <= 4
          ) {

            const targetRound =
              targetRoundNumber - 1;


            if (!state) {

              return;

            }


            let lockedRounds =
              Array.isArray(
                state.lockedRounds
              )
                ? [...state.lockedRounds]
                : [];


            /*
              XÓA VÒNG KHỎI DANH SÁCH KHÓA
            */

            lockedRounds =
              lockedRounds.filter(
                item =>
                  Number(item) !== targetRound
              );


            /*
              Chuyển game tới vòng
              BTC vừa mở khóa
            */

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

            state.lockedRounds =
              lockedRounds;


            /*
              Nếu mở Lần 4
              cho phép chọn lại câu.
            */

            if (
              targetRound === 3
            ) {

              state.round4LockedQuestions =
                [];

            }


            currentInput = "";

            busy = false;


            clearInterval(
              timerInterval
            );


            saveState();


            alert(
              `BTC đã mở khóa Lần ${targetRoundNumber}.`
            );


            location.reload();

          }

        }

      }

    );

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


  joinBtn.disabled =
    true;

  joinMessage.textContent =
    "Đang khởi tạo đội chơi...";


  try {

    let user =
      auth.currentUser;


    if (!user) {

      const credential =
        await signInAnonymously(
          auth
        );

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

      doc(
        db,
        "teams",
        uid
      ),

      {

        teamName,

        status:
          "playing",

        currentRound:
          1,

        currentQuestion:
          null,

        lockedRounds:
          [],

        round4LockedQuestions:
          [],

        adminAction:
          null,

        adminResetRound:
          null,

        adminUnlockRound:
          null,

        joinedAt:
          serverTimestamp(),

        lastActive:
          serverTimestamp()

      }

    );


    listenAdminActions();


    showRoundSelection();


  } catch (error) {

    console.error(
      error
    );


    joinMessage.textContent =
      "Không thể kết nối Firebase. Kiểm tra Authentication và Firestore Rules.";


    joinBtn.disabled =
      false;

  }

}


/* =====================================================
   HIỂN THỊ 4 LẦN
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


  if (roundTeamName) {

    roundTeamName.textContent =
      teamName;

  }


  roundList.innerHTML =
    "";


  ROUNDS.forEach(
    (round, index) => {

      const card =
        document.createElement(
          "div"
        );


      card.className =
        "round-card";


      const isLocked =
        Array.isArray(
          state.lockedRounds
        ) &&
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


      if (
        isCurrent &&
        !isLocked
      ) {

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

        card.addEventListener(
          "click",

          () => {

            showQuestionSelection(
              index
            );

          }

        );

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
    ROUNDS[
      roundIndex
    ];


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
        document.createElement(
          "div"
        );


      card.className =
        "question-card";


      /*
        LẦN 4:

        Chỉ khóa câu
        đã thất bại
      */

      const isLocked =

        roundIndex === 3 &&

        Array.isArray(
          state.round4LockedQuestions
        ) &&

        state.round4LockedQuestions.includes(
          index
        );


      if (isLocked) {

        card.classList.add(
          "locked"
        );

      }


      card.innerHTML = `

        <strong>
          CÂU ${index + 1}
        </strong>

        <span>
          ${
            isLocked
              ? "ĐÃ KHÓA"
              : "SẴN SÀNG"
          }
        </span>

      `;


      if (!isLocked) {

        card.addEventListener(

          "click",

          () => {

            startQuestion(
              roundIndex,
              index
            );

          }

        );

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
   LẤY ĐÁP ÁN
===================================================== */

function getCurrentAnswer() {

  if (
    !state ||
    state.selectedQuestion === null ||
    state.selectedQuestion === undefined
  ) {

    return "";

  }


  const answer =
    ROUNDS[
      state.currentRound
    ]?.words[
      state.selectedQuestion
    ];


  return normalizeWord(
    answer || ""
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
    !state ||
    roundIndex !==
    state.currentRound
  ) {

    return;

  }


  state.currentRound =
    roundIndex;

  state.selectedQuestion =
    questionIndex;


  if (!restoring) {

    state.guessRow =
      0;


    state.roundDeadline =

      Date.now() +

      (
        ROUNDS[
          roundIndex
        ].seconds * 1000
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
   PROGRESS 4 LẦN
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


  const tick = () => {

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


    if (
      remaining <= 0
    ) {

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
   BOARD TỰ ĐỘNG THEO ĐỘ DÀI ĐÁP ÁN
===================================================== */

function getTileSize(
  wordLength
) {

  if (
    wordLength <= 8
  ) {

    return 56;

  }


  if (
    wordLength <= 12
  ) {

    return 46;

  }


  if (
    wordLength <= 16
  ) {

    return 40;

  }


  return 34;

}


function buildBoard() {

  const answer =
    getCurrentAnswer();


  const wordLength =
    answer.length;


  board.innerHTML =
    "";


  if (
    !wordLength
  ) {

    return;

  }


  const tileSize =
    getTileSize(
      wordLength
    );


  /*
    Lưu độ dài để CSS
    hỗ trợ responsive
  */

  board.dataset.length =
    wordLength;


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


    /*
      Mỗi ô có kích thước
      theo độ dài đáp án.
    */

    row.style.gridTemplateColumns =
      `repeat(${wordLength}, ${tileSize}px)`;


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
        currentInput[index] || "";


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
        ]
          .find(
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


  const result =
    Array(
      answer.length
    )
      .fill(
        "absent"
      );


  const letterCount =
    {};


  /*
    Đếm ký tự đáp án
  */

  for (
    const letter of answer
  ) {

    letterCount[
      letter
    ] =
      (
        letterCount[
          letter
        ] || 0
      ) + 1;

  }


  /*
    BƯỚC 1

    ĐÚNG KÝ TỰ
    + ĐÚNG VỊ TRÍ
  */

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


  /*
    BƯỚC 2

    ĐÚNG KÝ TỰ
    NHƯNG SAI VỊ TRÍ
  */

  for (
    let i = 0;
    i < answer.length;
    i++
  ) {

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
      letterCount[
        letter
      ] > 0
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
    !answer
  ) {

    return;

  }


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


  const guess =
    normalizeWord(
      currentInput
    );


  const normalizedAnswer =
    normalizeWord(
      answer
    );


  const colors =
    colorGuess(
      guess,
      normalizedAnswer
    );


  const row =
    board.querySelector(
      `[data-row="${state.guessRow}"]`
    );


  if (!row) {

    return;

  }


  busy =
    true;


  const tiles =
    [...row.children];


  tiles.forEach(
    (tile, index) => {

      /*
        Luôn hiện chữ
      */

      tile.textContent =
        guess[index] || "";


      tile.classList.remove(

        "filled",
        "correct",
        "present",
        "absent"

      );


      tile.classList.add(
        "filled"
      );


      setTimeout(
        () => {

          /*
            XÓA CLASS CŨ
          */

          tile.classList.remove(

            "correct",
            "present",
            "absent"

          );


          /*
            THÊM MÀU
          */

          tile.classList.add(
            colors[index]
          );


          /*
            Backup để CSS
            luôn hiển thị màu
          */

          tile.dataset.result =
            colors[index];


          /*
            Ô cuối
          */

          if (
            index ===
            tiles.length - 1
          ) {

            updateKeyboard(
              guess,
              colors
            );


            if (
              guess ===
              normalizedAnswer
            ) {

              setTimeout(
                handleSuccess,
                350
              );

            }

            else {

              setTimeout(
                handleWrongGuess,
                350
              );

            }

          }

        },

        index * 100

      );

    }
  );

}


/* =====================================================
   SAI 1 LƯỢT
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


  state.roundDeadline =
    null;


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

  if (
    !state
  ) {

    return;

  }


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
    LẦN 1 → 3

    Khóa lần hiện tại
    rồi chuyển lần tiếp theo.
  */

  if (
    round < 3
  ) {

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


    currentInput =
      "";


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
    LẦN 4

    Chỉ khóa câu
    đang chơi.
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


  currentInput =
    "";


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
   BÀN PHÍM
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


  if (
    busy
  ) {

    return;

  }


  const answer =
    getCurrentAnswer();


  if (
    !answer
  ) {

    return;

  }


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
   KHÔI PHỤC GAME
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

    const teamRef =
      doc(
        db,
        "teams",
        uid
      );


    const teamSnap =
      await getDoc(
        teamRef
      );


    /*
      Admin đã xóa đội
    */

    if (
      !teamSnap.exists()
    ) {

      clearLocalGame();

      showScreen(
        joinScreen
      );

      return;

    }


    listenAdminActions();


    /*
      ĐÃ HOÀN THÀNH
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
      Đang chơi và còn thời gian
    */

    if (

      state.selectedQuestion !== null &&

      state.selectedQuestion !== undefined &&

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
      Refresh sau khi hết giờ
    */

    if (

      state.selectedQuestion !== null &&

      state.selectedQuestion !== undefined &&

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
   AUTH
===================================================== */

onAuthStateChanged(

  auth,

  async user => {

    authReady =
      true;


    if (!user) {

      showScreen(
        joinScreen
      );

      return;

    }


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


/*
  Bàn phím máy tính
*/

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

      event.preventDefault();


      handleKey(
        "BACK"
      );

    }

    else if (
      /^[a-zA-Z]$/.test(
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


      /*
        reset1 = index 0
        reset2 = index 1
        reset3 = index 2
        reset4 = index 3
      */

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
        RESET TOÀN BỘ KHÓA

        Điều này xử lý lỗi:

        Reset Lần 1
        nhưng Lần 1 vẫn bị khóa.
      */

      state.lockedRounds =
        [];


      state.round4LockedQuestions =
        [];


      currentInput =
        "";


      busy =
        false;


      saveState();


      await saveTeam({

        status:
          "playing",

        adminAction:
          null,

        adminResetRound:
          null,

        adminUnlockRound:
          null

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

        500

      );

    };

}


/* =====================================================
   CHỐNG DOUBLE TAP ZOOM
===================================================== */

let lastGameTouch =
  0;


document.addEventListener(

  "touchend",

  event => {

    const target =
      event.target;


    const isGameArea =
      target.closest(
        ".board, .keyboard, .game-main"
      );


    if (!isGameArea) {

      return;

    }


    const now =
      Date.now();


    if (
      now -
      lastGameTouch <
      280
    ) {

      event.preventDefault();

    }


    lastGameTouch =
      now;

  },

  {
    passive: false
  }

);