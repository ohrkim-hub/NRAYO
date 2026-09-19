const { db, admin } = require('./firestore');

const FieldValue = admin.firestore.FieldValue;

// ---------------- USERS ----------------
async function createUser(userId, data) {
  await db.collection('users').doc(userId).set(data);
  return data;
}
async function getUser(userId) {
  const snap = await db.collection('users').doc(userId).get();
  return snap.exists ? snap.data() : null;
}
async function updateUser(userId, partial) {
  await db.collection('users').doc(userId).set(partial, { merge: true });
}
async function findUserByPhone(phone) {
  const snap = await db.collection('users').where('phone', '==', phone).limit(1).get();
  return snap.empty ? null : snap.docs[0].data();
}
async function listUsersByRegionExcept(region, excludeUserId, limit = 2) {
  const snap = await db.collection('users').where('region', '==', region).limit(limit + 1).get();
  return snap.docs.map(d => d.data()).filter(u => u.id !== excludeUserId).slice(0, limit);
}

// ---------------- PROFILES ----------------
async function createProfile(userId, data) {
  await db.collection('profiles').doc(userId).set(data);
  return data;
}
async function getProfile(userId) {
  const snap = await db.collection('profiles').doc(userId).get();
  return snap.exists ? snap.data() : null;
}
async function updateProfile(userId, partial) {
  await db.collection('profiles').doc(userId).set(partial, { merge: true });
}

// ---------------- QUIZ ATTEMPTS ----------------
async function addQuizAttempt(attemptId, data) {
  await db.collection('quizAttempts').doc(attemptId).set(data);
}
async function countAttempts(fromUserId, toUserId) {
  const snap = await db.collection('quizAttempts')
    .where('fromUserId', '==', fromUserId)
    .where('toUserId', '==', toUserId)
    .get();
  return snap.size;
}

// ---------------- FRIEND REQUESTS / FRIENDSHIPS ----------------
async function createFriendRequest(requestId, data) {
  await db.collection('friendRequests').doc(requestId).set(data);
}
async function getFriendRequest(requestId) {
  const snap = await db.collection('friendRequests').doc(requestId).get();
  return snap.exists ? snap.data() : null;
}
async function updateFriendRequest(requestId, partial) {
  await db.collection('friendRequests').doc(requestId).set(partial, { merge: true });
}
async function createFriendship(friendshipId, data) {
  await db.collection('friendships').doc(friendshipId).set(data);
}

// ---------------- TRIO (rooms) ----------------
async function createRoom(roomId, data) {
  await db.collection('rooms').doc(roomId).set(data);
}
async function getRoom(roomId) {
  const snap = await db.collection('rooms').doc(roomId).get();
  return snap.exists ? snap.data() : null;
}
async function updateRoom(roomId, partial) {
  await db.collection('rooms').doc(roomId).set(partial, { merge: true });
}
async function addRoomMembers(roomId, members) {
  const batch = db.batch();
  members.forEach(m => {
    const ref = db.collection('rooms').doc(roomId).collection('members').doc(m.userId);
    batch.set(ref, m);
  });
  await batch.commit();
}
async function getRoomMembers(roomId) {
  const snap = await db.collection('rooms').doc(roomId).collection('members').get();
  return snap.docs.map(d => d.data());
}
async function removeRoomMember(roomId, userId) {
  await db.collection('rooms').doc(roomId).collection('members').doc(userId).delete();
}
async function addRoomMessage(roomId, message) {
  await db.collection('rooms').doc(roomId).collection('messages').doc(message.id).set(message);
}
async function getRoomMessages(roomId) {
  const snap = await db.collection('rooms').doc(roomId).collection('messages').orderBy('createdAt').get();
  return snap.docs.map(d => d.data());
}

// ---------------- MEETS ----------------
async function createMeet(meetId, data) {
  await db.collection('meets').doc(meetId).set(data);
}
async function getMeet(meetId) {
  const snap = await db.collection('meets').doc(meetId).get();
  return snap.exists ? snap.data() : null;
}
async function addMeetParticipant(meetId, participant) {
  await db.collection('meets').doc(meetId).collection('participants').doc(participant.userId).set(participant);
}
async function getMeetParticipants(meetId) {
  const snap = await db.collection('meets').doc(meetId).collection('participants').get();
  return snap.docs.map(d => d.data());
}
async function updateMeetParticipant(meetId, userId, partial) {
  await db.collection('meets').doc(meetId).collection('participants').doc(userId).set(partial, { merge: true });
}

