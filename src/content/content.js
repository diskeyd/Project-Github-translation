(function () {
  "use strict";

  // 전역 변수들 (3단계 모드)
  let translationMode = 0; // 0=OFF(완전중지), 1=LOCAL(로컬사전), 2=AI(AI+로컬)
  let translationCache = {}; // 번역 캐시
  let userGlossary = {}; // 사용자 정의 단어 사전
  let observer = null; // DOM 변경 감지자
  let banner = null; // 상태 배너
  let toggleButton = null; // 토글 버튼
  let statusText = null; // 상태 텍스트
  let statusIndicator = null; // 상태 아이콘
  let serverUrl = "http://localhost:5001";
  let serverConnected = false;

  // 원본 텍스트 저장을 위한 WeakMap
  let originalTextMap = new WeakMap();
  let translatedNodes = new Set(); // 번역된 노드들 추적

  // 🔄 **상태 동기화 기능 추가**
  // Chrome 확장프로그램 메시지 리스너 (popup으로부터 메시지 수신)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "modeChanged") {
      console.log(`📨 Popup에서 모드 변경 메시지 수신: ${message.mode}`);
      
      // 모드 변경 적용
      translationMode = message.mode;
      updateBannerStatus();
      
      // 모드에 따른 동작 수행
      if (translationMode === 0) {
        // OFF 모드: 모든 번역 텍스트를 원본으로 복구
        restoreOriginalTexts();
        if (observer) {
          observer.disconnect();
        }
      } else if (translationMode === 1) {
        // LOCAL 모드: 원본 복구 후 사전만 사용해서 재번역
        restoreOriginalTexts();
        setTimeout(() => {
          console.log("📚 LOCAL 모드: 사전만 사용하여 번역 시작");
          restartTranslation();
        }, 100);
      } else {
        // AI 모드: 번역 재시작
        restartTranslation();
      }
      
      sendResponse({ success: true });
    }
    
    return true; // 비동기 응답을 위해 true 반환
  });

  // 🔄 **Popup에 상태 변경 알림 함수**
  function notifyPopup(mode) {
    try {
      // 현재 활성 탭에 메시지 전송하지 않음 (popup이 닫힐 수 있음)
      // 대신 storage 업데이트로만 동기화
      console.log(`📤 배너에서 모드 변경: ${["OFF", "LOCAL", "AI"][mode]}`);
    } catch (error) {
      console.warn("Popup 알림 실패:", error);
    }
  }

  // 안전한 AbortController 생성 함수
  function createAbortController(timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    // cleanup 함수 추가
    controller.signal.addEventListener("abort", () => {
      clearTimeout(timeoutId);
    });

    return controller;
  }

  // 배너 상태 업데이트 함수 (3단계 모드)
  function updateBannerStatus() {
    const modes = ["OFF", "LOCAL", "AI"];
    toggleButton.innerText = modes[translationMode];

    if (translationMode === 0) {
      // OFF 모드
      banner.className = "github-korean-banner mode-off";
      statusText.innerText = "번역 중지";
      statusIndicator.innerText = "😴";
      statusIndicator.title = "번역 기능 완전 비활성화";
    } else if (translationMode === 1) {
      // LOCAL 모드
      banner.className = "github-korean-banner mode-local";
      statusText.innerText = "로컬 사전";
      statusIndicator.innerText = "📚";
      statusIndicator.title = "로컬 사전만 사용하여 번역";
    } else if (translationMode === 2) {
      // AI 모드
      banner.className = "github-korean-banner mode-ai";
      if (serverConnected) {
        statusText.innerText = "AI 번역";
        statusIndicator.innerText = "🤖";
        statusIndicator.title = "Google AI + 로컬 사전 번역";
      } else {
        statusText.innerText = "로컬 사전";
        statusIndicator.innerText = "📚";
        statusIndicator.title = "AI 서버 연결 실패 - 로컬 사전으로 fallback";
      }
    }
  }

  // 🔄 **Chrome Storage 사용으로 변경**
  // 설정 저장 (chrome.storage.local 사용)
  async function saveSettings() {
    try {
      await chrome.storage.local.set({ 
        "github-korean-mode": translationMode 
      });
      console.log(`💾 설정 저장: 모드 ${translationMode}`);
    } catch (error) {
      console.warn("설정 저장 실패:", error);
      // Fallback: localStorage 사용
      try {
        localStorage.setItem("github-korean-mode", translationMode.toString());
      } catch (fallbackError) {
        console.warn("Fallback 저장도 실패:", fallbackError);
      }
    }
  }

  // 📚 **사용자 정의 단어 로드**
  async function loadUserGlossary() {
    try {
      const result = await chrome.storage.local.get(["userGlossary"]);
      if (result.userGlossary && typeof result.userGlossary === "object") {
        userGlossary = result.userGlossary;
        console.log(`📚 사용자 정의 단어 로드: ${Object.keys(userGlossary).length}개`);
        
        // 로드된 단어들 출력 (디버깅용)
        Object.entries(userGlossary).forEach(([english, korean]) => {
          console.log(`📝 사용자 단어: "${english}" → "${korean}"`);
        });
      } else {
        userGlossary = {};
        console.log("📚 사용자 정의 단어 없음");
      }
    } catch (error) {
      console.warn("사용자 정의 단어 로드 실패:", error);
      userGlossary = {};
    }
  }

  // 설정 로드 (chrome.storage.local 사용)
  async function loadSettings() {
    try {
      const result = await chrome.storage.local.get(["github-korean-mode"]);
      if (result["github-korean-mode"] !== undefined) {
        translationMode = parseInt(result["github-korean-mode"], 10);
        if (![0, 1, 2].includes(translationMode)) {
          translationMode = 0; // 기본값 (OFF)
        }
      }
      console.log(`📖 설정 로드: 모드 ${translationMode}`);
    } catch (error) {
      console.warn("설정 로드 실패:", error);
      // Fallback: localStorage 사용
      try {
        const saved = localStorage.getItem("github-korean-mode");
        if (saved !== null) {
          translationMode = parseInt(saved, 10);
          if (![0, 1, 2].includes(translationMode)) {
            translationMode = 0; // 기본값 (OFF)
          }
        }
      } catch (fallbackError) {
        console.warn("Fallback 로드도 실패:", fallbackError);
        translationMode = 0; // 기본값 (OFF)
      }
    }
  }

  // CSS 스타일 추가
  function addStyles() {
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
      .github-korean-banner {
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
        font-size: 11px;
        font-weight: 500;
        padding: 6px 16px;
        border-radius: 20px;
        backdrop-filter: blur(12px) saturate(150%);
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        white-space: nowrap;
        border: 1px solid rgba(255, 255, 255, 0.15);
        user-select: none;
        animation: slideDown 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.05);
      }

      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(-20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0) scale(1);
        }
      }

      .github-korean-banner:hover {
        transform: translateX(-50%) translateY(-2px) scale(1.02);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
      }

      .mode-off {
        background: linear-gradient(135deg, rgba(88, 28, 135, 0.9) 0%, rgba(59, 7, 100, 0.9) 100%);
        color: #faf5ff;
        opacity: 0.75;
        backdrop-filter: blur(8px) saturate(120%);
      }

      .mode-local {
        background: linear-gradient(135deg, rgba(236, 72, 153, 0.9) 0%, rgba(219, 39, 119, 0.9) 100%);
        color: #fdf2f8;
      }

      .mode-ai {
        background: linear-gradient(135deg, rgba(34, 197, 94, 0.9) 0%, rgba(21, 128, 61, 0.9) 100%);
        color: #f0fdf4;
      }

      .banner-content {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .status-indicator {
        font-size: 14px;
        animation: pulse 2s infinite;
        filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.25));
      }

      @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.8; }
      }

      .status-text {
        font-weight: 600;
        font-size: 11px;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
      }

      .toggle-button {
        padding: 4px 12px;
        border: 1px solid rgba(255, 255, 255, 0.35);
        background: rgba(255, 255, 255, 0.12);
        color: inherit;
        border-radius: 12px;
        cursor: pointer;
        font-size: 10px;
        font-weight: 700;
        min-width: 50px;
        transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        backdrop-filter: blur(6px);
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
      }

      .toggle-button:hover {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.5);
        transform: scale(1.05) translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .toggle-button:active {
        transform: scale(0.97) translateY(0);
      }

      .mode-off .toggle-button {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.15);
      }

      .mode-off .status-indicator {
        animation: none;
        opacity: 0.6;
      }
    `;
    document.head.appendChild(styleSheet);
  }

  // 상태 배너 생성
  function createBanner() {
    addStyles(); // CSS 먼저 추가

    banner = document.createElement("div");
    banner.className = "github-korean-banner";
    banner.innerHTML = `
      <div class="banner-content">
        <span class="status-indicator">😴</span>
        <span class="status-text">번역 중지</span>
        <button class="toggle-button">OFF</button>
      </div>
    `;

    document.body.appendChild(banner);

    // 참조 저장
    statusIndicator = banner.querySelector(".status-indicator");
    statusText = banner.querySelector(".status-text");
    toggleButton = banner.querySelector(".toggle-button");

    // 🔄 **토글 버튼 이벤트 수정 (동기화 추가)**
    toggleButton.addEventListener("click", async () => {
      translationMode = (translationMode + 1) % 3;
      
      // Storage 저장
      await saveSettings();
      
      // 배너 상태 업데이트
      updateBannerStatus();
      
      // Popup에 알림
      notifyPopup(translationMode);

      if (translationMode === 0) {
        // OFF 모드: 모든 번역 텍스트를 원본으로 복구
        restoreOriginalTexts();
        if (observer) {
          observer.disconnect();
        }
      } else if (translationMode === 1) {
        // LOCAL 모드: 원본 복구 후 사전만 사용해서 재번역
        restoreOriginalTexts();
        setTimeout(() => {
          console.log("📚 LOCAL 모드: 사전만 사용하여 번역 시작");
          restartTranslation();
        }, 100);
      } else {
        // AI 모드: 번역 재시작
        restartTranslation();
      }

      console.log(
        `🔄 배너에서 번역 모드 변경: ${["OFF", "LOCAL", "AI"][translationMode]}`
      );
    });

    updateBannerStatus();
  }

  // 원본 텍스트 복구 함수
  function restoreOriginalTexts() {
    console.log("🔄 원본 텍스트 복구 시작...");
    let restoredCount = 0;

    translatedNodes.forEach((node) => {
      try {
        if (
          node &&
          node.nodeType === Node.TEXT_NODE &&
          originalTextMap.has(node)
        ) {
          const originalText = originalTextMap.get(node);
          if (node.nodeValue !== originalText) {
            node.nodeValue = originalText;
            restoredCount++;
          }
        }
      } catch (error) {
        console.warn("텍스트 복구 중 오류:", error);
      }
    });

    console.log(`✅ ${restoredCount}개 텍스트 원본 복구 완료`);
    translatedNodes.clear();
  }

  // 번역 재시작
  function restartTranslation() {
    // 기존 observer 정지
    if (observer) {
      observer.disconnect();
    }

    // 페이지 다시 스캔
    setTimeout(() => {
      if (translationMode > 0) {
        scanPage();
        repeatedlyScanPage();
      }
    }, 100);
  }

  // 번역 대상 텍스트 필터링
  function shouldTranslate(text) {
    if (!text || typeof text !== "string") return false;

    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed.length > 200) return false;

    // 한글이 포함된 텍스트는 번역 대상이 아님
    if (/[가-힣]/.test(trimmed)) return false;

    // 숫자만 있는 텍스트는 번역 대상이 아님
    if (/^\d+[\d\s,.-]*$/.test(trimmed)) return false;

    // 특수 문자만 있는 텍스트는 번역 대상이 아님
    if (/^[^\w\s]+$/.test(trimmed)) return false;

    return true;
  }

  // 강화된 서버 연결 상태 확인
  async function checkServerConnection() {
    const controller = createAbortController(3000);

    try {
      const response = await fetch(`${serverUrl}/health`, {
        method: "GET",
        signal: controller.signal,
      });

      if (response.ok) {
        serverConnected = true;
        console.log("✅ AI 서버 연결 성공");
      } else {
        serverConnected = false;
        console.log(`❌ AI 서버 연결 실패: HTTP ${response.status}`);
      }
    } catch (error) {
      serverConnected = false;

      if (error.name === "AbortError") {
        console.log("❌ AI 서버 연결 타임아웃");
      } else if (error.name === "TypeError") {
        console.log("❌ AI 서버 네트워크 오류 (서버 꺼짐 또는 CORS)");
      } else {
        console.log(`❌ AI 서버 연결 실패: ${error.message}`);
      }
    }

    updateBannerStatus();
  }

  // 강화된 AI 번역 함수
  async function translateWithAI(text) {
    // 로컬 캐시 확인
    if (translationCache[text]) {
      return translationCache[text];
    }

    const controller = createAbortController(15000);

    try {
      const response = await fetch(`${serverUrl}/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: text }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `서버 응답 오류: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();

      if (result.success && result.translated !== text) {
        // 캐시에 저장
        translationCache[text] = result.translated;
        saveTranslationCache();

        console.log(`🤖 AI 번역: "${text}" → "${result.translated}"`);
        return result.translated;
      }
    } catch (error) {
      if (error.name === "AbortError") {
        console.log(`⏱️ AI 번역 타임아웃: "${text}" (정상 동작)`);
      } else if (error.name === "TypeError") {
        console.log(`🔌 AI 서버 연결 문제: "${text}"`);
        serverConnected = false;
        updateBannerStatus();
      } else {
        console.log(`⚠️ AI 번역 실패: "${text}" - ${error.message}`);
      }
      throw error; // 에러를 다시 던져서 fallback 처리
    }

    return text;
  }

  // 로컬 번역 (사전 기반) - LOCAL 모드에서는 엄격하게 제한
  function translateLocally(text, strictMode = false) {
    const basicDictionary = {
      // GitHub 핵심 용어
      repository: "저장소",
      repositories: "저장소들",
      issue: "이슈",
      issues: "이슈들",
      "pull request": "풀 리퀘스트",
      "pull requests": "풀 리퀘스트들",
      commit: "커밋",
      commits: "커밋들",
      branch: "브랜치",
      branches: "브랜치들",
      merge: "병합",
      fork: "포크",
      clone: "복제",
      star: "스타",
      stars: "스타들",
      starred: "스타함",
      watch: "관찰",
      unwatch: "관찰 해제",
      follow: "팔로우",
      unfollow: "언팔로우",

      // UI 기본 요소들
      home: "홈",
      search: "검색",
      clear: "지우기",
      loading: "로딩 중",
      privacy: "개인정보",
      terms: "약관",
      status: "상태",
      help: "도움말",
      about: "정보",
      contact: "연락처",
      blog: "블로그",
      explore: "탐색",
      marketplace: "마켓플레이스",
      copilot: "코파일럿",
      codespaces: "코드스페이스",
      navigation: "네비게이션",
      command: "명령",
      palette: "팔레트",
      feedback: "피드백",
      provide: "제공",
      give: "주기",
      submit: "제출",
      suggestions: "제안",
      syntax: "문법",
      tips: "팁",
      saved: "저장된",
      searches: "검색들",
      type: "타입",
      "to search": "검색하기",

      // 동작 관련
      create: "생성",
      edit: "편집",
      delete: "삭제",
      remove: "제거",
      add: "추가",
      update: "업데이트",
      upload: "업로드",
      download: "다운로드",
      save: "저장",
      cancel: "취소",
      confirm: "확인",
      apply: "적용",
      ok: "확인",
      yes: "예",
      no: "아니오",
      close: "닫기",
      open: "열기",

      // 자주 나오는 문구들
      "skip to content": "콘텐츠로 건너뛰기",
      "command palette": "명령 팔레트",
      "give feedback": "피드백 제공",
      "provide feedback": "피드백 제공",
      "submit feedback": "피드백 제출",
      "saved searches": "저장된 검색",
      "search syntax tips": "검색 문법 팁",
      "global navigation": "전역 네비게이션",
      "navigation menu": "네비게이션 메뉴",
      "there was an error": "오류가 발생했습니다",
      "while loading": "로딩 중에",
      "0 suggestions": "0개 제안",
      "uh oh": "앗",
      dashboard: "대시보드",
    };

    // 🔥 **사용자 정의 단어를 최우선으로 확인**
    const textLower = text.toLowerCase().trim();
    
    // 1순위: 사용자 정의 단어 (정확한 매칭)
    for (const [english, korean] of Object.entries(userGlossary)) {
      if (textLower === english.toLowerCase()) {
        console.log(`👤 사용자 정의: "${text}" → "${korean}"`);
        return korean;
      }
    }
    
    // 2순위: 사용자 정의 단어 (부분 매칭, strict 모드가 아닐 때만)
    if (!strictMode) {
      for (const [english, korean] of Object.entries(userGlossary).sort(
        (a, b) => b[0].length - a[0].length // 긴 단어 우선
      )) {
        const pattern = new RegExp(
          `\\b${english.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          "gi"
        );
        if (pattern.test(text)) {
          const translated = text.replace(pattern, korean);
          if (translated !== text) {
            console.log(`👤 사용자 정의 (부분): "${text}" → "${translated}"`);
            return translated;
          }
        }
      }
    }

    if (strictMode) {
      // LOCAL 모드: 정확한 매칭만 허용 (기본 사전)
      for (const [english, korean] of Object.entries(basicDictionary)) {
        if (textLower === english.toLowerCase()) {
          return korean;
        }
      }
      return text; // 사전에 없으면 원본 반환
    } else {
      // AI 모드: 기존 부분 매칭 허용 (기본 사전)
      let translated = text;

      // 정확한 매칭 우선 (기본 사전)
      for (const [english, korean] of Object.entries(basicDictionary)) {
        if (textLower === english.toLowerCase()) {
          return korean;
        }
      }

      // 부분 매칭 (긴 구문 우선, 기본 사전)
      for (const [english, korean] of Object.entries(basicDictionary).sort(
        (a, b) => b[0].length - a[0].length
      )) {
        const pattern = new RegExp(
          `\\b${english.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          "gi"
        );
        if (pattern.test(translated)) {
          translated = translated.replace(pattern, korean);
        }
      }

      return translated;
    }
  }

  // 통합 번역 함수 (모드에 따라 다른 처리)
  async function translateText(text) {
    if (translationMode === 0) {
      // OFF 모드: 번역하지 않음
      return text;
    } else if (translationMode === 1) {
      // LOCAL 모드: 로컬 사전만 사용 (엄격 모드)
      const translated = translateLocally(text, true);
      if (translated !== text) {
        console.log(`📚 로컬 번역: "${text}" → "${translated}"`);
      }
      return translated;
    } else if (translationMode === 2) {
      // AI 모드: AI 시도 → 실패시 로컬 fallback
      if (serverConnected) {
        try {
          return await translateWithAI(text);
        } catch (error) {
          // AI 실패시 로컬 번역으로 fallback
          const translated = translateLocally(text, false);
          if (translated !== text) {
            console.log(`📚 AI 실패 → 로컬 번역: "${text}" → "${translated}"`);
          }
          return translated;
        }
      } else {
        // 서버 연결 안됨 → 로컬 번역
        const translated = translateLocally(text, false);
        if (translated !== text) {
          console.log(
            `📚 서버 미연결 → 로컬 번역: "${text}" → "${translated}"`
          );
        }
        return translated;
      }
    }

    return text;
  }

  // 강화된 배치 번역 함수
  async function batchTranslate(texts) {
    if (texts.length === 0) return texts;

    if (translationMode === 0) {
      // OFF 모드: 번역하지 않음
      return texts;
    } else if (translationMode === 1) {
      // LOCAL 모드: 모든 텍스트를 로컬로 번역 (엄격 모드)
      return texts.map((text) => translateLocally(text, true));
    } else if (translationMode === 2 && serverConnected) {
      // AI 모드 + 서버 연결됨: AI 배치 번역 시도
      const controller = createAbortController(20000);

      try {
        const response = await fetch(`${serverUrl}/batch-translate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ texts: texts }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `배치 번역 실패: ${response.status} ${response.statusText}`
          );
        }

        const result = await response.json();

        if (result.success) {
          // 번역 결과를 캐시에 저장
          result.results.forEach((item, index) => {
            if (item.success && item.translated !== texts[index]) {
              translationCache[texts[index]] = item.translated;
            }
          });
          saveTranslationCache();

          return result.results.map((item, index) =>
            item.success
              ? item.translated
              : translateLocally(texts[index], false)
          );
        }
      } catch (error) {
        if (error.name === "AbortError") {
          console.log("⏱️ AI 배치 번역 타임아웃 (정상 동작)");
        } else if (error.name === "TypeError") {
          console.log("🔌 AI 서버 연결 문제 - 로컬 번역으로 전환");
          serverConnected = false;
          updateBannerStatus();
        } else {
          console.log(`⚠️ AI 배치 번역 실패: ${error.message}`);
        }
      }
    }

    // AI 실패 또는 로컬 모드: 로컬 번역 사용
    return texts.map((text) => translateLocally(text, translationMode === 1));
  }

  // 번역 캐시 저장
  function saveTranslationCache() {
    try {
      const cacheEntries = Object.entries(translationCache);
      if (cacheEntries.length > 1000) {
        // 캐시 크기 제한
        const limitedCache = Object.fromEntries(cacheEntries.slice(-1000));
        translationCache = limitedCache;
      }
      localStorage.setItem(
        "github-korean-cache",
        JSON.stringify(translationCache)
      );
    } catch (error) {
      console.warn("번역 캐시 저장 실패:", error);
    }
  }

  // 번역 캐시 로드
  function loadTranslationCache() {
    try {
      const cached = localStorage.getItem("github-korean-cache");
      if (cached) {
        translationCache = JSON.parse(cached);
        console.log(
          `🔄 번역 캐시 로드됨: ${Object.keys(translationCache).length}개 항목`
        );
      }
    } catch (error) {
      console.warn("번역 캐시 로드 실패:", error);
      translationCache = {};
    }
  }

  // 페이지 스캔 및 번역
  function scanPage() {
    if (translationMode === 0) return; // OFF 모드면 스캔하지 않음

    const textsToTranslate = [];
    const nodes = [];

    try {
      // TreeWalker로 텍스트 노드 탐색
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function (node) {
            if (!node.parentElement) return NodeFilter.FILTER_REJECT;

            const parent = node.parentElement;
            const tagName = parent.tagName.toLowerCase();

            // 제외할 태그들
            if (
              [
                "script",
                "style",
                "noscript",
                "textarea",
                "input",
                "code",
                "pre",
              ].includes(tagName)
            ) {
              return NodeFilter.FILTER_REJECT;
            }

            // 번역 대상 텍스트인지 확인
            if (shouldTranslate(node.nodeValue)) {
              return NodeFilter.FILTER_ACCEPT;
            }

            return NodeFilter.FILTER_REJECT;
          },
        }
      );

      let node;
      while ((node = walker.nextNode())) {
        const text = node.nodeValue.trim();

        // 원본 텍스트 저장 (처음 발견된 경우에만)
        if (!originalTextMap.has(node)) {
          originalTextMap.set(node, node.nodeValue);
        }

        if (translationMode === 1) {
          // LOCAL 모드: 캐시 무시하고 사전만 사용
          if (text) {
            textsToTranslate.push(text);
            nodes.push(node);
          }
        } else {
          // AI 모드: 캐시 사용
          if (text && !translationCache[text]) {
            textsToTranslate.push(text);
            nodes.push(node);
          } else if (text && translationCache[text]) {
            // 캐시된 번역 즉시 적용
            const translated = translationCache[text];
            if (translated !== text) {
              node.nodeValue = translated;
              translatedNodes.add(node);
            }
          }
        }
      }
    } catch (error) {
      console.warn("페이지 스캔 중 오류:", error);
      return;
    }

    if (translationMode === 1) {
      console.log(
        `📚 LOCAL 모드: ${textsToTranslate.length}개 텍스트 사전 번역 시도 (캐시 무시)`
      );
    } else {
      console.log(
        `🔍 번역 대상: ${textsToTranslate.length}개 텍스트 발견 (모드: ${
          ["OFF", "LOCAL", "AI"][translationMode]
        })`
      );
    }

    // 번역 실행
    if (textsToTranslate.length > 0) {
      if (
        translationMode === 2 &&
        serverConnected &&
        textsToTranslate.length > 5
      ) {
        // AI 모드 + 대량 텍스트: 배치 번역 사용
        batchTranslate(textsToTranslate)
          .then((translations) => {
            translations.forEach((translated, index) => {
              try {
                if (translated !== textsToTranslate[index] && nodes[index]) {
                  nodes[index].nodeValue = translated;
                  translatedNodes.add(nodes[index]);
                  console.log(
                    `🔄 배치 번역 적용: "${textsToTranslate[index]}" → "${translated}"`
                  );
                }
              } catch (error) {
                console.warn("배치 번역 적용 중 오류:", error);
              }
            });
          })
          .catch((error) => {
            console.warn("배치 번역 실행 중 오류:", error);
          });
      } else {
        // 개별 번역 (LOCAL 모드 또는 소량 텍스트)
        nodes.forEach(async (node, index) => {
          try {
            const original = textsToTranslate[index];
            const translated = await translateText(original);
            if (translated !== original && node) {
              node.nodeValue = translated;
              translatedNodes.add(node);
              console.log(`🔄 개별 번역 적용: "${original}" → "${translated}"`);
            }
          } catch (error) {
            console.warn("개별 번역 적용 중 오류:", error);
          }
        });
      }
    }
  }

  // 반복 스캔
  function repeatedlyScanPage() {
    if (translationMode === 0) return; // OFF 모드면 스캔하지 않음

    try {
      // DOM 변경 감지
      if (observer) {
        observer.disconnect();
      }

      observer = new MutationObserver((mutations) => {
        let shouldScan = false;

        mutations.forEach((mutation) => {
          if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
            for (let node of mutation.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                shouldScan = true;
                break;
              }
            }
          }
        });

        if (shouldScan) {
          setTimeout(scanPage, 100);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // 30초마다 서버 연결 상태 확인 (AI 모드일 때만)
      setInterval(() => {
        if (translationMode === 2 && !serverConnected) {
          console.log("🔄 AI 서버 재연결 시도 중...");
          checkServerConnection();
        }
      }, 30000);
    } catch (error) {
      console.warn("DOM 감지 설정 중 오류:", error);
    }
  }

  // Chrome Storage 변경 감지 (사용자 정의 단어 실시간 업데이트)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.userGlossary) {
      console.log("📝 사용자 정의 단어 변경 감지");
      loadUserGlossary();
    }
  });

  // 🔄 **초기화 함수 수정 (async로 변경)**
  async function initialize() {
    console.log("🚀 GitHub 한글화 확장프로그램 시작 (상태 동기화 버전)");

    try {
      // 설정 로드 (비동기)
      await loadSettings();
      await loadUserGlossary(); // 🔥 사용자 정의 단어 로드 추가
      loadTranslationCache();
      createBanner();

      // AI 서버 연결 확인 (AI 모드일 때만)
      if (translationMode === 2) {
        checkServerConnection();
      }

      // DOM 준비 후 스캔 시작
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
          setTimeout(() => {
            if (translationMode > 0) {
              scanPage();
              repeatedlyScanPage();
            }
          }, 500);
        });
      } else {
        setTimeout(() => {
          if (translationMode > 0) {
            scanPage();
            repeatedlyScanPage();
          }
        }, 500);
      }

      console.log("🔄 상태 동기화 활성화: 배너 ↔ 팝업 연동");
    } catch (error) {
      console.error("초기화 중 오류:", error);
    }
  }

  // 시작
  initialize();
})();