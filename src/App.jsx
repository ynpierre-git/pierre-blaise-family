import { useState } from 'react'
import './App.css'
import Demographics from './components/Demographics.jsx'
import FamilyTree from './components/FamilyTree.jsx'
import Events from './components/Events.jsx'
import Birthdays from './components/Birthdays.jsx'
import JeanMariePierre from './components/JeanMariePierre.jsx'
import Login from './components/Login.jsx'

const TABS = [
  { id: 'demographics', label: 'Demographics', hint: 'Admin' },
  { id: 'tree', label: 'Family Tree', hint: 'Lineage' },
  { id: 'events', label: 'Events', hint: 'Gatherings' },
  { id: 'birthdays', label: 'Birthdays', hint: 'This Month' },
  { id: 'jmpierre', label: 'Jean-Marie Pierre', hint: 'Historian' },
]

export default function App() {
  const [active, setActive] = useState('tree')
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem('pbfam_authed') === '1',
  )

  const login = () => {
    sessionStorage.setItem('pbfam_authed', '1')
    setAuthed(true)
  }
  const logout = () => {
    sessionStorage.removeItem('pbfam_authed')
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
          <p className="thanks">
            A heartfelt thank-you to <strong>Jean-Marie Pierre</strong> for his
            remarkable work gathering and preserving our family’s history. His
            dedication, patience, and vision have given us a priceless gift, one
            that strengthens our identity and keeps our legacy alive for
            generations to come.
          </p>
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
              {(tab.id === 'demographics' || tab.id === 'events') && !authed
                ? `🔒 ${tab.hint}`
                : tab.hint}
            </span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="panel" role="tabpanel">
        {active === 'demographics' &&
          (authed ? <Demographics onLogout={logout} /> : <Login onLogin={login} />)}
        {active === 'tree' && <FamilyTree />}
        {active === 'jmpierre' && <JeanMariePierre />}
        {active === 'events' &&
          (authed ? <Events /> : <Login onLogin={login} />)}
        {active === 'birthdays' && <Birthdays />}
      </main>

      <footer className="footer">
        <span>Pierre-Blaise Family Tree</span>
        <span className="footer-dot">•</span>
        <span>Built with care for generations to come</span>
      </footer>
    </div>
  )
}