// ---------------- SAFETY (reports / blocks) ----------------
async function createReport(reportId, data) {
  await db.collection('reports').doc(reportId).set(data);
}
async function listReports() {
  const snap = await db.collection('reports').orderBy('createdAt', 'desc').get();
  return snap.docs.map(d => d.data());
}
async function createBlock(blockId, data) {
  await db.collection('blocks').doc(blockId).set(data);
}

// ---------------- PHONE VERIFICATION ----------------
async function saveVerificationCode(phone, code, expiresAt) {
  await db.collection('verificationCodes').doc(phone).set({ phone, code, expiresAt, verified: false });
}
async function getVerificationCode(phone) {
  const snap = await db.collection('verificationCodes').doc(phone).get();
  return snap.exists ? snap.data() : null;
}
async function markPhoneVerified(phone) {
  await db.collection('verificationCodes').doc(phone).set({ verified: true }, { merge: true });
}
async function isPhoneVerified(phone) {
  const snap = await db.collection('verificationCodes').doc(phone).get();
  return snap.exists && snap.data().verified === true;
}

// ---------------- ADMIN ----------------
async function listAllUsers(limit = 200) {
  const snap = await db.collection('users').orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map(d => d.data());
}
async function resolveReport(reportId, status) {
  await db.collection('reports').doc(reportId).set({ status }, { merge: true });
}

module.exports = {
  FieldValue,
  createUser, getUser, updateUser, findUserByPhone, findUserByGoogleUid, listUsersByRegionExcept,
  findUserByReferralCode, countUsersReferredBy,
  createProfile, getProfile, updateProfile,
  addQuizAttempt, countAttempts,
  createFriendRequest, getFriendRequest, updateFriendRequest, createFriendship,
  createRoom, getRoom, updateRoom, addRoomMembers, getRoomMembers, removeRoomMember, addRoomMessage, getRoomMessages,
  listRoomsForUser,
  createMeet, getMeet, addMeetParticipant, getMeetParticipants, updateMeetParticipant,
  createReport, listReports, createBlock,
  saveVerificationCode, getVerificationCode, markPhoneVerified, isPhoneVerified,
  listAllUsers, resolveReport,
  saveContacts, getContactHashes,
  addMannerRating, getMannerScore,
  createPayment, creditStars,
  saveGameAnswer, getGameAnswers,
  saveWhosThisQuestion, getWhosThisQuestion, saveWhosThisGuess, getWhosThisGuesses,
  saveDrawRound, getDrawRound, updateDrawRound, addDrawGuess, listDrawGuesses, clearDrawGuesses,
  createPost, getPost, listRecentPosts, deletePost, toggleLike, addComment, listComments, toggleJoin,
  createSuggestion, getSuggestion, listSuggestions, deleteSuggestion, toggleSuggestionLike,
  addSuggestionComment, listSuggestionComments, updateSuggestionStatus,
  createKakaoExchange, getKakaoExchange, updateKakaoExchange, listKakaoExchangesForUser
};

