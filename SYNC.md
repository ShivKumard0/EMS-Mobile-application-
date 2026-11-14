# EMS phone ↔ web sync

The web app (this repo) and the mobile app (repo `EMS-Mobile-application-`) share one Supabase project, so they work on the same data. The same file is kept in both repos. Change it in both whenever a rule changes.

## The one rule

**The web app is the engine.** The phone never decides a request's outcome itself:

- The phone sends a **command** (`ems_commands`).
- The open web app files it through its own functions, as the person who did it on the phone. The same checks, route, approvers, numbers and logs apply as on the web.
- The web app then answers with `done` (and the web number) or `failed` (and the reason).
- The web app **publishes** what the phone shows (`ems_records`).

The web app must be open (on the laptop) for phone actions to be filed. Until then they wait safely and are applied as soon as it opens.

## What syncs (Nova Retail, presentation)

| From the phone (commands) | Filed on the web by |
|---|---|
| `claim.submit` – new claim, or a web draft continued on the phone (`draftWid`, `asDraft`) | `submitAddExpense(true)` / the draft's items + `caLogMove(id,'Awaiting Approval')` |
| `advance.submit` | `advCreate(…, true)` |
| `approval.decide` – Approve / Reject (all or some items) / Send back | `caDecide` (same calls as the Review Line Items popup) |
| `request.withdraw` | `caWithdraw` |
| `request.respond` – answer a Follow-Up | `caResubmit` |
| `advance.return` | `advRrCreate` |

| Published by the web (records) | Used on the phone for |
|---|---|
| `exp:<id>`, `adv:<id>` – claims and advances, with the web's status word (`flow`), Pending At, who can decide which items (`deciders`) | Expenses list, request detail, Approvals |
| `meta:people` | names, managers, Switch User |
| `meta:lists` – Category → Sub Category, Advance Types, Category → wallet, today's date | New Request form, submit summary |
| `wallets:<eid>` – balances per wallet on the employee's card | submit summary, My cards |
| `meta:index` – which records exist now | removes records no longer on the web |

Receipts and documents go to the `ems-files` store. The web line keeps the file link in `proofUrl`, so **Expense Proof** opens it on the web.

## Field names (as on the web's New Request)

- **Expense Type:** Expense Claim / Advance.
- **Each item:** Category, Sub Category, Expense Title, Start Date, End Date, Amount Spent, GST Amount, Expense Paid By, Merchant / Vendor, Invoice / Receipt No., Vendor GSTIN, Expense Proof, Description. On the web, GST Amount and Vendor GSTIN are kept in `cols`.
- **Advance:** Advance Type, Title, Requested Amount, Required By Date, Expense Period From / To, Business Purpose, Supporting Document, Notes. Justification appears while an earlier advance is unsettled.
- **Status words:** Pending, Approved, Rejected, Reimbursed, Disbursed. Phone-only states: Draft, Sending, Not submitted.

## Set up (once)

1. Supabase → New project (region Mumbai) → **SQL Editor** → paste `supabase/ems-sync-setup.sql` (web repo) → **Run**.
2. Supabase → Project Settings → API Keys: copy the **Project URL** and the **Publishable key** (`sb_publishable_…`). Never use the secret key.
3. Put both values in `js/ems-sync-config.js` (web) and `js/sync-config.js` (phone).
4. The GitHub job `.github/workflows/ems-keep-awake.yml` (web repo) writes a heartbeat every day, so the free project is not paused.

With the two config files empty, both apps work exactly as before, each on its own copy.

## Safe by design

- One web tab works at a time. A command is applied once only: the phone makes its ID, and the web takes it from `new` to `working` to `done`.
- Nothing is filed while a form or popup is open on the web page.
- The signed-in user and the screen on the web are restored after each command.
- Offline: the phone queues everything and sends it when back online.
