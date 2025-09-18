#!/bin/bash

echo "🚀 Git-KR AI 번역 서버 시작"
echo "============================="

# 현재 디렉토리 확인
if [ ! -f "app.py" ]; then
    echo "❌ app.py 파일을 찾을 수 없습니다. server 폴더에서 실행해주세요."
    exit 1
fi

# Python 버전 확인
echo "📋 Python 환경 확인..."
if command -v python3 &> /dev/null; then
    python3 --version
    PYTHON_CMD="python3"
    PIP_CMD="pip3"
elif command -v python &> /dev/null; then
    python --version
    PYTHON_CMD="python"
    PIP_CMD="pip"
else
    echo "❌ Python이 설치되지 않았습니다."
    echo "Python 3.7 이상을 설치해주세요."
    exit 1
fi

# 가상환경 옵션 (선택사항)
echo ""
read -p "🤔 가상환경을 사용하시겠습니까? (y/N): " use_venv

if [[ $use_venv =~ ^[Yy]$ ]]; then
    # 가상환경 생성 및 활성화
    if [ ! -d "venv" ]; then
        echo "📦 Python 가상환경 생성 중..."
        $PYTHON_CMD -m venv venv
    fi
    
    echo "🔄 가상환경 활성화 중..."
    source venv/bin/activate
    PYTHON_CMD="python"
    PIP_CMD="pip"
fi

# 의존성 설치
echo "📦 필수 패키지 설치 중..."
$PIP_CMD install -r requirements.txt

if [ $? -eq 0 ]; then
    echo "✅ 패키지 설치 완료"
else
    echo "❌ 패키지 설치 실패"
    exit 1
fi

# 서버 시작
echo ""
echo "🤖 Git-KR AI 번역 서버 시작 중..."
echo "🔥 Google Translate AI 엔진 활성화"
echo "📚 GitHub 특화 사전 + AI 번역 제공"
echo ""
echo "🌐 서버 주소: http://localhost:5001"
echo "🏥 헬스체크: http://localhost:5001/health"
echo "📊 AI 상태: http://localhost:5001/model-status"
echo ""
echo "🛑 종료하려면 Ctrl+C를 누르세요"
echo "============================="
echo ""

$PYTHON_CMD app.py