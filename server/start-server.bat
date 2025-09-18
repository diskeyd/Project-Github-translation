@echo off
chcp 65001 >nul

echo 🚀 Git-KR AI 번역 서버 시작
echo =============================

REM 현재 디렉토리 확인
if not exist "app.py" (
    echo ❌ app.py 파일을 찾을 수 없습니다. server 폴더에서 실행해주세요.
    pause
    exit /b 1
)

REM Python 버전 확인
echo 📋 Python 환경 확인...
python --version
if %errorlevel% neq 0 (
    echo ❌ Python이 설치되지 않았습니다.
    echo Python 3.7 이상을 설치해주세요.
    pause
    exit /b 1
)

REM 가상환경 옵션
echo.
set /p use_venv="🤔 가상환경을 사용하시겠습니까? (y/N): "

if /i "%use_venv%"=="y" (
    REM 가상환경 생성 및 활성화
    if not exist "venv" (
        echo 📦 Python 가상환경 생성 중...
        python -m venv venv
    )
    
    echo 🔄 가상환경 활성화 중...
    call venv\Scripts\activate.bat
)

REM 의존성 설치
echo 📦 필수 패키지 설치 중...
pip install -r requirements.txt

if %errorlevel% equ 0 (
    echo ✅ 패키지 설치 완료
) else (
    echo ❌ 패키지 설치 실패
    pause
    exit /b 1
)

REM 서버 시작
echo.
echo 🤖 Git-KR AI 번역 서버 시작 중...
echo 🔥 Google Translate AI 엔진 활성화
echo 📚 GitHub 특화 사전 + AI 번역 제공
echo.
echo 🌐 서버 주소: http://localhost:5001
echo 🏥 헬스체크: http://localhost:5001/health
echo 📊 AI 상태: http://localhost:5001/model-status
echo.
echo 🛑 종료하려면 Ctrl+C를 누르세요
echo =============================
echo.

python app.py
pause