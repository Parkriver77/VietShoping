# 안심쇼핑 VN

베트남에서 정품 보증이 확실한 매장만 골라 한 번에 검색하는 웹앱입니다.
제품명·모델명, 신품/중고, 예산, 지역을 입력하면 공식 매장(Thế Giới Di Động, Điện Máy Xanh,
FPT Shop, CellphoneS, Phong Vũ, GearVN, Hasaki, Tiki 등)의 검색 결과로 바로 연결합니다.
컴퓨터는 기기 종류, CPU, 램 용량·종류, 저장 용량·종류, 그래픽, 화면 크기로도 검색할 수 있습니다.

## 파일

- `index.html` — 앱 전체 (빌드 과정 없는 단일 정적 페이지)
- `.github/workflows/deploy.yml` — GitHub Pages 수동 배포

## 배포 (수동)

1. 저장소 **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 설정
2. **Actions** 탭 → **Deploy to GitHub Pages (manual)** → **Run workflow**
3. 완료되면 `https://<사용자명>.github.io/<저장소명>/` 에서 열림

push 만으로는 배포되지 않습니다. 배포할 때마다 2번을 직접 실행하세요.

## 참고

- **AI 구매 점검**은 claude.ai 아티팩트 안에서만 동작합니다. GitHub Pages 버전에서는
  안내 문구만 표시되고, 매장 검색 링크와 Claude 채팅용 문장 복사는 그대로 쓸 수 있습니다.
- 모든 매장 링크는 각 매장 사이트의 자체 검색 결과로 바로 연결됩니다.
- 마지막 검색 조건은 브라우저(localStorage)에만 저장됩니다.
