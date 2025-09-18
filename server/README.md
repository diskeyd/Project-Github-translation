# 🤖 Git-KR AI 번역 서버

> **Google Translate AI 기반 GitHub 한글화 번역 서버**

## 🚀 **빠른 시작**

### **Interactive Docker 방식 (추천)**
```bash
# 1. Docker 컨테이너 생성
docker run -it -p 5001:5001 --name git-kr-server \\
  -v $(pwd):/workspace python:3.12 /bin/bash

# 2. 컨테이너 내부에서
cd /workspace/server
pip install -r requirements.txt
python app.py
```

### **로컬 실행 방식**
```bash
# 의존성 설치
pip install -r requirements.txt

# 서버 실행
python app.py
# 또는
./start-server.sh  # Mac/Linux
start-server.bat   # Windows
```

---

## 📁 **파일 구조**

```
server/
├── 📄 app.py              # 메인 Flask 서버
├── 📄 requirements.txt    # Python 의존성
├── 📄 start-server.sh     # Linux/Mac 실행 스크립트
├── 📄 start-server.bat    # Windows 실행 스크립트
└── 📄 README.md          # 이 파일
```

---

## 🔧 **기술 스택**

- **Flask 2.3.3** - 웹 서버 프레임워크
- **Google Translate 4.0.0rc1** - AI 번역 엔진
- **Flask-CORS 4.0.0** - CORS 정책 관리
- **Python 3.12** - 런타임 환경

---

## 🌐 **API 엔드포인트**

### **1. 서버 상태 확인**
```http
GET /
GET /health
GET /model-status
```

### **2. 단일 번역**
```http
POST /translate
Content-Type: application/json

{
  "text": "Pull Request"
}
```

**응답 예시:**
```json
{
  "success": true,
  "original": "Pull Request",
  "translated": "풀 리퀘스트",
  "method": "google_ai_hybrid",
  "ai_used": true,
  "cached": false
}
```

### **3. 배치 번역**
```http
POST /batch-translate
Content-Type: application/json

{
  "texts": ["repository", "issue", "pull request"]
}
```

---

## 🧪 **테스트**

```bash
# 서버 상태 확인
curl http://localhost:5001
curl http://localhost:5001/health

# 단일 번역 테스트
curl -X POST http://localhost:5001/translate \\
  -H "Content-Type: application/json" \\
  -d '{"text": "repository"}'

# 배치 번역 테스트  
curl -X POST http://localhost:5001/batch-translate \\
  -H "Content-Type: application/json" \\
  -d '{"texts": ["issue", "star", "fork"]}'
```

---

## 🎯 **특징**

- 🤖 **Google Translate AI** + 📚 **GitHub 특화 사전**
- 🚀 **하이브리드 번역**: AI 실패 시 로컬 사전으로 fallback
- 💾 **메모리 캐시**: 빠른 번역 성능
- 🔒 **CORS 지원**: Chrome 확장프로그램 호환
- ⚡ **배치 처리**: 대량 텍스트 효율적 번역

---

## 📊 **성능**

- **응답 시간**: ~200ms (캐시 히트), ~1-2초 (AI 번역)
- **포트**: 5001
- **호스트**: 0.0.0.0 (모든 인터페이스)
- **동시 연결**: Flask 기본값

---

## 🔗 **연관 파일**

- **Chrome 확장프로그램**: `../src/`
- **프로젝트 전체 가이드**: `../README.md`
- **설정 파일**: `../manifest.json`