import { useState } from 'react'
import {
  Syringe,
  Baby,
  HeartPulse,
  ShieldCheck,
  AlertTriangle,
  Stethoscope,
  Apple,
  CalendarCheck,
  ChevronDown,
} from 'lucide-react'
import { Sidebar, TopBar } from './PatientDashboard.jsx'
import { getStoredUser } from '../api/apiClient.js'

/* =========================================================================
 * STATIC REFERENCE DATA
 * Paraphrased from the publicly published IAP immunization schedule and
 * WHO / Govt. of India antenatal care guidance. General awareness content —
 * not a substitute for a doctor's advice for any individual patient.
 * ========================================================================= */

const VACCINATION_SCHEDULE = [
  {
    age: 'At birth',
    items: [
      { vaccine: 'BCG', protects: 'Tuberculosis' },
      { vaccine: 'Hepatitis B — Dose 1', protects: 'Hepatitis B' },
      { vaccine: 'OPV — Dose 0', protects: 'Polio' },
    ],
  },
  {
    age: '6 weeks',
    items: [
      { vaccine: 'DTwP/DTaP — Dose 1', protects: 'Diphtheria, Tetanus, Whooping Cough' },
      { vaccine: 'IPV — Dose 1', protects: 'Polio' },
      { vaccine: 'Hib — Dose 1', protects: 'Hib infections (meningitis, pneumonia)' },
      { vaccine: 'Hepatitis B — Dose 2', protects: 'Hepatitis B' },
      { vaccine: 'Rotavirus — Dose 1', protects: 'Severe rotavirus diarrhea' },
      { vaccine: 'PCV — Dose 1', protects: 'Pneumococcal disease' },
    ],
  },
  {
    age: '10 weeks',
    items: [
      { vaccine: 'DTwP/DTaP — Dose 2', protects: 'Diphtheria, Tetanus, Whooping Cough' },
      { vaccine: 'IPV — Dose 2', protects: 'Polio' },
      { vaccine: 'Hib — Dose 2', protects: 'Hib infections' },
      { vaccine: 'Hepatitis B — Dose 3', protects: 'Hepatitis B' },
      { vaccine: 'Rotavirus — Dose 2', protects: 'Severe rotavirus diarrhea' },
      { vaccine: 'PCV — Dose 2', protects: 'Pneumococcal disease' },
    ],
  },
  {
    age: '14 weeks',
    items: [
      { vaccine: 'DTwP/DTaP — Dose 3', protects: 'Diphtheria, Tetanus, Whooping Cough' },
      { vaccine: 'IPV — Dose 3', protects: 'Polio' },
      { vaccine: 'Hib — Dose 3', protects: 'Hib infections' },
      { vaccine: 'Rotavirus — Dose 3', protects: 'Severe rotavirus diarrhea' },
      { vaccine: 'PCV — Dose 3', protects: 'Pneumococcal disease' },
    ],
  },
  {
    age: '6–7 months',
    items: [
      { vaccine: 'Influenza — Dose 1 & 2', protects: 'Seasonal flu' },
      { vaccine: 'Typhoid Conjugate Vaccine', protects: 'Typhoid fever' },
    ],
  },
  {
    age: '9 months',
    items: [
      { vaccine: 'MMR — Dose 1', protects: 'Measles, Mumps, Rubella' },
    ],
  },
  {
    age: '12–15 months',
    items: [
      { vaccine: 'Hepatitis A — Dose 1', protects: 'Hepatitis A' },
      { vaccine: 'MMR — Dose 2', protects: 'Measles, Mumps, Rubella' },
      { vaccine: 'Varicella — Dose 1', protects: 'Chickenpox' },
      { vaccine: 'PCV Booster', protects: 'Pneumococcal disease' },
    ],
  },
  {
    age: '16–18 months',
    items: [
      { vaccine: 'DTwP/DTaP + Hib + IPV Booster', protects: 'Diphtheria, Tetanus, Pertussis, Hib, Polio' },
      { vaccine: 'Varicella — Dose 2', protects: 'Chickenpox' },
      { vaccine: 'Hepatitis A — Dose 2', protects: 'Hepatitis A' },
    ],
  },
  {
    age: '4–6 years',
    items: [
      { vaccine: 'DTwP/DTaP + IPV Booster', protects: 'Diphtheria, Tetanus, Pertussis, Polio' },
      { vaccine: 'MMR — Dose 3', protects: 'Measles, Mumps, Rubella' },
    ],
  },
  {
    age: '10–12 years',
    items: [
      { vaccine: 'Tdap/Td Booster', protects: 'Tetanus, Diphtheria, Pertussis' },
      { vaccine: 'HPV — Dose 1 & 2', protects: 'HPV-linked cancers (recommended for girls; boys per doctor advice)' },
    ],
  },
]

