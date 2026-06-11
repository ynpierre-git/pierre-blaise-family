import { useState } from 'react'
import './App.css'
import { isAuthed, logout as authLogout } from './auth.js'
import Demographics from './components/Demographics.jsx'
import FamilyTree from './components/FamilyTree.jsx'
import WhoIs from './components/WhoIs.jsx'
import Relate from './components/Relate.jsx'
import Events from './components/Events.jsx'
import Birthdays from './components/Birthdays.jsx'
import JeanMariePierre from './components/JeanMariePierre.jsx'
import Login from './components/Login.jsx'

const TABS = [
  { id: 'demographics', label: 'Demographics', hint: 'Admin' },
  { id: 'tree', label: 'Family Tree', hint: 'Lineage' },
  { id: 'whois', label: 'Who is?', hint: 'Lookup' },
  { id: 'relate', label: 'How Related?', hint: 'Genealogical relationships' },
  { id: 'events', label: 'Events', hint: 'Gatherings' },
  { id: 'birthdays', label: 'Birthdays', hint: 'This Month' },
  { id: 'jmpierre', label: 'Jean-Marie Pierre', hint: 'About' },
]

// A shared profile link looks like "…/#/who/<id>" — open straight to that
// person on the Who is? tab.
function sharedWhoId() {
  const m = window.location.hash.match(/^#\/who\/(.+)$/)
  return m ? decodeURIComponent(m[1]) : null
}

export default function App() {
  const initialWhoId = sharedWhoId()
  const [active, setActive] = useState(initialWhoId ? 'whois' : 'tree')
  const [authed, setAuthed] = useState(() => isAuthed())

  // Called after a successful server login (the token is already stored).
  const login = () => setAuthed(true)
  const logout = () => {
    authLogout()
    setAuthed(false)
  }

  return (
    <div className="app" data-page={active}>
      <div className="leaf-bg" key={active} aria-hidden="true" />

      <header className="masthead">
        <div className="masthead-inner">
          <p className="eyebrow">Pierre-Blaise Family Hub</p>
          <h1 className="title">
            <span className="title-line">Pierre-Blaise</span>
            <span className="title-line title-accent">Family Tree</span>
          </h1>
          <p className="lede">
            Where memories are cherished and connections grow stronger.
          </p>
          <p className="roots">
            Our family has its roots in <strong>Arcahaie, Haïti</strong> 🇭🇹
          </p>
          {active === 'tree' && (
            <p className="thanks">
              A heartfelt <em className="thanks-ty">THANK YOU</em> to{' '}
              <strong>Jean-Marie Pierre</strong> for his
              remarkable work gathering and preserving our family’s history. His
              dedication, patience, and vision have given us a priceless gift, one
              that strengthens our identity and keeps our legacy alive for
              generations to come. ❤️🙏🏿
            </p>
          )}
        </div>
      </header>

      <nav className="tabs" role="tablist" aria-label="Sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active === tab.id}
            className={`tab ${active === tab.id ? 'tab-active' : ''}`}
            onClick={() => setActive(tab.id)}
          >
            <span className="tab-hint">
              {tab.id === 'demographics' && !authed ? `🔒 ${tab.hint}` : tab.hint}
            </span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="panel" role="tabpanel">
        {active === 'demographics' &&
          (authed ? <Demographics onLogout={logout} /> : <Login onLogin={login} />)}
        {active === 'tree' && <FamilyTree />}
        {active === 'whois' && <WhoIs initialId={initialWhoId} />}
        {active === 'relate' && <Relate />}
        {active === 'jmpierre' && <JeanMariePierre authed={authed} onLogin={login} />}
        {active === 'events' && <Events authed={authed} onLogin={login} />}
        {active === 'birthdays' && <Birthdays authed={authed} onLogin={login} />}
      </main>

      <footer className="footer">
        <span>Pierre-Blaise Family Tree</span>
        <span className="footer-dot">•</span>
        <span>Built with care for generations to come</span>
        <span className="footer-dot">•</span>
        <a
          className="footer-link"
          href="/pierre-blaise-family-guide.pdf"
          target="_blank"
          rel="noopener noreferrer"
        >
          📖 User Guide
        </a>
      </footer>
    </div>
  )
}
