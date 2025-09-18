from flask import Flask, request, jsonify
from flask_cors import CORS
import re
import json
import time
from datetime import datetime
import logging

app = Flask(__name__)
CORS(app)

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GoogleTranslateAIEngine:
    def __init__(self):
        self.translator = None
        self.model_ready = False
        
        # GitHub 특화 사전 (Google 번역 후처리용)
        self.base_glossary = {
            "repository": "저장소", "repositories": "저장소들",
            "issue": "이슈", "issues": "이슈들",
            "pull request": "풀 리퀘스트", "pull requests": "풀 리퀘스트들",
            "commit": "커밋", "commits": "커밋들",
            "branch": "브랜치", "branches": "브랜치들",
            "merge": "병합", "fork": "포크", "clone": "복제",
            "star": "스타", "stars": "스타들", "starred": "스타함",
            "watch": "관찰", "unwatch": "관찰 해제",
            "follow": "팔로우", "unfollow": "언팔로우",
            "readme": "리드미", "license": "라이선스",
            "release": "릴리스", "releases": "릴리스들",
            "tag": "태그", "tags": "태그들",
            "workflow": "워크플로우", "workflows": "워크플로우들",
            "action": "액션", "actions": "액션들",
            "settings": "설정", "profile": "프로필",
            "dashboard": "대시보드", "file": "파일", "files": "파일들",
            "folder": "폴더", "folders": "폴더들",
            "project": "프로젝트", "projects": "프로젝트들",
            "code": "코드", "discussion": "토론", "discussions": "토론들",
            "wiki": "위키", "insights": "인사이트",
            "security": "보안", "packages": "패키지",
            "sponsors": "스폰서", "gist": "지스트", "gists": "지스트들",
            
            # 동작 관련
            "create": "생성", "edit": "편집", "delete": "삭제", "remove": "제거",
            "add": "추가", "update": "업데이트", "upload": "업로드",
            "download": "다운로드", "import": "가져오기", "export": "내보내기",
            "copy": "복사", "paste": "붙여넣기", "cut": "잘라내기",
            "rename": "이름 변경", "move": "이동", "duplicate": "복제",
            "share": "공유", "print": "인쇄", "email": "이메일",
            "save": "저장", "cancel": "취소", "submit": "제출",
            "confirm": "확인", "apply": "적용", "ok": "확인",
            "yes": "예", "no": "아니오", "close": "닫기", "open": "열기",
            
            # UI 요소
            "home": "홈", "search": "검색", "clear": "지우기",
            "loading": "로딩 중", "privacy": "개인정보", "terms": "약관",
            "status": "상태", "help": "도움말", "about": "정보",
            "contact": "연락처", "blog": "블로그", "explore": "탐색",
            "marketplace": "마켓플레이스", "copilot": "코파일럿",
            "codespaces": "코드스페이스", "navigation": "네비게이션",
            "command": "명령", "palette": "팔레트", "feedback": "피드백",
            "provide": "제공", "give": "주기", "submit": "제출",
            "suggestions": "제안", "syntax": "문법", "tips": "팁",
            "saved": "저장된", "searches": "검색들",
        }
        
        # 번역 통계
        self.stats = {
            "total_requests": 0,
            "successful_translations": 0,
            "cache_hits": 0,
            "ai_translations": 0,
            "dictionary_translations": 0,
            "start_time": datetime.now(),
        }
        
        # 번역 캐시
        self.translation_cache = {}
        self.max_cache_size = 1000
        
        # Google Translate 초기화 시도
        self.init_google_translate()
    
    def init_google_translate(self):
        """Google Translate 초기화"""
        try:
            from googletrans import Translator
            self.translator = Translator()
            self.model_ready = True
            logger.info("✅ Google Translate AI 초기화 성공")
        except ImportError:
            logger.warning("❌ googletrans 라이브러리가 설치되지 않음")
            logger.info("설치: pip install googletrans==4.0.0rc1")
            self.model_ready = False
        except Exception as e:
            logger.error(f"❌ Google Translate 초기화 실패: {e}")
            self.model_ready = False
    
    def translate_text(self, text):
        """메인 번역 함수"""
        original_text = text.strip()
        
        # 기본 검증
        if not original_text or len(original_text) > 500:
            return original_text
            
        if re.search(r'[가-힣]', original_text):
            return original_text
        
        # 캐시 확인
        if original_text in self.translation_cache:
            self.stats["cache_hits"] += 1
            return self.translation_cache[original_text]
        
        # 번역 처리
        translated = self.process_translation(original_text)
        
        # 캐시 저장
        if translated != original_text:
            if len(self.translation_cache) >= self.max_cache_size:
                oldest_key = next(iter(self.translation_cache))
                del self.translation_cache[oldest_key]
            
            self.translation_cache[original_text] = translated
        
        return translated
    
    def process_translation(self, text):
        """번역 처리 - Google AI + GitHub 사전"""
        # 1차: 정확한 GitHub 용어 확인
        exact_match = self.get_exact_translation(text)
        if exact_match:
            self.stats["dictionary_translations"] += 1
            logger.info(f"📚 정확한 매칭: '{text}' → '{exact_match}'")
            return exact_match
        
        # 2차: Google AI 번역 시도
        if self.model_ready:
            try:
                ai_translated = self.google_translate(text)
                if ai_translated and ai_translated != text:
                    # GitHub 용어 후처리
                    corrected = self.correct_github_terms(ai_translated)
                    self.stats["ai_translations"] += 1
                    logger.info(f"🤖 Google AI 번역: '{text}' → '{corrected}'")
                    return corrected
            except Exception as e:
                logger.error(f"Google 번역 실패: {e}")
        
        # 3차: 부분 사전 번역
        dict_translated = self.dictionary_translate(text)
        if dict_translated != text:
            self.stats["dictionary_translations"] += 1
            logger.info(f"📚 사전 번역: '{text}' → '{dict_translated}'")
            return dict_translated
        
        return text
    
    def get_exact_translation(self, text):
        """정확한 매칭 확인"""
        text_lower = text.lower().strip()
        
        for english, korean in self.base_glossary.items():
            if text_lower == english.lower():
                return korean
        
        return None
    
    def google_translate(self, text):
        """Google Translate API 사용"""
        if not self.model_ready or not self.translator:
            return text
        
        try:
            # Google Translate로 번역
            result = self.translator.translate(text, src='en', dest='ko')
            
            if result and result.text:
                translated = result.text.strip()
                
                # 번역 품질 검증
                if self.is_good_translation(text, translated):
                    return translated
                    
        except Exception as e:
            logger.error(f"Google 번역 API 오류: {e}")
        
        return text
    
    def correct_github_terms(self, ai_result):
        """AI 번역 결과에서 GitHub 용어 교정"""
        corrected = ai_result
        
        # GitHub 용어 교정
        corrections = {
            "저장소": "저장소",  # 이미 맞는 경우
            "문제": "이슈",  # issue를 "문제"로 번역한 경우
            "당기기 요청": "풀 리퀘스트",
            "끌어오기 요청": "풀 리퀘스트", 
            "분기": "브랜치",  # branch를 "분기"로 번역한 경우
            "별": "스타",  # star를 "별"로 번역한 경우
            "별표": "스타",
            "검색": "검색",  # 이미 맞는 경우
            "개인 정보": "개인정보",
            "피드백": "피드백",
            "제안": "제안",
        }
        
        for wrong, correct in corrections.items():
            corrected = corrected.replace(wrong, correct)
        
        return corrected
    
    def dictionary_translate(self, text):
        """사전 기반 번역"""
        translated = text
        
        # 부분 매칭 (긴 구문 우선)
        for english, korean in sorted(self.base_glossary.items(), key=len, reverse=True):
            pattern = r'\b' + re.escape(english) + r'\b'
            if re.search(pattern, text, re.IGNORECASE):
                translated = re.sub(pattern, korean, translated, flags=re.IGNORECASE)
        
        return translated
    
    def is_good_translation(self, original, translated):
        """번역 품질 검증"""
        if not translated or original.lower() == translated.lower():
            return False
            
        if len(translated) > len(original) * 4:
            return False
            
        return True

