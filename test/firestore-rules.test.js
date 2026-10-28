#!/usr/bin/env node
/**
 * firestore-rules.test.js — Firestore security rules tests (emulator)
 *
 * Runs firestore.rules in the Firestore emulator, which needs Java, so
 * it is NOT part of test/run-all.js. CI runs it in its own job; locally:
 *
 *   npm install --no-save @firebase/rules-unit-testing@5.0.2 firebase@12.15.0
 *   firebase emulators:exec --only firestore --project demo-bayan "node test/firestore-rules.test.js"
 *
 * Focus: learning/{uid} writes require an active subscription that
 * mirrors isPremium() in js/services/premium.js, while reads/deletes
 * stay open to the owner.
 */

var fs = require('fs');
var path = require('path');
var rut = require('@firebase/rules-unit-testing');
var fsdk = require('firebase/firestore');

var assertSucceeds = rut.assertSucceeds;
var assertFails = rut.assertFails;

var DAY_MS = 24 * 60 * 60 * 1000;
var passed = 0;
var failed = 0;

async function t(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  ✅ ' + name);
  } catch (e) {
    failed++;
    console.log('  ❌ ' + name + ': ' + (e && e.message ? e.message : e).split('\n')[0]);
  }
}

async function main() {
  var testEnv = await rut.initializeTestEnvironment({
    projectId: 'demo-bayan',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') },
  });

  /** Replace subscriptions/{uid} (or remove it when sub is null). */
  async function setSubscription(uid, sub) {
    await testEnv.withSecurityRulesDisabled(async function (ctx) {
      var ref = fsdk.doc(ctx.firestore(), 'subscriptions', uid);
      if (sub === null) await fsdk.deleteDoc(ref);
      else await fsdk.setDoc(ref, sub);
    });
  }

  function dbFor(uid) {
    return uid ? testEnv.authenticatedContext(uid).firestore() : testEnv.unauthenticatedContext().firestore();
  }

  function writeLearning(uid, asUid) {
    return fsdk.setDoc(fsdk.doc(dbFor(asUid || uid), 'learning', uid), { srsData: { w1: { stage: 1 } } }, { merge: true });
  }

  var isoDate = function (offsetMs) { return new Date(Date.now() + offsetMs).toISOString(); };

  console.log('\n📋 learning/{uid} — premium-gated writes');

  await t('no subscription doc → write denied', async function () {
    await setSubscription('alice', null);
    await assertFails(writeLearning('alice'));
  });

  await t('status canceled → write denied', async function () {
    await setSubscription('alice', { status: 'canceled', currentPeriodEnd: isoDate(30 * DAY_MS) });
    await assertFails(writeLearning('alice'));
  });

  await t('status past_due → write denied', async function () {
    await setSubscription('alice', { status: 'past_due' });
    await assertFails(writeLearning('alice'));
  });

  await t('active without currentPeriodEnd → write allowed', async function () {
    await setSubscription('alice', { status: 'active', plan: 'monthly' });
    await assertSucceeds(writeLearning('alice'));
  });

  await t('active, ISO period end in the future → write allowed', async function () {
    await setSubscription('alice', { status: 'active', currentPeriodEnd: isoDate(10 * DAY_MS) });
    await assertSucceeds(writeLearning('alice'));
  });

  await t('active, ISO period ended two days ago → write denied', async function () {
    await setSubscription('alice', { status: 'active', currentPeriodEnd: isoDate(-2 * DAY_MS) });
    await assertFails(writeLearning('alice'));
  });

  await t('active, Firestore timestamp in the future → write allowed', async function () {
    await setSubscription('alice', { status: 'active', currentPeriodEnd: fsdk.Timestamp.fromMillis(Date.now() + DAY_MS) });
    await assertSucceeds(writeLearning('alice'));
  });

  await t('active, Firestore timestamp in the past → write denied', async function () {
    await setSubscription('alice', { status: 'active', currentPeriodEnd: fsdk.Timestamp.fromMillis(Date.now() - 60 * 1000) });
    await assertFails(writeLearning('alice'));
  });

  await t('active, epoch millis in the future → write allowed', async function () {
    await setSubscription('alice', { status: 'active', currentPeriodEnd: Date.now() + DAY_MS });
    await assertSucceeds(writeLearning('alice'));
  });

  await t('active, epoch millis in the past → write denied', async function () {
    await setSubscription('alice', { status: 'active', currentPeriodEnd: Date.now() - 60 * 1000 });
    await assertFails(writeLearning('alice'));
  });

  await t("premium user cannot write another user's learning doc", async function () {
    await setSubscription('alice', { status: 'active' });
    await assertFails(writeLearning('bob', 'alice'));
  });

  await t('unauthenticated write denied', async function () {
    await assertFails(fsdk.setDoc(fsdk.doc(dbFor(null), 'learning', 'alice'), { x: 1 }));
  });

  console.log('\n📋 learning/{uid} — reads and deletes');

  await t('free owner can read own learning doc (restore after lapse)', async function () {
    await setSubscription('alice', null);
    await assertSucceeds(fsdk.getDoc(fsdk.doc(dbFor('alice'), 'learning', 'alice')));
  });

  await t("cannot read another user's learning doc", async function () {
    await assertFails(fsdk.getDoc(fsdk.doc(dbFor('bob'), 'learning', 'alice')));
  });

  await t('free owner can delete own learning doc', async function () {
    await setSubscription('alice', null);
    await assertSucceeds(fsdk.deleteDoc(fsdk.doc(dbFor('alice'), 'learning', 'alice')));
  });

  console.log('\n📋 subscriptions / profiles (unchanged behaviour)');

  await t('owner can read own subscription, not write it', async function () {
    await setSubscription('alice', { status: 'active' });
    await assertSucceeds(fsdk.getDoc(fsdk.doc(dbFor('alice'), 'subscriptions', 'alice')));
    await assertFails(fsdk.setDoc(fsdk.doc(dbFor('alice'), 'subscriptions', 'alice'), { status: 'active' }));
  });

  await t("cannot read another user's subscription", async function () {
    await assertFails(fsdk.getDoc(fsdk.doc(dbFor('bob'), 'subscriptions', 'alice')));
  });

  await t('free owner can still write own profile', async function () {
    await setSubscription('alice', null);
    await assertSucceeds(fsdk.setDoc(fsdk.doc(dbFor('alice'), 'profiles', 'alice'), { displayName: 'A' }));
  });

  await testEnv.cleanup();

  var total = passed + failed;
  console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed, ' + total + ' total');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
