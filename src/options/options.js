// GitHub 한글화 확장프로그램 - 설정 페이지 (v2.1 - CSP 호환)

document.addEventListener("DOMContentLoaded", function () {
  console.log("🔧 GitHub 한글화 설정 페이지 v2.1 로드 (CSP 호환)");

  // DOM 요소들 (새 HTML 구조에 맞게)
  const elements = {
    // AI 서버 설정
    serverUrl: document.getElementById("serverUrl"),
    serverStatus: document.getElementById("serverStatus"),
    saveServerUrl: document.getElementById("saveServerUrl"),
    testServerConnection: document.getElementById("testServerConnection"),
    serverMessage: document.getElementById("serverMessage"),
    useOfflineMode: document.getElementById("useOfflineMode"),

    // 사용자 정의 단어
    englishWord: document.getElementById("englishWord"),
    koreanWord: document.getElementById("koreanWord"),
    addWord: document.getElementById("addWord"),
    wordsTableBody: document.getElementById("wordsTableBody"),

    // 서버 통계 (새 구조)
    serverRequests: document.getElementById("serverRequests"),
    serverSuccess: document.getElementById("serverSuccess"),
    serverUptime: document.getElementById("serverUptime"),
    serverStats: document.getElementById("serverStats"),

    // 번역 모드 및 기타
    currentModeDisplay: document.getElementById("currentModeDisplay"),
    clearCache: document.getElementById("clearCache"),
    resetSettings: document.getElementById("resetSettings"),

    // 빠른 작업
    exportSettings: document.getElementById("exportSettings"),
    importSettings: document.getElementById("importSettings"),
    openGitHub: document.getElementById("openGitHub"),
    importFileInput: document.getElementById("importFileInput"),
  };

  let currentServerUrl = "http://localhost:5001";

  // 안전한 요소 접근 함수
  function safeElement(element) {
    return element || { addEventListener: () => {}, click: () => {} };
  }

  // 설정 로드
  function loadSettings() {
    chrome.storage.local.get(
      [
        "serverUrl",
        "useOfflineMode", 
        "userGlossary",
        "github-korean-mode"
      ],
      function (result) {
        try {
          // AI 서버 설정
          if (result.serverUrl && elements.serverUrl) {
            elements.serverUrl.value = result.serverUrl;
            currentServerUrl = result.serverUrl;
          }
          if (elements.useOfflineMode) {
            elements.useOfflineMode.checked = result.useOfflineMode || false;
          }

          // 현재 번역 모드 표시
          const mode = result["github-korean-mode"] || 2;
          const modeNames = ["OFF (완전 중지)", "LOCAL (로컬 사전)", "AI (AI + 로컬)"];
          if (elements.currentModeDisplay) {
            elements.currentModeDisplay.textContent = `현재 모드: ${modeNames[mode]}`;
          }

          // 사용자 정의 단어 테이블 업데이트
          updateWordsTable(result.userGlossary || {});

          console.log("⚙️ 설정 로드 완료");
        } catch (error) {
          console.warn("설정 로드 중 오류:", error);
        }
      }
    );
  }

  // AI 서버 연결 테스트
  async function testServerConnection() {
    if (!elements.serverUrl) return;
    
    const url = elements.serverUrl.value.trim();
    if (!url) {
      showMessage("서버 주소를 입력해주세요.", "error");
      return;
    }

    updateServerStatus("testing", "연결 테스트 중...");

    try {
      // AbortController를 안전하게 생성
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${url}/health`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        updateServerStatus("connected", "연결 성공");
        showMessage(`✅ 서버 연결 성공: ${data.service || "AI 서버"}`, "success");

        // 서버 통계 로드
        loadServerStats();
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      updateServerStatus("disconnected", "연결 실패");
      const errorMsg = error.name === 'AbortError' ? '연결 타임아웃' : error.message;
      showMessage(`❌ 서버 연결 실패: ${errorMsg}`, "error");
    }
  }

  // 서버 통계 로드
  async function loadServerStats() {
    if (!elements.serverStats) return;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${currentServerUrl}/`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        
        if (elements.serverRequests) {
          elements.serverRequests.textContent = data.stats?.total_requests || 0;
        }
        if (elements.serverSuccess) {
          const successRate = data.stats?.successful_translations && data.stats?.total_requests 
            ? Math.round((data.stats.successful_translations / data.stats.total_requests) * 100)
            : 0;
          elements.serverSuccess.textContent = successRate + "%";
        }
        if (elements.serverUptime) {
          const uptime = data.uptime_seconds || 0;
          elements.serverUptime.textContent = Math.round(uptime) + "초";
        }
        
        elements.serverStats.style.display = "block";
      }
    } catch (error) {
      console.log("서버 통계 로드 실패:", error);
      if (elements.serverStats) {
        elements.serverStats.style.display = "none";
      }
    }
  }

  // 서버 상태 업데이트
  function updateServerStatus(status, message) {
    if (!elements.serverStatus) return;

    const statusElement = elements.serverStatus;
    statusElement.className = "status-badge";

    switch (status) {
      case "connected":
        statusElement.classList.add("status-connected");
        statusElement.textContent = "연결됨";
        break;
      case "disconnected":
        statusElement.classList.add("status-disconnected");
        statusElement.textContent = "미연결";
        break;
      case "testing":
        statusElement.classList.add("status-testing");
        statusElement.textContent = "테스트중";
        break;
    }
  }

  // 메시지 표시
  function showMessage(message, type = "info") {
    if (!elements.serverMessage) return;

    const messageDiv = elements.serverMessage;
    messageDiv.className = `server-message ${type}`;
    messageDiv.textContent = message;
    messageDiv.style.display = "block";

    setTimeout(() => {
      messageDiv.style.display = "none";
    }, 5000);
  }

  // 🔥 **CSP 호환 방식으로 수정된 사용자 정의 단어 테이블 업데이트**
  function updateWordsTable(userGlossary) {
    if (!elements.wordsTableBody) return;

    const tbody = elements.wordsTableBody;
    
    if (Object.keys(userGlossary).length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; color: #6b7280; padding: 40px;">
            아직 추가된 단어가 없습니다. 위의 폼을 사용해서 단어를 추가해보세요.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = "";
    Object.entries(userGlossary).forEach(([english, korean]) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(english)}</td>
        <td>${escapeHtml(korean)}</td>
        <td>
          <button class="btn btn-danger btn-small delete-word-btn" data-word="${escapeHtml(english)}">
            🗑️ 삭제
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });

    // 🔥 **이벤트 위임을 사용한 삭제 버튼 이벤트 리스너**
    tbody.removeEventListener('click', handleDeleteClick); // 중복 방지
    tbody.addEventListener('click', handleDeleteClick);
  }

  // 🔥 **CSP 호환 방식의 삭제 핸들러**
  function handleDeleteClick(event) {
    if (event.target.classList.contains('delete-word-btn')) {
      const englishWord = event.target.getAttribute('data-word');
      deleteWord(englishWord);
    }
  }

  // 🔥 **CSP 호환 방식으로 수정된 단어 삭제 함수**
  function deleteWord(english) {
    if (confirm(`"${english}" 단어를 삭제하시겠습니까?`)) {
      chrome.storage.local.get(["userGlossary"], function (result) {
        const userGlossary = result.userGlossary || {};
        delete userGlossary[english];

        chrome.storage.local.set({ userGlossary: userGlossary }, function () {
          updateWordsTable(userGlossary);
          showMessage(`"${english}" 단어가 삭제되었습니다.`, "success");
          console.log(`🗑️ 사용자 정의 단어 삭제: "${english}"`);
        });
      });
    }
  }

  // HTML 이스케이프
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // 캐시 초기화
  function clearCache() {
    if (confirm("번역 캐시를 모두 지우시겠습니까?")) {
      localStorage.removeItem("github-korean-cache");
      showMessage("번역 캐시가 초기화되었습니다.", "success");
    }
  }

  // 설정 초기화
  function resetSettings() {
    if (confirm("모든 설정을 초기화하시겠습니까? (사용자 단어도 모두 삭제됩니다)")) {
      chrome.storage.local.clear(() => {
        localStorage.clear();
        showMessage("모든 설정이 초기화되었습니다.", "success");
        setTimeout(() => {
          location.reload();
        }, 1000);
      });
    }
  }

  // 설정 내보내기
  function exportSettings() {
    chrome.storage.local.get(null, (result) => {
      const settings = {
        ...result,
        exportDate: new Date().toISOString(),
        version: "2.1"
      };
      
      const blob = new Blob([JSON.stringify(settings, null, 2)], {
        type: "application/json"
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `github-korean-settings-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      showMessage("설정이 내보내기되었습니다.", "success");
    });
  }

  // 설정 가져오기
  function importSettings() {
    if (elements.importFileInput) {
      elements.importFileInput.click();
    }
  }

  // === 이벤트 리스너들 (안전하게) ===

  // AI 서버 설정 저장
  safeElement(elements.saveServerUrl).addEventListener("click", function () {
    const url = elements.serverUrl?.value?.trim();
    const useOffline = elements.useOfflineMode?.checked;

    if (!url) {
      showMessage("서버 주소를 입력해주세요.", "error");
      return;
    }

    chrome.storage.local.set(
      {
        serverUrl: url,
        useOfflineMode: useOffline,
      },
      function () {
        currentServerUrl = url;
        showMessage("AI 서버 설정이 저장되었습니다.", "success");
      }
    );
  });

  // 서버 연결 테스트
  safeElement(elements.testServerConnection).addEventListener("click", testServerConnection);

  // 사용자 정의 단어 추가
  safeElement(elements.addWord).addEventListener("click", function () {
    const english = elements.englishWord?.value?.trim();
    const korean = elements.koreanWord?.value?.trim();

    if (!english || !korean) {
      showMessage("영어 단어와 한글 번역을 모두 입력해주세요.", "error");
      return;
    }

    chrome.storage.local.get(["userGlossary"], function (result) {
      const userGlossary = result.userGlossary || {};
      userGlossary[english] = korean;

      chrome.storage.local.set({ userGlossary: userGlossary }, function () {
        updateWordsTable(userGlossary);
        if (elements.englishWord) elements.englishWord.value = "";
        if (elements.koreanWord) elements.koreanWord.value = "";
        showMessage(`"${english}" → "${korean}" 단어가 추가되었습니다.`, "success");
        console.log(`➕ 사용자 정의 단어 추가: "${english}" → "${korean}"`);
      });
    });
  });

  // Enter 키로 단어 추가
  if (elements.koreanWord) {
    elements.koreanWord.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        safeElement(elements.addWord).click();
      }
    });
  }

  // 캐시 초기화
  safeElement(elements.clearCache).addEventListener("click", clearCache);

  // 설정 초기화  
  safeElement(elements.resetSettings).addEventListener("click", resetSettings);

  // 설정 내보내기
  safeElement(elements.exportSettings).addEventListener("click", exportSettings);

  // 설정 가져오기
  safeElement(elements.importSettings).addEventListener("click", importSettings);

  // GitHub 바로가기
  safeElement(elements.openGitHub).addEventListener("click", function () {
    chrome.tabs.create({ url: "https://github.com" });
  });

  // 파일 가져오기 처리
  if (elements.importFileInput) {
    elements.importFileInput.addEventListener("change", function (e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const settings = JSON.parse(e.target.result);
          chrome.storage.local.set(settings, () => {
            showMessage("설정이 가져오기되었습니다.", "success");
            setTimeout(() => location.reload(), 1000);
          });
        } catch (error) {
          showMessage("잘못된 설정 파일입니다.", "error");
        }
      };
      reader.readAsText(file);
    });
  }

  // 초기 설정 로드
  loadSettings();

  // 1초 후 서버 연결 상태 자동 확인
  setTimeout(() => {
    testServerConnection();
  }, 1000);

  console.log("✅ GitHub 한글화 설정 페이지 v2.1 초기화 완료 (CSP 호환)");
});