# 전역 번역 엔진
translator_engine = GoogleTranslateAIEngine()

@app.route("/")
def home():
    """API 상태 확인"""
    uptime = datetime.now() - translator_engine.stats["start_time"]
    return jsonify({
        "service": "Google AI GitHub Korean Translation Server",
        "status": "running",
        "version": "7.0.0",
        "ai_enabled": translator_engine.model_ready,
        "ai_provider": "Google Translate",
        "uptime_seconds": uptime.total_seconds(),
        "stats": translator_engine.stats,
    })

@app.route("/translate", methods=["POST"])
def translate_text():
    """단일 텍스트 번역"""
    try:
        data = request.get_json()
        if not data or "text" not in data:
            return jsonify({"error": "text 필드가 필요합니다"}), 400
            
        text = data["text"].strip()
        if not text:
            return jsonify({"error": "빈 텍스트는 번역할 수 없습니다"}), 400
            
        translator_engine.stats["total_requests"] += 1
        
        # 번역 실행
        translated = translator_engine.translate_text(text)
        
        if translated != text:
            translator_engine.stats["successful_translations"] += 1
            
        return jsonify({
            "success": True,
            "original": text,
            "translated": translated,
            "method": "google_ai_hybrid",
            "ai_used": translator_engine.model_ready,
            "timestamp": datetime.now().isoformat(),
            "cached": text in translator_engine.translation_cache,
        })
        
    except Exception as e:
        logger.error(f"번역 오류: {e}")
        return jsonify({"error": "서버 내부 오류"}), 500

