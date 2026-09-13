# 📱 SwasthyaSahay (MedCheck) — Mobile App Development Specification & Feature Blueprint

> **Notice for Mobile App Developers (React Native / Flutter / Android / iOS):**
> This document is the definitive master specification derived directly from the complete web frontend codebase (`medcheck`). It outlines every feature, user flow, data contract, real-time WebSocket protocol, WebRTC signaling event, and screen architecture required to implement the SwasthyaSahay mobile application.

---

## 📑 Table of Contents

1. [Executive Summary & Platform Identity](#1-executive-summary--platform-identity)
2. [High-Level Architecture & Tech Specifications](#2-high-level-architecture--tech-specifications)
3. [Authentication, Session & Onboarding Flows](#3-authentication-session--onboarding-flows)
4. [Role-Based Access & User Routing](#4-role-based-access--user-routing)
5. [Feature Specification: Patient Experience](#5-feature-specification-patient-experience)
   - [5.1 Patient Dashboard & Health Score Engine](#51-patient-dashboard--health-score-engine)
   - [5.2 AI Health Assistant & Symptom Triage](#52-ai-health-assistant--symptom-triage)
   - [5.3 Doctor Discovery & Appointment Booking](#53-doctor-discovery--appointment-booking)
   - [5.4 Real-time Chat & WebRTC Teleconsultation](#54-real-time-chat--webrtc-teleconsultation)
   - [5.5 Emergency SOS & Department Recommender](#55-emergency-sos--department-recommender)
   - [5.6 Nearby Hospitals & Medical Stores (OSM / Overpass)](#56-nearby-hospitals--medical-stores-osm--overpass)
   - [5.7 Child & Maternal Health Hub (IAP / ANC Guidelines)](#57-child--maternal-health-hub-iap--anc-guidelines)
   - [5.8 Patient Health Identity, Vitals Baseline & Clinical Reports](#58-patient-health-identity-vitals-baseline--clinical-reports)
6. [Feature Specification: Doctor Clinical Suite](#6-feature-specification-doctor-clinical-suite)
   - [6.1 Doctor Onboarding & Facility Affiliation](#61-doctor-onboarding--facility-affiliation)
   - [6.2 Doctor Dashboard & Consultation Management](#62-doctor-dashboard--consultation-management)
   - [6.3 Doctor Patients Registry & Status Filtering](#63-doctor-patients-registry--status-filtering)
   - [6.4 Patient Clinical Chart & Sensor Telemetry](#64-patient-clinical-chart--sensor-telemetry)
7. [Complete Backend REST API Specification](#7-complete-backend-rest-api-specification)
8. [Real-time Socket.IO & WebRTC Signaling Protocols](#8-real-time-socketio--webrtc-signaling-protocols)
9. [Mobile Native Capabilities & Hardware Permissions](#9-mobile-native-capabilities--hardware-permissions)
10. [Recommended Mobile App Navigation Tree](#10-recommended-mobile-app-navigation-tree)

---

## 1. Executive Summary & Platform Identity

**SwasthyaSahay** is an integrated clinical continuum and telehealth network tailored for primary care facilities (PHC), secondary/tertiary referral hospitals (CHC), certified doctors, and patients. It bridges healthcare access gaps with:

- **Bilingual / Multilingual Support:** English + 8 Indian languages (Hindi, Marathi, Tamil, Telugu, Kannada, Bengali, Gujarati, Punjabi).
- **Two Distinct Clinical Roles:**
  1. **Patient:** Self-service symptom triage, vitals monitoring, hospital search, doctor teleconsultation, emergency SOS.
  2. **Doctor:** OPD queue management, telehealth consultations, patient electronic health records (EHR), availability toggle.
- **Standards & Identity:** Designed with ABHA (Ayushman Bharat Health Account) / Ayushman Bharat digital registry compatibility in mind.

---

## 2. High-Level Architecture & Tech Specifications

### Backend Service
- **Production Base URL:** `https://sih-otuc.onrender.com`
- **Authentication:** Standard JWT Bearer token via `Authorization: Bearer <access_token>` header.
- **Silent Token Refresh:** HTTP `401 Unauthorized` triggers an automatic refresh handshake via `POST /auth/refresh` using the stored `refresh_token`. Requests queue up until the refresh completes, then replay seamlessly.

### Real-Time Infrastructure
- **WebSockets:** Socket.IO v4 client connected to `https://sih-otuc.onrender.com` under two namespaces:
  - `/chat` for text messaging between patient and doctor.
  - `/video` for WebRTC call signaling (SDP offer/answer exchange, ICE candidates, call lifecycle).
- **WebRTC:** Peer-to-peer audio/video calling.
  - Default STUN servers: Google Public STUN (`stun:stun.l.google.com:19302`, `stun1`, `stun2`).
  - Dynamic backend credentials: `GET /appointments/:id/video-token` provides custom TURN/ICE servers when available.

### Geospatial Services
- **OpenStreetMap (OSM) Overpass API:** Real-time spatial queries for hospitals, clinics, pharmacies, and diagnostic laboratories.
- Primary Endpoint: `https://overpass-api.de/api/interpreter`
- Fallback Mirrors (failover queue with 8s timeout):
  - `https://overpass.kumi.systems/api/interpreter`
  - `https://maps.mail.ru/osm/tools/overpass/api/interpreter`
  - `https://overpass.private.coffee/api/interpreter`
  - `https://overpass.openstreetmap.ru/api/interpreter`

---

## 3. Authentication, Session & Onboarding Flows

```
[Start App]
   │
   ├── User has valid token?
   │     ├── NO  ──► [Landing / Welcome Screen] ──► [Login] or [Sign Up]
   │     └── YES ──► Check Role & Onboarding Status:
   │                   ├── Role: PATIENT
   │                   │     ├── Vitals logged? NO  ──► [Vitals & History Onboarding]
   │                   │     └── Vitals logged? YES ──► [Patient Dashboard]
   │                   │
   │                   └── Role: DOCTOR
   │                         ├── Verified Doctor Profile exists? NO  ──► [Doctor Onboarding (License & Facility)]
   │                         └── Verified Doctor Profile exists? YES ──► [Doctor Dashboard]
```

### 3.1 Sign Up Flow
- **Fields:**
  - Full Name (`name`) — string
  - Phone Number (`phone`) — 10 digit Indian mobile number (e.g., `9876543210`)
  - Email (`email`) — optional string
  - Password (`password`) — string
  - Confirm Password — client validation check
  - Role Selection (`role`) — `'patient'` OR `'doctor'`
  - Preferred Language (`preferred_language`) — default `'en'` (options: `en`, `hi`, `mr`, `ta`, `te`, `kn`, `bn`, `gu`, `pa`)
  - Consent Checkbox (`consent`) — required boolean
- **API:** `POST /auth/signup`
- **Output:** Saves `access_token`, `refresh_token`, and user object.
- **Next Screen:** `AccountCreated` (displays confirmation checkmark and ABHA sync badge).

### 3.2 Login Flow
- **Fields:**
  - Phone (`phone`) OR Email (`email`)
  - Password (`password`)
  - Remember Workstation / Device checkbox
- **API:** `POST /auth/login`
- **Social Auth:** `POST /auth/google` with Google `id_token`, `role`, and `preferred_language`.

### 3.3 Silent Token Refresh Flow
When any API call returns `401 Unauthorized`:
1. The app pauses pending requests in an internal queue.
2. Calls `POST /auth/refresh` with `{ refresh_token }`.
3. If success: updates access token in secure storage and retries all queued requests with the new token.
4. If failure: clears tokens and redirects to the Login screen.

---

## 4. Role-Based Access & User Routing

| Route / Screen | Role | Guard Condition |
|---|---|---|
| `Landing` | Public | Shown when no auth token exists |
| `Login` / `SignUp` | Public | Authentication |
| `AccountCreated` | Authenticated | Post-signup landing screen |
| `Vitals` | Patient | First-time onboarding OR manual update |
| `PatientDashboard` | Patient | Requires `vitals-complete` |
| `HealthAssistant` | Patient | Active AI triage & chat |
| `Doctors` | Patient | Search & book appointments |
| `NearbyHospitals` | Patient / Public | Geolocation & OSM search |
| `NearbyMedicalStores` | Patient / Public | Geolocation & pharmacy search |
| `EmergencyPage` | Patient | SOS trigger & department finder |
| `ChildMaternalCare` | Patient | Pediatric vaccination & ANC tracker |
| `PatientProfile` | Patient | EHR, reports & profile edit |
| `DoctorInfo` | Doctor | Onboarding (license & facility setup) |
| `DoctorDashboard` | Doctor | Primary doctor workspace & queue |
| `DoctorPatients` | Doctor | Patient registry & history list |
| `DoctorPatientProfile` | Doctor | Detailed clinical chart of a patient |

---

## 5. Feature Specification: Patient Experience

### 5.1 Patient Dashboard & Health Score Engine

The patient home screen provides a high-level overview of the patient's physiological state and upcoming care actions.

#### Key Features:
1. **Dynamic Greeting:** Context-aware based on device time ("Good morning / afternoon / evening, {FirstName}").
2. **Clinical Health Index Gauge (Recharts Pie / SVG Radial):**
   - **Severity-First, Non-Averaging Engine:** Unlike naive apps that average metrics, SwasthyaSahay uses clinical triage rules: **the overall score is driven by the single worst vital**.
   - Thresholds:
     - **Blood Pressure (mmHg):**
       - Normal: Systolic < 130 AND Diastolic < 85 (Score: 92)
       - Moderate: Systolic 130–139 OR Diastolic 85–89 (Score: 72)
       - High: Systolic 140–159 OR Diastolic 90–109 (Score: 50)
       - Very High: Systolic 160–179 OR Diastolic 110–119 (Score: 30)
       - Critical: Systolic ≥ 180 OR Diastolic ≥ 120 (Score: 12)
     - **Blood Sugar (mg/dL):** Normal (80–139), Moderate (70–79 or 140–199), High (54–69 or 200–299), Critical (< 54 or ≥ 300).
     - **SpO2 (%):** Normal (≥ 95%), Moderate (91–94%), High (86–90%), Critical (≤ 85%).
     - **Heart Rate (bpm):** Normal (60–100), Moderate (50–59 or 101–110), High (40–49 or 111–130), Critical (< 40 or > 130).
3. **Core Vitals Metric Cards:**
   - Cards for Blood Pressure, Blood Sugar, SpO2, and Heart Rate.
   - Shows current value, unit, status pill (Optimal / Monitor / Alert).
   - **Trend Differential Indicator:** Compares current reading with the previous reading (e.g., `↑ 4 mmHg vs prev (Oct 12)`).
   - **Mini Sparkline Area Graph** showing trend curve across recent entries.
4. **Active Consultations & Telehealth Section:**
   - Displays appointments loaded from `GET /appointments`.
   - Card states:
     - `pending`: Displays "⏳ Awaiting Doctor Approval". Chat & Video actions are locked.
     - `approved`: Shows "✓ Approved & Ready". Unlocks two buttons:
       - **💬 Chat with Doctor** (opens ChatModal)
       - **📹 Video Call Doctor** (initiates WebRTC video call)
     - `completed`: Shows "Session ended" + "View Chat History" button.
     - `rejected`: Displays "Declined".
5. **Care Journey Tracker:**
   - Visual 7-step horizontal timeline:
     `Screening` ➔ `Referral` ➔ `Appointment` ➔ `Consultation` ➔ `Diagnostics` ➔ `Treatment` ➔ `Follow-up`

---

### 5.2 AI Health Assistant & Symptom Triage

An intelligent conversational medical triage agent supporting multi-session history, file attachments, and clinical zone assessment.

#### Key Features:
1. **Chat Session Management:**
   - `POST /triage/sessions/new` creates a fresh conversation.
   - `GET /triage/sessions` fetches all past sessions with title, preview snippet, message count, and clinical zone badge.
   - `PATCH /triage/sessions/:id` allows renaming the session.
   - `DELETE /triage/sessions/:id` deletes a session and associated reports.
2. **Multilingual Response Engine:**
   - Allows switching conversation language on the fly: English (`en`), Hindi (`hi`), Punjabi (`pa`), Gujarati (`gu`), Marathi (`mr`).
   - Translates backend AI clinical advice into the selected language.
3. **Multimedia / File Attachments:**
   - Supports camera capture and photo gallery picking (JPEG/PNG/PDF/DOCX up to 10MB).
   - Displays thumbnail chips with delete buttons before sending.
   - Appends contextual metadata to message payload.
4. **Clinical Zone Stratification (Triage Result):**
   - **Green Zone:** Low urgency; home remedies, hydration, rest.
   - **Yellow Zone:** Moderate risk; scheduling a doctor consultation is advised within 24–48 hours.
   - **Red Zone:** High risk; urgent warning alert and recommendation to trigger emergency SOS.
5. **Assessment Summary Card:**
   - Triggered when `res.is_final === true`.
   - Displays summarized symptoms, primary health concern, and suggested action plan.
6. **Instant Clinical PDF Report Generation:**
   - Calls `POST /triage/report` with `{ session_id }`.
   - Backend compiles the conversation and vitals into a clinical PDF.
   - Mobile app should download and view the PDF using native document viewing / sharing.

---

### 5.3 Doctor Discovery & Appointment Booking

A public and patient directory of verified doctors across clinical networks.

#### Key Features:
1. **Doctor Directory (`GET /doctors`):**
   - Returns list of verified doctors with nested `doctor.user` and `doctor.facility` data.
2. **Search & Filters:**
   - Full-text search across doctor's name, specialization, qualification, and facility name.
   - Toggle button: "All Doctors" vs "Available Now".
   - Alphabetical sorting (A–Z).
3. **Doctor Card Display:**
   - Doctor initials avatar, full name with "Dr." prefix, specialization badge, qualification, affiliated clinic/hospital name, experience in years, and availability indicator.
4. **Booking Modal (`POST /appointments`):**
   - Date and time picker for the consultation slot.
   - Input for "Reason for visit / symptoms".
   - `share_records` toggle: gives doctor permission to access historical vitals & triage reports.

---

### 5.4 Real-time Chat & WebRTC Teleconsultation

Direct, secure communication between patient and doctor during an approved appointment.

#### 5.4.1 Real-Time Chat (Socket.IO `/chat`)
- **Initial Load:** Fetches chat message history via `GET /chat/history/:appointment_id`.
- **Socket Connect:** Connects to `${BASE_URL}/chat` with JWT auth token.
- **Room Joining:** Emits `join` event `{ appointment_id }`.
- **Optimistic Messaging:** On send, app creates a local bubble with a temporary ID (`local_xxx`), emits `message` `{ appointment_id, text }`, and replaces it with the server response when received.
- **Auto-scroll:** Automatically scrolls to the bottom on new message.

#### 5.4.2 WebRTC Video Consultation (Socket.IO `/video`)
- **Signaling Flow:**
  1. Patient clicks "Video Call Doctor". App connects to `${BASE_URL}/video` and emits `join` `{ appointment_id }`.
  2. Acquires local camera and microphone stream (`navigator.mediaDevices.getUserMedia` or `react-native-webrtc`).
  3. Initiator creates SDP Offer (`createOffer`) and emits `offer` `{ appointment_id, sdp }`.
  4. Remote peer receives `offer`, creates SDP Answer (`createAnswer`), and emits `answer` `{ appointment_id, sdp }`.
  5. Both peers exchange ICE candidates via `ice-candidate` `{ appointment_id, candidate }`.
  6. Connected call displays local preview, remote stream in full screen, call duration timer, and mute/camera toggle controls.
  7. Either party can end the call via `end-call`, which broadcasts `call-ended`.

#### 5.4.3 Background Call Listener (`useCallListener`)
- Runs continuously on dashboards for users who have active approved appointments.
- Listens for incoming `offer` events on the video socket.
- When an offer arrives:
  - Plays an audible repeating ringtone.
  - Pops up the `IncomingCallModal` showing the caller's name, role, and appointment time.
  - User can **Accept** (answers WebRTC call immediately) or **Decline** (emits `end-call`).

---

### 5.5 Emergency SOS & Department Recommender

Designed for high-stress situations where rapid medical intervention is necessary.

#### Key Features:
1. **Body Area Quick Triage:**
   - 5 Quick-select anatomical buttons:
     - 🫀 **Heart:** Chest pain, radiating pain, cardiac distress.
     - 🫁 **Lungs:** Shortness of breath, acute respiratory failure.
     - 🩺 **Liver:** Acute upper right abdominal pain, sudden jaundice.
     - 🦴 **Muscle & Bones:** Fractures, dislocations, trauma.
     - 🧠 **Neuro:** Facial drooping, sudden seizure, stroke symptoms.
   - Alternatively, user can type freeform symptoms.
2. **Live Geolocation:** Fetches device GPS coordinates (`latitude`, `longitude`).
3. **Emergency Find Help API (`POST /emergency/find-help`):**
   - Payload: `{ text: symptoms, lat, lng }`.
   - Returns:
     - `urgency`: `'high'` vs `'normal'`
     - `specialty`: e.g. "Cardiology", "Neurology", "Emergency Medicine"
     - `needs`: `'hospital'` vs `'doctor'`
     - `facilities`: sorted list of nearby facilities with distances in km, phone numbers, and addresses.
4. **SOS Distress Trigger (`POST /emergency/sos`):**
   - Dispatches emergency alert with user ID, GPS coordinates, and reason.
5. **One-Tap Actions:**
   - Immediate phone dialer trigger (`tel:${phone}`).
   - Turn-by-turn navigation via Google Maps / Apple Maps.
   - National emergency quick dialers (112 Emergency, 108 Ambulance, 102 Maternal/Child).

---

### 5.6 Nearby Hospitals & Medical Stores (OSM / Overpass)

Location-based healthcare discovery without third-party proprietary map API billing.

#### Key Features:
1. **Hospital & Clinic Discovery (`NearbyHospitals`):**
   - Overpass query tags: `amenity=hospital`, `amenity=clinic`, `amenity=doctors`, `healthcare=doctor`.
   - Filter chips: All, Hospitals, Clinics, Doctors.
   - Distance calculated via client-side Haversine formula.
   - Search radius slider: 1 km to 15 km.
   - Fallback dataset: If user is offline or Overpass servers fail, returns verified Community Health Centres (CHC) and Primary Health Centres (PHC).
2. **Pharmacies & Diagnostic Centers (`NearbyMedicalStores`):**
   - Overpass query tags: `amenity=pharmacy`, `healthcare=laboratory`, `healthcare=diagnostic_centre`.
   - Filter chips: All, Pharmacies, Diagnostic Labs.
   - Displays operating hours (e.g. "24/7" or "08:00 - 22:00") and operator information (e.g. Pradhan Mantri Jan Aushadhi Kendra).

---

### 5.7 Child & Maternal Health Hub (IAP / ANC Guidelines)

Comprehensive educational and clinical tracking resource aligned with the Indian Academy of Pediatrics (IAP) and WHO/Govt of India guidelines.

#### Key Features:
1. **Complete Pediatric Immunization Schedule:**
   - Chronological breakdown from birth to 12 years:
     - **At birth:** BCG, Hepatitis B (Dose 1), OPV (Dose 0).
     - **6 weeks / 10 weeks / 14 weeks:** DTwP/DTaP, IPV, Hib, HepB, Rotavirus, PCV.
     - **6–9 months:** Influenza, Typhoid Conjugate, MMR (Dose 1).
     - **12–18 months:** Hepatitis A, MMR (Dose 2), Varicella, PCV Booster, DTwP/IPV Booster.
     - **4–6 years:** MMR Dose 3, DTwP/IPV Booster.
     - **10–12 years:** Tdap Booster, HPV (Dose 1 & 2 for cancer prevention).
2. **Antenatal Care (ANC) Journey:**
   - 4-Trimester / Stage guidance:
     - First contact (before 12 weeks): Registration, blood/urine baseline, iron-folic acid.
     - Second trimester (14–26 weeks): Fetal growth, ultrasound, first Td injection.
     - Early third trimester (28–34 weeks): Second Td injection, facility birth planning.
     - Final checkups (36 weeks to delivery): Weekly monitoring, birth readiness.
3. **High-Risk Pregnancy Warning Signs:**
   - Critical visual alerts for severe headaches, visual disturbances, sudden facial swelling, vaginal bleeding, reduced fetal movement, or high fever.

---

### 5.8 Patient Health Identity, Vitals Baseline & Clinical Reports

The patient's permanent electronic health record profile.

#### Key Features:
1. **Patient Demographic Card:**
   - Name, ABHA / Health ID, Age (auto-calculated from DOB), Gender, Blood Group, Phone, Email, Address, Primary Attending Doctor.
2. **Vitals Baseline & Telemetry:**
   - Resting BP, Heart Rate, Fasting Sugar, Height, Weight, and auto-computed BMI (`kg/m²`) with classification (`Healthy`, `Underweight`, `Overweight`).
3. **Medical History Log (`GET /patients/:id/medical-history`):**
   - Chronic conditions tags (e.g. Hypertension, Type-2 Diabetes).
   - Past surgical procedures.
   - Endemic history flags: Typhoid history (Yes/No), Malaria history (Yes/No).
   - Doctor's historical notes.
4. **Clinical Reports & PDF Manager (`GET /patients/:id/reports`):**
   - Lists all clinical triage PDFs generated by the patient.
   - Native viewer: Handles Base64 strings, Blob URLs, or remote HTTPS URLs.
   - Sharing & download capabilities.
5. **Edit Profile Modal (`PATCH /patients/:id/profile`):**
   - Editable fields: Full Name, Phone, Email, Date of Birth, Gender, Blood Group, Emergency Contact, and Residential Address.

---

## 6. Feature Specification: Doctor Clinical Suite

### 6.1 Doctor Onboarding & Facility Affiliation

Post-signup verification flow for doctors.

#### Key Features:
1. **Medical Registration Number:** Alphanumeric license ID (MCI / NMC / State Medical Council).
2. **Specialization:** General Medicine, Cardiology, Pediatrics, Gynecology, Orthopedics, etc.
3. **Qualification:** MBBS, MD, MS, DNB, etc.
4. **Experience:** Total clinical experience in years.
5. **Facility Affiliation (`GET /facilities`):**
   - Searchable directory of hospitals and PHCs/CHCs.
   - Doctor links their digital OPD to a verified facility.
6. **API Registration:** `POST /doctors/register`.

---

### 6.2 Doctor Dashboard & Consultation Management

The central clinical workspace for practicing clinicians.

#### Key Features:
1. **Availability Toggle Switch:**
   - Doctor toggles between **Available (Online)** and **Busy (Offline)**.
   - Calls `PATCH /doctors/:id/availability` with `{ is_available: boolean }`.
   - Real-time indicator visible to patients in the doctor directory.
2. **Consultation Queue Tabs:**
   - **Pending:** New incoming patient requests. Doctor can:
     - `Approve`: Confirms slot (`PATCH /appointments/:id/approve`).
     - `Reject`: Declines appointment (`PATCH /appointments/:id/reject`).
   - **Approved:** Active consultations ready for care. Doctor can:
     - Launch **💬 Chat**.
     - Launch **📹 WebRTC Video Call**.
     - Mark as **✓ Complete** (`PATCH /appointments/:id/complete`).
   - **Completed / Rejected:** Historical log with chat transcripts.
3. **Live Incoming Call Alerts:**
   - Real-time WebRTC offer listener triggers full-screen incoming consultation modal.

---

### 6.3 Doctor Patients Registry & Status Filtering

A searchable roster of all patients associated with the doctor's consultations.

#### Key Features:
1. **Patient Search:** Search by patient name or reason for visit.
2. **Category Filters:** "All Patients", "New Requests (Pending)", "Scheduled (Approved)".
3. **Direct Navigation:** Tapping any patient opens their comprehensive medical chart.

---

### 6.4 Patient Clinical Chart & Sensor Telemetry

Doctor's view of an individual patient's medical records (`DoctorPatientProfile`).

#### Key Features:
1. **Patient Overview:** Name, ABHA ID, Age, Contact, Emergency Contact, Residential District.
2. **Clinical Sensor Telemetry:**
   - Latest sensor readings: BP, Heart Rate, SpO2 Saturation, Blood Sugar.
   - Clinical risk assessment zone (Low / Moderate / High).
   - Clinical guidance note auto-generated by triage algorithms.
3. **Longitudinal Medical History:** Pre-existing conditions, past surgeries, endemic illness flags.
4. **AI Triage Reports:** Review PDFs generated by the patient during AI Health Assistant conversations before starting the video call.
5. **Print / Export Chart:** Generates clinical summary for physical records or referrals.

---

## 7. Complete Backend REST API Specification

### Base URL: `https://sih-otuc.onrender.com`

### 7.1 Authentication (`/auth`)
| Method | Endpoint | Description | Request Body | Response |
|---|---|---|---|---|
| `POST` | `/auth/signup` | Register new patient or doctor | `{ name, phone, password, role, email?, preferred_language? }` | `{ user, access_token, refresh_token }` |
| `POST` | `/auth/login` | Login with credentials | `{ phone?, email?, password }` | `{ user, access_token, refresh_token }` |
| `POST` | `/auth/refresh` | Refresh expired access token | `{ refresh_token }` | `{ access_token }` |
| `POST` | `/auth/google` | Google social login | `{ id_token, role?, phone?, preferred_language? }` | `{ user, access_token, refresh_token }` |

### 7.2 Patients (`/patients`)
| Method | Endpoint | Description | Request Body | Response |
|---|---|---|---|---|
| `GET` | `/patients/:id/profile` | Get patient profile | — | `{ user }` |
| `PATCH` | `/patients/:id/profile` | Update profile info | `{ name, phone, email, dob, gender, blood_group, address, emergency_contact }` | `{ user }` |
| `GET` | `/patients/:id/vitals` | Get vitals history | — | `{ vitals: [...] }` |
| `POST` | `/patients/:id/vitals` | Save new vitals entry | `{ bp, sugar, sugar_type?, spo2, hr, weight?, height?, temperature?, notes? }` | `{ vitals, risk_level, recommendation }` |
| `POST` | `/patients/:id/onboarding-records` | Batch vitals + history + profile | `{ vitals, medical_history, profile }` | `{ success: true }` |
| `GET` | `/patients/:id/medical-history` | Get medical history | — | `{ medical_history: [...] }` |
| `POST` | `/patients/:id/medical-history` | Add medical history | `{ conditions[], surgeries[], had_typhoid, had_malaria, doctor_notes }` | `{ medical_history }` |
| `GET` | `/patients/:id/reports` | Get clinical PDF reports | — | `{ reports: [{ id, pdf_url, generated_at }] }` |

### 7.3 Doctors (`/doctors`)
| Method | Endpoint | Description | Request Body | Response |
|---|---|---|---|---|
| `GET` | `/doctors` | Public doctor directory | Query params: `facility_id`, `specialization`, `available` | `{ doctors: [...] }` |
| `POST` | `/doctors/register` | Complete doctor registration | `{ specialization, facility_id, license_number, qualification, experience_years, bio }` | `{ doctor }` |
| `GET` | `/doctors/profile/me` | Current doctor's profile | — | `{ doctor }` |
| `PATCH` | `/doctors/profile/me` | Update doctor's profile | `{ specialization, bio, qualification, experience_years }` | `{ doctor }` |
| `PATCH` | `/doctors/:id/availability` | Toggle online/offline status | `{ is_available: boolean }` | `{ doctor }` |

### 7.4 Appointments (`/appointments`)
| Method | Endpoint | Description | Request Body | Response |
|---|---|---|---|---|
| `GET` | `/appointments` | List appointments (scoped by user role) | — | `{ appointments: [...] }` |
| `POST` | `/appointments` | Book new consultation | `{ doctor_id, slot, share_records }` | `{ appointment }` |
| `GET` | `/appointments/:id` | Full appointment details | — | `{ appointment }` |
| `GET` | `/appointments/:id/video-token` | WebRTC ICE servers | — | `{ ice_servers: [...] }` |
| `PATCH` | `/appointments/:id/approve` | Approve appointment (Doctor) | — | `{ appointment }` |
| `PATCH` | `/appointments/:id/reject` | Reject appointment (Doctor) | — | `{ appointment }` |
| `PATCH` | `/appointments/:id/complete` | Mark consultation complete | — | `{ appointment }` |

### 7.5 AI Triage (`/triage`)
| Method | Endpoint | Description | Request Body | Response |
|---|---|---|---|---|
| `POST` | `/triage/chat` | Send message to AI triage | `{ message, language, session_id? }` | `{ reply, zone, is_final, remedy_suggestion, session_id, title }` |
| `POST` | `/triage/report` | Generate clinical PDF | `{ session_id }` | `{ pdf_url, report_base64 }` |
| `GET` | `/triage/sessions` | List past chat sessions | — | `{ sessions: [...] }` |
| `GET` | `/triage/sessions/:id` | Get single session chat history | — | `{ session: { messages: [...] } }` |
| `POST` | `/triage/sessions/new` | Create blank session | `{}` | `{ session_id, title }` |
| `PATCH` | `/triage/sessions/:id` | Rename session title | `{ title }` | `{ session }` |
| `DELETE` | `/triage/sessions/:id` | Delete session and reports | — | `{ success: true }` |

### 7.6 Emergency (`/emergency`)
| Method | Endpoint | Description | Request Body | Response |
|---|---|---|---|---|
| `POST` | `/emergency/find-help` | Identify urgency & departments | `{ text, lat, lng }` | `{ urgency, specialty, needs, facilities: [...] }` |
| `POST` | `/emergency/sos` | Trigger immediate SOS distress | `{ lat, lng, reason?, facility_id?, session_id? }` | `{ success: true, alert_id }` |
| `GET` | `/emergency/alerts` | List active emergency alerts | — | `{ alerts: [...] }` |

### 7.7 Facilities & Referrals (`/facilities`, `/referrals`)
| Method | Endpoint | Description | Request Body | Response |
|---|---|---|---|---|
| `GET` | `/facilities` | List all healthcare facilities | — | `{ facilities: [...] }` |
| `GET` | `/facilities/:id` | Facility profile & doctor list | — | `{ facility }` |
| `GET` | `/facilities/:id/stats` | Live facility stats & queue | — | `{ stats: { doctors, waiting, high_risk } }` |
| `GET` | `/referrals` | List referrals (scoped by user) | Query params: `patient_id`, `status` | `{ referrals: [...] }` |
| `POST` | `/referrals` | Create inter-facility referral | `{ patient_id, to_facility, from_facility?, reason }` | `{ referral }` |
| `PATCH` | `/referrals/:id/status` | Update referral status | `{ status: "pending"\|"accepted"\|"rejected"\|"completed" }` | `{ referral }` |

---

## 8. Real-time Socket.IO & WebRTC Signaling Protocols

### 8.1 Consultation Chat Namespace: `${BASE_URL}/chat`

```
Mobile Client                                   Server (/chat)
    │                                                 │
    ├── connect (auth: { token }) ───────────────────►│
    ├── emit('join', { appointment_id }) ────────────►│
    │◄── on('joined', { appointment_id }) ────────────┤
    │                                                 │
    ├── emit('message', { appointment_id, text }) ───►│
    │◄── on('message', { id, sender_id, text, ... }) ─┤ (broadcast to room)
    │                                                 │
    ├── emit('leave', { appointment_id }) ───────────►│
    └── disconnect() ────────────────────────────────►│
```

### 8.2 WebRTC Video Consultation Namespace: `${BASE_URL}/video`

```
Caller (Patient)              Server (/video)              Callee (Doctor)
      │                              │                            │
      ├── emit('join', { appt_id }) ─►│                            │
      │                              │◄── emit('join', { appt_id })┤
      │◄── on('peer-joined') ────────┤                            │
      │                              │                            │
      │── emit('offer', { sdp }) ────►│                            │
      │                              │── on('offer', { sdp }) ───►│
      │                              │                            │ (Ring / Incoming Modal)
      │                              │◄── emit('answer', { sdp })─┤ (Accept Call)
      │◄── on('answer', { sdp }) ────┤                            │
      │                              │                            │
      │── emit('ice-candidate') ─────►│── on('ice-candidate') ───►│
      │◄── on('ice-candidate') ──────┤◄── emit('ice-candidate') ──┤
      │                              │                            │
      │   ◄══════ Peer-to-Peer Encrypted Media Stream (WebRTC) ═════►
      │                              │                            │
      │── emit('end-call') ──────────►│── on('call-ended') ───────►│
```

---

## 9. Mobile Native Capabilities & Hardware Permissions

To deliver a polished mobile app experience matching the web app, implement the following native capabilities:

| Feature | Android Permission | iOS Info.plist Key | Purpose |
|---|---|---|---|
| **Video Teleconsultation** | `android.permission.CAMERA` | `NSCameraUsageDescription` | WebRTC video stream |
| **Audio Teleconsultation** | `android.permission.RECORD_AUDIO` | `NSMicrophoneUsageDescription` | WebRTC audio stream |
| **Incoming Call Ringing** | `android.permission.VIBRATE` | Background Audio capability | Ringtone chime when app is open |
| **Emergency SOS & OSM** | `android.permission.ACCESS_FINE_LOCATION` | `NSLocationWhenInUseUsageDescription` | GPS coordinates for SOS & hospital distance |
| **Document & Report Upload** | `android.permission.READ_EXTERNAL_STORAGE` / Photo Picker | `NSPhotoLibraryUsageDescription` | Attaching lab images to AI triage chat |
| **Incoming Call Notifications** | Firebase Cloud Messaging (FCM) | Apple Push Notification (APNs) + PushKit / CallKit | Ringing call notifications when app is backgrounded/killed |

### Mobile Recommendations:
1. **WebRTC Library:**
   - React Native: `react-native-webrtc` + `react-native-incall-manager`
   - Flutter: `flutter_webrtc`
2. **Local Storage:**
   - React Native: `react-native-mmkv` or `@react-native-async-storage/async-storage`
   - Flutter: `shared_preferences` or `hive`
3. **VoIP Calling Experience:**
   - Use `react-native-callkeep` / `flutter_callkit_incoming` to display a native phone-call answering screen on incoming doctor teleconsultations.
4. **Offline Resilience:**
   - Cache recent vitals and the offline emergency directory locally so users can access emergency numbers even with zero network connectivity.

---

## 10. Recommended Mobile App Navigation Tree

```
App Navigation Root
├── Auth Stack
│   ├── Landing / Welcome Screen
│   ├── Login Screen (Phone / Email + Google)
│   ├── Sign Up Screen (Role selector: Patient vs Doctor)
│   └── Account Created Confirmation
│
├── Patient Tab Navigator (Bottom Bar)
│   ├── Tab 1: Dashboard
│   │   ├── Vitals Entry / Update Screen
│   │   ├── Longitudinal Health Trends Chart
│   │   └── Active Appointments List
│   ├── Tab 2: AI Assistant
│   │   ├── Active Triage Chat View
│   │   ├── Chat Session Drawer (History, Rename, Delete)
│   │   └── Clinical PDF Viewer
│   ├── Tab 3: Consultations
│   │   ├── Doctors Directory (Search, Filter, Availability)
│   │   └── Booking Modal Sheet
│   ├── Tab 4: Healthcare Map
│   │   ├── Nearby Hospitals (OSM)
│   │   └── Nearby Medical Stores / Pharmacies
│   ├── Tab 5: Profile & Care
│   │   ├── Patient Identity & ABHA Card
│   │   ├── Child & Maternal Health (Vaccination + ANC)
│   │   ├── Emergency SOS Modal / Action
│   │   └── Edit Profile Screen
│   │
│   └── Telehealth Modal Stack (Shared)
│       ├── Active Chat Modal (Socket.IO `/chat`)
│       ├── WebRTC Video Call Screen (Full-screen camera streams)
│       └── Incoming Call Ringing Modal
│
└── Doctor Stack / Drawer Navigator
    ├── Screen 1: Clinical Dashboard
    │   ├── Availability Toggle (Online/Offline)
    │   ├── Appointment Queue Tabs (Pending, Approved, Completed)
    │   └── Quick Stats & Facility Info
    ├── Screen 2: Patients Registry
    │   ├── Searchable Patient Roster
    │   └── Status Filtering (New Requests vs Scheduled)
    ├── Screen 3: Patient Clinical Chart
    │   ├── Patient Demographics & ABHA ID
    │   ├── Sensor Vitals Telemetry
    │   ├── Longitudinal Medical History
    │   └── Clinical PDF Reports
    ├── Screen 4: Doctor Profile & Facility Configuration
    └── Telehealth Modals (Chat, WebRTC Video, Incoming Call Alert)
```

---

## 💡 Quick Tips for the Mobile App Dev Teammate

1. **Start with Authentication and Token Storage:** Set up secure storage for `access_token` and `refresh_token`, along with the axios/fetch interceptor for silent token refresh on `401`.
2. **Reuse the Severity Algorithm:** Copy the exact severity rules from Section 5.1 (`classifyBloodPressure`, `classifyBloodSugar`, etc.) into your mobile state store so the patient health index score matches the web application exactly.
3. **Use the Tested Socket Events:** Follow the socket payloads defined in Section 8. The backend expects stringified IDs or standard objects.
4. **Leverage the OpenStreetMap Service:** No Google Maps API keys are required for hospital or pharmacy lookup. Use the Overpass query format provided in Section 5.6.

---
*Generated directly from the MedCheck / SwasthyaSahay production codebase.*
