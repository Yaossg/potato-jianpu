import { useState } from 'react'
import './App.css'
import { RenderedScore } from './render'
import { playMusic, stopMusic } from './player'
import SettingsModal from './SettingsModal'
import ExamplesPanel from './ExamplesPanel'
import { useTheme } from './ThemeContext'

function App() {
  const [source, setSource] = useState("")
  const [isPlaying, setIsPlaying] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showExamples, setShowExamples] = useState(false)
  const [instrument, setInstrument] = useState(0)
  const [volume, setVolume] = useState(100)
  const [playingNote, setPlayingNote] = useState(-1)
  const { theme, toggleTheme } = useTheme()

  async function togglePlayMusic(startIndex = 0) {
    setShowExamples(false)
    setPlayingNote(startIndex)
    setIsPlaying(true)
    await playMusic(source, instrument, volume / 100, startIndex, setPlayingNote)
    setIsPlaying(false)
    setPlayingNote(-1)
  }

  function toggleStopMusic() {
    setShowExamples(false)
    stopMusic()
    setIsPlaying(false)
    setPlayingNote(-1)
  }

  return (
    <div className="app-container">
      <div className="header-container">
        <h1>Modern Numbered Musical Notation Markup</h1>
        <button
          onClick={toggleTheme}
          className="theme-toggle-button"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>
      <h2>Warning: Still In Early Development</h2>
      <div className="preview-area">
        <h2>
          <span>Preview</span>
          <div className="button-group">
            <button 
              onClick={() => setShowSettings(!showSettings)} 
              className="settings-button"
            >
              ⚙️
            </button>
            <SettingsModal
              isOpen={showSettings}
              onClose={() => setShowSettings(false)}
              instrument={instrument}
              onInstrumentChange={(e) => setInstrument(e.target.value)}
              volume={volume}
              onVolumeChange={(e) => setVolume(e.target.value)}
            />
            {isPlaying ? (
              <button 
                onClick={toggleStopMusic} 
                className="stop-button"
              >
                ⏹
              </button>
            ) : (
              <button 
                onClick={togglePlayMusic} 
                className="play-button"
              >
                ▶
              </button>
            )}
          </div>
        </h2>
        <div className="render-area">
          <RenderedScore source={source} onNoteClick={note => togglePlayMusic(note.indexOfScore)} playingNote={playingNote} />
        </div>
      </div>
      <div className="editor-area">
        <h2>
          <span>Editor</span>
          <div className="button-group">
            <button
              onClick={() => window.open('grammar.html', '_blank')}
              className="help-button"
              title="Grammar Help"
            >
              ❔
            </button>
            <button 
              onClick={() => setShowExamples(!showExamples)}
              className="examples-button"
            >
              📚
            </button>
          </div>
        </h2>
        <ExamplesPanel 
          isOpen={showExamples}
          onClose={() => setShowExamples(false)}
          onSelectExample={(content) => {
            setSource(content);
            setShowExamples(false);
            toggleStopMusic();
          }}
        />
        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          onFocus={() => setShowExamples(false)}
          className="score-editor"
          rows={15}
          spellCheck="false"
          placeholder="Enter your Jianpu here..."
        />
      </div>
    </div>
  )
}

export default App