@app.route("/batch-translate", methods=["POST"])
def batch_translate():
    """배치 번역"""
    try:
        data = request.get_json()
        if not data or "texts" not in data:
            return jsonify({"error": "texts 배열이 필요합니다"}), 400
            
        texts = data["texts"]
        if not isinstance(texts, list):
            return jsonify({"error": "texts는 배열이어야 합니다"}), 400
            
        results = []
        for text in texts:
            if isinstance(text, str) and text.strip():
                translator_engine.stats["total_requests"] += 1
                translated = translator_engine.translate_text(text.strip())
                
                if translated != text:
                    translator_engine.stats["successful_translations"] += 1
                    
                results.append({
                    "success": True,
                    "original": text.strip(),
                    "translated": translated,
                    "cached": text.strip() in translator_engine.translation_cache,
                })
                
        return jsonify({
            "success": True,
            "results": results,
            "total_processed": len(results)
        })
        
    except Exception as e:
        logger.error(f"배치 번역 오류: {e}")
        return jsonify({"error": "서버 내부 오류"}), 500

@app.route("/model-status")
def model_status():
    """모델 상태 확인"""
    return jsonify({
        "model_ready": translator_engine.model_ready,
        "ai_provider": "Google Translate",
        "cache_size": len(translator_engine.translation_cache),
        "max_cache_size": translator_engine.max_cache_size,
    })

@app.route("/health")
def health_check():
    """헬스 체크"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "google-ai-github-korean",
        "ai_ready": translator_engine.model_ready,
    })

if __name__ == "__main__":
    logger.info("🚀 Google AI GitHub 한글화 번역 서버 시작...")
    logger.info(f"📚 사전 단어: {len(translator_engine.base_glossary)}개")
    logger.info("🤖 Google Translate AI 사용")
    
    app.run(host="0.0.0.0", port=5001, debug=True)