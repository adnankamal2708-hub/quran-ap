# Bayan API — Premium Subscription Backend

Stripe Checkout + webhook handlers for Bayan's premium subscription system,
deployed as Vercel serverless functions.

---

## Environment Variables  Yes

Set these in your Vercel project dashboard (**Settings → Environment Variables**).

| Variable | Format | Example | Notes |
|---|---|---|---|
| | `STRIPE_SECRET_KEY` | `sk_test_...` or `sk_live_...` | *(your key, starts with `sk_test_` or `sk_live_`)* | From [Stripe Dashboard → API keys](https://dashboard.stripe.com/apikeys) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | *(your key, starts with `whsec_`)* | From [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks) after registering your endpoint URL |
| `FIREBASE_SERVICE_ACCOUNT` | JSON string (one line) | `{"type":"service_account","project_id":"..."}` | From [Firebase Console → Project Settings → Service Accounts](https://console.firebase.google.com/) → "Generate new private key". Paste the **entire JSON as a single line** (you can use `jq -c . < service-account.json` to minify it). |
| `APP_URL` | URL string | `https://bayan.app` | **Optional.** The app's root URL used for Stripe success/cancel redirects. Defaults to `https://bayan.app`. |

---

## Deploying to Vercel

### Prerequisites
- A Vercel account (free tier is sufficient)
- The GitHub repository connected to Vercel

### Steps

1. **Import the repository**  
   Go to [Vercel Dashboard → Add New → Project](https://vercel.com/new).  
   Import the same GitHub repo that contains the `api/` directory.

2. **Configure project**  
   - **Framework Preset**: Leave as "Other" (auto-detect is fine).  
   - **Root Directory**: Leave as `./` (the repo root).  
   - **Build Command**: Leave blank (or set to `echo "no build needed"`).  
   - **Output Directory**: Leave blank.

3. **Set environment variables**  
   Add all four variables from the table above.

4. **Deploy**  
   Click **Deploy**. Vercel will automatically discover `api/create-checkout-session.js` and `api/webhook.js` and expose them at:

   ```
   https://your-project.vercel.app/api/create-checkout-session
   https://your-project.vercel.app/api/webhook
   ```

5. **Register the webhook URL in Stripe**  
   - Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks).  
   - Click **Add endpoint**.  
   - **Endpoint URL**: `https://your-project.vercel.app/api/webhook`  
   - **Events to listen for**:  
     - `checkout.session.completed`  
     - `customer.subscription.updated`  
     - `customer.subscription.deleted`  
   - Click **Add endpoint**.  
   - Copy the **Signing secret** (`whsec_...`) and set it as `STRIPE_WEBHOOK_SECRET` in Vercel.  
   - Redeploy or **Settings → Environment Variables** → save → trigger a re-deployment.

---

## Testing with Stripe Test Mode

### Test Cards

| Card Number | Result |
|---|---|
| `4242 4242 4242 4242` | Payment succeeds immediately |
| `4000 0025 0000 3155` | Requires 3D Secure authentication |
| `4000 0000 0000 9995` | Card is declined |

All test cards use any future expiry date and any 3-digit CVC.

### Test Flow

1. **Frontend calls `create-checkout-session`**  
   Your app sends a `POST` request with `Authorization: Bearer <Firebase ID token>` and body `{ "plan": "monthly" }`.

2. **User is redirected to Stripe Checkout**  
   The function returns `{ "url": "https://checkout.stripe.com/..." }`. The frontend redirects the user.

3. **User completes payment**  
   Enter `4242 4242 4242 4242` (or another test card). Stripe redirects back to `APP_URL?checkout=success`.

4. **Webhook fires**  
   Stripe sends `checkout.session.completed` → the webhook writes a subscription document to Firestore at `subscriptions/{uid}`.

5. **Verify in Firestore**  
   Check your Firebase Console → Firestore → `subscriptions` collection. A document with the user's `uid` should contain:
   ```json
   {
     "status": "active",
     "currentPeriodEnd": "2025-08-28T00:00:00.000Z",
     "stripeCustomerId": "cus_...",
     "stripeSubscriptionId": "sub_...",
     "plan": "monthly",
     "updatedAt": "2025-07-29T00:00:00.000Z"
   }
   ```

### Testing Webhooks Locally

Use the Stripe CLI to forward events to your local machine:

```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe listen --forward-to localhost:3000/api/webhook
```

Then trigger a test event:

```bash
stripe trigger checkout.session.completed
```

---

## API Reference

### `POST /api/create-checkout-session`

**Headers**
```
Authorization: Bearer <Firebase ID token>
Content-Type: application/json
```

**Body**
```json
{
  "plan": "monthly"
}
```

Valid plans: `"monthly"` ($2.99/month) or `"yearly"` ($19.99/year).

**Success Response** (200)
```json
{
  "url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

**Error Responses**
- `401` — Missing or invalid Authorization header
- `400` — Invalid plan name
- `500` — Server error (check Vercel logs)

### `POST /api/webhook`

Stripe webhook endpoint. Does not accept direct API calls — only Stripe.  
Returns `200 { "received": true }` on success.

---

## Architecture

```
┌─────────────┐     POST /api/create-checkout-session     ┌──────────────────┐
│  Bayan App  │ ──── (Firebase ID token + plan) ──────→   │  Vercel Function │
│ (GitHub Pg) │                                           │  (verify token,  │
│             │ ←── { url: "checkout.stripe.com/..." } ───│  create session) │
└─────────────┘                                           └────────┬─────────┘
                                                                  │
                                                    User redirected │ to Stripe
                                                                  ▼
                                                          ┌──────────────────┐
                                                          │  Stripe Checkout │
                                                          │  (test/live mode) │
                                                          └────────┬─────────┘
                                                                  │
                                              Webhook events ─────┤
                                                                  ▼
┌──────────────────┐     POST /api/webhook              ┌──────────────────┐
│  Firestore       │ ←── (verified signature) ─────────│  Vercel Function  │
│ subscriptions/   │                                    │  (write doc)      │
│   {uid}          │                                    └──────────────────┘
└──────────────────┘
```
