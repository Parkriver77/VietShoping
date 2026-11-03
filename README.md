# 안심쇼핑 VN

베트남에서 정품 보증이 확실한 매장만 골라 한 번에 검색하는 웹앱입니다.

- **실시간 가격 비교**: Thế Giới Di Động, Phong Vũ, Tiki, (중고) Chotot 의 검색 결과를
  서버에서 모아 가격순으로 보여줍니다. 공식 매장·Tiki 직판 상품은 따로 표시합니다.
- **매장 바로가기**: Điện Máy Xanh, FPT Shop, CellphoneS, GearVN, Hasaki 등 각 매장 자체 검색으로 연결합니다.
- 컴퓨터는 기기 종류, CPU, 램 용량·종류, 저장 용량·종류, 그래픽, 화면 크기로 검색할 수 있습니다.

## 구조

- `public/index.html` — 앱 화면 (빌드 없는 단일 페이지)
- `netlify/functions/search.mts` — 가격 비교 서버 (`/api/search?q=검색어&used=0|1|2`)
- `.github/workflows/netlify.yml` — Netlify 수동 배포 (메인 주소: https://vietshoping-app.netlify.app)
- `.github/workflows/deploy.yml` — GitHub Pages 수동 배포 (Netlify 서버를 불러 씀)

## 처음 한 번 설정

1. Netlify → User settings → Applications → **Personal access tokens** → New access token
2. GitHub 저장소 → Settings → Secrets and variables → Actions → **New repository secret**
   - Name: `NETLIFY_AUTH_TOKEN`, Secret: 1번에서 만든 토큰

## 배포 (수동)

Actions 탭 → **Deploy to Netlify (manual)** → Run workflow.
push 만으로는 배포되지 않습니다.

## 참고

- 매장이 사이트 구조를 바꾸거나 자동 접속을 막으면 그 매장만 "실패"로 표시되고 나머지는 계속 동작합니다.
- 같은 검색어는 10분 동안 캐시해서 매장 사이트에 부담을 주지 않습니다.
- AI 구매 점검은 claude.ai 아티팩트 안에서만 보입니다.
