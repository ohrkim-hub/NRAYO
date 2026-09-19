// FCM 푸시 발송 헬퍼 - 실패해도(토큰 없음/만료/설정 안 됨) 호출한 쪽의 흐름을 절대 막지 않음
// (알림은 "있으면 좋은" 부가 기능이라 실패하면 조용히 넘어가고 로그만 남김)
const { admin } = require('../data/firestore');
const repo = require('../data/repo');

async function sendPushToUser(userId, { title, body, data = {} }) {
  try {
    if (!userId) return false;
    const user = await repo.getUser(userId);
    if (!user || !user.fcmToken) return false;

    await admin.messaging().send({
      token: user.fcmToken,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      webpush: { fcmOptions: { link: '/' } }
    });
    return true;
  } catch (e) {
    console.warn(`푸시 발송 실패(userId=${userId}, 무시하고 계속 진행):`, e.message);
    return false;
  }
}

// 여러 명에게 한 번에 보낼 때 (실패한 사람이 있어도 나머지는 계속 시도)
async function sendPushToUsers(userIds, payload) {
  await Promise.all(userIds.map(uid => sendPushToUser(uid, payload)));
}

module.exports = { sendPushToUser, sendPushToUsers };