const ANC_FLOW = [
  {
    stage: 'First contact',
    window: 'As soon as pregnancy is confirmed, ideally before 12 weeks',
    detail: 'Pregnancy registration, health & obstetric history, weight, blood pressure, blood and urine tests, and starting daily iron-folic acid.',
  },
  {
    stage: 'Second trimester checkup',
    window: '14–26 weeks',
    detail: 'Routine ANC visit, fetal growth check, ultrasound, and the first Td (tetanus-diphtheria) injection.',
  },
  {
    stage: 'Early third trimester',
    window: '28–34 weeks',
    detail: 'Second Td injection if due, continued iron-folic acid, and counseling on recognizing labor and planning a facility birth.',
  },
  {
    stage: 'Final checkups',
    window: '36 weeks to delivery',
    detail: 'Frequent monitoring, a confirmed birth plan, and a review of warning signs that need immediate care.',
  },
]

const MATERNAL_CATEGORIES = [
  {
    icon: CalendarCheck,
    category: 'Antenatal Visits',
    guideline: 'At least 4 ANC checkups across pregnancy is the standard minimum; WHO recommends up to 8 contacts where possible for the best outcomes.',
    accent: '#29574b',
    bg: '#eff5f1',
  },
  {
    icon: Syringe,
    category: 'Vaccination',
    guideline: 'Two doses of Td (tetanus-diphtheria) during pregnancy protect both mother and newborn against neonatal tetanus.',
    accent: '#1e40af',
    bg: '#dbeafe',
  },
  {
    icon: Apple,
    category: 'Nutrition',
    guideline: 'Daily iron and folic acid supplementation throughout pregnancy helps prevent maternal anemia and supports healthy birth weight.',
    accent: '#0e7490',
    bg: '#cffafe',
  },
  {
    icon: Stethoscope,
    category: 'Screening & Tests',
    guideline: 'Blood pressure, hemoglobin, blood sugar, and urine tests at every visit, plus HIV and syphilis screening at the first visit.',
    accent: '#be185d',
    bg: '#fce7f3',
  },
  {
    icon: AlertTriangle,
    category: 'Danger Signs',
    guideline: 'Seek immediate care for bleeding, severe headache or blurred vision, high fever, reduced fetal movement, or swelling of the face and hands.',
    accent: '#991b1b',
    bg: '#fff1f0',
  },
  {
    icon: HeartPulse,
    category: 'Postnatal Care',
    guideline: 'Checkups for both mother and newborn should continue through the first 42 days after delivery.',
    accent: '#92400e',
    bg: '#fef3c7',
  },
]

const FLOW_ACCENTS = ['#10b981', '#3b82f6', '#06b6d4', '#ec4899', '#f59e0b']

