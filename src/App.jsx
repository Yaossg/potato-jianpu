import { useState } from 'react'
import './App.css'
import { compile } from './render'
import { playMusic, stopMusic } from './player'
import SettingsModal from './SettingsModal'
import ExamplesPanel from './ExamplesPanel'

function App() {
  const [source, setSource] = useState("")
  const [bpm, setBpm] = useState(120)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showExamples, setShowExamples] = useState(false)
  const [instrument, setInstrument] = useState(0)
  const [volume, setVolume] = useState(100)

  async function togglePlayMusic() {
    setShowExamples(false)
    setIsPlaying(true)
    await playMusic(source, bpm, instrument, volume / 100)
    setIsPlaying(false)
  }

  function toggleStopMusic() {
    setShowExamples(false)
    stopMusic()
    setIsPlaying(false)
  }

  return (
    <div className="app-container">
      <h1>Modern Numbered Musical Notation Markup</h1>
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
              bpm={bpm}
              onBpmChange={(e) => setBpm(e.target.value)}
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
        <div 
          className="render-area" 
        >{compile(source)}</div>
      </div>
      <div className="editor-area">
        <h2>
          <span>Editor</span>
          <div className="button-group">
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