// ---------------- 건의사항 (유저 제안/버그신고 게시판) ----------------
async function createSuggestion(id, data) {
  await db.collection('suggestions').doc(id).set(data);
}
async function getSuggestion(id) {
  const snap = await db.collection('suggestions').doc(id).get();
  return snap.exists ? snap.data() : null;
}
async function listSuggestions(limit = 100) {
  const snap = await db.collection('suggestions').orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map(d => d.data());
}
async function deleteSuggestion(id) {
  const ref = db.collection('suggestions').doc(id);
  const commentsSnap = await ref.collection('comments').get();
  if (!commentsSnap.empty) {
    const batch = db.batch();
    commentsSnap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
  await ref.delete();
}
async function toggleSuggestionLike(id, userId) {
  const ref = db.collection('suggestions').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const likedBy = snap.data().likedBy || [];
  const nowLiked = !likedBy.includes(userId);
  await ref.update({ likedBy: nowLiked ? FieldValue.arrayUnion(userId) : FieldValue.arrayRemove(userId) });
  return nowLiked;
}
async function addSuggestionComment(id, commentId, data) {
  const ref = db.collection('suggestions').doc(id);
  await ref.collection('comments').doc(commentId).set(data);
  await ref.update({ commentCount: FieldValue.increment(1) });
}
async function listSuggestionComments(id) {
  const snap = await db.collection('suggestions').doc(id).collection('comments').orderBy('createdAt').get();
  return snap.docs.map(d => d.data());
}
async function updateSuggestionStatus(id, status) {
  await db.collection('suggestions').doc(id).set({ status }, { merge: true });
}

// ---------------- 동네생활 (게시판) ----------------
// likedBy는 배열 필드로 post 문서에 직접 저장(별도 좋아요 서브컬렉션 없이 가볍게 처리)
async function createPost(postId, data) {
  await db.collection('posts').doc(postId).set(data);
}
async function getPost(postId) {
  const snap = await db.collection('posts').doc(postId).get();
  return snap.exists ? snap.data() : null;
}
// 지역 필터 없이 최신순 전체 조회 (초기엔 유저가 적어 지역별로 나누면 더 썰렁해 보이므로,
// 지역은 배지로만 보여주고 피드 자체는 통합. 유저가 늘어나면 지역 필터 추가 검토)
async function listRecentPosts(limit = 50) {
  const snap = await db.collection('posts').orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map(d => d.data());
}
async function deletePost(postId) {
  // Firestore는 상위 문서를 지워도 서브컬렉션(comments)이 자동으로 같이 삭제되지 않으므로 먼저 정리
  const postRef = db.collection('posts').doc(postId);
  const commentsSnap = await postRef.collection('comments').get();
  if (!commentsSnap.empty) {
    const batch = db.batch();
    commentsSnap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
  await postRef.delete();
}
async function toggleLike(postId, userId) {
  const postRef = db.collection('posts').doc(postId);
  const snap = await postRef.get();
  if (!snap.exists) return null;
  const likedBy = snap.data().likedBy || [];
  const nowLiked = !likedBy.includes(userId);
  await postRef.update({
    likedBy: nowLiked ? FieldValue.arrayUnion(userId) : FieldValue.arrayRemove(userId)
  });
  return nowLiked;
}
// 모집글(postType 'recruit')의 "참여하기" 토글. 좋아요와 달리 닉네임까지 같이 저장해야 해서
// (참여자 명단을 이름으로 보여줘야 함) arrayUnion/arrayRemove 대신 읽고 다시 쓰는 방식 사용
async function toggleJoin(postId, userId, nickname) {
  const postRef = db.collection('posts').doc(postId);
  const snap = await postRef.get();
  if (!snap.exists) return null;
  const participants = snap.data().participants || [];
  const alreadyJoined = participants.some(p => p.userId === userId);
  const newParticipants = alreadyJoined
    ? participants.filter(p => p.userId !== userId)
    : [...participants, { userId, nickname, joinedAt: new Date().toISOString() }];
  await postRef.update({ participants: newParticipants });
  return { joined: !alreadyJoined, participants: newParticipants };
}

async function addComment(postId, commentId, data) {
  const postRef = db.collection('posts').doc(postId);
  await postRef.collection('comments').doc(commentId).set(data);
  await postRef.update({ commentCount: FieldValue.increment(1) });
}
async function listComments(postId) {
  const snap = await db.collection('posts').doc(postId).collection('comments').orderBy('createdAt').get();
  return snap.docs.map(d => d.data());
}

// ---------------- 내 모든 대화방 (1:1 DM + TRIO) 조회 ----------------
async function listRoomsForUser(userId) {
  const snap = await db.collectionGroup('members').where('userId', '==', userId).get();
  const rooms = [];
  for (const doc of snap.docs) {
    const roomRef = doc.ref.parent.parent;
    if (!roomRef) continue;
    const roomSnap = await roomRef.get();
    if (roomSnap.exists) rooms.push(roomSnap.data());
  }
  rooms.sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt));
  return rooms;
}

async function findUserByGoogleUid(googleUid) {
  const snap = await db.collection('users').where('googleUid', '==', googleUid).limit(1).get();
  return snap.empty ? null : snap.docs[0].data();
}

// ---------------- 친구 초대 (추천인 코드) ----------------
async function findUserByReferralCode(referralCode) {
  const snap = await db.collection('users').where('referralCode', '==', referralCode).limit(1).get();
  return snap.empty ? null : snap.docs[0].data();
}
async function countUsersReferredBy(userId) {
  const snap = await db.collection('users').where('referredBy', '==', userId).get();
  return snap.size;
}

// ---------------- 결제 / 재화 ----------------
async function createPayment(paymentId, data) {
  await db.collection('payments').doc(paymentId).set(data);
}
async function creditStars(userId, amount) {
  const user = await getUser(userId);
  if (!user) return null;
  const newStars = (user.stars || 0) + amount;
  await updateUser(userId, { stars: newStars });
  return newStars;
}

// ---------------- TRIO 관계게임: SAME 5 ----------------
async function saveGameAnswer(roomId, promptId, userId, answer) {
  await db.collection('rooms').doc(roomId).collection('gameAnswers').doc(`${promptId}_${userId}`)
    .set({ promptId, userId, answer, createdAt: new Date().toISOString() });
}
async function getGameAnswers(roomId, promptId) {
  const snap = await db.collection('rooms').doc(roomId).collection('gameAnswers')
    .where('promptId', '==', promptId).get();
  return snap.docs.map(d => d.data());
}

