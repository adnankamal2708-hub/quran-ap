# Bayan API — Premium Subscription Backend

Polar Checkout + webhook handlers for Bayan's premium subscription system,
deployed as Vercel serverless functions.

> **Migrated from Stripe → Polar.sh (Merchant of Record).**
> The frontend contract is unchanged: the checkout endpoint still returns
> `{ url }` and `premium.js`'s `isPremium()` still reads the same Firestore
> `subscriptions/{uid}` doc shape (`status` / `currentPeriodEnd` / `plan`).

---

## Environment Variables

Set these in your Vercel project dashboard (**Settings → Environment Variables**).

| Variable | Format | Example | Notes |
|---|---|---|---|
| `POLAR_ACCESS_TOKEN` | `polar_oat_...` | `polar_oat_xxxx` | Organization Access Token from [Polar Dashboard → Settings → Organization → API Keys](https://polar.sh). Use the **sandbox** token while testing (see Sandbox below). |
| `POLAR_WEBHOOK_SECRET` | string | *(generated when you create the webhook endpoint)* | The secret you set on the Polar webhook endpoint. Used for Standard Webhooks signature verification. |
| `POLAR_PRODUCT_ID_MONTHLY` | UUID | `00000000-0000-4000-8000-000000000000` | Product ID of the monthly subscription plan (from the Polar dashboard). |
| `POLAR_PRODUCT_ID_YEARLY` | UUID | `00000000-0000-4000-8000-000000000000` | Product ID of the yearly subscription plan (from the Polar dashboard). |
| `POLAR_API_URL` | URL | `https://sandbox-api.polar.sh` | **Optional.** Base URL for the Polar REST API. Unset → production `https://api.polar.sh`. Set to `https://sandbox-api.polar.sh` to point the whole backend at the sandbox (config change, not a code change). |
| `FIREBASE_SERVICE_ACCOUNT` | JSON string (one line) | `{"type":"service_account","project_id":"..."}` | From [Firebase Console → Project Settings → Service Accounts](https://console.firebase.google.com/) → "Generate new private key". Paste the **entire JSON as a single line** (you can use `jq -c . < service-account.json` to minify it). |
| `APP_URL` | URL string | `https://bayan.app` | **Optional.** The app's root URL used for Polar success/cancel redirects. Defaults to `https://bayan.app`. |

No Stripe variables are used anymore. The Stripe SDK dependency has been removed.

---

## Sandbox vs. Production

Polar has a separate sandbox environment (`sandbox.polar.sh`) where you can
run test purchases without real payments. Switching between them is a
**config change only** — the same deployed code handles both:

| | Sandbox | Production |
|---|---|---|
| `POLAR_API_URL` | `https://sandbox-api.polar.sh` | unset (defaults to `https://api.polar.sh`) |
| `POLAR_ACCESS_TOKEN` | sandbox OAT (`polar_oat_...` from sandbox org) | production OAT |
| Products/prices | created in the sandbox org | created in the production org |

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
   Add all the variables from the table above.

4. **Deploy**
   Click **Deploy**. Vercel will automatically discover `api/create-checkout-session.js` and `api/webhook.js` and expose them at:

   ```
   https://your-project.vercel.app/api/create-checkout-session
   https://your-project.vercel.app/api/webhook
   ```

5. **Register the webhook endpoint in Polar**
   - Go to [Polar Dashboard → Settings → Webhooks](https://polar.sh) → **Add Endpoint**.
   - **Endpoint URL**: `https://your-project.vercel.app/api/webhook`
   - **Delivery format**: leave on **Raw** (standard JSON payloads).
   - **Secret**: set one (Polar can generate a random one) and copy it to `POLAR_WEBHOOK_SECRET` in Vercel.
   - **Events to subscribe to**:
     - `order.created`
     - `subscription.updated`
     - `subscription.revoked`
     - `subscription.past_due`
   - Save, then redeploy Vercel (or add the env vars and trigger a redeployment).

---

## Testing with the Polar Sandbox

1. Create sandbox products (Monthly / Yearly) in the sandbox org and copy their product IDs to `POLAR_PRODUCT_ID_MONTHLY` / `POLAR_PRODUCT_ID_YEARLY`.
2. Set `POLAR_API_URL=https://sandbox-api.polar.sh` and use the sandbox `POLAR_ACCESS_TOKEN`.
3. Configure the sandbox webhook endpoint pointing at the deployed `api/webhook` (or use the Polar CLI to forward locally: `polar listen http://localhost:3000/`).
4. **Test flow** — from the app:
   1. Frontend calls `create-checkout-session` with `Authorization: Bearer <Firebase ID token>` and body `{ "plan": "monthly" }`.
   2. The function returns `{ "url": "https://checkout.polar.sh/..." }`; the frontend redirects.
   3. Complete the checkout with a test payment method (Polar's sandbox accepts test cards without charging).
   4. Polar redirects back to `APP_URL?checkout=success`.
   5. The webhook fires `order.created` (then `subscription.updated`) → writes `subscriptions/{uid}`.
5. **Verify in Firestore** — `subscriptions` collection, doc `{uid}`:
   ```json
   {
     "status": "active",
     "currentPeriodEnd": "2026-09-01T00:00:00.000Z",
     "polarCustomerId": "00000000-0000-4000-8000-000000000000",
     "polarSubscriptionId": "00000000-0000-4000-8000-000000000000",
     "plan": "monthly",
     "updatedAt": "2026-08-01T00:00:00.000Z"
   }
   ```
   Note: a `subscription.updated`/`subscription.revoked` with status `past_due` or `canceled` will overwrite `status`, which immediately drops `isPremium()` to `false` — matching the existing 5-rule logic.

### Testing Webhooks Locally

Use the Polar CLI to relay events to your local machine:

```bash
# Install Polar CLI: https://docs.polar.sh/polar-cli
polar listen http://localhost:3000/
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

Valid plans: `"monthly"` or `"yearly"`.

**Success Response** (200)
```json
{
  "url": "https://checkout.polar.sh/..."
}
```

**Error Responses**
- `401` — Missing or invalid Authorization header
- `400` — Invalid plan name
- `502` — Polar checkout provider error
- `500` — Server error (check Vercel logs)

### `POST /api/webhook`

Polar webhook endpoint. Does not accept direct API calls — only Polar.
Returns `200 { "received": true }` on success, `403` on signature
verification failure.

---

## Architecture

```
┌─────────────┐     POST /api/create-checkout-session     ┌──────────────────┐
│  Bayan App  │ ──── (Firebase ID token + plan) ──────→   │  Vercel Function │
│ (GitHub Pg) │                                           │  (verify token,  │
│             │ ←── { url: "checkout.polar.sh/..." } ─────│  create checkout)│
└─────────────┘                                           └────────┬─────────┘
                                                                  │
                                                    User redirected │ to Polar
                                                                  ▼
                                                          ┌──────────────────┐
                                                          │   Polar Checkout │
                                                          │  (sandbox/live)  │
                                                          └────────┬─────────┘
                                                                  │
                                               Webhook events ─────┤
              (order.created, subscription.updated,               │
               subscription.revoked, subscription.past_due)       ▼
┌──────────────────┐     POST /api/webhook              ┌──────────────────┐
│  Firestore       │ ←── (verified signature) ─────────│  Vercel Function  │
│ subscriptions/   │                                    │  (write doc)      │
│   {uid}          │                                    └──────────────────┘
└──────────────────┘
```
