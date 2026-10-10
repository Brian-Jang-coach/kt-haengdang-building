# KT 행당빌딩 — GitHub / Vercel 배포용

2026-10-10 기준 공개 홈페이지 소스입니다. 원본 커밋: d0e69af302575d9b162638885253c88021c2ad86

## 포함 기능
메인/사옥 안내/공지/층별 안내/시설 및 주차/체력단련실 포스터/안전보건, 실제 회의실 예약 및 조회·취소, 안전 개선 요청 접수 및 조회·철회. 예약 확인번호는 숫자 6자리이며 기존 번호도 호환됩니다. 예약 기간은 한국 시간 기준 오늘부터 30일입니다. 이름과 소속은 공개 시간표에 표시됩니다.

## GitHub에 올리기
1. ZIP을 풀고 이 폴더 안의 파일을 새 GitHub 저장소의 최상위에 올립니다. package.json과 vercel.json이 최상위에 있어야 합니다.
2. 숨김 파일 .gitignore, .env.example, .openai도 포함합니다. 실제 .env, 비밀번호, node_modules는 올리지 않습니다.
3. GitHub 저장소 생성 후 이 폴더에서 git init → git add . → git commit -m "Initial website" → git branch -M main → git remote add origin 저장소주소 → git push -u origin main 순서로 실행할 수도 있습니다.

## Vercel 배포
1. Vercel의 Add New → Project에서 해당 GitHub 저장소를 Import합니다.
2. Framework Preset: Other, Root Directory: 이 폴더의 루트, Build Command: npm run build, Output Directory: public. 설정은 vercel.json에 들어 있습니다. Node.js 22 이상을 선택합니다.
3. 환경변수 BOOKING_API_ORIGIN을 https://kt-haengdang-building.tao23t.chatgpt.site 로 설정합니다. 생략하면 같은 주소를 기본으로 사용합니다.
4. Deploy를 누릅니다. 자체 도메인을 쓰면 SITE_URL에 https://도메인 값을 입력하고 재배포하면 링크 미리보기 사진 주소에도 적용됩니다.
5. 공지, 사진, 모바일 화면을 확인하고 회의실 예약 생성·조회·취소 및 안전 개선 요청 접수·조회를 점검합니다.

## 데이터 연결 방식 — 꼭 확인
Vercel은 화면과 API 프록시를 배포합니다. 예약 및 안전 개선 요청 데이터는 기존 공개 사이트의 D1 서버에 계속 저장합니다. 기존 사이트와 Vercel 사이트는 같은 예약을 공유합니다. 기존 사이트를 삭제하거나 비공개로 바꾸면 연결이 끊깁니다. Vercel 자체 데이터베이스로 완전히 이전하는 작업은 이 ZIP에 포함되지 않습니다. 프록시 경유 요청은 기존 서버에서 동일한 중계 서버 IP로 보일 수 있어 IP별 요청 제한을 공유할 수 있습니다.
ZIP에는 실제 예약·접수 데이터, 개인정보, 인증 토큰이 없습니다. drizzle에는 데이터베이스 구조와 변경 이력만 있습니다. 로그인은 기존처럼 준비 중입니다.

## 파일 구조 및 수정
- site-assets/: 최신 화면 HTML, CSS, 사진, 포스터.
- worker/: 실제 예약/안전 개선 요청 서버 및 브라우저 코드.
- drizzle/: D1 스키마 변경 파일. 적용된 이전 파일은 수정하지 않습니다.
- api/proxy.js: Vercel에서 기존 공개 데이터 서버로 연결.
- scripts/build-vercel.mjs: 실제 Worker 출력에서 최신 정적 화면을 추출.
- scripts/build-booking.mjs: 원본 Worker 빌드.
- npm run build: Vercel 배포 파일 생성(외부 패키지 설치 불필요).
- npm run dev:worker: Node.js 22.13 이상에서 로컬 SQLite 테스트 서버, http://127.0.0.1:3002. 로컬 테스트 데이터는 실제 운영 데이터와 별도입니다.

이 ZIP은 업로드할 파일 묶음입니다. GitHub 업로드 및 Vercel 실제 배포는 아직 실행하지 않았습니다.

참고: https://vercel.com/docs/project-configuration/vercel-json 및 https://vercel.com/docs/functions/configuring-functions/runtime

## Vercel 빌드 오류 수정 (2026-10-10)
.openai/hosting.json은 Sites 전용 배포 메타데이터입니다. 없으면 {d1: "DB", r2: null} 기본값을 사용하므로 GitHub에 .openai 폴더를 올리지 않아도 npm run build가 성공합니다. 파일이 있는 경우 원래 설정의 검증은 유지합니다. Vercel 예약 연결 주소는 런타임 환경변수 BOOKING_API_ORIGIN, 링크 미리보기 도메인은 빌드 환경변수 SITE_URL로 설정합니다. 비밀키는 필요하지 않습니다. .openai가 없는 새 폴더에서 npm run build 성공 및 예약 생성·조회·취소 API 프록시 전달 검증을 완료했습니다.