// ---------------- TRIO 관계게임: WHO'S THIS ----------------
async function saveWhosThisQuestion(roomId, data) {
  await db.collection('rooms').doc(roomId).collection('whosThis').doc('current').set(data);
}
async function getWhosThisQuestion(roomId) {
  const snap = await db.collection('rooms').doc(roomId).collection('whosThis').doc('current').get();
  return snap.exists ? snap.data() : null;
}
async function saveWhosThisGuess(roomId, userId, guess) {
  await db.collection('rooms').doc(roomId).collection('whosThisGuesses').doc(userId)
    .set({ userId, guess, createdAt: new Date().toISOString() });
}
async function getWhosThisGuesses(roomId) {
  const snap = await db.collection('rooms').doc(roomId).collection('whosThisGuesses').get();
  return snap.docs.map(d => d.data());
}

// ---------------- TRIO 관계게임: 그림 맞추기 (캐치마인드 스타일) ----------------
async function saveDrawRound(roomId, data) {
  await db.collection('rooms').doc(roomId).collection('draw').doc('current').set(data);
}
async function getDrawRound(roomId) {
  const snap = await db.collection('rooms').doc(roomId).collection('draw').doc('current').get();
  return snap.exists ? snap.data() : null;
}
async function updateDrawRound(roomId, partial) {
  await db.collection('rooms').doc(roomId).collection('draw').doc('current').set(partial, { merge: true });
}
async function addDrawGuess(roomId, guessId, data) {
  await db.collection('rooms').doc(roomId).collection('drawGuesses').doc(guessId).set(data);
}
async function listDrawGuesses(roomId) {
  const snap = await db.collection('rooms').doc(roomId).collection('drawGuesses').orderBy('createdAt').get();
  return snap.docs.map(d => d.data());
}
async function clearDrawGuesses(roomId) {
  const snap = await db.collection('rooms').doc(roomId).collection('drawGuesses').get();
  if (!snap.empty) {
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
}

// ---------------- 지인 피하기 (연락처 기반) ----------------
async function saveContacts(userId, hashedPhones) {
  await db.collection('contacts').doc(userId).set({ userId, hashedPhones, updatedAt: new Date().toISOString() });
}
async function getContactHashes(userId) {
  const snap = await db.collection('contacts').doc(userId).get();
  return snap.exists ? (snap.data().hashedPhones || []) : [];
}

// ---------------- 매너 평점 ----------------
async function addMannerRating(targetUserId, raterUserId, score) {
  await db.collection('mannerRatings').doc(targetUserId).collection('ratings').doc(raterUserId)
    .set({ raterUserId, score, createdAt: new Date().toISOString() });

  const snap = await db.collection('mannerRatings').doc(targetUserId).collection('ratings').get();
  const scores = snap.docs.map(d => d.data().score);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  await updateUser(targetUserId, { mannerScore: Math.round(avg * 10) / 10, mannerRatingCount: scores.length });
  return { mannerScore: Math.round(avg * 10) / 10, mannerRatingCount: scores.length };
}
async function getMannerScore(targetUserId) {
  const user = await getUser(targetUserId);
  return user ? { mannerScore: user.mannerScore || null, mannerRatingCount: user.mannerRatingCount || 0 } : null;
}

// ---------------- 카카오톡 ID 교환 (유료, 상호 동의) ----------------
// 별을 써서 요청을 보내고, 상대가 수락해야만 서로의 카카오톡 ID가 보임 (일방적 공개 아님)
async function createKakaoExchange(id, data) {
  await db.collection('kakaoExchanges').doc(id).set(data);
}
async function getKakaoExchange(id) {
  const snap = await db.collection('kakaoExchanges').doc(id).get();
  return snap.exists ? snap.data() : null;
}
async function updateKakaoExchange(id, partial) {
  await db.collection('kakaoExchanges').doc(id).set(partial, { merge: true });
}
// 지역 필터처럼 복합 인덱스를 피하기 위해 where 절 하나짜리 쿼리 두 번으로 나눠서 합침
async function listKakaoExchangesForUser(userId) {
  const [sentSnap, receivedSnap] = await Promise.all([
    db.collection('kakaoExchanges').where('fromUserId', '==', userId).get(),
    db.collection('kakaoExchanges').where('toUserId', '==', userId).get()
  ]);
  return [...sentSnap.docs.map(d => d.data()), ...receivedSnap.docs.map(d => d.data())];
}
