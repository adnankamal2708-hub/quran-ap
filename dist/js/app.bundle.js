const FIREBASE_CONFIG = {
apiKey:            "AIzaSyActPDi21DFbyGl7KeecPC_CFuJuor9fxo",
authDomain:        "bayan-quran-vocabulary.firebaseapp.com",
projectId:         "bayan-quran-vocabulary",
storageBucket:     "bayan-quran-vocabulary.firebasestorage.app",
messagingSenderId: "857901285463",
appId:             "1:857901285463:web:9dc416c77b0add0e366312",
};
const CLOUD_SYNC_ENABLED = true;
const AUTO_IMPORT_ON_LOGIN = true;
const SYNC_DEBOUNCE_MS = 2000;
const FIRESTORE_LEARNING_COLLECTION = 'learning';
const FIRESTORE_PROFILE_COLLECTION = 'profiles';
const PENDING_SYNC_KEY = 'quran_sync_pending';
var {
createUserWithEmailAndPassword,
signInWithEmailAndPassword,
signOut,
sendPasswordResetEmail: _sendPasswordResetEmail,
confirmPasswordReset: _confirmPasswordReset,
applyActionCode: _applyActionCode,
updateProfile,
updateEmail: _updateEmail,
updatePassword: _updatePassword,
sendEmailVerification,
deleteUser,
reauthenticateWithCredential,
EmailAuthProvider,
setPersistence,
browserLocalPersistence,
browserSessionPersistence,
} = window.__firebaseCore || {};
var {
doc: _doc,
setDoc: _setDoc,
serverTimestamp: _serverTimestamp,
} = window.__firebaseCore || {};
let _authReady = false;
const _listeners = new Set();
let _currentUser = null;
let _unsubscribeAuth = null;
function initAuth() {
const ok = window.__firebaseCore ? window.__firebaseCore.initCore() : false;
if (!ok) {
console.warn('[auth] Firebase core not available — auth disabled.');
_authReady = false;
return false;
}
try {
_unsubscribeAuth = window.__firebaseCore.subscribeToAuth(function (user) {
if (user) {
_currentUser = {
uid: user.uid,
email: user.email,
displayName: user.displayName,
emailVerified: user.emailVerified,
createdAt: user.metadata ? user.metadata.creationTime : null,
lastSignIn: user.metadata ? user.metadata.lastSignInTime : null,
photoURL: user.photoURL || null,
isAnonymous: user.isAnonymous || false,
};
} else {
_currentUser = null;
}
_listeners.forEach(function (fn) {
try { fn(_currentUser); } catch (e) { console.warn('[auth] listener error:', e); }
});
});
_authReady = true;
return true;
} catch (e) {
console.warn('[auth] Init failed:', e.message);
_authReady = false;
return false;
}
}
function isAuthReady() {
return _authReady;
}
function getCurrentUser() {
return _currentUser;
}
async function fetchCurrentUser() {
if (!_authReady) {
_currentUser = null;
return null;
}
try {
const auth = window.__firebaseCore ? window.__firebaseCore.getAuth() : null;
if (!auth || !auth.currentUser) {
_currentUser = null;
return null;
}
await auth.currentUser.reload();
const user = auth.currentUser;
_currentUser = {
uid: user.uid,
email: user.email,
displayName: user.displayName,
emailVerified: user.emailVerified,
createdAt: user.metadata ? user.metadata.creationTime : null,
lastSignIn: user.metadata ? user.metadata.lastSignInTime : null,
photoURL: user.photoURL || null,
isAnonymous: user.isAnonymous || false,
};
return _currentUser;
} catch (e) {
console.warn('[auth] Error fetching user:', e.message);
return _currentUser;
}
}
function onAuthChange(fn) {
_listeners.add(fn);
if (_currentUser !== null) {
try { fn(_currentUser); } catch (e) {  }
}
return function () {
_listeners.delete(fn);
};
}
async function signUpWithEmail(email, password, displayName) {
const auth = window.__firebaseCore ? window.__firebaseCore.getAuth() : null;
const db = window.__firebaseCore ? window.__firebaseCore.getDb() : null;
if (!auth) {
throw new Error('Authentication service is not available.');
}
try {
const result = await createUserWithEmailAndPassword(auth, email, password);
if (displayName && result.user) {
await updateProfile(result.user, { displayName: displayName });
}
if (result.user && !result.user.emailVerified) {
await sendEmailVerification(result.user, {
url: window.location.origin + '/',
handleCodeInApp: true,
});
}
return { user: result.user };
} catch (e) {
throw _translateFirebaseError(e);
}
}
async function loginWithEmail(email, password, rememberMe) {
const auth = window.__firebaseCore ? window.__firebaseCore.getAuth() : null;
if (!auth) {
throw new Error('Authentication service is not available.');
}
try {
if (rememberMe) {
await setPersistence(auth, browserLocalPersistence);
} else {
await setPersistence(auth, browserSessionPersistence);
}
const result = await signInWithEmailAndPassword(auth, email, password);
return { user: result.user };
} catch (e) {
throw _translateFirebaseError(e);
}
}
async function logout() {
const auth = window.__firebaseCore ? window.__firebaseCore.getAuth() : null;
if (!auth) return;
try {
await signOut(auth);
_currentUser = null;
} catch (e) {
console.warn('[auth] Logout error:', e.message);
}
}
async function sendPasswordResetEmail(email) {
const auth = window.__firebaseCore ? window.__firebaseCore.getAuth() : null;
if (!auth) {
throw new Error('Authentication service is not available.');
}
try {
await _sendPasswordResetEmail(auth, email, {
url: window.location.origin + '/',
handleCodeInApp: true,
});
return 'Password reset email sent. Check your inbox.';
} catch (e) {
throw _translateFirebaseError(e);
}
}
async function confirmPasswordReset(oobCode, newPassword) {
const auth = window.__firebaseCore ? window.__firebaseCore.getAuth() : null;
if (!auth) {
throw new Error('Authentication service is not available.');
}
try {
await _confirmPasswordReset(auth, oobCode, newPassword);
return 'Password has been reset successfully. Please sign in.';
} catch (e) {
throw _translateFirebaseError(e);
}
}
function checkActionCode() {
var params = new URLSearchParams(window.location.search);
var mode = params.get('mode');
var oobCode = params.get('oobCode');
var continueUrl = params.get('continueUrl');
if (mode === 'resetPassword' && oobCode) {
return { mode: 'resetPassword', oobCode: oobCode, continueUrl: continueUrl };
}
if (mode === 'verifyEmail' && oobCode) {
return { mode: 'verifyEmail', oobCode: oobCode, continueUrl: continueUrl };
}
return { mode: null, oobCode: null, continueUrl: null };
}
async function applyVerificationCode(oobCode) {
const auth = window.__firebaseCore ? window.__firebaseCore.getAuth() : null;
if (!auth) {
throw new Error('Authentication service is not available.');
}
try {
await _applyActionCode(auth, oobCode);
if (auth.currentUser) {
await auth.currentUser.reload();
}
return 'Email verified successfully!';
} catch (e) {
throw _translateFirebaseError(e);
}
}
async function resendVerificationEmail() {
const auth = window.__firebaseCore ? window.__firebaseCore.getAuth() : null;
if (!auth || !auth.currentUser) {
throw new Error('No user is signed in.');
}
try {
await sendEmailVerification(auth.currentUser, {
url: window.location.origin + '/',
handleCodeInApp: true,
});
return 'Verification email sent.';
} catch (e) {
throw _translateFirebaseError(e);
}
}
async function updateDisplayName(newName) {
const auth = window.__firebaseCore ? window.__firebaseCore.getAuth() : null;
if (!auth || !auth.currentUser) {
throw new Error('No user is signed in.');
}
try {
await updateProfile(auth.currentUser, { displayName: newName });
if (_currentUser) _currentUser.displayName = newName;
return true;
} catch (e) {
throw _translateFirebaseError(e);
}
}
async function updateEmail(newEmail) {
const auth = window.__firebaseCore ? window.__firebaseCore.getAuth() : null;
if (!auth || !auth.currentUser) {
throw new Error('No user is signed in.');
}
try {
await _updateEmail(auth.currentUser, newEmail);
if (_currentUser) _currentUser.email = newEmail;
await sendEmailVerification(auth.currentUser, {
url: window.location.origin + '/',
handleCodeInApp: true,
});
return true;
} catch (e) {
throw _translateFirebaseError(e);
}
}
async function updatePassword(newPassword) {
const auth = window.__firebaseCore ? window.__firebaseCore.getAuth() : null;
if (!auth || !auth.currentUser) {
throw new Error('No user is signed in.');
}
try {
await _updatePassword(auth.currentUser, newPassword);
return true;
} catch (e) {
throw _translateFirebaseError(e);
}
}
async function reauthenticate(email, password) {
const auth = window.__firebaseCore ? window.__firebaseCore.getAuth() : null;
if (!auth || !auth.currentUser) {
throw new Error('No user is signed in.');
}
try {
const credential = EmailAuthProvider.credential(email, password);
await reauthenticateWithCredential(auth.currentUser, credential);
return true;
} catch (e) {
throw _translateFirebaseError(e);
}
}
async function deleteAccount() {
const auth = window.__firebaseCore ? window.__firebaseCore.getAuth() : null;
if (!auth || !auth.currentUser) {
throw new Error('No user is signed in.');
}
try {
await deleteUser(auth.currentUser);
_currentUser = null;
return true;
} catch (e) {
throw _translateFirebaseError(e);
}
}
function _translateFirebaseError(error) {
var code = error.code || error.message || 'unknown';
switch (code) {
case 'auth/email-already-in-use':
return new Error('This email is already registered. Try signing in instead.');
case 'auth/invalid-email':
return new Error('Please enter a valid email address.');
case 'auth/user-disabled':
return new Error('This account has been disabled.');
case 'auth/user-not-found':
case 'auth/wrong-password':
case 'auth/invalid-credential':
return new Error('Invalid email or password.');
case 'auth/weak-password':
return new Error('Password should be at least 6 characters.');
case 'auth/too-many-requests':
return new Error('Too many attempts. Please try again later.');
case 'auth/requires-recent-login':
return new Error('Please sign in again before making this change.');
case 'auth/network-request-failed':
return new Error('Network error. Check your connection and try again.');
case 'auth/operation-not-allowed':
return new Error('Email/password sign-in is not enabled. Please contact support.');
case 'auth/expired-action-code':
return new Error('This verification link has expired. Please request a new one.');
case 'auth/invalid-action-code':
return new Error('This verification link is invalid. Please request a new one.');
default:
console.warn('[auth] Untranslated error:', code);
return new Error('Something went wrong. Please try again.');
}
}
window.getCurrentUser = getCurrentUser;
window.initAuth = initAuth;
window.fetchCurrentUser = fetchCurrentUser;
window.onAuthChange = onAuthChange;
window.signUpWithEmail = signUpWithEmail;
window.loginWithEmail = loginWithEmail;
window.logout = logout;
window.sendPasswordResetEmail = sendPasswordResetEmail;
window.confirmPasswordReset = confirmPasswordReset;
window.checkActionCode = checkActionCode;
window.applyVerificationCode = applyVerificationCode;
window.resendVerificationEmail = resendVerificationEmail;
window.updateDisplayName = updateDisplayName;
window.updateEmail = updateEmail;
window.updatePassword = updatePassword;
window.reauthenticate = reauthenticate;
window.deleteAccount = deleteAccount;
window.__auth = {
init: initAuth,
isReady: isAuthReady,
getCurrentUser: getCurrentUser,
fetchCurrentUser: fetchCurrentUser,
onAuthChange: onAuthChange,
signUp: signUpWithEmail,
login: loginWithEmail,
logout: logout,
sendPasswordReset: sendPasswordResetEmail,
confirmPasswordReset: confirmPasswordReset,
checkActionCode: checkActionCode,
applyVerificationCode: applyVerificationCode,
resendVerification: resendVerificationEmail,
updateDisplayName: updateDisplayName,
updateEmail: updateEmail,
updatePassword: updatePassword,
reauthenticate: reauthenticate,
deleteAccount: deleteAccount,
};
var {
doc: _doc,
getDoc: _getDoc,
setDoc: _setDoc,
deleteDoc: _deleteDoc,
serverTimestamp: _serverTimestamp,
} = window.__firebaseCore || {};
let _syncReady = false;
let _syncTimer = null;
let _syncing = false;
function initSync() {
const coreOk = window.__firebaseCore ? window.__firebaseCore.initCore() : false;
if (!coreOk) {
console.warn('[sync] Firebase core not available — sync disabled.');
_syncReady = false;
return false;
}
try {
const db = window.__firebaseCore.getDb();
if (!db) {
console.warn('[sync] Firestore not available — sync disabled.');
_syncReady = false;
return false;
}
_syncReady = true;
console.log('[sync] Sync service initialized with v12 modular SDK.');
return true;
} catch (e) {
console.warn('[sync] Init failed:', e.message);
_syncReady = false;
return false;
}
}
function isSyncReady() {
return _syncReady;
}
function exportLocalData() {
var data = {};
function tryParse(key, lsKey) {
try {
var raw = localStorage.getItem(lsKey || key);
if (raw) data[key] = JSON.parse(raw);
} catch (e) {  }
}
tryParse('srsData', 'quran_srs_data');
tryParse('favorites', 'quran_favorites');
tryParse('notes', 'quran_notes');
tryParse('streak', 'quran_streak');
tryParse('quiz', 'quran_quiz');
tryParse('settings', 'quran_settings');
tryParse('lessonProgress', 'quran_lesson_progress');
tryParse('surahProgress', 'quran_surah_progress');
data._exportedAt = new Date().toISOString();
return data;
}
function importLocalData(data) {
var imported = [];
var skipped = [];
if (!data || typeof data !== 'object') {
return { imported: [], skipped: [], error: 'Invalid data format.' };
}
function trySet(key, lsKey, value) {
try {
localStorage.setItem(lsKey || key, JSON.stringify(value));
imported.push(key);
} catch (e) {
skipped.push(key);
}
}
var mappings = {
srsData: 'quran_srs_data',
favorites: 'quran_favorites',
notes: 'quran_notes',
streak: 'quran_streak',
quiz: 'quran_quiz',
settings: 'quran_settings',
lessonProgress: 'quran_lesson_progress',
surahProgress: 'quran_surah_progress',
};
Object.keys(mappings).forEach(function (key) {
if (data[key] !== undefined) {
trySet(key, mappings[key], data[key]);
}
});
return { imported: imported, skipped: skipped };
}
async function uploadToCloud(userId, retryCount) {
if (retryCount == null) retryCount = 0;
if (!_syncReady) {
console.warn('[sync] Cannot upload — sync not initialized.');
return false;
}
if (!userId) {
console.warn('[sync] Cannot upload — no user ID.');
return false;
}
try {
var data = exportLocalData();
delete data._exportedAt;
var db = window.__firebaseCore ? window.__firebaseCore.getDb() : null;
if (!db) {
console.warn('[sync] Firestore not available.');
return false;
}
var docRef = _doc(db, FIRESTORE_LEARNING_COLLECTION, userId);
await _setDoc(docRef, {
learningData: data,
updatedAt: _serverTimestamp(),
}, { merge: true });
console.log('[sync] Data uploaded to cloud.');
return true;
} catch (e) {
if (retryCount < 3 && _isRetryableError(e)) {
var delayMs = Math.pow(2, retryCount) * 1000;
console.warn('[sync] Upload failed (attempt ' + (retryCount + 1) + '), retrying in ' + delayMs + 'ms:', e.message);
await new Promise(function (resolve) { setTimeout(resolve, delayMs); });
return uploadToCloud(userId, retryCount + 1);
}
console.warn('[sync] Upload failed:', e.message);
return false;
}
}
function _isRetryableError(error) {
var code = error.code || '';
return code === 'unavailable' ||
code === 'resource-exhausted' ||
code === 'deadline-exceeded' ||
code === 'aborted' ||
(error.message && error.message.indexOf('network') >= 0);
}
async function downloadFromCloud(userId, retryCount) {
if (retryCount == null) retryCount = 0;
if (!_syncReady) {
console.warn('[sync] Cannot download — sync not initialized.');
return null;
}
if (!userId) {
console.warn('[sync] Cannot download — no user ID.');
return null;
}
try {
var db = window.__firebaseCore ? window.__firebaseCore.getDb() : null;
if (!db) {
console.warn('[sync] Firestore not available.');
return null;
}
var docRef = _doc(db, FIRESTORE_LEARNING_COLLECTION, userId);
var snap = await _getDoc(docRef);
if (!snap.exists()) {
console.log('[sync] No cloud data found for user.');
return null;
}
var result = snap.data();
return result.learningData || null;
} catch (e) {
if (retryCount < 3 && _isRetryableError(e)) {
var delayMs = Math.pow(2, retryCount) * 1000;
console.warn('[sync] Download failed (attempt ' + (retryCount + 1) + '), retrying in ' + delayMs + 'ms:', e.message);
await new Promise(function (resolve) { setTimeout(resolve, delayMs); });
return downloadFromCloud(userId, retryCount + 1);
}
console.warn('[sync] Download failed:', e.message);
return null;
}
}
function mergeData(localData, cloudData) {
if (!cloudData) return localData || {};
if (!localData) return cloudData || {};
var merged = {};
if (localData.srsData || cloudData.srsData) {
var localSRS = localData.srsData || {};
var cloudSRS = cloudData.srsData || {};
merged.srsData = {};
var allKeys = new Set();
Object.keys(localSRS).forEach(function (k) { allKeys.add(k); });
Object.keys(cloudSRS).forEach(function (k) { allKeys.add(k); });
allKeys.forEach(function (key) {
var local = localSRS[key];
var cloud = cloudSRS[key];
if (!local) {
merged.srsData[key] = cloud;
} else if (!cloud) {
merged.srsData[key] = local;
} else {
var localReviews = local.totalReviews || 0;
var cloudReviews = cloud.totalReviews || 0;
merged.srsData[key] = localReviews >= cloudReviews ? local : cloud;
}
});
}
if (localData.favorites || cloudData.favorites) {
merged.favorites = {};
var localFav = localData.favorites || {};
var cloudFav = cloudData.favorites || {};
Object.keys(localFav).forEach(function (k) { merged.favorites[k] = true; });
Object.keys(cloudFav).forEach(function (k) { merged.favorites[k] = true; });
}
if (localData.notes || cloudData.notes) {
merged.notes = {};
var localNotes = localData.notes || {};
var cloudNotes = cloudData.notes || {};
Object.keys(cloudNotes).forEach(function (k) { merged.notes[k] = cloudNotes[k]; });
Object.keys(localNotes).forEach(function (k) { merged.notes[k] = localNotes[k]; });
}
if (localData.streak || cloudData.streak) {
var localStreak = localData.streak || { streak: 0, lastDate: null };
var cloudStreak = cloudData.streak || { streak: 0, lastDate: null };
merged.streak = (localStreak.streak >= cloudStreak.streak) ? localStreak : cloudStreak;
}
merged.settings = localData.settings || cloudData.settings || null;
if (localData.quiz || cloudData.quiz) {
var localQuiz = localData.quiz || { correct: 0, total: 0 };
var cloudQuiz = cloudData.quiz || { correct: 0, total: 0 };
merged.quiz = {
correct: Math.max(localQuiz.correct || 0, cloudQuiz.correct || 0),
total: Math.max(localQuiz.total || 0, cloudQuiz.total || 0),
};
}
if (localData.surahProgress || cloudData.surahProgress) {
var localSP = localData.surahProgress || { completedSurahs: [], quizPassed: {} };
var cloudSP = cloudData.surahProgress || { completedSurahs: [], quizPassed: {} };
merged.surahProgress = (localSP.completedSurahs.length >= cloudSP.completedSurahs.length) ? localSP : cloudSP;
}
return merged;
}
async function fullSync(userId) {
if (!userId) {
console.warn('[sync] Full sync requires a user ID.');
return false;
}
_syncing = true;
try {
var localData = exportLocalData();
var cloudData = await downloadFromCloud(userId);
var merged = mergeData(localData, cloudData);
var result = importLocalData(merged);
console.log('[sync] Merged data written to localStorage:', result.imported.length, 'keys');
var uploadOk = await uploadToCloud(userId);
_syncing = false;
return uploadOk;
} catch (e) {
console.warn('[sync] Full sync failed:', e.message);
_syncing = false;
return false;
}
}
function queueSync(userId) {
if (!_syncReady || !userId) return;
if (_syncTimer) {
clearTimeout(_syncTimer);
}
_syncTimer = setTimeout(function () {
if (_syncing) return;
uploadToCloud(userId)
.then(function (ok) {
if (ok) {
try { localStorage.removeItem(PENDING_SYNC_KEY); } catch (e) {  }
}
})
.catch(function (e) {
console.warn('[sync] Debounced sync failed:', e.message);
try { localStorage.setItem(PENDING_SYNC_KEY, 'true'); } catch (e) {  }
});
}, SYNC_DEBOUNCE_MS);
}
function hasPendingSync() {
try {
return localStorage.getItem(PENDING_SYNC_KEY) === 'true';
} catch (e) {
return false;
}
}
function getSyncStatus() {
return {
ready: _syncReady,
syncing: _syncing,
pending: hasPendingSync(),
user: typeof getCurrentUser === 'function' ? getCurrentUser()?.uid : null,
};
}
window.__sync = {
init: initSync,
isReady: isSyncReady,
exportData: exportLocalData,
importData: importLocalData,
uploadToCloud: uploadToCloud,
downloadFromCloud: downloadFromCloud,
mergeData: mergeData,
fullSync: fullSync,
queueSync: queueSync,
hasPending: hasPendingSync,
getStatus: getSyncStatus,
};
var {
doc: _doc,
getDoc: _getDoc,
setDoc: _setDoc,
deleteDoc: _deleteDoc,
serverTimestamp: _serverTimestamp,
} = window.__firebaseCore || {};
let _userReady = false;
function initUserService() {
const coreOk = window.__firebaseCore ? window.__firebaseCore.initCore() : false;
if (!coreOk) {
console.warn('[user] Firebase core not available.');
_userReady = false;
return false;
}
const db = window.__firebaseCore ? window.__firebaseCore.getDb() : null;
if (!db) {
console.warn('[user] Firestore not available.');
_userReady = false;
return false;
}
_userReady = true;
return true;
}
function isUserServiceReady() {
return _userReady;
}
async function saveProfile(userId, profileData) {
if (!_userReady) {
console.warn('[user] Cannot save profile — service not ready.');
return false;
}
if (!userId) return false;
try {
var db = window.__firebaseCore ? window.__firebaseCore.getDb() : null;
if (!db) return false;
var docRef = _doc(db, FIRESTORE_PROFILE_COLLECTION, userId);
var data = {
updatedAt: _serverTimestamp(),
};
if (profileData.displayName !== undefined) data.displayName = profileData.displayName;
if (profileData.email !== undefined) data.email = profileData.email;
if (profileData.avatarUrl !== undefined) data.avatarUrl = profileData.avatarUrl;
if (profileData.settings !== undefined) data.settings = profileData.settings;
await _setDoc(docRef, data, { merge: true });
return true;
} catch (e) {
console.warn('[user] Save profile failed:', e.message);
return false;
}
}
async function loadProfile(userId) {
if (!_userReady) {
console.warn('[user] Cannot load profile — service not ready.');
return null;
}
if (!userId) return null;
try {
var db = window.__firebaseCore ? window.__firebaseCore.getDb() : null;
if (!db) return null;
var docRef = _doc(db, FIRESTORE_PROFILE_COLLECTION, userId);
var snap = await _getDoc(docRef);
if (!snap.exists()) return null;
return snap.data();
} catch (e) {
console.warn('[user] Load profile failed:', e.message);
return null;
}
}
async function deleteProfile(userId) {
if (!_userReady) return false;
if (!userId) return false;
try {
var db = window.__firebaseCore ? window.__firebaseCore.getDb() : null;
if (!db) return false;
await _deleteDoc(_doc(db, FIRESTORE_PROFILE_COLLECTION, userId));
await _deleteDoc(_doc(db, FIRESTORE_LEARNING_COLLECTION, userId));
return true;
} catch (e) {
console.warn('[user] Delete profile failed:', e.message);
return false;
}
}
function getDefaultSettings() {
return {
dailyReviewLimit: 25,
sessionSize: 20,
autoImportOnLogin: true,
};
}
function mergeSettings(saved) {
var defaults = getDefaultSettings();
if (!saved || typeof saved !== 'object') return defaults;
var result = {};
Object.keys(defaults).forEach(function (key) {
result[key] = (saved[key] !== undefined) ? saved[key] : defaults[key];
});
return result;
}
function computeLearningSummary() {
var srsStats = typeof getSRSStats === 'function' ? getSRSStats() : { total: 0, mature: 0, totalReviews: 0 };
var streakData = typeof loadStreakData === 'function' ? loadStreakData() : { streak: 0 };
return {
totalWords: srsStats.total || 0,
wordsMastered: srsStats.mature || 0,
totalReviews: srsStats.totalReviews || 0,
streak: streakData.streak || 0,
averageRetention: srsStats.avgRetention || 0,
};
}
async function exportAccountData(userId) {
var data = {
exportedAt: new Date().toISOString(),
version: 1,
};
try {
var profile = await loadProfile(userId);
if (profile) data.profile = profile;
} catch (e) {  }
try {
var db = window.__firebaseCore ? window.__firebaseCore.getDb() : null;
if (db) {
var snap = await _getDoc(_doc(db, FIRESTORE_LEARNING_COLLECTION, userId));
if (snap.exists()) {
data.learningData = snap.data().learningData;
}
}
} catch (e) {  }
try {
if (typeof exportLocalData === 'function') {
var local = exportLocalData();
if (local) data.localData = local;
}
} catch (e) {  }
return data;
}
window.__user = {
init: initUserService,
isReady: isUserServiceReady,
saveProfile: saveProfile,
loadProfile: loadProfile,
deleteProfile: deleteProfile,
getDefaultSettings: getDefaultSettings,
mergeSettings: mergeSettings,
computeLearningSummary: computeLearningSummary,
exportAccount: exportAccountData,
};
const TYPE_CATEGORIES = {
noun: 'Nouns',
verb: 'Verbs',
particle: 'Particles',
adjective: 'Adjectives',
pronoun: 'Pronouns',
exclamation: 'Exclamations',
};
var _wordIndex = null;
var _arabicToIds = null;
function buildWordIndex() {
_wordIndex = {};
_arabicToIds = {};
for (var i = 0; i < ALL_WORDS.length; i++) {
var w = ALL_WORDS[i];
_wordIndex[w.id] = w;
if (!_arabicToIds[w.arabic]) _arabicToIds[w.arabic] = [];
_arabicToIds[w.arabic].push(w.id);
}
}
function findWordById(id) {
if (!_wordIndex) buildWordIndex();
return _wordIndex[id];
}
function findWordByArabic(arabic) {
if (!_arabicToIds) buildWordIndex();
var ids = _arabicToIds[arabic];
if (ids && ids.length > 0) {
return findWordById(ids[0]) || undefined;
}
return undefined;
}
function findWordsByArabic(arabic) {
if (!_arabicToIds) buildWordIndex();
var ids = _arabicToIds[arabic] || [];
return ids.map(function(id) { return findWordById(id); }).filter(Boolean);
}
function findWordsByArabicList(arabicList) {
var result = [];
if (!arabicList || !arabicList.length) return result;
for (var i = 0; i < arabicList.length; i++) {
var words = findWordsByArabic(arabicList[i]);
if (words.length > 0) result.push(words[0]);
}
return result;
}
function searchWords(query) {
if (!query || query.trim() === '') {
return (typeof getCanonicalWords === 'function' && getCanonicalWords().length > 0)
? getCanonicalWords() : ALL_WORDS;
}
const q = query.trim().toLowerCase();
var words = (typeof getCanonicalWords === 'function' && getCanonicalWords().length > 0)
? getCanonicalWords() : ALL_WORDS;
return words.filter(function (w) {
var matches = (
w.arabic.includes(q) ||
w.translit.toLowerCase().includes(q) ||
w.english.toLowerCase().includes(q) ||
w.meaning.toLowerCase().includes(q) ||
w.root.includes(q) ||
(w.pattern && w.pattern.includes(q)) ||
(w.tags || []).some(function (t) { return t.includes(q); }) ||
w.type.toLowerCase().includes(q)
);
if (!matches && w.occurrences) {
for (var oi = 0; oi < w.occurrences.length; oi++) {
var occ = w.occurrences[oi];
if (
(occ.ayahA && occ.ayahA.includes(q)) ||
(occ.ayahT && occ.ayahT.toLowerCase().includes(q)) ||
(occ.tafsir && occ.tafsir.toLowerCase().includes(q)) ||
(occ.verseKey && occ.verseKey.includes(q))
) {
matches = true;
break;
}
if (occ.surahId) {
var surahName = getSurahEnglishName(occ.surahId).toLowerCase();
var surahNameSimple = getSurahNameSimple(occ.surahId).toLowerCase();
if (surahName.includes(q) || surahNameSimple.includes(q)) {
matches = true;
break;
}
}
}
}
return matches;
});
}
function filterByCategory(words, category) {
if (!category || category === 'all') return words;
return words.filter(function (w) { return w.typeCategory === category; });
}
function filterByDifficulty(words, difficulty) {
if (!difficulty) return words;
return words.filter(function (w) { return w.difficulty === difficulty; });
}
function filterBySurah(words, surahId) {
if (!surahId || surahId === 'all') return words;
return words.filter(function (w) { return w.surahId === surahId; });
}
function filterByTag(words, tag) {
if (!tag || tag === 'all') return words;
return words.filter(function (w) {
return (w.tags || []).indexOf(tag) >= 0;
});
}
function filterByStatus(words, statusFilter) {
if (!statusFilter || statusFilter === 'all') return words;
return words.filter(function (w) {
var srs = getSRSStatus(w.id);
if (statusFilter === 'new') return srs.status === 'new';
if (statusFilter === 'learning') return srs.status === 'review';
if (statusFilter === 'mastered') return srs.status === 'mastered';
return true;
});
}
function filterByFavorites(words) {
var favs = loadFavorites();
return words.filter(function (w) { return favs[w.id]; });
}
function getDistractors(correctWord, count) {
if (count == null) count = 3;
var pool = ALL_WORDS.filter(function (w) { return w !== correctWord; });
var sameType = pool.filter(function (w) { return w.typeCategory === correctWord.typeCategory; });
var sameRoot = pool.filter(function (w) { return w.root === correctWord.root && w.typeCategory !== correctWord.typeCategory; });
var other = pool.filter(function (w) {
return w.typeCategory !== correctWord.typeCategory && w.root !== correctWord.root;
});
var distractors = [];
var used = {};
function addCandidate(candidate) {
if (distractors.length >= count) return;
var key = candidate.arabic + '|' + candidate.english;
if (used[key]) return;
if (candidate.english === correctWord.english) return;
used[key] = true;
distractors.push(candidate);
}
shuffleArray(sameType).forEach(addCandidate);
shuffleArray(sameRoot).forEach(addCandidate);
shuffleArray(other).forEach(addCandidate);
if (distractors.length < count) {
shuffleArray(pool).forEach(addCandidate);
}
return distractors.slice(0, count);
}
function shuffleArray(arr) {
var a = arr.slice();
for (var i = a.length - 1; i > 0; i--) {
var j = Math.floor(Math.random() * (i + 1));
var tmp = a[i];
a[i] = a[j];
a[j] = tmp;
}
return a;
}
function getAllTags() {
var tags = {};
ALL_WORDS.forEach(function (w) {
(w.tags || []).forEach(function (t) { tags[t] = true; });
});
return Object.keys(tags).sort();
}
function getTypeCategories() {
return TYPE_CATEGORIES;
}
function getVocabularyStats() {
return getSRSStats();
}
const FAVORITES_KEY = 'quran_favorites';
function loadFavorites() {
try {
var raw = localStorage.getItem(FAVORITES_KEY);
if (!raw) return {};
var data = JSON.parse(raw);
return _migrateLegacyKeys(data, false);
} catch (e) {
return {};
}
}
function _migrateLegacyKeys(data, keepValue) {
if (!data || typeof data !== 'object') return {};
var keys = Object.keys(data);
var needsMigration = keys.some(function(k) { return k && k.indexOf('w_') !== 0; });
if (!needsMigration) return data;
var arabicToFirstId = {};
for (var j = 0; j < ALL_WORDS.length; j++) {
var w = ALL_WORDS[j];
if (!arabicToFirstId[w.arabic]) {
arabicToFirstId[w.arabic] = w.id;
}
}
var migrated = {};
for (var k = 0; k < keys.length; k++) {
var key = keys[k];
if (key.indexOf('w_') === 0) {
migrated[key] = data[key];
} else {
var id = arabicToFirstId[key];
if (id) {
migrated[id] = keepValue ? data[key] : true;
}
}
}
return migrated;
}
function saveFavorites(data) {
try {
localStorage.setItem(FAVORITES_KEY, JSON.stringify(data));
} catch (e) {
console.warn('Could not save favorites:', e.message);
}
}
function toggleFavorite(wordId) {
var favs = loadFavorites();
if (favs[wordId]) {
delete favs[wordId];
} else {
favs[wordId] = true;
}
saveFavorites(favs);
return !!favs[wordId];
}
function isFavorite(wordId) {
var favs = loadFavorites();
return !!favs[wordId];
}
const NOTES_KEY = 'quran_notes';
function loadNotes() {
try {
var raw = localStorage.getItem(NOTES_KEY);
if (!raw) return {};
var data = JSON.parse(raw);
return migrateNotesIfNeeded(data);
} catch (e) {
return {};
}
}
function migrateNotesIfNeeded(notes) {
return _migrateLegacyKeys(notes, true);
}
function saveNotes(data) {
try {
localStorage.setItem(NOTES_KEY, JSON.stringify(data));
} catch (e) {
console.warn('Could not save notes:', e.message);
}
}
function getNote(wordId) {
var notes = loadNotes();
return notes[wordId] || '';
}
function setNote(wordId, text) {
var notes = loadNotes();
notes[wordId] = text;
saveNotes(notes);
}
const SRS_STORAGE_KEY = 'quran_srs_data';
const DEFAULT_DAILY_REVIEW_LIMIT = 25;
var DAILY_REVIEW_LIMIT = DEFAULT_DAILY_REVIEW_LIMIT;
function updateDailyReviewLimit(limit) {
if (typeof limit === 'number' && limit >= 5 && limit <= 1000) {
DAILY_REVIEW_LIMIT = limit;
}
}
const MIN_EASE = 1.3;
const MAX_EASE = 3.0;
const DEFAULT_EASE = 2.5;
const LEECH_THRESHOLD = 3;
const LEECH_RECOVERY = 3;
const LEARNING_GRADUATION = 3;
const YOUNG_GRADUATION = 6;
const YOUNG_MAX_INTERVAL = 21;
const DAY_MS = 24 * 60 * 60 * 1000;
const STAGE1_AGAIN =  [0.007, 0.04,  0.17];
const STAGE1_HARD =   [0.04,  0.17,  1];
const STAGE1_GOOD =   [1,     2,     4];
const STAGE1_EASY =   [2,     4,     8];
function loadSRS() {
try {
var raw = localStorage.getItem(SRS_STORAGE_KEY);
if (!raw) return {};
var parsed = JSON.parse(raw);
if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
console.warn('SRS data malformed, resetting.');
return {};
}
var needsSave = false;
var migrated = {};
var arabicToFirstId = {};
for (var mi = 0; mi < ALL_WORDS.length; mi++) {
var mw = ALL_WORDS[mi];
if (!arabicToFirstId[mw.arabic]) {
arabicToFirstId[mw.arabic] = mw.id;
}
}
var tempEntries = {};
Object.keys(parsed).forEach(function (key) {
var entry = parsed[key];
if (key === '_leechRecovery') {
return;
}
if (entry.stage === undefined) {
entry = migrateLegacy(entry);
needsSave = true;
}
var canonicalKey = null;
if (key.indexOf('cw_') === 0) {
canonicalKey = key;
} else if (key.indexOf('w_') === 0) {
canonicalKey = (typeof getCanonicalIdForOldId === 'function')
? getCanonicalIdForOldId(key) : null;
} else {
var oldId = arabicToFirstId[key];
if (oldId) {
canonicalKey = (typeof getCanonicalIdForOldId === 'function')
? getCanonicalIdForOldId(oldId) : null;
}
}
if (!canonicalKey) {
canonicalKey = key;
}
if (!tempEntries[canonicalKey]) {
tempEntries[canonicalKey] = [];
}
tempEntries[canonicalKey].push(entry);
});
Object.keys(tempEntries).forEach(function (cid) {
var entries = tempEntries[cid];
if (entries.length === 1) {
migrated[cid] = entries[0];
} else {
migrated[cid] = mergeSRSEntries(entries);
needsSave = true;
console.log('[srs] Merged ' + entries.length + ' SRS entries into canonical ID: ' + cid);
}
});
if (parsed._leechRecovery) {
migrated._leechRecovery = migrateLeechRecoveryToCanonical(parsed._leechRecovery);
if (JSON.stringify(migrated._leechRecovery) !== JSON.stringify(parsed._leechRecovery)) {
needsSave = true;
}
}
if (needsSave) saveSRS(migrated);
return migrated;
} catch (e) {
console.warn('Could not load SRS data:', e.message);
return {};
}
}
function mergeSRSEntries(entries) {
var best = {
stage: 0,
dueDate: 0,
interval: 0,
lastRating: 2,
ratedAt: 0,
reps: 0,
totalReviews: 0,
lapses: 0,
easeFactor: DEFAULT_EASE,
leechCount: 0,
isLeech: false,
};
for (var i = 0; i < entries.length; i++) {
var e = entries[i];
if (e.stage > best.stage) {
best.stage = e.stage;
best.dueDate = e.dueDate;
best.interval = e.interval;
best.lastRating = e.lastRating;
best.ratedAt = e.ratedAt;
} else if (e.stage === best.stage && e.ratedAt > best.ratedAt) {
best.dueDate = e.dueDate;
best.interval = e.interval;
best.lastRating = e.lastRating;
best.ratedAt = e.ratedAt;
}
best.reps += e.reps || 0;
best.totalReviews += e.totalReviews || 0;
best.lapses += e.lapses || 0;
if (e.easeFactor && e.easeFactor > best.easeFactor && e.easeFactor <= MAX_EASE) {
best.easeFactor = e.easeFactor;
}
if (e.isLeech) {
best.isLeech = true;
}
best.leechCount += (e.leechCount || 0);
}
return best;
}
function migrateLeechRecoveryToCanonical(recovery) {
if (!recovery || typeof recovery !== 'object') return recovery || {};
var result = {};
Object.keys(recovery).forEach(function (key) {
var value = recovery[key];
var idPart = key.replace(/^leech_/, '');
var canonicalId = null;
if (idPart.indexOf('cw_') === 0) {
canonicalId = idPart;
} else if (typeof getCanonicalIdForOldId === 'function') {
canonicalId = getCanonicalIdForOldId(idPart);
}
if (canonicalId) {
var newKey = 'leech_' + canonicalId;
result[newKey] = (result[newKey] || 0) + value;
}
});
return result;
}
function migrateLeechRecoveryKeys(data) {
var recovery = data._leechRecovery;
if (!recovery) return false;
var needsSave = false;
var newRecovery = {};
var hasChanges = false;
Object.keys(recovery).forEach(function (key) {
if (key.indexOf('w_') === 0) {
newRecovery[key] = recovery[key];
} else {
var arabicPart = key.replace(/^leech_/, '');
for (var i = 0; i < ALL_WORDS.length; i++) {
if (ALL_WORDS[i].arabic === arabicPart) {
newRecovery['leech_' + ALL_WORDS[i].id] = recovery[key];
hasChanges = true;
break;
}
}
}
});
if (hasChanges) {
data._leechRecovery = newRecovery;
return true;
}
return false;
}
function migrateLegacy(entry) {
var interval = entry.interval || 0;
var stage = 1;
if (interval >= YOUNG_MAX_INTERVAL) {
stage = 3;
} else if (interval >= 3) {
stage = 2;
}
return {
dueDate: entry.dueDate || Date.now(),
interval: interval,
lastRating: entry.lastRating !== undefined ? entry.lastRating : 2,
ratedAt: entry.ratedAt || Date.now(),
stage: stage,
reps: 0,
totalReviews: 0,
lapses: 0,
easeFactor: DEFAULT_EASE,
leechCount: 0,
isLeech: false,
};
}
function saveSRS(data) {
try {
localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(data));
} catch (e) {
console.warn('Could not save SRS data:', e.message);
}
}
function getSRSStatus(wordId) {
var data = loadSRS();
var entry = data[wordId];
if (!entry || entry.stage === 0) {
return {
status: 'new',
stage: 0,
dueDate: null,
interval: 0,
easeFactor: DEFAULT_EASE,
isLeech: false,
retention: 1,
daysUntilDue: null,
};
}
var now = Date.now();
var daysUntilDue = (entry.dueDate - now) / DAY_MS;
var isDue = now >= entry.dueDate;
var retention = estimateRetention(entry);
if (isDue) {
return {
status: 'review',
stage: entry.stage,
dueDate: entry.dueDate,
interval: entry.interval,
easeFactor: entry.easeFactor,
isLeech: !!entry.isLeech,
retention: retention,
daysUntilDue: -Math.max(0, Math.round(-daysUntilDue)),
};
}
return {
status: 'mastered',
stage: entry.stage,
dueDate: entry.dueDate,
interval: entry.interval,
easeFactor: entry.easeFactor,
isLeech: !!entry.isLeech,
retention: retention,
daysUntilDue: Math.round(daysUntilDue),
};
}
function estimateRetention(entry) {
if (!entry || !entry.interval || entry.interval <= 0) return 1;
var daysSinceReview = (Date.now() - (entry.ratedAt || entry.dueDate)) / DAY_MS;
if (daysSinceReview <= 0) return 0.99;
var halfLife = entry.interval * 0.5;
var retention = Math.pow(0.9, daysSinceReview / halfLife);
return Math.max(0.6, Math.min(0.99, retention));
}
function getRetentionPercent(wordId) {
var srs = getSRSStatus(wordId);
return Math.round(srs.retention * 100);
}
function rateSRSWord(wordId, rating) {
if (!wordId) return;
var data = loadSRS();
var entry = data[wordId];
if (!entry) {
entry = {
dueDate: Date.now(),
interval: 0,
lastRating: rating,
ratedAt: Date.now(),
stage: 1,
reps: 0,
totalReviews: 0,
lapses: 0,
easeFactor: DEFAULT_EASE,
leechCount: 0,
isLeech: false,
};
data[wordId] = entry;
}
entry.totalReviews = (entry.totalReviews || 0) + 1;
if (rating === 0) {
entry.lapses = (entry.lapses || 0) + 1;
entry.leechCount = (entry.leechCount || 0) + 1;
} else {
entry.leechCount = Math.max(0, (entry.leechCount || 0) - 1);
}
if (entry.leechCount >= LEECH_THRESHOLD) {
entry.isLeech = true;
} else if (entry.isLeech && rating >= 2) {
data._leechRecovery = data._leechRecovery || {};
var recoveryKey = 'leech_' + wordId;
data._leechRecovery[recoveryKey] = (data._leechRecovery[recoveryKey] || 0) + 1;
if (data._leechRecovery[recoveryKey] >= LEECH_RECOVERY) {
entry.isLeech = false;
entry.leechCount = 0;
delete data._leechRecovery[recoveryKey];
if (Object.keys(data._leechRecovery).length === 0) {
delete data._leechRecovery;
}
}
} else if (entry.isLeech && rating < 2) {
data._leechRecovery = data._leechRecovery || {};
delete data._leechRecovery['leech_' + wordId];
if (Object.keys(data._leechRecovery).length === 0) {
delete data._leechRecovery;
}
}
if (rating >= 2) {
entry.reps = (entry.reps || 0) + 1;
}
var ef = entry.easeFactor || DEFAULT_EASE;
if (rating === 0) ef = Math.max(MIN_EASE, ef - 0.20);
else if (rating === 1) ef = Math.max(MIN_EASE, ef - 0.15);
else if (rating === 3) ef = Math.min(MAX_EASE, ef + 0.15);
entry.easeFactor = ef;
var prevInterval = entry.interval || 0;
var stage = entry.stage;
var newInterval = 0;
var newStage = stage;
switch (stage) {
case 1:
newInterval = computeLearningInterval(rating, prevInterval, entry);
if (entry.totalReviews >= LEARNING_GRADUATION && rating >= 2) {
newStage = 2;
}
if (rating === 0) {
}
break;
case 2:
if (rating === 0) {
newStage = 1;
newInterval = computeLearningInterval(rating, 0, entry);
} else if (rating === 1) {
newInterval = Math.max(1, prevInterval * 1.2);
} else if (rating === 2) {
newInterval = prevInterval * ef;
} else {
newInterval = prevInterval * ef * 1.3;
}
if (entry.reps >= YOUNG_GRADUATION && newInterval >= YOUNG_MAX_INTERVAL) {
newStage = 3;
}
break;
case 3:
if (rating === 0) {
newStage = 2;
newInterval = 1;
} else if (rating === 1) {
newInterval = Math.max(7, prevInterval * 1.2);
} else if (rating === 2) {
newInterval = prevInterval * ef;
} else {
newInterval = prevInterval * ef * 1.3;
}
break;
default:
newInterval = computeLearningInterval(rating, 0, entry);
newStage = 1;
}
if (entry.isLeech) {
newInterval = Math.min(newInterval, 7);
}
newInterval = Math.round(newInterval * 10) / 10;
var dueDate = Date.now() + Math.round(newInterval * DAY_MS);
entry.interval = newInterval;
entry.dueDate = dueDate;
entry.lastRating = rating;
entry.ratedAt = Date.now();
entry.stage = newStage;
data[wordId] = entry;
saveSRS(data);
}
function computeLearningInterval(rating, prevInterval, entry) {
var attemptCount = Math.min(entry.totalReviews || 0, 2);
switch (rating) {
case 0:
return STAGE1_AGAIN[attemptCount] || STAGE1_AGAIN[2];
case 1:
return STAGE1_HARD[attemptCount] || STAGE1_HARD[2];
case 2:
return STAGE1_GOOD[attemptCount] || STAGE1_GOOD[2];
case 3:
return STAGE1_EASY[attemptCount] || STAGE1_EASY[2];
default:
return 1;
}
}
function getDueReviews() {
var data = loadSRS();
var now = Date.now();
var due = [];
var words = (typeof getActiveLessonWords === 'function') ? getActiveLessonWords() : ALL_WORDS;
if (!words || words.length === 0) words = ALL_WORDS;
words.forEach(function (w) {
var entry = data[w.id];
if (!entry) return;
if (now >= entry.dueDate) {
due.push({
word: w,
entry: entry,
overdueMs: now - entry.dueDate,
});
}
});
due.sort(function (a, b) {
if (a.entry.isLeech && !b.entry.isLeech) return -1;
if (!a.entry.isLeech && b.entry.isLeech) return 1;
return b.overdueMs - a.overdueMs;
});
var limit = Math.min(DAILY_REVIEW_LIMIT, due.length);
return due.slice(0, limit).map(function (d) { return d.word; });
}
function getNewWords() {
var data = loadSRS();
var words = (typeof getActiveLessonWords === 'function') ? getActiveLessonWords() : ALL_WORDS;
if (!words || words.length === 0) words = ALL_WORDS;
return words.filter(function (w) {
var entry = data[w.id];
return !entry || entry.stage === 0;
});
}
function getTodayStart() {
var d = new Date();
d.setHours(0, 0, 0, 0);
return d.getTime();
}
function getSRSStats() {
var data = loadSRS();
var now = Date.now();
var stats = {
total: 0,
newCount: 0,
learning: 0,
young: 0,
mature: 0,
leechCount: 0,
dueToday: 0,
overdue: 0,
totalReviews: 0,
avgRetention: 0,
avgEaseFactor: 0,
reviewsToday: 0,
};
var todayStart = getTodayStart();
var retentionSum = 0;
var retentionCount = 0;
var efSum = 0;
var efCount = 0;
ALL_WORDS.forEach(function (w) {
stats.total++;
var entry = data[w.id];
if (!entry || entry.stage === 0) {
stats.newCount++;
return;
}
if (entry.stage === 1) stats.learning++;
else if (entry.stage === 2) stats.young++;
else if (entry.stage >= 3) stats.mature++;
if (entry.isLeech) stats.leechCount++;
if (now >= entry.dueDate) {
stats.dueToday++;
if (now - entry.dueDate > DAY_MS) stats.overdue++;
}
stats.totalReviews += entry.totalReviews || 0;
if (entry.ratedAt && entry.ratedAt >= todayStart) {
stats.reviewsToday++;
}
if (entry.interval > 0) {
retentionSum += estimateRetention(entry);
retentionCount++;
}
if (entry.easeFactor) {
efSum += entry.easeFactor;
efCount++;
}
});
stats.avgRetention = retentionCount > 0 ? Math.round((retentionSum / retentionCount) * 100) : 100;
stats.avgEaseFactor = efCount > 0 ? Math.round((efSum / efCount) * 100) / 100 : DEFAULT_EASE;
return stats;
}
let _cachedStats = null;
let _lastStatsTime = 0;
const STATS_CACHE_TTL = 2000;
function getSRSStatsCached() {
var now = Date.now();
if (_cachedStats && (now - _lastStatsTime) < STATS_CACHE_TTL) {
return _cachedStats;
}
_cachedStats = getSRSStats();
_lastStatsTime = now;
return _cachedStats;
}
function invalidateStatsCache() {
_cachedStats = null;
_lastStatsTime = 0;
if (typeof invalidateStatsCaches === 'function') {
invalidateStatsCaches();
}
}
window.__srs = {
loadSRS: loadSRS,
saveSRS: saveSRS,
getSRSStatus: getSRSStatus,
rateWord: rateSRSWord,
getDueReviews: getDueReviews,
getNewWords: getNewWords,
getStats: getSRSStatsCached,
getRetention: getRetentionPercent,
estimateRetention: estimateRetention,
updateDailyReviewLimit: updateDailyReviewLimit,
getDailyReviewLimit: function() { return DAILY_REVIEW_LIMIT; },
invalidateStatsCache: invalidateStatsCache,
};
const DOM = {
_cache: {},
get: function(id) {
if (!this._cache[id]) {
this._cache[id] = document.getElementById(id);
}
return this._cache[id];
}
};
function getShortMeaning(meaning) {
return (meaning || '').split('\u2014')[0].trim();
}
function setView(viewName) {
const views = ['learn', 'quiz', 'list', 'stats', 'auth', 'profile', 'settings'];
for (var i = 0; i < views.length; i++) {
var name = views[i];
var viewEl = DOM.get('view-' + name);
if (viewEl) viewEl.classList.toggle('active', name === viewName);
if (name === 'learn' || name === 'quiz' || name === 'list' || name === 'stats') {
var tabEl = DOM.get('tab-' + name);
if (tabEl) tabEl.classList.toggle('active', name === viewName);
}
}
if (window.__viewHasBeenSet) {
var viewEl = DOM.get('view-' + viewName);
if (viewEl) {
viewEl.classList.remove('view-animate');
void viewEl.offsetHeight;
viewEl.classList.add('view-animate');
}
} else {
window.__viewHasBeenSet = true;
}
var content = DOM.get('content');
if (content) content.scrollTop = 0;
}
let _currentOccurrenceIdx = 0;
function renderWordCard(w, currentIndex, total, isReview) {
if (!w) return;
_currentOccurrenceIdx = 0;
DOM.get('word-num').textContent = (isReview ? 'Review' : 'Word') + ' ' + (currentIndex + 1) + ' of ' + total;
DOM.get('arabic-word').textContent = w.arabic;
DOM.get('transliteration').textContent = w.translit;
DOM.get('word-type').textContent = w.type;
var occ = null;
var occCount = 0;
if (w.occurrences && w.occurrences.length > 0) {
occCount = w.occurrences.length;
occ = w.occurrences[_currentOccurrenceIdx % w.occurrences.length];
}
var surahBadge = DOM.get('surah-badge');
if (surahBadge) {
if (occ && occ.surahId && SURAH_INFO) {
var si = SURAH_INFO[occ.surahId];
var verseRef = occ.verseKey ? occ.verseKey.split(':')[1] : '';
var occLabel = occCount > 1 ? ' (' + (_currentOccurrenceIdx + 1) + '/' + occCount + ')' : '';
surahBadge.textContent = '📖 ' + (si ? si.name : 'Surah ' + occ.surahId) + (verseRef ? ' · Verse ' + verseRef : '') + occLabel;
surahBadge.style.display = 'block';
} else if (w.surahIds && w.surahIds.length > 0 && SURAH_INFO) {
var firstSurah = SURAH_INFO[w.surahIds[0]];
surahBadge.textContent = '📖 ' + (firstSurah ? firstSurah.name : 'Surah ' + w.surahIds[0]);
surahBadge.style.display = 'block';
} else {
surahBadge.style.display = 'none';
}
}
var patternEl = DOM.get('word-pattern');
if (patternEl) {
if (w.pattern && w.pattern !== '\u2014') {
patternEl.textContent = 'Pattern: ' + w.pattern;
patternEl.style.display = 'block';
} else {
patternEl.style.display = 'none';
}
}
DOM.get('meaning').textContent = w.meaning;
var occLabel = occCount > 1 ? ' (' + occCount + ' contexts)' : '';
DOM.get('occurrences').textContent = '\u2726 Appears ' + w.occ.toLocaleString() + ' times' + occLabel;
DOM.get('progress-fill').style.width = Math.round(((currentIndex + 1) / total) * 100) + '%';
DOM.get('progress-text').textContent = (currentIndex + 1) + ' / ' + total;
var prevBtn = DOM.get('btn-prev');
if (prevBtn) prevBtn.disabled = currentIndex === 0;
var nextBtn = DOM.get('btn-next');
if (nextBtn) {
nextBtn.textContent = currentIndex < total - 1 ? 'Next \u2192' : isReview ? 'Done \u2713' : 'Quiz \u270F\uFE0F';
}
renderSRSStatusPill(w.id);
renderRootBox(w);
renderWordNetwork(w);
window.__currentOccurrence = occ;
var ayahBox = DOM.get('ayah-box');
var tafsirBox = DOM.get('tafsir-box');
var tafsirBtn = DOM.get('tafsir-btn');
if (ayahBox) ayahBox.classList.remove('visible');
if (tafsirBox) tafsirBox.classList.remove('visible');
if (tafsirBtn) tafsirBtn.style.display = 'block';
var srs = getSRSStatus(w.id);
var showSRS = srs.status !== 'new' || currentIndex > 0;
var srsRow = DOM.get('srs-row');
var srsLabel = DOM.get('srs-label');
if (srsRow) srsRow.style.display = showSRS ? 'grid' : 'none';
if (srsLabel) srsLabel.style.display = showSRS ? 'block' : 'none';
updateBookmarkButton(w.id);
var notesBox = DOM.get('notes-box');
var notesInput = DOM.get('notes-input');
if (notesBox) notesBox.style.display = 'block';
if (notesInput) notesInput.value = getNote(w.id);
var occNav = DOM.get('occ-nav');
if (occNav) {
if (occCount > 1) {
occNav.style.display = 'flex';
var occPrevBtn = DOM.get('occ-prev');
var occNextBtn = DOM.get('occ-next');
var occLabel = DOM.get('occ-label');
if (occLabel) occLabel.textContent = (_currentOccurrenceIdx + 1) + '/' + occCount;
if (occPrevBtn) occPrevBtn.disabled = _currentOccurrenceIdx === 0;
if (occNextBtn) occNextBtn.disabled = _currentOccurrenceIdx >= occCount - 1;
} else {
occNav.style.display = 'none';
}
}
var card = DOM.get('word-card');
if (card) {
card.classList.remove('fade-in');
void card.offsetHeight;
card.classList.add('fade-in');
}
}
function nextOccurrence() {
var w = typeof getCurrentWord === 'function' ? getCurrentWord() : null;
if (!w || !w.occurrences) return;
if (_currentOccurrenceIdx < w.occurrences.length - 1) {
_currentOccurrenceIdx++;
updateWordCard();
}
}
function prevOccurrence() {
var w = typeof getCurrentWord === 'function' ? getCurrentWord() : null;
if (!w || !w.occurrences) return;
if (_currentOccurrenceIdx > 0) {
_currentOccurrenceIdx--;
updateWordCard();
}
}
function wireOccurrenceNav() {
var prevBtn = DOM.get('occ-prev');
var nextBtn = DOM.get('occ-next');
if (prevBtn) prevBtn.onclick = prevOccurrence;
if (nextBtn) nextBtn.onclick = nextOccurrence;
}
function renderSRSStatusPill(wordId) {
var srs = getSRSStatus(wordId);
var pill = DOM.get('sr-pill');
if (!pill) return;
var stageLabels = ['', '\uD83D\uDD0D', '\uD83C\uDF31', '\uD83D\uDCA1'];
var stageNames = ['', 'Learning', 'Young', 'Mature'];
if (srs.status === 'new') {
pill.className = 'sr-pill sr-new';
pill.textContent = '\uD83C\uDD95 New word';
return;
}
var label = '';
if (srs.status === 'review') {
var overdueText = srs.daysUntilDue < 0 ? ' (overdue!)' : '';
var leechBadge = srs.isLeech ? ' \uD83D\uDCA2' : '';
label = '\uD83D\uDD01 Due for review' + overdueText + leechBadge;
pill.className = 'sr-pill sr-review';
} else {
var daysText = srs.daysUntilDue > 0 ? 'Due in ' + srs.daysUntilDue + 'd' : 'Due today';
var stageIcon = stageLabels[srs.stage] || '';
var stageName = stageNames[srs.stage] || '';
var retentionText = srs.retention ? Math.round(srs.retention * 100) + '%' : '';
label = stageIcon + ' ' + stageName + ' \u00B7 ' + retentionText + ' \u00B7 ' + daysText;
pill.className = 'sr-pill sr-mastered';
}
pill.textContent = label;
if (srs.isLeech) {
pill.classList.add('sr-leech');
} else {
pill.classList.remove('sr-leech');
}
}
function renderWordNetwork(w) {
if (!w) return;
var similarSection = document.getElementById('similar-words-section');
var similarList = document.getElementById('similar-words-list');
similarList.innerHTML = '';
var similarWords = findWordsByArabicList(w.similarWords);
if (similarWords.length > 0) {
similarSection.style.display = 'block';
similarWords.forEach(function (sw) {
similarList.appendChild(createWordNetworkChip(sw, 'similar'));
});
} else {
similarSection.style.display = 'none';
}
var oppositeSection = document.getElementById('opposite-words-section');
var oppositeList = document.getElementById('opposite-words-list');
oppositeList.innerHTML = '';
var oppositeWords = findWordsByArabicList(w.oppositeWords);
if (oppositeWords.length > 0) {
oppositeSection.style.display = 'block';
oppositeWords.forEach(function (ow) {
oppositeList.appendChild(createWordNetworkChip(ow, 'opposite'));
});
} else {
oppositeSection.style.display = 'none';
}
}
function createWordNetworkChip(wordObj, type) {
var d = document.createElement('div');
d.className = 'word-network-chip';
d.setAttribute('role', 'button');
d.setAttribute('tabindex', '0');
d.setAttribute('aria-label', type + ' word: ' + wordObj.arabic + ' - ' + wordObj.english);
d.innerHTML =
'<span class="word-network-chip-arabic">' + wordObj.arabic + '</span>' +
'<span class="word-network-chip-eng">' + wordObj.english + '</span>';
d.onclick = function () {
navigateToWord(wordObj);
};
d.onkeydown = function (e) {
if (e.key === 'Enter' || e.key === ' ') {
e.preventDefault();
navigateToWord(wordObj);
}
};
return d;
}
function renderRootBox(w) {
if (!w) return;
document.getElementById('root-arabic-big').textContent = w.root;
document.getElementById('root-core-meaning').textContent = w.rootMeaning;
document.getElementById('root-pattern').textContent = w.rootPattern;
const fam = document.getElementById('root-family');
fam.innerHTML = '';
(w.rootFamily || []).forEach((rf) => {
const d = document.createElement('div');
d.className = 'root-word';
d.innerHTML = `<span class="root-word-arabic">${rf.a}</span><span class="root-word-eng">${rf.e}</span>`;
d.setAttribute('role', 'button');
d.setAttribute('tabindex', '0');
d.setAttribute('aria-label', `Show details for ${rf.a} (${rf.e})`);
d.onclick = function () {
var target = findWordByArabic(rf.a);
if (target) {
navigateToWord(target);
}
};
d.onkeydown = function (e) {
if (e.key === 'Enter' || e.key === ' ') {
e.preventDefault();
var target = findWordByArabic(rf.a);
if (target) {
navigateToWord(target);
}
}
};
fam.appendChild(d);
});
}
function showAyah(w) {
if (!w) return;
var occ = window.__currentOccurrence || null;
if (occ && occ.ayahA) {
document.getElementById('ayah-arabic').innerHTML = occ.ayahA;
document.getElementById('ayah-translation').innerHTML = occ.ayahT;
document.getElementById('ayah-ref').textContent = occ.ayahR;
} else if (w.occurrences && w.occurrences.length > 0) {
var firstOcc = w.occurrences[0];
document.getElementById('ayah-arabic').innerHTML = firstOcc.ayahA;
document.getElementById('ayah-translation').innerHTML = firstOcc.ayahT;
document.getElementById('ayah-ref').textContent = firstOcc.ayahR;
} else if (w.ayahA) {
document.getElementById('ayah-arabic').innerHTML = w.ayahA;
document.getElementById('ayah-translation').innerHTML = w.ayahT;
document.getElementById('ayah-ref').textContent = w.ayahR;
}
document.getElementById('ayah-box').classList.add('visible');
}
function loadTafsir(w) {
if (!w) return;
var occ = window.__currentOccurrence || null;
document.getElementById('tafsir-box').classList.add('visible');
document.getElementById('tafsir-text').innerHTML = '<span class="tafsir-loading">Loading Ibn Kathir commentary\u2026</span>';
document.getElementById('tafsir-btn').style.display = 'none';
setTimeout(() => {
var tafsirText = '';
if (occ && occ.tafsir) {
tafsirText = occ.tafsir;
} else if (w.occurrences && w.occurrences.length > 0) {
tafsirText = w.occurrences[0].tafsir;
} else if (w.tafsir) {
tafsirText = w.tafsir;
}
document.getElementById('tafsir-text').textContent = tafsirText;
}, 400);
}
function highlightRootBox() {
const rootBox = document.getElementById('root-box');
if (!rootBox) return;
rootBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
rootBox.style.transition = 'border-color 0.4s ease';
rootBox.style.borderColor = 'var(--gold)';
setTimeout(() => { rootBox.style.borderColor = ''; }, 1200);
}
function updateBookmarkButton(wordId) {
var btn = DOM.get('qa-bookmark');
if (!btn) return;
if (isFavorite(wordId)) {
btn.textContent = '\u2B50 Bookmarked';
btn.classList.add('active-qa');
} else {
btn.textContent = '\u2606 Bookmark';
btn.classList.remove('active-qa');
}
}
function updateGoalRing() {
var ringFill = DOM.get('goal-ring-fill');
var ringText = DOM.get('goal-ring-text');
var ringWrap = DOM.get('goal-ring-wrap');
if (!ringFill || !ringText || !ringWrap) return;
var srsObj = window.__srs;
var stats = (srsObj && srsObj.getStats) ? srsObj.getStats() : null;
if (!stats) {
ringFill.setAttribute('stroke-dasharray', '0, 100');
ringText.textContent = '0';
ringWrap.setAttribute('aria-valuenow', '0');
return;
}
var dailyLimit = (srsObj && srsObj.getDailyReviewLimit)
? srsObj.getDailyReviewLimit()
: 25;
var reviewsToday = stats.reviewsToday || 0;
if (dailyLimit <= 0) dailyLimit = 25;
var pct = Math.min(100, Math.round((reviewsToday / dailyLimit) * 100));
var circumference = 100;
var offset = Math.round((pct / 100) * circumference);
ringFill.setAttribute('stroke-dasharray', offset + ', ' + circumference);
ringText.textContent = pct;
ringWrap.setAttribute('aria-valuenow', String(pct));
ringWrap.title = 'Daily review goal: ' + reviewsToday + ' of ' + dailyLimit + ' (' + pct + '%)';
}
function updateStatsDisplay() {
var data = loadSRS();
var totalWords = DOM.get('stat-total');
if (totalWords) {
var count = (typeof getCanonicalWordCount === 'function' && getCanonicalWordCount() > 0)
? getCanonicalWordCount() : ALL_WORDS.length;
totalWords.textContent = count;
}
var learned = 0;
var lessonWords = typeof getActiveLessonWords === 'function' ? getActiveLessonWords() : ALL_WORDS.slice(0, 20);
for (var i = 0; i < lessonWords.length; i++) {
var entry = data[lessonWords[i].id];
if (entry && entry.stage && entry.stage > 0) learned++;
}
var due = getDueReviews().length;
DOM.get('stat-learned').textContent = learned;
DOM.get('stat-review').textContent = due;
updateGoalRing();
}
function updateReviewBanner() {
var due = getDueReviews();
var banner = DOM.get('review-banner');
var bannerText = DOM.get('review-banner-text');
if (!banner || !bannerText) return;
if (due.length > 0) {
banner.classList.add('visible');
bannerText.textContent = due.length + ' word' + (due.length !== 1 ? 's' : '') + ' due for review today';
} else {
banner.classList.remove('visible');
}
}
function renderWordList() {
var searchInput = DOM.get('search-input');
var searchQuery = searchInput ? searchInput.value : '';
var activeType = document.querySelector('#filter-type-chips .chip-active');
var activeStatus = document.querySelector('#filter-status-chips .chip-active');
var typeFilter = activeType ? activeType.getAttribute('data-value') : 'all';
var statusFilter = activeStatus ? activeStatus.getAttribute('data-value') : 'all';
var words = searchWords(searchQuery);
words = filterByCategory(words, typeFilter);
if (statusFilter === 'favorites') {
words = filterByFavorites(words);
} else {
words = filterByStatus(words, statusFilter);
}
var countEl = DOM.get('list-count');
if (countEl) countEl.textContent = words.length + ' word' + (words.length !== 1 ? 's' : '');
var container = DOM.get('wordlist-container');
container.innerHTML = '';
if (words.length === 0) {
container.innerHTML = '<div style="text-align:center;padding:30px 0;color:var(--text-muted);font-size:13px">No words match your search or filters.</div>';
return;
}
var fragment = document.createDocumentFragment();
var srsData = loadSRS();
var favs = loadFavorites();
for (var i = 0; i < words.length; i++) {
var w = words[i];
var entry = srsData[w.id];
var badge = '';
if (entry && entry.stage >= 3) {
badge = '\uD83D\uDCA1';
} else if (entry && entry.stage >= 2) {
badge = '\uD83C\uDF31';
} else if (entry && entry.stage >= 1 && Date.now() >= entry.dueDate) {
badge = entry.isLeech ? '\uD83D\uDCA2' : '\uD83D\uDD01';
} else {
badge = '\uD83C\uDD95';
}
var favStar = favs[w.id] ? '\u2B50' : '';
var d = document.createElement('div');
d.className = 'wordlist-item';
d.setAttribute('role', 'button');
d.setAttribute('tabindex', '0');
var shortMeaning = getShortMeaning(w.meaning);
d.setAttribute('aria-label', 'Study ' + w.arabic + ' - ' + shortMeaning);
d.innerHTML =
'<div class="wordlist-arabic">' + w.arabic + '</div>' +
'<div class="wordlist-info">' +
'<div class="wordlist-meaning">' + shortMeaning + '</div>' +
'<div class="wordlist-sub">' + w.translit + ' \u00B7 ' + w.root + ' \u00B7 ' + w.type + '</div>' +
'</div>' +
'<div class="wordlist-badge">' + favStar + badge + '</div>';
d._word = w;
d.onclick = function() { navigateToWord(this._word); };
d.onkeydown = function(e) {
if (e.key === 'Enter' || e.key === ' ') {
e.preventDefault();
navigateToWord(this._word);
}
};
fragment.appendChild(d);
}
container.appendChild(fragment);
}
var _typeCountCache = null;
function getTypeCounts() {
if (_typeCountCache) return _typeCountCache;
var counts = {};
var typeLabels = { noun: 'Nouns', verb: 'Verbs', particle: 'Particles', adjective: 'Adjectives', pronoun: 'Pronouns', exclamation: 'Exclamations' };
Object.keys(typeLabels).forEach(function (key) { counts[key] = 0; });
for (var i = 0; i < ALL_WORDS.length; i++) {
var cat = ALL_WORDS[i].typeCategory;
if (counts[cat] !== undefined) counts[cat]++;
}
_typeCountCache = counts;
return counts;
}
var _difficultyCountCache = null;
function getDifficultyCounts() {
if (_difficultyCountCache) return _difficultyCountCache;
var counts = {};
for (var i = 0; i < ALL_WORDS.length; i++) {
var d = ALL_WORDS[i].difficulty;
counts[d] = (counts[d] || 0) + 1;
}
_difficultyCountCache = counts;
return counts;
}
function invalidateStatsCaches() {
_typeCountCache = null;
_difficultyCountCache = null;
}
function renderStats() {
var srsObj = window.__srs;
var srsStats = (srsObj && srsObj.getStats) ? srsObj.getStats() : getSRSStats();
var srsData = loadSRS();
var now = Date.now();
DOM.get('stat-total').textContent = srsStats.total;
DOM.get('stat-mastered').textContent = srsStats.mature;
DOM.get('stat-new-count').textContent = srsStats.newCount;
DOM.get('stat-learning-count').textContent = srsStats.dueToday;
updateStreakDisplay();
var typeContainer = DOM.get('stats-by-type');
typeContainer.innerHTML = '';
var typeLabels = { noun: 'Nouns', verb: 'Verbs', particle: 'Particles', adjective: 'Adjectives', pronoun: 'Pronouns', exclamation: 'Exclamations' };
var typeCounts = getTypeCounts();
var totalWords = srsStats.total || 1;
Object.keys(typeLabels).forEach(function (key) {
var count = typeCounts[key] || 0;
if (count === 0) return;
var pct = Math.round((count / totalWords) * 100);
typeContainer.appendChild(createBarRow(typeLabels[key], count, pct));
});
var diffContainer = DOM.get('stats-by-difficulty');
diffContainer.innerHTML = '';
var diffCounts = getDifficultyCounts();
var diffLabels = { 1: 'Easy (\u2605)', 2: 'Medium (\u2605\u2605)', 3: 'Hard (\u2605\u2605\u2605)', 4: 'Complex (\u2605\u2605\u2605\u2605)', 5: 'Advanced (\u2605\u2605\u2605\u2605\u2605)' };
for (var d = 1; d <= 5; d++) {
var count = diffCounts[d] || 0;
if (count === 0) continue;
var pct = Math.round((count / totalWords) * 100);
diffContainer.appendChild(createBarRow(diffLabels[d] || 'Level ' + d, count, pct));
}
var stageContainer = DOM.get('stats-stages');
if (stageContainer) {
stageContainer.innerHTML = '';
var stageLabels = [
{ key: 'newCount', label: '\uD83C\uDD95 New', color: 'var(--blue)' },
{ key: 'learning', label: '\uD83D\uDD0D Learning', color: 'var(--purple)' },
{ key: 'young', label: '\uD83C\uDF31 Young', color: 'var(--gold-dim)' },
{ key: 'mature', label: '\uD83D\uDCA1 Mature', color: 'var(--green)' },
];
for (var si = 0; si < stageLabels.length; si++) {
var sl = stageLabels[si];
var count = srsStats[sl.key] || 0;
if (count === 0) continue;
var pct = Math.round((count / totalWords) * 100);
var row = document.createElement('div');
row.className = 'stats-bar-row';
row.innerHTML =
'<span class="stats-bar-label" style="color:' + sl.color + '">' + sl.label + '</span>' +
'<div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + pct + '%;background:' + sl.color + '"></div></div>' +
'<span class="stats-bar-value">' + count + '</span>';
stageContainer.appendChild(row);
}
}
var healthContainer = DOM.get('stats-health');
if (healthContainer) {
healthContainer.innerHTML = '';
var healthItems = [
{ label: 'Avg Retention', value: srsStats.avgRetention + '%', pct: srsStats.avgRetention, color: 'var(--green)' },
{ label: 'Avg Ease', value: String(srsStats.avgEaseFactor.toFixed(2)), pct: Math.round((srsStats.avgEaseFactor / 3) * 100), color: 'var(--blue)' },
{ label: 'Overdue', value: srsStats.overdue, pct: srsStats.dueToday > 0 ? Math.round((srsStats.overdue / srsStats.dueToday) * 100) : 0, color: srsStats.overdue > 0 ? 'var(--red)' : 'var(--green)' },
{ label: 'Reviews Today', value: srsStats.reviewsToday, pct: Math.min(100, Math.round((srsStats.reviewsToday / DAILY_REVIEW_LIMIT) * 100)), color: 'var(--gold)' },
];
for (var hi = 0; hi < healthItems.length; hi++) {
var item = healthItems[hi];
var row = document.createElement('div');
row.className = 'stats-bar-row';
row.innerHTML =
'<span class="stats-bar-label">' + item.label + '</span>' +
'<div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + item.pct + '%;background:' + item.color + '"></div></div>' +
'<span class="stats-bar-value">' + item.value + '</span>';
healthContainer.appendChild(row);
}
}
var leechContainer = DOM.get('stats-leeches');
if (leechContainer) {
leechContainer.innerHTML = '';
if (srsStats.leechCount > 0) {
leechContainer.innerHTML = '<div style="font-size:12px;color:var(--red);padding:8px 0">\uD83D\uDCA2 ' + srsStats.leechCount + ' leeched word' + (srsStats.leechCount !== 1 ? 's' : '') + ' — consider giving extra attention</div>';
} else {
leechContainer.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px 0">\u2705 No leeched words</div>';
}
}
renderReviewForecast(srsData, now);
}
function createBarRow(label, count, pct) {
var row = document.createElement('div');
row.className = 'stats-bar-row';
row.innerHTML =
'<span class="stats-bar-label">' + label + '</span>' +
'<div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + pct + '%"></div></div>' +
'<span class="stats-bar-value">' + count + '</span>';
return row;
}
function renderReviewForecast(srsData, now) {
var container = DOM.get('stats-forecast');
container.innerHTML = '';
var intervals = [
{ label: 'Today', days: 0 },
{ label: '3 days', days: 3 },
{ label: '7 days', days: 7 },
{ label: '14 days', days: 14 },
{ label: '30 days', days: 30 },
];
var totalWords = ALL_WORDS.length || 1;
for (var ii = 0; ii < intervals.length; ii++) {
var interval = intervals[ii];
var cutoff = now + interval.days * DAY_MS;
var count = 0;
for (var wi = 0; wi < ALL_WORDS.length; wi++) {
var entry = srsData[ALL_WORDS[wi].id];
if (entry && entry.dueDate <= cutoff) count++;
}
var pct = Math.round((count / totalWords) * 100);
container.appendChild(createBarRow(interval.label, count, pct));
}
}
function updateStreakDisplay() {
var data = loadStreakData();
var streak = data.streak || 0;
var today = getDateKey();
DOM.get('streak-count').textContent = streak;
var streakToday = DOM.get('streak-today');
if (!streakToday) return;
if (data.lastDate === today) {
streakToday.textContent = '\u2713 Reviewed today! Come back tomorrow.';
streakToday.style.color = 'var(--green)';
} else if (data.lastDate === getYesterdayKey()) {
streakToday.textContent = '\uD83D\uDD25 ' + streak + ' day streak! Review today to continue.';
streakToday.style.color = 'var(--gold)';
} else if (streak > 0) {
streakToday.textContent = '\uD83D\uDD25 ' + streak + ' day streak! Review today to continue.';
streakToday.style.color = 'var(--gold)';
} else {
streakToday.textContent = 'Start your streak by reviewing a word today!';
streakToday.style.color = '';
}
}
function getDateKey() {
var d = new Date();
return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
function getYesterdayKey() {
var d = new Date();
d.setDate(d.getDate() - 1);
return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
function loadStreakData() {
try {
var raw = localStorage.getItem('quran_streak');
if (!raw) return { streak: 0, lastDate: null };
return JSON.parse(raw);
} catch (e) {
return { streak: 0, lastDate: null };
}
}
function saveStreakData(data) {
try {
localStorage.setItem('quran_streak', JSON.stringify(data));
} catch (e) {}
}
function updateStreak() {
var data = loadStreakData();
var today = getDateKey();
if (data.lastDate === today) {
return;
}
if (data.lastDate === getYesterdayKey()) {
data.streak = (data.streak || 0) + 1;
} else {
data.streak = 1;
}
data.lastDate = today;
saveStreakData(data);
}
function renderQuizQuestion(currentWordObj, allWords) {
const wordEl = document.getElementById('quiz-word');
const optionsEl = document.getElementById('quiz-options');
const feedbackEl = document.getElementById('quiz-feedback');
const nextBtn = document.getElementById('btn-next-quiz');
nextBtn.style.display = 'none';
feedbackEl.textContent = '';
wordEl.textContent = currentWordObj.arabic;
const correct = getShortMeaning(currentWordObj.meaning);
var distractors = getDistractors(currentWordObj, 3);
var opts = [correct];
distractors.forEach(function (d) {
var label = getShortMeaning(d.meaning);
if (label !== correct && opts.indexOf(label) === -1) {
opts.push(label);
}
});
if (opts.length < 4) {
allWords.forEach(function (w) {
if (w !== currentWordObj && opts.length < 4) {
var label = getShortMeaning(w.meaning);
if (label !== correct && opts.indexOf(label) === -1) {
opts.push(label);
}
}
});
}
for (var si = opts.length - 1; si > 0; si--) {
var sj = Math.floor(Math.random() * (si + 1));
var tmp = opts[si];
opts[si] = opts[sj];
opts[sj] = tmp;
}
optionsEl.innerHTML = '';
opts.forEach(function (opt) {
var b = document.createElement('button');
b.className = 'quiz-opt';
b.textContent = opt;
b.setAttribute('role', 'button');
b.onclick = function () { handleQuizAnswer(b, opt, correct, currentWordObj.id); };
optionsEl.appendChild(b);
});
}
function renderQuizCompletion(score, total) {
const pct = total > 0 ? Math.round((score / total) * 100) : 0;
document.getElementById('quiz-word').textContent = '\uD83C\uDF89';
document.getElementById('quiz-options').innerHTML = '';
const feedback = document.getElementById('quiz-feedback');
const msg = pct >= 80 ? 'Excellent, mashAllah!' : pct >= 60 ? 'Good effort \u2014 review the harder ones.' : "Keep going, you'll get there!";
feedback.textContent = 'Done! ' + pct + '% \u2014 ' + msg;
feedback.style.color = 'var(--gold)';
document.getElementById('btn-next-quiz').style.display = 'none';
}
function updateQuizScoreDisplay(correct, total) {
document.getElementById('stat-score').textContent = total > 0 ? Math.round((correct / total) * 100) + '%' : '\u2014';
document.getElementById('quiz-score-display').textContent = correct + '/' + total + ' correct';
}
function navigateToWord(w) {
var activeWords = typeof getActiveLessonWords === 'function' ? getActiveLessonWords() : ALL_WORDS;
var idx = activeWords.indexOf(w);
if (idx >= 0) {
window.__navigateToWordIndex(idx);
return;
}
var globalIdx = ALL_WORDS.indexOf(w);
if (globalIdx < 0) {
var canonicalWords = typeof getCanonicalWords === 'function' ? getCanonicalWords() : [];
var canonicalIdx = canonicalWords.indexOf(w);
if (canonicalIdx >= 0) {
if (typeof goToLesson === 'function') {
var wordLesson = Math.floor(canonicalIdx / WORDS_PER_LESSON);
var wordInLesson = canonicalIdx % WORDS_PER_LESSON;
if (wordLesson >= 0) {
goToLesson(wordLesson, wordInLesson);
}
}
return;
}
return;
}
if (w.surahId && typeof goToSurah === 'function') {
var surahWords = getSurahWords(w.surahId);
var surahIdx = surahWords.indexOf(w);
if (surahIdx >= 0) {
goToSurah(w.surahId, surahIdx);
return;
}
}
if (typeof goToLesson === 'function') {
var wordLesson = Math.floor(globalIdx / WORDS_PER_LESSON);
var wordInLesson = globalIdx % WORDS_PER_LESSON;
if (wordLesson >= 0) {
goToLesson(wordLesson, wordInLesson);
}
}
}
function showWordContent(w) {
if (!w) return;
showAyah(w);
loadTafsir(w);
}
let quizWords = [];
let quizIndex = 0;
let quizCorrect = 0;
let quizTotal = 0;
let quizAnswered = false;
let quizFinished = false;
function initQuiz() {
if (quizWords.length > 0 && !quizFinished && quizIndex < quizWords.length) {
var currentWord = quizWords[quizIndex % quizWords.length];
if (currentWord) {
showQuizQ();
return;
}
}
var lessonWords = getActiveLessonWords();
if (!lessonWords || lessonWords.length === 0) {
quizWords = [];
quizIndex = 0;
quizCorrect = 0;
quizTotal = 0;
quizAnswered = false;
quizFinished = true;
var wordEl = DOM.get('quiz-word');
if (wordEl) wordEl.textContent = '📚';
var optionsEl = DOM.get('quiz-options');
if (optionsEl) optionsEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">No words available for quiz.</div>';
DOM.get('quiz-score-display').textContent = '';
return;
}
quizWords = shuffleArray(lessonWords);
quizIndex = 0;
quizCorrect = 0;
quizTotal = 0;
quizAnswered = false;
quizFinished = false;
DOM.get('quiz-score-display').textContent = '';
showQuizQ();
}
function showQuizQ() {
quizAnswered = false;
DOM.get('btn-next-quiz').style.display = 'none';
DOM.get('quiz-feedback').textContent = '';
var wordIndex = quizIndex % quizWords.length;
var currentWord = quizWords[wordIndex];
renderQuizQuestion(currentWord, ALL_WORDS);
}
function answerQuiz(btn, chosen, correct, wordId) {
if (quizAnswered) return;
quizAnswered = true;
quizTotal++;
var allOpts = document.querySelectorAll('.quiz-opt');
for (var i = 0; i < allOpts.length; i++) {
allOpts[i].disabled = true;
allOpts[i].setAttribute('aria-disabled', 'true');
}
var feedback = DOM.get('quiz-feedback');
if (chosen === correct) {
btn.classList.add('correct');
quizCorrect++;
rateSRSWord(wordId, 2);
feedback.textContent = '\u2713 Correct!';
feedback.style.color = 'var(--green)';
} else {
btn.classList.add('wrong');
rateSRSWord(wordId, 0);
for (var bi = 0; bi < allOpts.length; bi++) {
if (allOpts[bi].textContent === correct) allOpts[bi].classList.add('correct');
}
feedback.textContent = '\u2717 Answer: ' + correct;
feedback.style.color = 'var(--red)';
}
updateQuizScoreDisplay(quizCorrect, quizTotal);
DOM.get('btn-next-quiz').style.display = 'inline-block';
updateStatsDisplay();
}
function renderQuizCompletion(score, total) {
var pct = total > 0 ? Math.round((score / total) * 100) : 0;
DOM.get('quiz-word').textContent = '\uD83C\uDF89';
DOM.get('quiz-options').innerHTML = '';
var feedback = DOM.get('quiz-feedback');
var msg = pct >= 80 ? 'Excellent, mashAllah!' : pct >= 60 ? 'Good effort \u2014 review the harder ones.' : "Keep going, you'll get there!";
feedback.textContent = 'Done! ' + pct + '% \u2014 ' + msg;
feedback.style.color = 'var(--gold)';
DOM.get('btn-next-quiz').style.display = 'none';
}
function updateQuizScoreDisplay(correct, total) {
DOM.get('stat-score').textContent = total > 0 ? Math.round((correct / total) * 100) + '%' : '\u2014';
DOM.get('quiz-score-display').textContent = correct + '/' + total + ' correct';
}
function nextQuiz() {
quizIndex++;
if (quizIndex >= quizWords.length) {
renderQuizCompletion(quizCorrect, quizTotal);
updateStatsDisplay();
var pct = quizTotal > 0 ? Math.round((quizCorrect / quizTotal) * 100) : 0;
if (pct >= 60) {
var isSurahMode = (typeof getOrganizationMode === 'function' && getOrganizationMode() === 'surah');
if (isSurahMode) {
var activeSurahId = getActiveSurahId ? getActiveSurahId() : null;
if (activeSurahId) {
completeSurah(activeSurahId);
}
} else {
completeLesson(activeLessonIndex);
}
if (typeof updateLessonProgressDisplay === 'function') {
updateLessonProgressDisplay();
}
var autoNavTimer = setTimeout(function() {
if (typeof currentView !== 'undefined' && currentView === 'quiz') {
if (isSurahMode) {
var surahIds = typeof getSurahsWithVocabulary === 'function' ? getSurahsWithVocabulary() : [];
var curIdx = surahIds.indexOf(activeSurahId);
if (curIdx >= 0 && curIdx < surahIds.length - 1 && typeof goToSurah === 'function') {
goToSurah(surahIds[curIdx + 1]);
}
} else {
var nextIncomplete = getNextIncompleteLesson();
if (nextIncomplete < getLessonCount() && nextIncomplete !== activeLessonIndex) {
if (typeof goToLesson === 'function') {
goToLesson(nextIncomplete);
}
}
}
}
}, 3000);
window.__autoNavTimer = autoNavTimer;
}
} else {
showQuizQ();
}
}
function handleQuizAnswer(btn, chosen, correct, wordId) {
answerQuiz(btn, chosen, correct, wordId);
}
let _currentAuthView = 'none';
let _importPrompted = false;
function initAuthUI() {
wireAuthFormEvents();
wireUserMenuEvents();
checkActionCodeOnLoad();
onAuthChange(function (user) {
updateAuthUI(user);
});
}
function showAuthView(viewName) {
_currentAuthView = viewName;
var views = ['auth-login', 'auth-signup', 'auth-forgot', 'auth-reset', 'auth-verify'];
views.forEach(function (id) {
var el = document.getElementById(id);
if (el) el.style.display = (id === 'auth-' + viewName) ? 'block' : 'none';
});
var titleEl = document.getElementById('auth-title');
var titles = {
'login': 'Welcome Back',
'signup': 'Create Account',
'forgot': 'Reset Password',
'reset': 'Set New Password',
'verify': 'Verify Email',
};
if (titleEl) titleEl.textContent = titles[viewName] || 'Account';
}
function wireAuthFormEvents() {
var loginForm = document.getElementById('auth-login-form');
if (loginForm) {
loginForm.onsubmit = function (e) {
e.preventDefault();
handleLogin();
};
}
var forgotLink = document.getElementById('auth-forgot-link');
if (forgotLink) {
forgotLink.onclick = function (e) {
e.preventDefault();
showAuthView('forgot');
};
}
var signupLink = document.getElementById('auth-signup-link');
if (signupLink) {
signupLink.onclick = function (e) {
e.preventDefault();
showAuthView('signup');
};
}
var signupForm = document.getElementById('auth-signup-form');
if (signupForm) {
signupForm.onsubmit = function (e) {
e.preventDefault();
handleSignUp();
};
}
var loginLink = document.getElementById('auth-login-link');
if (loginLink) {
loginLink.onclick = function (e) {
e.preventDefault();
showAuthView('login');
};
}
var forgotForm = document.getElementById('auth-forgot-form');
if (forgotForm) {
forgotForm.onsubmit = function (e) {
e.preventDefault();
handleForgotPassword();
};
}
var backLogin = document.getElementById('auth-back-login');
if (backLogin) {
backLogin.onclick = function (e) {
e.preventDefault();
showAuthView('login');
};
}
var resetForm = document.getElementById('auth-reset-form');
if (resetForm) {
resetForm.onsubmit = function (e) {
e.preventDefault();
handleResetPassword();
};
}
var resendBtn = document.getElementById('auth-resend-verify');
if (resendBtn) {
resendBtn.onclick = function () {
handleResendVerification();
};
}
}
function wireUserMenuEvents() {
var userBtn = document.getElementById('user-btn');
if (userBtn) {
userBtn.onclick = function () {
var user = getCurrentUser();
if (user) {
switchView('profile');
} else {
showAuthView('login');
switchView('auth');
}
};
}
var logoutBtn = document.getElementById('btn-logout');
if (logoutBtn) {
logoutBtn.onclick = function () {
handleLogout();
};
}
}
async function handleLogin() {
var email = document.getElementById('auth-login-email').value.trim();
var password = document.getElementById('auth-login-password').value;
var rememberMe = document.getElementById('auth-remember').checked;
var errorEl = document.getElementById('auth-login-error');
var submitBtn = document.getElementById('auth-login-submit');
if (!email || !password) {
showAuthError(errorEl, 'Please fill in all fields.');
var emailInput = document.getElementById('auth-login-email');
var pwdInput = document.getElementById('auth-login-password');
if (emailInput) emailInput.setAttribute('aria-describedby', 'auth-login-error');
if (pwdInput) pwdInput.setAttribute('aria-describedby', 'auth-login-error');
return;
}
setButtonLoading(submitBtn, true);
hideAuthError(errorEl);
try {
var result = await loginWithEmail(email, password, rememberMe);
if (result.user && !result.user.emailVerified) {
showAuthView('verify');
var verifyEmailEl = document.getElementById('auth-verify-email');
if (verifyEmailEl) verifyEmailEl.textContent = email;
setButtonLoading(submitBtn, false);
return;
}
await promptImportLocalData();
switchView('learn');
setButtonLoading(submitBtn, false);
} catch (e) {
showAuthError(errorEl, e.message);
setButtonLoading(submitBtn, false);
}
}
async function handleSignUp() {
var name = document.getElementById('auth-signup-name').value.trim();
var email = document.getElementById('auth-signup-email').value.trim();
var password = document.getElementById('auth-signup-password').value;
var confirm = document.getElementById('auth-signup-confirm').value;
var errorEl = document.getElementById('auth-signup-error');
var submitBtn = document.getElementById('auth-signup-submit');
if (!name || !email || !password || !confirm) {
showAuthError(errorEl, 'Please fill in all fields.');
document.getElementById('auth-signup-name').setAttribute('aria-describedby', 'auth-signup-error');
document.getElementById('auth-signup-email').setAttribute('aria-describedby', 'auth-signup-error');
document.getElementById('auth-signup-password').setAttribute('aria-describedby', 'auth-signup-error');
document.getElementById('auth-signup-confirm').setAttribute('aria-describedby', 'auth-signup-error');
return;
}
if (password !== confirm) {
showAuthError(errorEl, 'Passwords do not match.');
document.getElementById('auth-signup-password').setAttribute('aria-describedby', 'auth-signup-error');
document.getElementById('auth-signup-confirm').setAttribute('aria-describedby', 'auth-signup-error');
return;
}
if (password.length < 6) {
showAuthError(errorEl, 'Password must be at least 6 characters.');
document.getElementById('auth-signup-password').setAttribute('aria-describedby', 'auth-signup-error');
return;
}
setButtonLoading(submitBtn, true);
hideAuthError(errorEl);
try {
var result = await signUpWithEmail(email, password, name);
var userId = result.user.uid;
var defaultSettings = getDefaultSettings();
await saveProfile(userId, {
displayName: name,
email: email,
settings: defaultSettings,
});
await promptImportLocalData();
showAuthView('verify');
var verifyEmailEl = document.getElementById('auth-verify-email');
if (verifyEmailEl) verifyEmailEl.textContent = email;
setButtonLoading(submitBtn, false);
} catch (e) {
showAuthError(errorEl, e.message);
setButtonLoading(submitBtn, false);
}
}
async function handleForgotPassword() {
var email = document.getElementById('auth-forgot-email').value.trim();
var errorEl = document.getElementById('auth-forgot-error');
var successEl = document.getElementById('auth-forgot-success');
var submitBtn = document.getElementById('auth-forgot-submit');
if (!email) {
showAuthError(errorEl, 'Please enter your email address.');
document.getElementById('auth-forgot-email').setAttribute('aria-describedby', 'auth-forgot-error');
return;
}
setButtonLoading(submitBtn, true);
hideAuthError(errorEl);
if (successEl) successEl.style.display = 'none';
try {
var msg = await sendPasswordResetEmail(email);
setButtonLoading(submitBtn, false);
if (successEl) {
successEl.textContent = msg;
successEl.style.display = 'block';
}
} catch (e) {
showAuthError(errorEl, e.message);
setButtonLoading(submitBtn, false);
}
}
async function handleResetPassword() {
var password = document.getElementById('auth-reset-password').value;
var confirm = document.getElementById('auth-reset-confirm').value;
var errorEl = document.getElementById('auth-reset-error');
var successEl = document.getElementById('auth-reset-success');
var submitBtn = document.getElementById('auth-reset-submit');
if (!password || !confirm) {
showAuthError(errorEl, 'Please fill in all fields.');
document.getElementById('auth-reset-password').setAttribute('aria-describedby', 'auth-reset-error');
document.getElementById('auth-reset-confirm').setAttribute('aria-describedby', 'auth-reset-error');
return;
}
if (password !== confirm) {
showAuthError(errorEl, 'Passwords do not match.');
document.getElementById('auth-reset-password').setAttribute('aria-describedby', 'auth-reset-error');
document.getElementById('auth-reset-confirm').setAttribute('aria-describedby', 'auth-reset-error');
return;
}
if (password.length < 6) {
showAuthError(errorEl, 'Password must be at least 6 characters.');
document.getElementById('auth-reset-password').setAttribute('aria-describedby', 'auth-reset-error');
return;
}
var actionCode = document.getElementById('auth-reset-code');
var oobCode = actionCode ? actionCode.value : null;
if (!oobCode) {
showAuthError(errorEl, 'Invalid or expired reset link. Please request a new one.');
return;
}
setButtonLoading(submitBtn, true);
hideAuthError(errorEl);
if (successEl) successEl.style.display = 'none';
try {
var msg = await confirmPasswordReset(oobCode, password);
setButtonLoading(submitBtn, false);
if (successEl) {
successEl.textContent = msg;
successEl.style.display = 'block';
}
setTimeout(function () {
showAuthView('login');
}, 2000);
} catch (e) {
showAuthError(errorEl, e.message);
setButtonLoading(submitBtn, false);
}
}
async function handleResendVerification() {
var errorEl = document.getElementById('auth-verify-error');
var successEl = document.getElementById('auth-verify-success');
var resendBtn = document.getElementById('auth-resend-verify');
hideAuthError(errorEl);
if (successEl) successEl.style.display = 'none';
try {
var msg = await resendVerificationEmail();
if (successEl) {
successEl.textContent = msg;
successEl.style.display = 'block';
}
} catch (e) {
showAuthError(errorEl, e.message);
}
}
async function handleLogout() {
if (hasPendingSync && hasPendingSync()) {
console.log('[auth] Pending sync data — uploading before logout...');
var user = getCurrentUser();
if (user) {
await uploadToCloud(user.uid);
}
}
await logout();
showAuthView('login');
switchView('auth');
}
async function promptImportLocalData() {
if (_importPrompted) return;
var user = getCurrentUser();
if (!user) return;
var localData = exportLocalData ? exportLocalData() : {};
var hasData = localData.srsData && Object.keys(localData.srsData).length > 0;
if (!hasData) {
var cloudData = await downloadFromCloud(user.uid);
if (cloudData) {
importLocalData(cloudData);
}
_importPrompted = true;
return;
}
if (AUTO_IMPORT_ON_LOGIN) {
await fullSync(user.uid);
_importPrompted = true;
return;
}
var confirmed = confirm('You have local learning progress. Would you like to sync it with your account to access it from any device?');
if (confirmed) {
await fullSync(user.uid);
}
_importPrompted = true;
}
function checkActionCodeOnLoad() {
var action = checkActionCode();
if (action.mode === 'resetPassword' && action.oobCode) {
var codeInput = document.getElementById('auth-reset-code');
if (codeInput) codeInput.value = action.oobCode;
showAuthView('reset');
switchView('auth');
return true;
}
if (action.mode === 'verifyEmail' && action.oobCode) {
applyVerificationCode(action.oobCode)
.then(function (msg) {
var user = getCurrentUser();
if (user) {
switchView('learn');
} else {
showAuthView('login');
switchView('auth');
}
})
.catch(function (e) {
showAuthView('login');
switchView('auth');
});
return true;
}
return false;
}
function updateAuthUI(user) {
var userBtn = document.getElementById('user-btn');
var guestBadge = document.getElementById('guest-badge');
var authViews = ['view-auth', 'view-profile', 'view-settings'];
if (user) {
if (userBtn) {
var initial = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
userBtn.innerHTML = '<span class="user-avatar-small">' + escapeHtml(initial) + '</span>';
userBtn.title = user.displayName || user.email || 'Account';
}
if (guestBadge) guestBadge.style.display = 'none';
if (currentView === 'profile' || currentView === 'settings') {
renderProfileView();
}
} else {
if (userBtn) {
userBtn.innerHTML = '<span class="user-avatar-small" style="font-size:12px">👤</span>';
userBtn.title = 'Sign in';
}
if (guestBadge) guestBadge.style.display = 'inline';
}
}
function showAuthError(el, msg) {
if (!el) return;
el.textContent = msg;
el.style.display = 'block';
}
function hideAuthError(el) {
if (!el) return;
el.textContent = '';
el.style.display = 'none';
}
function setButtonLoading(btn, loading) {
if (!btn) return;
btn.disabled = loading;
if (loading) {
btn._originalText = btn.textContent;
btn.textContent = '⏳ Processing...';
} else {
btn.textContent = btn._originalText || btn.textContent;
}
}
function escapeHtml(str) {
if (!str) return '';
return str.replace(/[&<>"']/g, function (c) {
var m = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
return m[c] || c;
});
}
window.__authUI = {
init: initAuthUI,
showView: showAuthView,
updateUI: updateAuthUI,
};
let _editingProfile = false;
let _editingSettings = false;
function initProfileUI() {
wireProfileEvents();
wireSettingsEvents();
wireAccountEvents();
}
function wireProfileEvents() {
var editBtn = document.getElementById('btn-edit-profile');
if (editBtn) {
editBtn.onclick = function () {
toggleEditProfile();
};
}
var saveBtn = document.getElementById('btn-save-profile');
if (saveBtn) {
saveBtn.onclick = function () {
saveProfileChanges();
};
}
var cancelBtn = document.getElementById('btn-cancel-profile');
if (cancelBtn) {
cancelBtn.onclick = function () {
toggleEditProfile();
};
}
}
function wireSettingsEvents() {
var editBtn = document.getElementById('btn-edit-settings');
if (editBtn) {
editBtn.onclick = function () {
toggleEditSettings();
};
}
var saveBtn = document.getElementById('btn-save-settings');
if (saveBtn) {
saveBtn.onclick = function () {
saveSettingsChanges();
};
}
var cancelBtn = document.getElementById('btn-cancel-settings');
if (cancelBtn) {
cancelBtn.onclick = function () {
toggleEditSettings();
};
}
}
function wireAccountEvents() {
var changePwdBtn = document.getElementById('btn-change-password');
if (changePwdBtn) {
changePwdBtn.onclick = function () {
showPasswordChangeModal();
};
}
var exportBtn = document.getElementById('btn-export-data');
if (exportBtn) {
exportBtn.onclick = function () {
handleExportData();
};
}
var importBtn = document.getElementById('btn-import-data');
if (importBtn) {
importBtn.onclick = function () {
handleImportData();
};
}
var deleteBtn = document.getElementById('btn-delete-account');
if (deleteBtn) {
deleteBtn.onclick = function () {
handleDeleteAccount();
};
}
var pwdForm = document.getElementById('password-change-form');
if (pwdForm) {
pwdForm.onsubmit = function (e) {
e.preventDefault();
handlePasswordChangeSubmit();
};
}
var pwdCancel = document.getElementById('btn-cancel-password');
if (pwdCancel) {
pwdCancel.onclick = function () {
document.getElementById('password-change-modal').style.display = 'none';
};
}
}
async function renderProfileView() {
var user = getCurrentUser();
if (!user) {
showAuthView('login');
switchView('auth');
return;
}
var nameEl = document.getElementById('profile-name');
var emailEl = document.getElementById('profile-email');
var joinDateEl = document.getElementById('profile-join-date');
var avatarEl = document.getElementById('profile-avatar');
if (nameEl) nameEl.textContent = user.displayName || 'User';
if (emailEl) emailEl.textContent = user.email || '';
if (joinDateEl) {
joinDateEl.textContent = user.createdAt
? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
: '—';
}
if (avatarEl) {
var initial = (user.displayName || 'U').charAt(0).toUpperCase();
avatarEl.textContent = initial;
}
var stats = computeLearningSummary();
document.getElementById('profile-stats-mastered').textContent = stats.wordsMastered;
document.getElementById('profile-stats-reviews').textContent = stats.totalReviews;
document.getElementById('profile-stats-streak').textContent = stats.streak + ' days';
document.getElementById('profile-stats-retention').textContent = (stats.averageRetention || 0) + '%';
var profile = await loadProfile(user.uid);
if (profile && profile.settings) {
var settings = mergeSettings(profile.settings);
document.getElementById('settings-daily-limit').textContent = settings.dailyReviewLimit;
document.getElementById('settings-session-size').textContent = settings.sessionSize;
document.getElementById('settings-auto-import').textContent = settings.autoImportOnLogin ? 'On' : 'Off';
} else {
var defaults = getDefaultSettings();
document.getElementById('settings-daily-limit').textContent = defaults.dailyReviewLimit;
document.getElementById('settings-session-size').textContent = defaults.sessionSize;
document.getElementById('settings-auto-import').textContent = defaults.autoImportOnLogin ? 'On' : 'Off';
}
var verifiedEl = document.getElementById('profile-email-verified');
if (verifiedEl) {
if (user.emailVerified) {
verifiedEl.textContent = '✓ Verified';
verifiedEl.style.color = 'var(--green)';
} else {
verifiedEl.textContent = '⚠ Not verified — check your inbox';
verifiedEl.style.color = 'var(--red)';
}
}
var syncStatus = getSyncStatus ? getSyncStatus() : {};
var syncEl = document.getElementById('profile-sync-status');
if (syncEl) {
if (syncStatus.syncing) {
syncEl.textContent = 'Syncing...';
syncEl.style.color = 'var(--gold)';
} else if (syncStatus.pending) {
syncEl.textContent = '⚠ Pending sync — changes not saved to cloud';
syncEl.style.color = 'var(--red)';
} else if (syncStatus.ready) {
syncEl.textContent = '✓ Cloud sync active';
syncEl.style.color = 'var(--green)';
} else {
syncEl.textContent = '○ Cloud sync inactive (offline mode)';
syncEl.style.color = 'var(--text-muted)';
}
}
}
function toggleEditProfile() {
_editingProfile = !_editingProfile;
var viewEl = document.getElementById('profile-info');
var editEl = document.getElementById('profile-edit');
if (viewEl) viewEl.style.display = _editingProfile ? 'none' : 'block';
if (editEl) editEl.style.display = _editingProfile ? 'block' : 'none';
if (_editingProfile) {
var user = getCurrentUser();
var nameInput = document.getElementById('profile-edit-name');
if (nameInput && user) nameInput.value = user.displayName || '';
var emailInput = document.getElementById('profile-edit-email');
if (emailInput && user) emailInput.value = user.email || '';
}
}
async function saveProfileChanges() {
var user = getCurrentUser();
if (!user) return;
var nameInput = document.getElementById('profile-edit-name');
var emailInput = document.getElementById('profile-edit-email');
var errorEl = document.getElementById('profile-edit-error');
var successEl = document.getElementById('profile-edit-success');
hideProfileMessage(errorEl);
hideProfileMessage(successEl);
var newName = nameInput ? nameInput.value.trim() : '';
var newEmail = emailInput ? emailInput.value.trim() : '';
try {
if (newName && newName !== user.displayName) {
await updateDisplayName(newName);
}
if (newEmail && newEmail !== user.email) {
await updateEmail(newEmail);
}
await saveProfile(user.uid, {
displayName: newName || user.displayName,
email: newEmail || user.email,
});
if (successEl) {
successEl.textContent = 'Profile updated successfully.';
successEl.style.display = 'block';
}
toggleEditProfile();
} catch (e) {
if (errorEl) {
errorEl.textContent = e.message;
errorEl.style.display = 'block';
}
}
}
function toggleEditSettings() {
_editingSettings = !_editingSettings;
var viewEl = document.getElementById('settings-info');
var editEl = document.getElementById('settings-edit');
if (viewEl) viewEl.style.display = _editingSettings ? 'none' : 'block';
if (editEl) editEl.style.display = _editingSettings ? 'block' : 'none';
if (_editingSettings) {
var user = getCurrentUser();
if (user) {
loadProfile(user.uid).then(function (profile) {
var settings = profile && profile.settings ? mergeSettings(profile.settings) : getDefaultSettings();
var limitInput = document.getElementById('settings-edit-limit');
if (limitInput) limitInput.value = settings.dailyReviewLimit;
var sizeInput = document.getElementById('settings-edit-size');
if (sizeInput) sizeInput.value = settings.sessionSize;
var autoInput = document.getElementById('settings-edit-auto');
if (autoInput) autoInput.checked = settings.autoImportOnLogin;
});
}
}
}
async function saveSettingsChanges() {
var user = getCurrentUser();
if (!user) return;
var limitInput = document.getElementById('settings-edit-limit');
var sizeInput = document.getElementById('settings-edit-size');
var autoInput = document.getElementById('settings-edit-auto');
var errorEl = document.getElementById('settings-edit-error');
var successEl = document.getElementById('settings-edit-success');
hideProfileMessage(errorEl);
hideProfileMessage(successEl);
var newSettings = {
dailyReviewLimit: parseInt(limitInput ? limitInput.value : 25, 10) || 25,
sessionSize: parseInt(sizeInput ? sizeInput.value : 20, 10) || 20,
autoImportOnLogin: autoInput ? autoInput.checked : true,
};
newSettings.dailyReviewLimit = Math.max(5, Math.min(100, newSettings.dailyReviewLimit));
newSettings.sessionSize = Math.max(5, Math.min(ALL_WORDS.length, newSettings.sessionSize));
try {
await saveProfile(user.uid, { settings: newSettings });
if (typeof SESSION_SIZE !== 'undefined') {
}
if (successEl) {
successEl.textContent = 'Settings saved. Some changes take effect after reload.';
successEl.style.display = 'block';
}
toggleEditSettings();
} catch (e) {
if (errorEl) {
errorEl.textContent = e.message;
errorEl.style.display = 'block';
}
}
}
function showPasswordChangeModal() {
var modal = document.getElementById('password-change-modal');
if (modal) {
modal.style.display = 'flex';
modal.onclick = function(e) {
if (e.target === modal) closePasswordModal();
};
}
var appEl = document.querySelector('.app');
if (appEl) appEl.setAttribute('aria-hidden', 'true');
trapFocus(modal);
document.getElementById('password-change-error').style.display = 'none';
document.getElementById('password-change-success').style.display = 'none';
document.getElementById('password-change-current').value = '';
document.getElementById('password-change-new').value = '';
document.getElementById('password-change-confirm').value = '';
}
async function handlePasswordChangeSubmit() {
var currentPwd = document.getElementById('password-change-current').value;
var newPwd = document.getElementById('password-change-new').value;
var confirmPwd = document.getElementById('password-change-confirm').value;
var errorEl = document.getElementById('password-change-error');
var successEl = document.getElementById('password-change-success');
var user = getCurrentUser();
hideProfileMessage(errorEl);
hideProfileMessage(successEl);
var currentInput = document.getElementById('password-change-current');
var newInput = document.getElementById('password-change-new');
var confirmInput = document.getElementById('password-change-confirm');
if (!currentPwd || !newPwd || !confirmPwd) {
errorEl.textContent = 'Please fill in all fields.';
errorEl.style.display = 'block';
errorEl.id = 'password-change-error';
if (currentInput) currentInput.setAttribute('aria-describedby', 'password-change-error');
if (newInput) newInput.setAttribute('aria-describedby', 'password-change-error');
if (confirmInput) confirmInput.setAttribute('aria-describedby', 'password-change-error');
return;
}
if (newPwd !== confirmPwd) {
errorEl.textContent = 'New passwords do not match.';
errorEl.style.display = 'block';
errorEl.id = 'password-change-error';
if (newInput) newInput.setAttribute('aria-describedby', 'password-change-error');
if (confirmInput) confirmInput.setAttribute('aria-describedby', 'password-change-error');
return;
}
if (newPwd.length < 6) {
errorEl.textContent = 'Password must be at least 6 characters.';
errorEl.style.display = 'block';
errorEl.id = 'password-change-error';
if (newInput) newInput.setAttribute('aria-describedby', 'password-change-error');
return;
}
try {
await reauthenticate(user.email, currentPwd);
await updatePassword(newPwd);
successEl.textContent = 'Password changed successfully.';
successEl.style.display = 'block';
setTimeout(function () {
closePasswordModal();
}, 2000);
} catch (e) {
errorEl.textContent = e.message;
errorEl.style.display = 'block';
}
}
async function handleDeleteAccount() {
var user = getCurrentUser();
if (!user) return;
var confirm1 = confirm('Are you sure you want to delete your account? This cannot be undone.');
if (!confirm1) return;
var confirm2 = confirm('Type "DELETE" to confirm permanent account deletion.');
if (!confirm2) return;
try {
await deleteProfile(user.uid);
await deleteAccount();
localStorage.clear();
showAuthView('login');
switchView('auth');
} catch (e) {
alert('Failed to delete account: ' + e.message);
}
}
async function handleExportData() {
var user = getCurrentUser();
var data;
if (user) {
data = await exportAccountData(user.uid);
} else {
data = exportLocalData ? exportLocalData() : {};
}
var json = JSON.stringify(data, null, 2);
var blob = new Blob([json], { type: 'application/json' });
var url = URL.createObjectURL(blob);
var a = document.createElement('a');
a.href = url;
a.download = 'quran-vocab-backup-' + new Date().toISOString().slice(0, 10) + '.json';
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
}
function handleImportData() {
var input = document.createElement('input');
input.type = 'file';
input.accept = '.json';
input.onchange = function (e) {
var file = e.target.files[0];
if (!file) return;
var reader = new FileReader();
reader.onload = function (ev) {
try {
var data = JSON.parse(ev.target.result);
var result = importLocalData ? importLocalData(data) : { imported: [], skipped: [] };
if (result.error) {
alert('Import error: ' + result.error);
} else {
alert('Imported ' + result.imported.length + ' data categories successfully.' +
(result.skipped.length > 0 ? ' (' + result.skipped.length + ' skipped)' : '') +
'\nPlease reload the app.');
}
} catch (err) {
alert('Invalid backup file. Please choose a valid .json file.');
}
};
reader.readAsText(file);
};
input.click();
}
function hideProfileMessage(el) {
if (!el) return;
el.textContent = '';
el.style.display = 'none';
}
window.__profileUI = {
init: initProfileUI,
render: renderProfileView,
};
buildLessons();
let currentWord = 0;
let reviewMode = false;
let reviewQueue = [];
let currentView = 'learn';
let activeLessonIndex = 0;
function getActiveLessonWords() {
if (getOrganizationMode() === 'surah' && getActiveSurahId()) {
return getSurahWords(getActiveSurahId());
}
return getLessonWords(activeLessonIndex);
}
function getActiveLessonWordCount() {
var words = getActiveLessonWords();
return words ? words.length : 0;
}
function goToSurah(surahId, wordIndex) {
if (!surahId || !SURAH_INFO[surahId]) return;
setOrganizationMode('surah');
setActiveSurahId(surahId);
activeLessonIndex = 0;
currentWord = (wordIndex !== undefined && wordIndex >= 0) ? wordIndex : 0;
reviewMode = false;
switchView('learn');
updateWordCard();
}
function goToLessonMode() {
setOrganizationMode('lesson');
setActiveSurahId(null);
activeLessonIndex = getCurrentLessonIndex();
currentWord = 0;
reviewMode = false;
switchView('learn');
updateWordCard();
}
function goToLesson(lessonIndex, wordIndex) {
if (lessonIndex < 0 || lessonIndex >= getLessonCount()) return;
if (getOrganizationMode() !== 'lesson') {
setOrganizationMode('lesson');
setActiveSurahId(null);
}
if (!isLessonUnlocked(lessonIndex) && lessonIndex !== activeLessonIndex) {
return;
}
activeLessonIndex = lessonIndex;
setCurrentLesson(lessonIndex);
currentWord = (wordIndex !== undefined && wordIndex >= 0) ? wordIndex : 0;
reviewMode = false;
switchView('learn');
updateWordCard();
updateLessonProgressDisplay();
}
function continueLearning() {
var next = getNextIncompleteLesson();
goToLesson(next);
}
function getCurrentWord() {
if (reviewMode) return reviewQueue[currentWord];
var words = getActiveLessonWords();
if (!words || words.length === 0) return null;
if (currentWord >= words.length) currentWord = 0;
return words[currentWord];
}
function switchView(viewName) {
if (window.__autoNavTimer) {
clearTimeout(window.__autoNavTimer);
window.__autoNavTimer = null;
}
currentView = viewName;
setView(viewName);
if (viewName === 'learn') {
updateReviewBanner();
updateLessonProgressDisplay();
}
if (viewName === 'quiz') initQuiz();
if (viewName === 'list') renderWordList();
if (viewName === 'stats') renderStats();
if (viewName === 'profile') renderProfileView();
if (document.activeElement) document.activeElement.blur();
}
function nextWord() {
const total = reviewMode ? reviewQueue.length : getActiveLessonWordCount();
if (currentWord < total - 1) {
currentWord++;
updateWordCard();
}
}
function prevWord() {
if (currentWord > 0) {
currentWord--;
updateWordCard();
}
}
function updateWordCard() {
const w = getCurrentWord();
if (!w) return;
const total = reviewMode ? reviewQueue.length : getActiveLessonWordCount();
renderWordCard(w, currentWord, total, reviewMode);
const btnNext = document.getElementById('btn-next');
btnNext.onclick = function () {
if (currentWord < total - 1) {
nextWord();
} else if (reviewMode) {
endReview();
} else {
switchView('quiz');
}
};
updateStatsDisplay();
}
function rateSRS(rating) {
const w = getCurrentWord();
if (!w) return;
rateSRSWord(w.id, rating);
if (window.__srs && window.__srs.invalidateStatsCache) {
window.__srs.invalidateStatsCache();
}
updateStreak();
updateStatsDisplay();
var user = getCurrentUser ? getCurrentUser() : null;
if (user && window.__sync && window.__sync.queueSync) {
window.__sync.queueSync(user.uid);
}
const total = reviewMode ? reviewQueue.length : getActiveLessonWordCount();
if (currentWord < total - 1) {
currentWord++;
updateWordCard();
} else if (reviewMode) {
endReview();
} else {
switchView('quiz');
}
}
function handleSearchInput() {
renderWordList();
}
function handleFilterClick(filterType, value) {
var selector = '#filter-' + filterType + '-chips .chip';
document.querySelectorAll(selector).forEach(function (chip) {
if (chip.getAttribute('data-value') === value) {
chip.classList.add('chip-active');
} else {
chip.classList.remove('chip-active');
}
});
renderWordList();
}
function toggleBookmark() {
var w = getCurrentWord();
if (!w) return;
toggleFavorite(w.id);
updateBookmarkButton(w.id);
}
function saveNote() {
var w = getCurrentWord();
if (!w) return;
var text = document.getElementById('notes-input').value;
setNote(w.id, text);
}
function updateLessonProgressDisplay() {
var lessonLabel = DOM.get('lesson-label');
if (getOrganizationMode() === 'surah') {
var surahId = getActiveSurahId();
var surahInfo = getSurahInfo(surahId);
var surahIds = getSurahsWithVocabulary();
var curIdx = surahIds.indexOf(surahId);
if (lessonLabel && surahInfo) {
lessonLabel.textContent = surahInfo.name + ' - ' + surahInfo.english;
}
var completed = getCompletedSurahCount();
var lessonProgress = DOM.get('lesson-progress');
if (lessonProgress) {
var pct = surahIds.length > 0 ? Math.round((completed / surahIds.length) * 100) : 0;
lessonProgress.style.width = pct + '%';
}
var lessonProgressText = DOM.get('lesson-progress-text');
if (lessonProgressText) {
lessonProgressText.textContent = completed + ' of ' + surahIds.length + ' surahs complete';
}
var continueBtn = DOM.get('continue-learning-btn');
if (continueBtn) {
if (completed >= surahIds.length) {
continueBtn.textContent = '🎉 All Surahs Complete!';
continueBtn.disabled = true;
} else {
var nextIncomplete = -1;
for (var si = 0; si < surahIds.length; si++) {
if (!isSurahCompleted(surahIds[si])) { nextIncomplete = si; break; }
}
if (nextIncomplete >= 0) {
continueBtn.textContent = '📖 Continue ' + getSurahNameSimple(surahIds[nextIncomplete]);
continueBtn.disabled = false;
}
}
}
return;
}
var total = getLessonCount();
var completed = getCompletedLessonCount();
var current = activeLessonIndex + 1;
if (lessonLabel) {
lessonLabel.textContent = 'Lesson ' + current + ' of ' + total;
}
var lessonProgress = DOM.get('lesson-progress');
if (lessonProgress) {
var pct = total > 0 ? Math.round((completed / total) * 100) : 0;
lessonProgress.style.width = pct + '%';
}
var lessonProgressText = DOM.get('lesson-progress-text');
if (lessonProgressText) {
lessonProgressText.textContent = completed + ' of ' + total + ' lessons complete';
}
var continueBtn = DOM.get('continue-learning-btn');
if (continueBtn) {
var nextIncomplete = getNextIncompleteLesson();
if (nextIncomplete === 0 && isLessonCompleted(0) && getLessonCount() > 1) {
continueBtn.textContent = '\uD83C\uDF89 All Lessons Complete!';
continueBtn.disabled = true;
} else if (nextIncomplete === activeLessonIndex) {
continueBtn.textContent = '\uD83D\uDCD6 Continue Lesson ' + (nextIncomplete + 1);
continueBtn.disabled = false;
} else if (isLessonCompleted(activeLessonIndex) && nextIncomplete < getLessonCount()) {
continueBtn.textContent = '\uD83D\uDD13 Unlock Lesson ' + (nextIncomplete + 1) + '!';
continueBtn.disabled = false;
} else {
continueBtn.textContent = '\uD83D\uDCD6 Continue Lesson ' + (nextIncomplete + 1);
continueBtn.disabled = false;
}
}
}
let quickMode = false;
function toggleQuickMode() {
quickMode = !quickMode;
var view = document.getElementById('view-learn');
if (view) {
view.classList.toggle('quick-mode', quickMode);
}
var btn = document.getElementById('qa-quick-mode');
if (btn) {
if (quickMode) {
btn.classList.add('active-qa');
btn.textContent = '⚡ Quick: ON';
} else {
btn.classList.remove('active-qa');
btn.textContent = '⚡ Quick';
}
}
if (quickMode) {
var card = document.getElementById('word-card');
if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
}
function showSessionSummary(stats) {
var modal = document.getElementById('session-summary-modal');
if (!modal) return;
document.getElementById('session-words-reviewed').textContent = stats.wordsReviewed || 0;
document.getElementById('session-streak-earned').textContent = stats.streakDays || 0;
document.getElementById('session-mastered-new').textContent = stats.newMastered || 0;
var encouragement = document.getElementById('session-encouragement');
var msgs = [
'🌟 MashAllah! Excellent progress!',
'📖 Keep going — every word brings you closer!',
'💪 Strong effort! Consistency is key.',
'🎯 Focused review makes perfect. Well done!',
'🌙 Beautiful work! The Quran rewards persistence.',
];
if (stats.wordsReviewed >= 10) {
encouragement.textContent = msgs[0];
} else if (stats.wordsReviewed >= 5) {
encouragement.textContent = msgs[1];
} else {
encouragement.textContent = msgs[2];
}
modal.style.display = 'flex';
modal.onclick = function(e) {
if (e.target === modal) closeSessionSummary();
};
var appEl = document.querySelector('.app');
if (appEl) appEl.setAttribute('aria-hidden', 'true');
trapFocus(modal);
}
function closeSessionSummary() {
var modal = document.getElementById('session-summary-modal');
modal.style.display = 'none';
modal.onclick = null;
releaseFocusTrap(modal);
var appEl = document.querySelector('.app');
if (appEl) appEl.removeAttribute('aria-hidden');
__sessionSummaryModalQueuedSwitch = false;
}
let _kbdHintsTimer = null;
function showKeyboardHints() {
var hint = document.getElementById('kbd-hints');
if (!hint) return;
hint.classList.add('visible');
hint.setAttribute('role', 'status');
hint.setAttribute('aria-live', 'polite');
if (_kbdHintsTimer) clearTimeout(_kbdHintsTimer);
_kbdHintsTimer = setTimeout(function () {
hint.classList.remove('visible');
hint.removeAttribute('role');
hint.removeAttribute('aria-live');
}, 4000);
}
function setupKeyboardShortcuts() {
document.addEventListener('keydown', function (e) {
var tag = e.target.tagName;
if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
var passwordModal = document.getElementById('password-change-modal');
var sessionModal = document.getElementById('session-summary-modal');
var anyModalOpen = (passwordModal && passwordModal.style.display === 'flex') ||
(sessionModal && sessionModal.style.display === 'flex');
if (anyModalOpen) {
if (e.key === 'Escape') {
e.preventDefault();
closeSessionSummary();
closePasswordModal();
}
return;
}
if (e.key === '?') {
e.preventDefault();
showKeyboardHints();
return;
}
switch (currentView) {
case 'learn':
if (e.key === 'ArrowRight' || e.key === ' ') {
e.preventDefault();
var btnNext = document.getElementById('btn-next');
if (btnNext && !btnNext.disabled) btnNext.click();
} else if (e.key === 'ArrowLeft') {
e.preventDefault();
var btnPrev = document.getElementById('btn-prev');
if (btnPrev && !btnPrev.disabled) btnPrev.click();
} else if (e.key >= '1' && e.key <= '4') {
e.preventDefault();
var srsBtns = ['srs-again', 'srs-hard', 'srs-good', 'srs-easy'];
var btn = document.getElementById(srsBtns[parseInt(e.key) - 1]);
if (btn && btn.style.display !== 'none') btn.click();
} else if (e.key === 'q' || e.key === 'Q') {
e.preventDefault();
toggleQuickMode();
}
break;
case 'quiz':
if (e.key >= '1' && e.key <= '4') {
e.preventDefault();
var opts = document.querySelectorAll('.quiz-opt:not(:disabled)');
var idx = parseInt(e.key) - 1;
if (opts[idx]) opts[idx].click();
} else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
e.preventDefault();
var nextBtn = document.getElementById('btn-next-quiz');
if (nextBtn && nextBtn.style.display !== 'none') nextBtn.click();
}
break;
case 'list':
if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
e.preventDefault();
var searchInput = document.getElementById('search-input');
if (searchInput) searchInput.focus();
}
break;
}
if (!e.ctrlKey && !e.metaKey && !e.altKey) {
if (e.key === 'l' || e.key === 'L') { e.preventDefault(); switchView('learn'); }
else if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); switchView('quiz'); }
else if (e.key === 'w' || e.key === 'W') { e.preventDefault(); switchView('list'); }
else if (e.key === 's' || e.key === 'S') { e.preventDefault(); switchView('stats'); }
}
if (window._kbdHintsAutoShown) {
window._kbdHintsAutoShown = false;
var hint = document.getElementById('kbd-hints');
if (hint) {
clearTimeout(_kbdHintsTimer);
hint.classList.remove('visible');
}
}
});
}
function wireEvents() {
document.getElementById('tab-learn').onclick = function () { switchView('learn'); };
document.getElementById('tab-quiz').onclick = function () { switchView('quiz'); };
document.getElementById('tab-list').onclick = function () { switchView('list'); };
document.getElementById('tab-stats').onclick = function () { switchView('stats'); };
document.getElementById('btn-prev').onclick = prevWord;
document.getElementById('qa-show-ayah').onclick = function () {
var w = getCurrentWord();
if (w) showAyah(w);
};
document.getElementById('qa-show-more').onclick = function () {
var w = getCurrentWord();
if (w) showWordContent(w);
};
document.getElementById('qa-root-family').onclick = highlightRootBox;
document.getElementById('qa-bookmark').onclick = toggleBookmark;
document.getElementById('tafsir-btn').onclick = function () {
var w = getCurrentWord();
if (w) loadTafsir(w);
};
document.getElementById('notes-input').onblur = saveNote;
document.getElementById('srs-again').onclick = function () { rateSRS(0); };
document.getElementById('srs-hard').onclick = function () { rateSRS(1); };
document.getElementById('srs-good').onclick = function () { rateSRS(2); };
document.getElementById('srs-easy').onclick = function () { rateSRS(3); };
document.getElementById('btn-next-quiz').onclick = nextQuiz;
document.getElementById('review-start-btn').onclick = startReview;
var searchInput = DOM.get('search-input');
if (searchInput) {
var searchTimer = null;
searchInput.oninput = function () {
if (searchTimer) {
cancelAnimationFrame(searchTimer);
}
searchTimer = requestAnimationFrame(function() {
searchTimer = null;
handleSearchInput();
});
};
}
wireFilterChips('type');
wireFilterChips('status');
DOM.get('continue-learning-btn').onclick = function () {
if (getOrganizationMode() === 'surah') {
var surahIds = getSurahsWithVocabulary();
for (var si = 0; si < surahIds.length; si++) {
if (!isSurahCompleted(surahIds[si])) {
goToSurah(surahIds[si]);
return;
}
}
goToSurah(surahIds[0] || 1);
} else {
continueLearning();
}
};
DOM.get('qa-quick-mode').onclick = toggleQuickMode;
DOM.get('session-summary-close').onclick = function () {
closeSessionSummary();
switchView('learn');
var wordCard = DOM.get('word-card');
if (wordCard && typeof wordCard.focus === 'function') {
wordCard.setAttribute('tabindex', '-1');
wordCard.focus();
}
};
DOM.get('prev-lesson-btn').onclick = function () {
if (getOrganizationMode() === 'surah') {
var surahIds = getSurahsWithVocabulary();
var curIdx = surahIds.indexOf(getActiveSurahId());
if (curIdx > 0) goToSurah(surahIds[curIdx - 1]);
} else if (activeLessonIndex > 0) {
goToLesson(activeLessonIndex - 1);
}
};
DOM.get('next-lesson-btn').onclick = function () {
if (getOrganizationMode() === 'surah') {
var surahIds = getSurahsWithVocabulary();
var curIdx = surahIds.indexOf(getActiveSurahId());
if (curIdx >= 0 && curIdx < surahIds.length - 1) goToSurah(surahIds[curIdx + 1]);
} else {
var nextIdx = activeLessonIndex + 1;
if (nextIdx < getLessonCount() && isLessonUnlocked(nextIdx)) {
goToLesson(nextIdx);
}
}
};
var surahSelector = DOM.get('surah-select');
if (surahSelector) {
surahSelector.onchange = function () {
var val = parseInt(this.value, 10);
if (val) {
goToSurah(val);
} else {
goToLessonMode();
}
};
}
wireOccurrenceNav();
}
function wireFilterChips(filterType) {
var selector = '#filter-' + filterType + '-chips';
var container = document.querySelector(selector);
if (container) {
container.onclick = function (e) {
var chip = e.target.closest('.chip');
if (chip) {
handleFilterClick(filterType, chip.getAttribute('data-value'));
}
};
}
}
var _reviewOriginalMastered = 0;
function startReview() {
reviewQueue = getDueReviews();
if (!reviewQueue.length) return;
_reviewOriginalMastered = 0;
var srsData = loadSRS();
for (var ri = 0; ri < reviewQueue.length; ri++) {
var entry = srsData[reviewQueue[ri].id];
if (entry && entry.stage >= 2) _reviewOriginalMastered++;
}
reviewMode = true;
currentWord = 0;
DOM.get('review-banner').classList.remove('visible');
updateWordCard();
}
function endReview() {
var srsData = loadSRS();
var newMastered = 0;
for (var ri = 0; ri < reviewQueue.length; ri++) {
var entry = srsData[reviewQueue[ri].id];
if (entry && entry.stage >= 2) {
newMastered++;
}
}
newMastered = Math.max(0, newMastered - _reviewOriginalMastered);
var streakData = loadStreakData();
var stats = {
wordsReviewed: reviewQueue.length,
streakDays: streakData.streak || 0,
newMastered: newMastered,
};
reviewMode = false;
currentWord = 0;
updateReviewBanner();
updateWordCard();
if (reviewQueue.length > 0) {
showSessionSummary(stats);
}
}
function trapFocus(modalEl) {
if (!modalEl) return;
var focusableSelector = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
var focusable = modalEl.querySelectorAll(focusableSelector);
if (focusable.length === 0) return;
var firstFocusable = focusable[0];
var lastFocusable = focusable[focusable.length - 1];
window.__lastFocusedEl = document.activeElement;
if (firstFocusable) firstFocusable.focus();
modalEl._focusTrapHandler = function (e) {
if (e.key === 'Tab') {
if (e.shiftKey) {
if (document.activeElement === firstFocusable) {
e.preventDefault();
lastFocusable.focus();
}
} else {
if (document.activeElement === lastFocusable) {
e.preventDefault();
firstFocusable.focus();
}
}
}
};
document.addEventListener('keydown', modalEl._focusTrapHandler);
}
function releaseFocusTrap(modalEl) {
if (!modalEl) return;
if (modalEl._focusTrapHandler) {
document.removeEventListener('keydown', modalEl._focusTrapHandler);
delete modalEl._focusTrapHandler;
}
if (window.__lastFocusedEl && window.__lastFocusedEl.focus) {
window.__lastFocusedEl.focus();
}
}
function closePasswordModal() {
var modal = document.getElementById('password-change-modal');
if (!modal) return;
modal.style.display = 'none';
modal.onclick = null;
releaseFocusTrap(modal);
var appEl = document.querySelector('.app');
if (appEl) appEl.removeAttribute('aria-hidden');
}
function populateSurahSelector() {
var select = DOM.get('surah-select');
if (!select) return;
while (select.options.length > 1) {
select.remove(1);
}
var surahIds = getSurahsWithVocabulary();
if (surahIds.length === 0) return;
var separator = document.createElement('option');
separator.disabled = true;
separator.textContent = '─── Surahs ───';
select.appendChild(separator);
for (var i = 0; i < surahIds.length; i++) {
var sid = surahIds[i];
var info = getSurahInfo(sid);
if (!info) continue;
var opt = document.createElement('option');
opt.value = sid;
opt.textContent = sid + '. ' + info.name + ' — ' + info.english;
select.appendChild(opt);
}
}
window.__getCurrentWord = getCurrentWord;
window.__navigateToWordIndex = function (idx) {
var count = getActiveLessonWordCount();
if (count === 0) return;
currentWord = Math.min(idx, count - 1);
reviewMode = false;
switchView('learn');
updateWordCard();
};
function validateData() {
if (!ALL_WORDS || ALL_WORDS.length === 0) {
console.warn('[validate] No vocabulary data loaded.');
return { valid: false, errors: ['No vocabulary data loaded'] };
}
var errors = [];
var idMap = {};
var arabicCounts = {};
var arabicSet = new Set();
for (var si = 0; si < ALL_WORDS.length; si++) {
if (ALL_WORDS[si].arabic) arabicSet.add(ALL_WORDS[si].arabic);
}
for (var i = 0; i < ALL_WORDS.length; i++) {
var w = ALL_WORDS[i];
if (!w.id) {
errors.push('Word #' + i + ' is missing an id field');
} else if (idMap[w.id]) {
errors.push('Duplicate ID: ' + w.id + ' (words #' + idMap[w.id] + ' and #' + i + ')');
} else {
idMap[w.id] = i;
}
if (w.id && w.id.indexOf('w_') !== 0) {
errors.push('Word #' + i + ' has malformed ID: ' + w.id);
}
if (!w.arabic) errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') is missing arabic field');
if (!w.english) errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') is missing english field');
if (!w.translit) errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') is missing translit field');
if (!w.meaning) errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') is missing meaning field');
if (!w.type) errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') is missing type field');
if (!w.typeCategory) errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') is missing typeCategory field');
if (!w.root) errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') is missing root field');
if (w.occ === undefined || w.occ === null) errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') is missing occ field');
if (!w.difficulty) errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') is missing difficulty field');
if (w.surahId !== undefined && w.surahId !== null) {
if (!SURAH_INFO || !SURAH_INFO[w.surahId]) {
errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') has invalid surahId: ' + w.surahId);
}
}
if (w.verseKey && typeof w.verseKey === 'string') {
var parts = w.verseKey.split(':');
if (parts.length !== 2) {
errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') has malformed verseKey: ' + w.verseKey);
} else {
var vSurah = parseInt(parts[0], 10);
var vVerse = parseInt(parts[1], 10);
if (w.surahId && SURAH_INFO && SURAH_INFO[w.surahId]) {
var maxVerses = SURAH_INFO[w.surahId].verses;
if (vVerse < 1 || vVerse > maxVerses) {
errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') has verseKey ' + w.verseKey + ' but surah ' + w.surahId + ' only has ' + maxVerses + ' verses');
}
}
if (w.surahId && vSurah !== w.surahId) {
errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') has verseKey surah ' + vSurah + ' but surahId is ' + w.surahId);
}
}
}
var refFields = ['similarWords', 'oppositeWords'];
for (var ri = 0; ri < refFields.length; ri++) {
var refs = w[refFields[ri]];
if (refs && Array.isArray(refs)) {
for (var rj = 0; rj < refs.length; rj++) {
if (!arabicSet.has(refs[rj])) {
errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') references missing ' + refFields[ri] + ' word: \'' + refs[rj] + '\'');
}
}
}
}
if (w.rootFamily && Array.isArray(w.rootFamily)) {
for (var rfi = 0; rfi < w.rootFamily.length; rfi++) {
var rfArabic = w.rootFamily[rfi].a;
if (rfArabic && !arabicSet.has(rfArabic)) {
errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') references missing rootFamily word: \'' + rfArabic + '\'');
}
}
}
if (w.arabic) {
if (!arabicCounts[w.arabic]) arabicCounts[w.arabic] = 0;
arabicCounts[w.arabic]++;
}
if (w.difficulty !== undefined && (w.difficulty < 1 || w.difficulty > 5)) {
errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') has out-of-range difficulty: ' + w.difficulty);
}
var validCategories = ['noun', 'verb', 'particle', 'adjective', 'pronoun', 'exclamation'];
if (w.typeCategory && validCategories.indexOf(w.typeCategory) < 0) {
errors.push('Word #' + i + ' (' + (w.id || 'no-id') + ') has invalid typeCategory: ' + w.typeCategory);
}
}
var duplicateArabic = [];
Object.keys(arabicCounts).forEach(function (arabic) {
if (arabicCounts[arabic] > 1) {
duplicateArabic.push(arabic + ' (' + arabicCounts[arabic] + ' instances)');
}
});
if (errors.length > 0) {
console.warn('[validate] Data validation found ' + errors.length + ' issue(s):');
errors.forEach(function (err) { console.warn('  ✗ ' + err); });
}
if (duplicateArabic.length > 0) {
console.log('[validate] Legitimate duplicate Arabic words found (' + duplicateArabic.length + '):');
duplicateArabic.forEach(function (info) { console.log('  ℹ ' + info); });
}
console.log('[validate] All ' + ALL_WORDS.length + ' words validated. ' +
(errors.length === 0 ? '✓ No issues.' : errors.length + ' issue(s) found.'));
return { valid: errors.length === 0, errors: errors, arabicDuplicates: duplicateArabic };
}
function registerServiceWorker() {
if ('serviceWorker' in navigator) {
navigator.serviceWorker
.register('sw.js')
.then(function () {
var badge = document.getElementById('offline-badge');
if (badge) badge.textContent = '\u2713 Offline ready';
})
.catch(function () {
var badge = document.getElementById('offline-badge');
if (badge) badge.style.display = 'none';
});
} else {
var badge = document.getElementById('offline-badge');
if (badge) badge.style.display = 'none';
}
}
function init() {
if (LESSONS.length === 0) buildLessons();
if (typeof buildWordIndex === 'function') buildWordIndex();
validateData();
activeLessonIndex = getCurrentLessonIndex();
if (activeLessonIndex >= getLessonCount()) activeLessonIndex = 0;
var firebaseReady = initAuth();
if (firebaseReady) {
initSync();
initUserService();
}
initAuthUI();
initProfileUI();
wireEvents();
setupKeyboardShortcuts();
populateSurahSelector();
updateWordCard();
updateReviewBanner();
updateStatsDisplay();
updateLessonProgressDisplay();
registerServiceWorker();
setupOnlineSync();
setTimeout(function() {
if (!window._kbdHintsShown) {
window._kbdHintsShown = true;
window._kbdHintsAutoShown = true;
showKeyboardHints();
}
}, 1000);
var user = getCurrentUser();
if (user) {
if (!user.emailVerified) {
console.log('[app] Email not verified — user can continue.');
}
}
if (user && window.__user) {
window.__user.loadProfile(user.uid).then(function (profile) {
if (profile && profile.settings && profile.settings.dailyReviewLimit) {
if (window.__srs && window.__srs.updateDailyReviewLimit) {
window.__srs.updateDailyReviewLimit(profile.settings.dailyReviewLimit);
}
}
}).catch(function () {
});
}
}
function setupOnlineSync() {
window.addEventListener('online', function () {
var user = getCurrentUser();
if (user && window.__sync) {
if (window.__sync.hasPending && window.__sync.hasPending()) {
console.log('[app] Back online — syncing pending changes...');
window.__sync.fullSync(user.uid);
}
}
});
}
init();