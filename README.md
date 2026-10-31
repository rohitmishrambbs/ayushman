# 🏥 BoCW District Monitoring & Execution Portal - Azamgarh

> **Live Deployment URL**: [https://ayushman-y0h.pages.dev/](https://ayushman-y0h.pages.dev/)  
> **District**: Azamgarh, Uttar Pradesh  
> **Scheme**: Ayushman Bharat - Pradhan Mantri Jan Arogya Yojana (AB PM-JAY) & Building and Other Construction Workers (BoCW) Welfare Board Saturation Campaign

---

## 📌 Overview

The **BoCW District Monitoring & Execution Portal** is a specialized district-grade operational system built for real-time tracking, beneficiary verification, field camp execution, and administrative command across **all 22 blocks of District Azamgarh**.

The portal monitors a baseline target of **70,673 verified members across 17,922 families**, providing synchronized data collection between ground-level Data Entry Operators (DEOs) and the Assistant Chief Medical Officer (ACMO) District Command.

---

## 🚀 Key Features

### 1. 🛡️ Role-Based Access Control (RBAC)
- **Block DEO Terminal**: Authenticated access strictly bound to assigned block data. Data Entry Operators cannot alter records outside their assigned jurisdiction.
- **ACMO District Command**: Master administrative command across all 22 blocks with district performance analytics, anti-cheat velocity checks, and block terminal switching.

### 2. ⚡ Field Execution Workspace (DEO Terminal)
- **Hierarchical Gram Panchayat (GP) Filtering**: Real-time GP dropdown displaying live GP completion metrics (`Approved / Total Members`).
- **Interactive Quick-Metrics Bar**: 7 interactive summary cards (Base Total, Approved, Portal Pending, Not Applied, No Record Found, Not Traceable, Extra Added) that double as **1-click status filters**.
- **Instant Search**: Real-time search across Beneficiary Name, Family ID, Member ID, Father/Spouse Name, and Mobile Number, with an inline clear (`✕`) button and keyboard shortcut (`↵ Enter`).
- **1-Click Family ID Copy**: Quick-copy button for instant pasting into the National Health Authority (NHA) PM-JAY portal.
- **Direct Dial Integration**: Direct telephone dialer button (`tel:`) for calling beneficiaries directly during mobilization camps.
- **Granular & Batch Actions**:
  - Individual beneficiary status updates with visual active feedback.
  - "Whole Family" quick-action buttons (Approve All, Pending All, Not Applied All, No Record All, Not Traceable All).
- **Extra PM-JAY Beneficiary Capture (`+ Add Member`)**:
  - Dynamically add extra family members uncovered on the PM-JAY portal without altering baseline government targets.
  - Automatically tagged with unique internal identifiers (`EXTRA_`) and distinct sparkle badges (`✨ Added Member`).
- **Standardized Field Reason Auditing**: Mandatory classification for "Not Traceable" beneficiaries:
  1. Deceased / Death (मृत्यु)
  2. Permanent Migration / Out of District (स्थायी पलायन)
  3. Married Out of Block (विवाह पश्चात स्थानांतरण)
  4. Unknown in GP / Wrong Mobile (ग्राम पंचायत में अज्ञात / गलत नंबर)
  5. Duplicate / Card Already Made via Ration Card (राशन कार्ड से पूर्व निर्मित)
  6. Refused eKYC (लाभार्थी द्वारा इंकार)
  7. Disabled (दिव्यांग)
  8. Existing Coverage (पूर्व से आच्छादित)

### 3. 📊 District ACMO Command Dashboard
- **22-Block Performance Leaderboard**: Live ranking with completion rates, progress bars, and rank medals (🥇 Gold, 🥈 Silver, 🥉 Bronze).
- **Instant Block Search**: Real-time filtering to locate any of the 22 blocks instantly.
- **Anti-Cheat Velocity Audit**: Automated anomaly scanner that checks database timestamps over the last 24 hours to flag suspicious rapid bulk-clicking (>6 families updated per minute).
- **District KPI Cards**: Comprehensive breakdown of district targets, approvals, pending applications, camp targets, and verified exclusions.

### 4. 📥 High-Speed Excel (.xlsx) Exports
- **Camp Call List Export**: Exports filtered family records by GP and card status into standardized `.xlsx` spreadsheets for field camp distribution. Extra added members have member IDs cleanly masked.
- **Leaderboard Export**: Generates district summary tables with block-wise breakdown for executive review and administrative reporting.

### 5. 🎨 UI / UX Architecture
- **Typography**: Built with *Plus Jakarta Sans* and *JetBrains Mono* for crisp data legibility.
- **Toast Notifications**: Non-blocking toast notification system replacing browser alert dialogues.
- **Smooth Modals**: Accessible modal dialogs with backdrop blur, keyboard navigation (`Escape` to close), and autofocus.
- **Floating Scroll-To-Top**: Quick-jump control for long beneficiary lists.

---

## 🏛️ Covered Blocks (22 Blocks of Azamgarh)

| # | Block Name | Target Members | # | Block Name | Target Members |
|---|------------|----------------|---|------------|----------------|
| 1 | **AHIRAULA** | 4,093 | 12 | **TAHBARPUR** | 3,281 |
| 2 | **LALGANJ** | 4,028 | 13 | **MAHRAJGANJ** | 3,271 |
| 3 | **MIRZAPUR** | 4,027 | 14 | **KOILSA** | 3,202 |
| 4 | **PAWAI** | 3,940 | 15 | **RANI KI SARAI** | 3,147 |
| 5 | **THEKMA** | 3,844 | 16 | **TARWA** | 3,128 |
| 6 | **AZMATGARH** | 3,734 | 17 | **MARTINGANJ** | 3,105 |
| 7 | **MOHAMMADPUR** | 3,542 | 18 | **SATHIYAON** | 3,058 |
| 8 | **PHULPUR** | 3,440 | 19 | **HARAIYA** | 2,859 |
| 9 | **MEHNAGAR** | 2,844 | 20 | **BILARIYAGANJ** | 2,779 |
| 10 | **PALHANI** | 2,595 | 21 | **ATRAULIA** | 2,405 |
| 11 | **JAHANAGANJ** | 2,334 | 22 | **PALHANA** | 2,017 |

---

## 🛠️ Technology Stack

* **Frontend**: Vanilla JavaScript (Modern ES6+ Modules), HTML5, CSS3
* **Styling**: Tailwind CSS (Utility-first styling & JIT compiler) + Custom CSS Micro-animations
* **Fonts**: Google Fonts (*Plus Jakarta Sans*, *JetBrains Mono*)
* **Spreadsheet Engine**: SheetJS / `xlsx` (Client-side native `.xlsx` generation)
* **Backend & Database**: [Supabase](https://supabase.com/) (Managed PostgreSQL, RPC Stored Procedures, and Row-Level Security)
* **Hosting & CDN**: [Cloudflare Pages](https://pages.cloudflare.com/) (Edge-replicated, low latency)

---

## 📁 Repository Structure

```
ayushman/
├── css/
│   └── styles.css          # Design tokens, keyframe animations, toast & card styling
├── js/
│   ├── admin.js            # ACMO command center, leaderboard calculations & velocity audit
│   ├── app.js              # Application lifecycle, routing, and role switching
│   ├── auth.js             # Authentication, session caching, and block permission enforcement
│   ├── config.js           # Supabase connection credentials and pagination parameters
│   ├── deo.js              # Field execution workspace, DB mutations, and status handlers
│   ├── export.js           # Filter-aware native Excel (.xlsx) export generators
│   ├── state.js            # Centralized client runtime state
│   └── ui.js               # DOM rendering, toast notification manager, and modal controllers
├── index.html              # Main Single Page Application (SPA) entrypoint
└── README.md               # Project documentation
```

---

## 💻 Local Development Setup

No complex build pipeline or Node modules required; the application runs directly on standard static hosting or local servers.

1. **Clone the repository**:
   ```bash
   git clone https://github.com/rohitmishrambbs/ayushman.git
   cd ayushman
   ```

2. **Serve with any local HTTP server**:
   * Using Python:
     ```bash
     python -m http.server 8080
     ```
   * Using Node (`npx`):
     ```bash
     npx serve .
     ```
   * Or using VS Code extension **Live Server**.

3. **Open in browser**:
   Navigate to `http://localhost:8080`.

---

## 🔒 Security & Data Integrity

* **Baseline Integrity**: The official 70,673 base member dataset remains immutable in target counts; additions from PM-JAY are segregated using the `EXTRA_` namespace.
* **Block Isolation**: Block DEO credentials only permit updates to records with matching `block_name`.
* **Velocity Anomaly Detection**: Prevents arbitrary bulk automated marking through temporal analysis of batch status updates.

---

## 📄 License & Attribution

Designed and maintained for the **District Administration Azamgarh & Department of Health & Family Welfare, Uttar Pradesh**. All rights reserved.
