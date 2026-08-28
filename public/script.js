let currentTeamData = null;

let gameInitialized = false;
let handlingRemoteReset = false;

let lastResetVersion = null;

let gameStarted = false;
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
   CẤU HÌNH GAME
===================================================== */

/*
  SỐ HÀNG ĐOÁN

  10 hàng
*/
const MAX_ATTEMPTS = 10;


/*
  4 LẦN THỬ THÁCH

  Lần 1: 3 phút
  Lần 2: 5 phút
  Lần 3: 7 phút
  Lần 4: 10 phút
*/

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
      "DANHTHUCTIEMNANG",
      "TRITUETOITHUONG",
      "BONAOTUONGLAI",
      "KYNGUYENTRITUE",
      "TUDUYNHANTAO"
    ]
  },

  {
    round: 3,
    seconds: 420,

    words: [
      "KIENTAOTUONGLAI",
      "VUOTQUAGIOIHAN",
      "TRITHUCVOHAN",
      "KHOTRITHUCSO",
      "DINHCAOTRITHUC"
    ]
  },

  {
    round: 4,
    seconds: 600,

    words: [
      "KYNGUYENSO",
      "TRITUEMAY",
      "THOIDAIMOI",
      "KYNGUYENAI",
      "NAONHANTAO"
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
let isJoining = false;


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

  busy = false;

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
   LƯU FIREBASE
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

          state.selectedQuestion !== null &&
          state.selectedQuestion !== undefined

            ? state.selectedQuestion + 1

            : null,

        currentAttempt:
          state.guessRow + 1,

        lockedRounds:
          state.lockedRounds || [],

        round4LockedQuestions:
          state.round4LockedQuestions || [],

        lastActive:
          serverTimestamp(),

        ...extra

      }
    );

  }

  catch (error) {

    console.error(
      "Lỗi lưu Firebase:",
      error
    );

  }

}


/* =====================================================
   THEO DÕI ADMIN REALTIME
===================================================== */

/* =====================================================
   THEO DÕI ADMIN REALTIME
===================================================== */

let unsubscribeTeam = null;

/*
  Chống xử lý cùng một lệnh Admin nhiều lần
*/
let lastProcessedAdminActionId = null;

let isHandlingAdminAction = false;


function stopGameTimer() {

  if (timerInterval) {

    clearInterval(
      timerInterval
    );

    timerInterval = null;

  }

}


