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
  createProfile, getProfile, updateProfile,
  addQuizAttempt, countAttempts,
  createFriendRequest, getFriendRequest, updateFriendRequest, createFriendship,
  createRoom, getRoom, updateRoom, addRoomMembers, getRoomMembers, addRoomMessage, getRoomMessages,
  createMeet, getMeet, addMeetParticipant, getMeetParticipants, updateMeetParticipant,
  createReport, listReports, createBlock,
  saveVerificationCode, getVerificationCode, markPhoneVerified, isPhoneVerified,
  listAllUsers, resolveReport,
  saveContacts, getContactHashes,
  addMannerRating, getMannerScore,
  createPayment, creditStars,
  saveGameAnswer, getGameAnswers,
  saveWhosThisQuestion, getWhosThisQuestion, saveWhosThisGuess, getWhosThisGuesses
};

async function findUserByGoogleUid(googleUid) {
  const snap = await db.collection('users').where('googleUid', '==', googleUid).limit(1).get();
  return snap.empty ? null : snap.docs[0].data();
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
