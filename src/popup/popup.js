document.addEventListener("DOMContentLoaded", () => {
  loadCurrentMode();
  checkServerStatus();
  loadStats();

  // 모드 버튼 이벤트 리스너
  document.getElementById("modeOff").addEventListener("click", () => setMode(0));
  document.getElementById("modeLocal").addEventListener("click", () => setMode(1));
  document.getElementById("modeAI").addEventListener("click", () => setMode(2));
  
  // 설정 버튼
  document.getElementById("openSettings").addEventListener("click", openSettingsPage);
  
  // 3초마다 서버 상태 확인
  setInterval(checkServerStatus, 3000);

  // 🔄 **Storage 변경 감지 리스너 추가** 
  // Content script에서 배너 버튼 클릭시 popup도 동기화됨
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes['github-korean-mode']) {
      const newMode = changes['github-korean-mode'].newValue;
      if (newMode !== undefined) {
        console.log(`📨 Storage 변경 감지: 모드 ${newMode}`);
        updateModeDisplay(newMode);
      }
    }
  });
});

// 🔄 **Chrome Storage 사용으로 변경**
// 현재 모드 로드 (chrome.storage.local 사용)
async function loadCurrentMode() {
  try {
    const result = await chrome.storage.local.get(["github-korean-mode"]);
    const mode = result["github-korean-mode"] !== undefined ? parseInt(result["github-korean-mode"], 10) : 0;
    updateModeDisplay(mode);
    console.log(`📖 Popup 모드 로드: ${mode}`);
  } catch (error) {
    console.warn("모드 로드 실패:", error);
    // Fallback: localStorage 사용
    try {
      const saved = localStorage.getItem("github-korean-mode");
      const mode = saved !== null ? parseInt(saved, 10) : 0;
      updateModeDisplay(mode);
    } catch (fallbackError) {
      console.warn("Fallback 로드도 실패:", fallbackError);
      updateModeDisplay(0); // 기본값 (OFF)
    }
  }
}

// 🔄 **모드 설정 함수 수정**
async function setMode(mode) {
  try {
    // Chrome Storage에 저장
    await chrome.storage.local.set({ "github-korean-mode": mode });
    
    // 즉시 디스플레이 업데이트
    updateModeDisplay(mode);
    
    // 시각적 피드백
    const buttons = [
      document.getElementById("modeOff"),
      document.getElementById("modeLocal"),
      document.getElementById("modeAI")
    ];
    
    if (buttons[mode]) {
      buttons[mode].style.transform = "scale(0.95)";
      setTimeout(() => {
        buttons[mode].style.transform = "scale(1)";
      }, 150);
    }
    
    console.log(`🔄 Popup에서 번역 모드 변경: ${["OFF", "LOCAL", "AI"][mode]}`);
    
    // 🔄 **Content Script에 메시지 전송 (기존 코드 유지)**
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "modeChanged",
          mode: mode
        }).catch((error) => {
          // 메시지 전송 실패는 무시 (페이지가 GitHub이 아닐 수 있음)
          console.log("Content script 메시지 전송 실패 (정상):", error.message);
        });
      }
    });
    
  } catch (error) {
    console.warn("모드 설정 실패:", error);
    // Fallback: localStorage 사용
    try {
      localStorage.setItem("github-korean-mode", mode.toString());
      updateModeDisplay(mode);
    } catch (fallbackError) {
      console.warn("Fallback 저장도 실패:", fallbackError);
    }
  }
}

// 모드 디스플레이 업데이트
function updateModeDisplay(mode) {
  const buttons = [
    document.getElementById("modeOff"),
    document.getElementById("modeLocal"),
    document.getElementById("modeAI")
  ];
  
  const modeNames = ["완전 중지", "로컬 사전", "AI 번역"];
  const titles = ["😴 번역 완전 중지", "📚 로컬 사전만", "🤖 AI + 로컬"];
  
  // 모든 버튼 비활성화
  buttons.forEach(btn => {
    if (btn) btn.classList.remove("active");
  });
  
  // 현재 모드 버튼 활성화
  if (buttons[mode]) {
    buttons[mode].classList.add("active");
  }
  
  // 현재 모드 텍스트 업데이트
  const currentModeElement = document.getElementById("currentMode");
  const popupTitleElement = document.getElementById("popupTitle");
  
  if (currentModeElement) {
    currentModeElement.textContent = modeNames[mode] || "알 수 없음";
  }
  
  if (popupTitleElement) {
    popupTitleElement.textContent = titles[mode] || "🚀 GitHub 한글화";
  }
}

// 서버 상태 확인
async function checkServerStatus() {
  const serverText = document.getElementById("serverText");
  const serverDot = document.getElementById("serverDot");
  
  if (!serverText || !serverDot) return;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch("http://localhost:5001/health", {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      serverText.textContent = "연결됨";
      serverDot.classList.remove("inactive");
      
      // AI 상태 추가 표시
      if (data.ai_ready) {
        serverText.textContent = "AI 서버 연결됨";
      }
    } else {
      serverText.textContent = `오류 (${response.status})`;
      serverDot.classList.add("inactive");
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      serverText.textContent = "연결 타임아웃";
    } else {
      serverText.textContent = "연결 실패";
    }
    serverDot.classList.add("inactive");
  }
}

// 🔄 **통계 로드 함수 수정**
async function loadStats() {
  try {
    // Chrome Storage 사용
    const result = await chrome.storage.local.get(["userGlossary"]);
    const customWords = Object.keys(result.userGlossary || {}).length;
    
    const customWordsElement = document.getElementById("customWordsCount");
    if (customWordsElement) {
      customWordsElement.textContent = `${customWords}개`;
    }
  } catch (error) {
    console.warn("통계 로드 실패:", error);
    // Fallback: 기본값 설정
    const customWordsElement = document.getElementById("customWordsCount");
    if (customWordsElement) {
      customWordsElement.textContent = "0개";
    }
  }
}

// 설정 페이지 열기
function openSettingsPage() {
  try {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/options/options.html") });
    window.close();
  } catch (error) {
    console.warn("설정 페이지 열기 실패:", error);
  }
}