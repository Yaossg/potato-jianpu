import { useState } from 'react'
import './App.css'
import { RenderedFile }from './renderer/RenderedFile'
import { renderSvg, renderPng } from './renderer/renderer'
import { playMusic, stopMusic } from './player/player'
import { exportMusic } from './player/midi'
import { synthMusicInWorker } from './player/synth-worker-host'
import SettingsModal from './components/SettingsModal'
import ExamplesPanel from './components/ExamplesPanel'
import { useTheme } from './components/ThemeContext'

function App() {
  const [source, setSource] = useState("")
  const [isPlaying, setIsPlaying] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showExamples, setShowExamples] = useState(false)
  const [instrument, setInstrument] = useState(0)
  const [volume, setVolume] = useState(100)
  const [playingNote, setPlayingNote] = useState(-1)
  const { theme, toggleTheme } = useTheme()
  const [omitInitialRest, setOmitInitialRest] = useState(true)
  const [sampleRate, setSampleRate] = useState(44100)

  async function togglePlayMusic(startIndex) {
    setShowExamples(false)
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

  function downloadBlob(blob, ext) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jianpu-score.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function exportSVG() {
    const svg = renderSvg(source, 1000);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    downloadBlob(blob, 'svg');
  }

  async function exportPNG() {
    const png = await renderPng(source, 1000, theme);
    const blob = new Blob([png], { type: 'image/png' });
    downloadBlob(blob, 'png');
  }

  function exportMIDI() {
    const blob = exportMusic(source, instrument, omitInitialRest ? -1 : 0);
    if (!blob) {
      alert('Failed to export music');
      return;
    }
    downloadBlob(blob, 'mid');
  }

  async function exportWAV() {
    const blob = await synthMusicInWorker(source, instrument, volume / 100, sampleRate, omitInitialRest ? -1 : 0);
    if (!blob) {
      alert('Failed to export music');
      return;
    }
    downloadBlob(blob, 'wav');
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
      <div className="preview-area">
        <h2>
          <span>Preview</span>
          <div className="button-group">
            <button 
              onClick={exportSVG}
              className="export-button"
              title="Export SVG"
            >
              🧾
            </button>
            <button 
              onClick={exportPNG}
              className="export-button"
              title="Export PNG"
            >
              🖼️
            </button>
            <button
              onClick={exportMIDI}
              className="export-button"
              title="Export MIDI"
            >
              💾
            </button>
            <button
              onClick={exportWAV}
              className="export-button"
              title="Export WAV"
            >
              🔊
            </button>
            <button 
              onClick={() => setShowSettings(!showSettings)} 
              className="settings-button"
              title="Audio Settings"
            >
              ⚙️
            </button>
            {isPlaying ? (
              <button 
                onClick={toggleStopMusic} 
                className="stop-button"
                title="Stop Music"
              >
                ⏹
              </button>
            ) : (
              <button 
                onClick={() => togglePlayMusic(omitInitialRest ? -1 : 0)} 
                className="play-button"
                title="Play Music"
              >
                ▶
              </button>
            )}
          </div>
          <SettingsModal
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            instrument={instrument}
            onInstrumentChange={(e) => setInstrument(e.target.value)}
            volume={volume}
            onVolumeChange={(e) => setVolume(e.target.value)}
            omitInitialRest={omitInitialRest}
            onOmitInitialRestChange={(e) => setOmitInitialRest(e.target.checked)}
            sampleRate={sampleRate}
            onSampleRateChange={(e) => setSampleRate(e.target.value)}
          />
        </h2>
        <div className="render-area">
          <RenderedFile source={source} pageWidth={1000} onNoteClick={note => togglePlayMusic(note.indexOfScore)} playingNote={playingNote} />
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
              title="Examples"
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