function VaccinationFlow() {
  const [openIndex, setOpenIndex] = useState(0)

  return (
    <div style={{ position: 'relative', paddingLeft: '28px' }}>
      <div style={{ position: 'absolute', left: '9px', top: '10px', bottom: '10px', width: '2px', background: '#dcece5' }} />
      {VACCINATION_SCHEDULE.map((stop, index) => {
        const isOpen = openIndex === index
        const dotColor = FLOW_ACCENTS[index % FLOW_ACCENTS.length]
        return (
          <div key={stop.age} style={{ position: 'relative', marginBottom: index === VACCINATION_SCHEDULE.length - 1 ? 0 : '18px' }}>
            <div style={{
              position: 'absolute', left: '-28px', top: '18px',
              width: '20px', height: '20px', borderRadius: '50%',
              background: dotColor, border: '3px solid #ffffff',
              boxShadow: `0 0 0 2px ${dotColor}`,
            }} />
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? -1 : index)}
              style={{
                width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 20px', borderRadius: '14px', border: '1px solid #e2eae5',
                background: isOpen ? '#f5fbf7' : '#ffffff', cursor: 'pointer',
              }}
            >
              <div>
                <strong style={{ fontSize: '1.1rem', color: '#171d1b', fontWeight: 800 }}>{stop.age}</strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.9rem', color: '#59756e', fontWeight: 600 }}>
                  {stop.items.length} vaccine{stop.items.length !== 1 ? 's' : ''} due
                </p>
              </div>
              <ChevronDown size={20} style={{ color: '#29574b', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            {isOpen && (
              <div style={{ display: 'grid', gap: '10px', marginTop: '10px', paddingLeft: '4px' }}>
                {stop.items.map((item) => (
                  <div
                    key={item.vaccine}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '12px',
                      padding: '12px 16px', borderRadius: '12px', background: '#fbfaf6', border: '1px solid #eeece5',
                    }}
                  >
                    <Syringe size={18} style={{ color: dotColor, marginTop: '2px', flexShrink: 0 }} />
                    <div>
                      <strong style={{ fontSize: '0.98rem', color: '#171d1b' }}>{item.vaccine}</strong>
                      <p style={{ margin: '2px 0 0', fontSize: '0.88rem', color: '#526e67' }}>Protects against {item.protects}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function AncFlow() {
  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      {ANC_FLOW.map((stop, index) => {
        const accent = FLOW_ACCENTS[index % FLOW_ACCENTS.length]
        return (
          <div key={stop.stage} style={{ display: 'flex', gap: '18px', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%', background: accent,
                color: '#ffffff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.95rem',
              }}>
                {index + 1}
              </div>
              {index !== ANC_FLOW.length - 1 && (
                <div style={{ width: '2px', flex: 1, minHeight: '32px', background: '#dcece5', marginTop: '4px' }} />
              )}
            </div>
            <div style={{ flex: 1, padding: '16px 20px', borderRadius: '14px', background: '#ffffff', border: '1px solid #e2eae5', marginBottom: index !== ANC_FLOW.length - 1 ? '0' : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <strong style={{ fontSize: '1.05rem', color: '#171d1b', fontWeight: 800 }}>{stop.stage}</strong>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: accent, background: `${accent}1a`, padding: '3px 10px', borderRadius: '999px' }}>
                  {stop.window}
                </span>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: '0.95rem', color: '#404845', lineHeight: 1.55 }}>{stop.detail}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CategoryCards() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
      {MATERNAL_CATEGORIES.map(({ icon: Icon, category, guideline, accent, bg }) => (
        <div
          key={category}
          style={{ padding: '18px', borderRadius: '16px', background: '#ffffff', border: '1px solid #e2eae5', boxShadow: '0 6px 18px rgba(41,87,75,0.05)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <span style={{ width: '36px', height: '36px', borderRadius: '10px', background: bg, color: accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Icon size={18} />
            </span>
            <strong style={{ fontSize: '1rem', color: '#171d1b', fontWeight: 800 }}>{category}</strong>
          </div>
          <p style={{ margin: 0, fontSize: '0.92rem', color: '#526e67', lineHeight: 1.55 }}>{guideline}</p>
        </div>
      ))}
    </div>
  )
}

export default function ChildMaternalCare() {
  const user = getStoredUser()
  const userName = user?.name || window.localStorage.getItem('medimate-account-name') || 'there'
  const [activeSection, setActiveSection] = useState('child')

  return (
    <div className="dashboard" id="child-maternal-care">
      <TopBar userName={userName} />
      <div className="dashboard-body">
        <Sidebar userName={userName} activeLabel="Child & Maternal Health" />
        <main className="dashboard-main" style={{ paddingBottom: '60px' }}>
          <section style={{ marginBottom: '28px' }}>
            <h1 style={{ fontSize: '2.6rem', fontWeight: 800, margin: 0, color: '#171d1b', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Baby size={34} style={{ color: '#29574b' }} /> Child &amp; Maternal Health
            </h1>
            <p style={{ fontSize: '1.15rem', marginTop: '8px', color: '#404845', maxWidth: '680px' }}>
              A quick reference for childhood vaccinations and pregnancy care — general awareness guidance based on published IAP and WHO recommendations. Always confirm specific timing with your doctor.
            </p>

            <div style={{ display: 'inline-flex', gap: '8px', background: '#eff5f1', padding: '6px', borderRadius: '14px', border: '1px solid #c0c8c4', marginTop: '20px' }}>
              {[
                ['child', 'Child Vaccination'],
                ['maternal', 'Maternal & Pregnancy Care'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActiveSection(key)}
                  style={{
                    padding: '10px 20px', borderRadius: '10px', border: 0, fontWeight: 700, fontSize: '0.95rem',
                    cursor: 'pointer', background: activeSection === key ? '#29574b' : 'transparent',
                    color: activeSection === key ? '#00ff88' : '#404845', transition: 'all 0.2s ease',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {activeSection === 'child' ? (
            <section style={{ padding: '32px', borderRadius: '24px', background: '#fbfaf6', border: '1px solid #eeece5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <ShieldCheck size={24} style={{ color: '#29574b' }} />
                <h2 style={{ fontSize: '1.7rem', fontWeight: 800, margin: 0, color: '#171d1b' }}>Vaccination schedule, birth to 12 years</h2>
              </div>
              <p style={{ fontSize: '1rem', color: '#526e67', marginBottom: '24px' }}>
                Tap an age milestone to see which vaccines are due and what each one protects against.
              </p>
              <VaccinationFlow />
            </section>
          ) : (
            <>
              <section style={{ padding: '32px', borderRadius: '24px', background: '#fbfaf6', border: '1px solid #eeece5', marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <CalendarCheck size={24} style={{ color: '#29574b' }} />
                  <h2 style={{ fontSize: '1.7rem', fontWeight: 800, margin: 0, color: '#171d1b' }}>Antenatal visit timeline</h2>
                </div>
                <p style={{ fontSize: '1rem', color: '#526e67', marginBottom: '24px' }}>
                  What each stage of pregnancy checkups typically covers.
                </p>
                <AncFlow />
              </section>

              <section>
                <h2 style={{ fontSize: '1.7rem', fontWeight: 800, margin: '0 0 16px', color: '#171d1b' }}>Care guidelines by category</h2>
                <CategoryCards />
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
