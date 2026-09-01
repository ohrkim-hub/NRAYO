const admin = require('firebase-admin');

// Cloud Run 환경에서는 Application Default Credentials로 자동 인증됨
// (별도 서비스 계정 키 파일 불필요, 프로젝트 기본 서비스 계정 권한 사용)
// 로컬 개발 시에는 GOOGLE_APPLICATION_CREDENTIALS 환경변수로 키 파일 경로를 지정하거나
// Firestore 에뮬레이터(FIRESTORE_EMULATOR_HOST)를 사용하세요.
const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'nrayo-3c940';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId,
    storageBucket: process.env.STORAGE_BUCKET || 'nrayo-3c940.firebasestorage.app'
  });
}

const db = admin.firestore();

// Storage 버킷 초기화는 실패해도 서버 전체가 죽지 않도록 방어적으로 처리
// (프로필 사진 업로드 기능만 비활성화되고 나머지 API는 정상 동작)
let bucket = null;
try {
  bucket = admin.storage().bucket();
} catch (e) {
  console.warn('Storage 버킷 초기화 실패 (사진 업로드 기능은 사용 불가):', e.message);
}

module.exports = { admin, db, bucket };