function resetGameInterface() {

  /*
    Dừng đồng hồ cũ
  */

  stopGameTimer();


  /*
    Reset dữ liệu nhập
  */

  currentInput = "";

  busy = false;


  /*
    Xóa bàn chơi
  */

  if (board) {

    board.innerHTML = "";

  }


  /*
    Xóa màu bàn phím
  */

  if (keyboard) {

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

}


/* =====================================================
   LẮNG NGHE DỮ LIỆU ADMIN
===================================================== */

function listenAdminActions() {

  if (!uid) {

    return;

  }


  /*
    Tránh tạo nhiều onSnapshot
  */

  if (unsubscribeTeam) {

    return;

  }


  unsubscribeTeam =
    onSnapshot(

      doc(
        db,
        "teams",
        uid
      ),

      async snapshot => {

        /*
          Đội đã bị Admin xóa
        */

        if (
          !snapshot.exists()
        ) {

          stopGameTimer();

          clearLocalGame();

          if (unsubscribeTeam) {

            unsubscribeTeam();

            unsubscribeTeam = null;

          }


          showScreen(
            joinScreen
          );

          return;

        }


        const data =
          snapshot.data();


        /*
          Không có lệnh Admin
        */

        if (
          !data.adminAction
        ) {

          return;

        }


        /*
          Tạo ID riêng cho lệnh
          để không xử lý lại nhiều lần
        */

        const actionId =
          `${data.adminAction}-${data.adminResetRound || ""}-${data.adminUnlockRound || ""}`;


        if (
          lastProcessedAdminActionId ===
          actionId
        ) {

          return;

        }


        if (
          isHandlingAdminAction
        ) {

          return;

        }


        isHandlingAdminAction =
          true;

        lastProcessedAdminActionId =
          actionId;


        /* ===============================================
           RESET THEO LẦN
        =============================================== */

        if (
          data.adminAction ===
          "reset"
        ) {

          const targetRoundNumber =
            Number(
              data.adminResetRound
            );


          /*
            Chỉ nhận lần 1 - 4
          */

          if (
            targetRoundNumber >= 1 &&
            targetRoundNumber <= 4
          ) {

            console.log(
              "ADMIN RESET ROUND:",
              targetRoundNumber
            );


            /*
              Dừng game hiện tại
            */

            resetGameInterface();


            /*
              Reset state
            */

            state.currentRound =
              targetRoundNumber - 1;

            state.selectedQuestion =
              null;

            state.guessRow =
              0;

            state.roundDeadline =
              null;

            state.status =
              "playing";


            /*
              MỞ KHÓA ĐÚNG LẦN ĐƯỢC RESET

              Không reset toàn bộ các lần khác
              để tránh phá tiến trình.
            */

            if (
              !Array.isArray(
                state.lockedRounds
              )
            ) {

              state.lockedRounds =
                [];

            }


            /*
              Xóa khóa của lần đang reset
            */

            state.lockedRounds =
              state.lockedRounds.filter(
                roundIndex =>
                  Number(
                    roundIndex
                  ) !==
                  targetRoundNumber - 1
              );


            /*
              Nếu reset lần 4
              mở lại các câu đã khóa của lần 4
            */

            if (
              targetRoundNumber === 4
            ) {

              state.round4LockedQuestions =
                [];

            }


            /*
              Lưu local
            */

            saveState();


            /*
              Xóa lệnh Admin trên Firestore.

              RẤT QUAN TRỌNG:
              nếu không xóa, refresh sẽ nhận lại
              lệnh reset và tiếp tục xử lý.
            */

            await updateDoc(

              doc(
                db,
                "teams",
                uid
              ),

              {

                status:
                  "playing",

                currentRound:
                  targetRoundNumber,

                selectedQuestion:
                  null,

                roundDeadline:
                  null,

                adminAction:
                  null,

                adminResetRound:
                  null,

                adminUnlockRound:
                  null,

                lastActive:
                  serverTimestamp()

              }

            );


            /*
              Chờ Firestore ổn định
              rồi chuyển về màn chọn lần
            */

            setTimeout(

              () => {

                showRoundSelection();

                isHandlingAdminAction =
                  false;

              },

              300

            );

            return;

          }

        }


        /* ===============================================
           MỞ KHÓA THEO LẦN
        =============================================== */

        if (
          data.adminAction ===
          "unlock"
        ) {

          const targetRoundNumber =
            Number(
              data.adminUnlockRound
            );


          if (
            targetRoundNumber >= 1 &&
            targetRoundNumber <= 4
          ) {

            console.log(
              "ADMIN UNLOCK ROUND:",
              targetRoundNumber
            );


            /*
              Nếu chưa có mảng khóa
            */

            if (
              !Array.isArray(
                state.lockedRounds
              )
            ) {

              state.lockedRounds =
                [];

            }


            /*
              Mở khóa đúng lần
            */

            state.lockedRounds =
              state.lockedRounds.filter(
                roundIndex =>
                  Number(
                    roundIndex
                  ) !==
                  targetRoundNumber - 1
              );


            /*
              Nếu mở khóa lần 4
              không bắt buộc mở toàn bộ câu,
              giữ lại trạng thái câu.
            */

            state.currentRound =
              targetRoundNumber - 1;

            state.status =
              "playing";


            saveState();


            /*
              Xóa lệnh Admin
            */

            await updateDoc(

              doc(
                db,
                "teams",
                uid
              ),

              {

                status:
                  "playing",

                currentRound:
                  targetRoundNumber,

                adminAction:
                  null,

                adminResetRound:
                  null,

                adminUnlockRound:
                  null,

                lastActive:
                  serverTimestamp()

              }

            );


            setTimeout(

              () => {

                showRoundSelection();

                isHandlingAdminAction =
                  false;

              },

              300

            );

            return;

          }

        }


        /*
          Nếu lệnh không hợp lệ
          vẫn mở khóa xử lý
        */

        isHandlingAdminAction =
          false;

      },

      error => {

        console.error(
          "Lỗi theo dõi đội:",
          error
        );

        isHandlingAdminAction =
          false;

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


  /*
    Chống bấm liên tục
  */

  if (isJoining) {

    return;

  }


  isJoining =
    true;


  joinBtn.disabled =
    true;


  joinMessage.textContent =
    "Đang khởi tạo đội chơi...";


  try {

    let user =
      auth.currentUser;


    /*
      Nếu chưa có Anonymous User
      thì tạo mới.
    */

    if (!user) {

      const credential =
        await signInAnonymously(
          auth
        );

      user =
        credential.user;

    }


    /*
      Lấy UID thật của Firebase
    */

    uid =
      user.uid;


    teamName =
      name;


    /*
      Khởi tạo trạng thái game
    */

    state = {

      currentRound:
        0,

      selectedQuestion:
        null,

      guessRow:
        0,

      status:
        "playing",

      lockedRounds:
        [],

      round4LockedQuestions:
        [],

      roundDeadline:
        null

    };


    /*
      Lưu Local Storage
    */

    localStorage.setItem(
      "aiWordleUid",
      uid
    );


    localStorage.setItem(
      "aiWordleTeamName",
      teamName
    );


    saveState();


    /*
      Tạo document đội trên Firestore
    */

    await setDoc(

      doc(
        db,
        "teams",
        uid
      ),

      {

        teamName:
          teamName,

        status:
          "playing",

        currentRound:
          1,

        currentQuestion:
          null,

        currentAttempt:
          1,

        lockedRounds:
          [],

        round4LockedQuestions:
          [],

        roundDeadline:
          null,

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

      },

      {
        merge:
          true
      }

    );


    /*
      Document đã tạo thành công.

      Bây giờ mới cho phép
      hệ thống restore / realtime hoạt động.
    */

    isJoining =
      false;


    /*
      Bật theo dõi Admin
    */

    listenAdminActions();


    /*
      Chuyển sang chọn Lần 1-4
    */

    showRoundSelection();


    joinMessage.textContent =
      "";


  }

  catch (error) {

    console.error(
      "LỖI KHỞI TẠO ĐỘI:",
      error
    );


    /*
      Hiển thị lỗi thật
      để biết Firebase đang lỗi gì
    */

    if (
      error.code ===
      "auth/operation-not-allowed"
    ) {

      joinMessage.textContent =
        "Firebase chưa bật Anonymous Authentication.";

    }

    else if (
      error.code ===
      "permission-denied"
    ) {

      joinMessage.textContent =
        "Firestore Rules đang chặn quyền tạo đội.";

    }

    else {

      joinMessage.textContent =
        `Không thể khởi tạo đội: ${error.message}`;

    }


    joinBtn.disabled =
      false;


    isJoining =
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


  questionRoundLabel.textContent =
    `LẦN ${roundIndex + 1}`;


  questionTime.textContent =
    `THỜI GIAN: ${formatTime(round.seconds)}`;


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


  teamDisplay.textContent =
    teamName;


  roundLabel.textContent =
    `LẦN ${roundIndex + 1}`;


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
    `HÃY DỰ ĐOÁN TỪ KHÓA - BẠN CÓ ${MAX_ATTEMPTS} LƯỢT`;


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
   BOARD
   TỰ ĐỘNG THEO ĐỘ DÀI ĐÁP ÁN
   10 HÀNG
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


  /*
    Lưu độ dài đáp án.

    CSS sẽ tự điều chỉnh kích thước
    theo 5 -> 20 ký tự.
  */

  board.dataset.length =
    wordLength;


  /*
    10 HÀNG DỰ ĐOÁN
  */

  for (
    let rowIndex = 0;
    rowIndex < MAX_ATTEMPTS;
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
      minmax(0, 1fr)

      Rất quan trọng:

      Giúp các ô tự co lại
      để vừa chiều rộng điện thoại.

      Không tạo thanh kéo ngang.
    */

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

      const letter =
        currentInput[index] || "";


      tile.textContent =
        letter;


      tile.classList.toggle(
        "filled",
        Boolean(letter)
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
    ).fill(
      "absent"
    );


  const answerLetters =
    answer.split("");


  const guessLetters =
    guess.split("");


  /*
    BƯỚC 1

    ĐÚNG KÝ TỰ
    ĐÚNG VỊ TRÍ
  */

  for (
    let i = 0;
    i < answer.length;
    i++
  ) {

    if (
      guessLetters[i] ===
      answerLetters[i]
    ) {

      result[i] =
        "correct";


      answerLetters[i] =
        null;


      guessLetters[i] =
        null;

    }

  }


  /*
    BƯỚC 2

    ĐÚNG KÝ TỰ
    SAI VỊ TRÍ
  */

  for (
    let i = 0;
    i < answer.length;
    i++
  ) {

    if (
      guessLetters[i] === null
    ) {

      continue;

    }


    const foundIndex =
      answerLetters.indexOf(
        guessLetters[i]
      );


    if (
      foundIndex !== -1
    ) {

      result[i] =
        "present";


      answerLetters[
        foundIndex
      ] =
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

    !state ||

    state.status !==
    "playing"

  ) {

    return;

  }


  const answer =
    getCurrentAnswer();


  if (!answer) {

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


  /*
    Luôn hiển thị chữ
    và đổi màu trực tiếp
    trên từng ô.
  */

  tiles.forEach(
    (tile, index) => {

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

          tile.classList.remove(

            "correct",

            "present",

            "absent"

          );


          tile.classList.add(
            colors[index]
          );


          tile.dataset.result =
            colors[index];


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

        index * 70

      );

    }

  );

}


/* =====================================================
   SAI 1 LƯỢT
===================================================== */

function handleWrongGuess() {

  /*
    Nếu đã dùng hết
    10 hàng dự đoán
  */

  if (
    state.guessRow >=
    MAX_ATTEMPTS - 1
  ) {

    handleFailure();

    return;

  }


  state.guessRow++;


  currentInput =
    "";


  busy =
    false;


  statusBanner.textContent =
    `LƯỢT ${state.guessRow + 1}/${MAX_ATTEMPTS}`;


  statusBanner.className =
    "status-banner";


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

  if (!state) {

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
    LẦN 1 -> 3

    Khóa lần hiện tại.
    Chuyển sang lần tiếp theo.
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

    KHÔNG KHÓA TOÀN BỘ LẦN 4.

    Chỉ khóa câu vừa chơi.
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


  if (!answer) {

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
      BTC đã xóa đội
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
      Đã hoàn thành
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

  }

  catch (error) {

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

    /*
      Firebase Authentication đã sẵn sàng
    */

    authReady =
      true;


    /*
      Nếu đang trong quá trình
      tạo đội mới bằng Anonymous Auth
      thì KHÔNG restore game.

      Nếu không, Auth callback có thể chạy
      trước khi setDoc() tạo đội trên Firestore.
    */

    if (isJoining) {

      return;

    }


    /*
      Chưa đăng nhập
    */

    if (!user) {

      showScreen(
        joinScreen
      );

      return;

    }


    /*
      Có user Firebase nhưng UID Local
      không khớp.

      Trường hợp Admin đã xóa đội
      hoặc Local Storage cũ.
    */

    if (
      uid &&
      uid !== user.uid
    ) {

      clearLocalGame();

      showScreen(
        joinScreen
      );

      return;

    }


    /*
      Chưa có game Local
      thì chỉ hiện màn nhập tên.

      Không tự xóa Anonymous User.
    */

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


    /*
      Đảm bảo UID đang sử dụng
      đúng với Firebase Auth hiện tại
    */

    uid =
      user.uid;


    /*
      Khôi phục game cũ
    */

    try {

      await restoreGame();

    }

    catch (error) {

      console.error(
        "Lỗi khôi phục game:",
        error
      );


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


/* =====================================================
   BÀN PHÍM GAME TRÊN MÀN HÌNH
===================================================== */

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


/* =====================================================
   BÀN PHÍM MÁY TÍNH
===================================================== */

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


      const targetRoundNumber =
  Number(
    match[1]
  );

const targetRound =
  targetRoundNumber - 1;


/*
  Dừng đồng hồ hiện tại
*/

stopGameTimer();


/*
  Reset game đang chơi
*/

currentInput =
  "";

busy =
  false;


/*
  Chuyển đúng lần được reset
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


/*
  MỞ KHÓA ĐÚNG LẦN ĐANG RESET
*/

if (
  !Array.isArray(
    state.lockedRounds
  )
) {

  state.lockedRounds =
    [];

}


state.lockedRounds =
  state.lockedRounds.filter(
    roundIndex =>
      Number(
        roundIndex
      ) !==
      targetRound
  );


/*
  Reset câu đã chọn
*/

if (
  targetRoundNumber === 4
) {

  state.round4LockedQuestions =
    [];

}


/*
  Reset giao diện
*/

resetGameInterface();


saveState();


await saveTeam({

  status:
    "playing",

  currentRound:
    targetRoundNumber,

  selectedQuestion:
    null,

  roundDeadline:
    null,

  adminAction:
    null,

  adminResetRound:
    null,

  adminUnlockRound:
    null

});


msg.textContent =
  `Đã reset Lần ${targetRoundNumber} và mở khóa Lần ${targetRoundNumber}.`;


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