# Git-KR — GitHub 한글화 Chrome 확장

GitHub 화면의 영어 UI 문구를 한국어로 바꿔 보여 주는 Chrome 확장 프로그램입니다(Manifest V3). 조선대학교 오픈소스SW개론 수업의 4인 팀 프로젝트로 만들었습니다.

## 동작 방식

- content script(`src/content/content.js`)가 `github.com` 페이지의 텍스트를 훑어 한국어로 바꿉니다. `MutationObserver`로 나중에 그려지는 요소도 따라가며 번역합니다.
- 번역 모드는 세 가지이고, 확장 팝업이나 페이지 위 배너에서 바꿉니다.

| 모드 | 동작 |
|---|---|
| OFF | 번역하지 않습니다. 이미 바꾼 문구는 원문으로 되돌립니다 |
| LOCAL | 확장에 내장된 사전과 사용자 정의 단어만 씁니다. 서버가 필요 없습니다 |
| AI | 로컬 번역 서버(`server/app.py`)에 문장을 보내 번역합니다. 서버가 꺼져 있거나 번역이 실패하면 LOCAL 방식으로 대신합니다 |

- 사용자 정의 단어: 옵션 페이지에서 영어–한국어 쌍을 추가·삭제합니다. `chrome.storage.local`에 저장하고, 번역할 때 가장 먼저 적용합니다.
- 번역 서버: Flask 서버가 `googletrans`로 번역한 뒤 GitHub 용어 사전으로 결과를 바로잡습니다. 번역 결과는 메모리에 캐시합니다(최대 1,000개). 엔드포인트는 `/translate`, `/batch-translate`, `/health`, `/model-status`입니다.

## 폴더 구성

```
.
├── manifest.json            # 확장 설정 (Manifest V3)
├── src/
│   ├── content/             # 페이지 번역 (content.js, content.css)
│   ├── popup/               # 모드 전환 팝업
│   └── options/             # 서버 주소, 사용자 정의 단어 설정
├── assets/
│   ├── glossary.json        # GitHub 용어 사전 (영어 → 한국어, 142개)
│   └── icons/
├── server/                  # 번역 서버 (Flask + googletrans)
└── docs/                    # 설치·사용 안내 (SETUP.md, USAGE.md)
```

## 설치와 실행

1. 저장소를 받습니다.

```bash
git clone https://github.com/diskeyd/Project-Github-translation.git
```

2. Chrome에서 `chrome://extensions`를 열고 **개발자 모드**를 켠 뒤 **압축해제된 확장 프로그램을 로드합니다**로 저장소 폴더를 고릅니다.
3. AI 모드를 쓰려면 번역 서버를 띄웁니다. 주소는 `http://localhost:5001`입니다.

```bash
cd server
pip install -r requirements.txt
python app.py
```

자세한 순서는 [docs/SETUP.md](docs/SETUP.md), 사용법은 [docs/USAGE.md](docs/USAGE.md), 서버는 [server/README.md](server/README.md)에 있습니다.

## 팀과 역할

4인 팀 프로젝트(오픈소스SW개론). 본인은 프론트 담당으로 시작했습니다. AI 번역이 동작하지 않자 원인을 추적해 번역 엔진을 MarianMT에서 googletrans로 교체해 동작시켰고, GitHub 용어 사전(`assets/glossary.json`, 142개)을 만들었습니다.

## 참고한 프로젝트

- [hatemogi/github-ko-ext](https://github.com/hatemogi/github-ko-ext): GitHub 한글화 확장 프로그램. 아이디어를 참고했습니다. 이 저장소에는 라이선스 표기가 없습니다.
- `assets/glossary.json`은 위 프로젝트의 번역 데이터를 가져온 것이 아니라 따로 작성한 사전입니다.
