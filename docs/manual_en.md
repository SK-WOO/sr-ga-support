# SR GA Support — User Manual

**Version:** v0.1.0 · **Last Updated:** 2026-03-18

---

## Overview

SR GA Support is a General Affairs request management system for Seoul Robotics employees.
Submit and track requests for business cards, onboarding/offboarding, business trips, breakdown reports, and equipment rentals — all in one place.

---

## Login

1. Go to [sr-ga-support.vercel.app](https://sr-ga-support.vercel.app)
2. Click **Sign in with Google**
3. Use your Seoul Robotics Google account (@seoulrobotics.org)

> Supports iOS Safari and Chrome

---

## How to Submit a Request

### 1. Click **+ New Request** in the My Requests tab

### 2. Select a Category

| Category | Includes |
|---------|---------|
| 📋 General Request | Business cards, onboarding items/accounts, offboarding, corporate card |
| ✈️ Business Travel | Domestic trips, overseas trips |
| 🔧 Breakdown Report | Asset / facility / IT / item breakdowns |
| 📦 Rental Request | Company car, R&D items, equipment rental |

### 3. Select type and fill in the form

- **Title**: Brief description of your request (required)
- **Details**: Additional notes
- **Attachments**: Receipts, photos, etc. (required for expense claims)

### 4. Click **Submit Request** → Slack notification sent to assignee/approver

---

## Approval Chain

| Request Type | Chain |
|-------------|-------|
| Business card, onboarding/offboarding, breakdown, rental | Assignee only |
| Domestic trip | Manager → Assignee |
| Overseas trip, Corporate card | Manager → CEO → Assignee |

> Approval chains are configurable in Admin settings

---

## Request Status

| Status | Meaning |
|--------|---------|
| 🟡 Pending | Submitted, awaiting first approval |
| 🔵 In Progress | Partially approved, next step in progress |
| 🟢 Approved / Completed | Fully approved |
| 🔴 Rejected | Request was rejected |
| ⚫ Cancelled | Withdrawn by the applicant |

---

## Approver Guide

1. Click the **Approvals** tab
2. Review items pending your action (waiting time shown)
3. Click a request to view details
4. Click **Approve** or **Reject** (optional comment)

---

## Withdrawing a Request

- In My Requests, click a request with **Pending** status
- Click the **Withdraw** button at the bottom

---

## Business Travel Details

### Domestic Trip
- Select departure/return dates, destination, and support type (Transportation / Hotel / Other / Expense Claim)

### Overseas Trip
- Same as domestic + airfare option
- Expense claim requires receipt attachment

### Expense Claim
- Select Sub Type → **Expense Claim**
- Enter amount + attach receipts (required)

---

## Breakdown Report Details

| Type | Examples |
|------|---------|
| Asset Breakdown | Laptop, monitor, office equipment |
| Facility Breakdown | HVAC, lighting, doors, restrooms |
| IT Breakdown | Network, server, printer |
| Item Breakdown | Stationery, other items |

- Fill in **Asset / Location** field with the asset name or location

---

## Admin Guide

> The Admin tab is only visible to CEO and accounts listed in adminEmails.

### Assignees Tab
Set assignee emails per request type (comma-separated)

### Chains Tab
Toggle approval steps — Manager / CEO / Assignee on/off per request type

### Settings Tab
| Field | Description |
|-------|-------------|
| CEO Email | CEO account email |
| Slack Webhook URL | Webhook for notifications |
| App URL | Used for Slack button deep links |
| Drive Folder ID | Google Drive folder for attachments |

---

## Slack Notifications

- On new request → channel notification with **View & Approve** button link
- On approval/rejection → channel notification

---

## Contact

Sangkil Woo (sangkil.woo@seoulrobotics.org)
