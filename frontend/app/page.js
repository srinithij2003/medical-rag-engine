'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  extractText,
  getHealth,
  listPatients,
  getModels,
  login,
  runOCR,
  selectModel,
  streamExtraction,
  uploadFile,
} from '../lib/api';

function nowLabel() {
  return new Date().toLocaleString();
}

function parseBloodPressure(value) {
  if (!value || typeof value !== 'string') return null;
  const [sys, dia] = value.split('/').map((v) => Number(v));
  if (!Number.isFinite(sys) || !Number.isFinite(dia)) return null;
  return { systolic: sys, diastolic: dia };
}

function buildClinicalFlags(result) {
  if (!result) return [];
  const flags = [];
  const bp = parseBloodPressure(result.blood_pressure);
  const symptoms = (result.symptoms || []).map((item) => item.toLowerCase());

  if (symptoms.some((s) => s.includes('chest pain'))) {
    flags.push({ severity: 'critical', text: 'Chest pain mentioned. Escalate physician review immediately.' });
  }

  if (bp && (bp.systolic >= 180 || bp.diastolic >= 120)) {
    flags.push({ severity: 'critical', text: `Hypertensive crisis pattern (${bp.systolic}/${bp.diastolic}).` });
  } else if (bp && (bp.systolic >= 140 || bp.diastolic >= 90)) {
    flags.push({ severity: 'high', text: `Elevated blood pressure noted (${bp.systolic}/${bp.diastolic}).` });
  }

  if ((result.allergies || []).length > 0 && (result.medications || []).length > 0) {
    flags.push({ severity: 'medium', text: 'Medication/allergy cross-check required before order finalization.' });
  }

  if (flags.length === 0) {
    flags.push({ severity: 'low', text: 'No immediate high-risk pattern detected from extracted fields.' });
  }

  return flags;
}

const quickQueue = [
  { id: 'Q-4182', unit: 'Cardiology OPD', status: 'Pending extraction', priority: 'High' },
  { id: 'Q-4183', unit: 'General Medicine', status: 'Awaiting review', priority: 'Medium' },
  { id: 'Q-4184', unit: 'Emergency', status: 'Scanned intake ready', priority: 'Critical' },
];

export default function HomePage() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const [health, setHealth] = useState(null);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [modelSaving, setModelSaving] = useState(false);

  const [noteText, setNoteText] = useState('');
  const [streamText, setStreamText] = useState('');
  const [extraction, setExtraction] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [activeModel, setActiveModel] = useState('');

  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [ocrText, setOcrText] = useState('');

  const [globalError, setGlobalError] = useState('');
  const [info, setInfo] = useState('');
  const [lastLatencyMs, setLastLatencyMs] = useState(null);
  const [extractionsToday, setExtractionsToday] = useState(0);
  const [theme, setTheme] = useState('light');
  const [activity, setActivity] = useState([]);
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');

  useEffect(() => {
    const savedToken = localStorage.getItem('ocip_token') || '';
    const savedTheme = localStorage.getItem('ocip_theme') || 'light';
    setToken(savedToken);
    setTheme(savedTheme);
    document.documentElement.dataset.theme = savedTheme;
    setIsHydrated(true);
  }, []);

  function logActivity(message, level = 'info') {
    setActivity((prev) => [{ ts: nowLabel(), level, message }, ...prev].slice(0, 12));
  }

  async function refreshRuntime() {
    try {
      const [healthData, modelData, patientData] = await Promise.all([getHealth(), getModels(token), listPatients(token)]);
      setHealth(healthData);
      setModels(modelData.models || []);
      setSelectedModel(modelData.selected || '');
      setPatients(patientData.items || []);
    } catch (error) {
      setGlobalError(error.message || 'Failed to refresh runtime status');
    }
  }

  useEffect(() => {
    if (!token) return;
    refreshRuntime();
  }, [token]);

  useEffect(() => {
    if (!selectedPatientId && patients.length > 0) {
      setSelectedPatientId(String(patients[0].id));
    }
  }, [patients, selectedPatientId]);

  async function handleLogin(event) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    setGlobalError('');

    try {
      const data = await login(username, password);
      setToken(data.access_token);
      localStorage.setItem('ocip_token', data.access_token);
      logActivity('User authenticated for local clinical workspace.');
      setInfo('Login successful. Runtime checks started.');
    } catch (error) {
      setAuthError(error.message || 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    setToken('');
    localStorage.removeItem('ocip_token');
    setExtraction(null);
    setHealth(null);
    setInfo('Logged out.');
    logActivity('Session ended by user.');
  }

  async function handleModelSelect() {
    if (!selectedModel) return;
    setModelSaving(true);
    setGlobalError('');
    try {
      await selectModel(selectedModel, token);
      setInfo(`Model switched to ${selectedModel}`);
      logActivity(`Model switched to ${selectedModel}.`);
      await refreshRuntime();
    } catch (error) {
      setGlobalError(error.message || 'Model switch failed');
    } finally {
      setModelSaving(false);
    }
  }

  function setThemeMode(mode) {
    setTheme(mode);
    localStorage.setItem('ocip_theme', mode);
    document.documentElement.dataset.theme = mode;
  }

  function handleDropFile(nextFile) {
    if (!nextFile) return;
    setFile(nextFile);
    setInfo(`Loaded file: ${nextFile.name}`);
  }

  async function handleUploadAndOCR() {
    if (!file) {
      setGlobalError('Select a document first.');
      return;
    }

    setGlobalError('');
    setUploading(true);
    setUploadProgress(0);

    try {
      await uploadFile(file, token, setUploadProgress);
      logActivity(`Uploaded ${file.name} to local secure storage.`);

      const ocrResponse = await runOCR(file, token);
      const extractedText = ocrResponse?.text || '';
      setOcrText(extractedText);
      setNoteText(extractedText);
      setInfo('OCR complete. Review text and run extraction.');
      logActivity(`OCR completed for ${file.name}.`);
    } catch (error) {
      setGlobalError(error.message || 'Upload/OCR flow failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleStreamExtraction() {
    if (!noteText.trim()) {
      setGlobalError('Clinical note is required for extraction.');
      return;
    }

    setGlobalError('');
    setInfo('');
    setExtraction(null);
    setStreamText('');
    setExtracting(true);
    const startedAt = performance.now();

    try {
      await streamExtraction(
        noteText,
        token,
        (event) => {
        if (event.type === 'meta') {
          setActiveModel(event.model || 'unknown');
        }
        if (event.type === 'token') {
          setStreamText((prev) => prev + (event.delta || ''));
        }
        if (event.type === 'result') {
          setExtraction(event.result || null);
        }
        if (event.type === 'error') {
          setGlobalError(event.message || 'Streaming extraction failed');
        }
        },
        selectedPatientId || null
      );

      const latency = Math.round(performance.now() - startedAt);
      setLastLatencyMs(latency);
      setExtractionsToday((prev) => prev + 1);
      setInfo('Streaming extraction completed with validated JSON.');
      logActivity(`Extraction completed in ${latency} ms.`);
    } catch (error) {
      setGlobalError(error.message || 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  }

  async function handleSyncExtraction() {
    if (!noteText.trim()) {
      setGlobalError('Clinical note is required for extraction.');
      return;
    }

    setGlobalError('');
    setExtracting(true);
    const startedAt = performance.now();

    try {
      const response = await extractText(noteText, token, selectedPatientId || null);
      const payload = response?.extraction || null;
      setExtraction(payload);
      setStreamText(JSON.stringify(payload, null, 2));
      setLastLatencyMs(Math.round(performance.now() - startedAt));
      setExtractionsToday((prev) => prev + 1);
      setInfo('Synchronous extraction completed.');
      logActivity('Manual extraction endpoint executed.');
    } catch (error) {
      setGlobalError(error.message || 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  }

  const flags = useMemo(() => buildClinicalFlags(extraction), [extraction]);

  if (!isHydrated || !token) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <div className="login-head">
            <p className="eyebrow">Offline Clinical Intelligence Platform</p>
            <h1>Clinical Workstation Access</h1>
            <p>Local-only authentication. No patient note leaves on-prem infrastructure.</p>
          </div>
          <form onSubmit={handleLogin} className="login-form">
            <label>
              Username
              <input value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button type="submit" disabled={authLoading}>
              {authLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          {authError ? <p className="text-error">{authError}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="side-panel">
        <div>
          <p className="eyebrow">Healthcare AI Console</p>
          <h2>OCIP</h2>
          <p className="muted">Structured extraction and triage support for clinicians.</p>
        </div>

        <nav className="side-nav">
          <a href="#overview">Runtime Overview</a>
          <a href="#workspace">Extraction Workspace</a>
          <a href="#triage">Clinical Triage</a>
          <a href="#ops">Compliance & Ops</a>
          <a href="/patients">Patient Registry</a>
          <a href="/extractions">Extraction History</a>
        </nav>

        <div className="theme-switcher">
          <button
            className={theme === 'light' ? 'active' : ''}
            onClick={() => setThemeMode('light')}
            type="button"
          >
            Light
          </button>
          <button
            className={theme === 'dark' ? 'active' : ''}
            onClick={() => setThemeMode('dark')}
            type="button"
          >
            Dark
          </button>
        </div>

        <button className="logout" onClick={handleLogout} type="button">
          Logout
        </button>
      </aside>

      <section className="main-panel">
        <header className="topbar" id="overview">
          <div>
            <h1>Clinical Intelligence Dashboard</h1>
            <p>Live operations panel for note extraction, risk flags, and model governance.</p>
          </div>
          <button className="refresh" type="button" onClick={refreshRuntime}>
            Refresh Runtime
          </button>
        </header>

        <section className="metric-grid">
          <article className="metric-card">
            <p>Inference Runtime</p>
            <h3 className={health?.status === 'ok' ? 'ok' : 'bad'}>{health?.status || 'Unknown'}</h3>
            <span>{health?.ollama || 'No health data yet'}</span>
          </article>
          <article className="metric-card">
            <p>Current Model</p>
            <h3>{selectedModel || 'Not loaded'}</h3>
            <span>{models.length} local models detected</span>
          </article>
          <article className="metric-card">
            <p>Extractions (Session)</p>
            <h3>{extractionsToday}</h3>
            <span>Validated structured outputs</span>
          </article>
          <article className="metric-card">
            <p>Last Latency</p>
            <h3>{lastLatencyMs ? `${lastLatencyMs} ms` : '--'}</h3>
            <span>Clinical parsing response time</span>
          </article>
        </section>

        <section className="workspace" id="workspace">
          <article className="panel">
            <div className="panel-head">
              <h2>Document Intake</h2>
              <p>Upload report, run OCR, then stream structured extraction.</p>
            </div>

            <div
              className={`dropzone ${dragging ? 'dragging' : ''}`}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const dropped = event.dataTransfer.files?.[0] || null;
                handleDropFile(dropped);
              }}
            >
              <p>{file ? `Selected: ${file.name}` : 'Drop PDF/DOCX/TXT/PNG/JPG or choose file'}</p>
              <input
                type="file"
                onChange={(event) => handleDropFile(event.target.files?.[0] || null)}
              />
            </div>

            <div className="upload-row">
              <button type="button" onClick={handleUploadAndOCR} disabled={uploading || !file}>
                {uploading ? 'Processing...' : 'Upload + OCR'}
              </button>
              <div className="progress-wrap" aria-label="upload-progress">
                <div className="progress-bar" style={{ width: `${uploadProgress}%` }} />
              </div>
              <span>{uploadProgress}%</span>
            </div>

            <label className="block-label">
              Patient Assignment
              <select
                value={selectedPatientId}
                onChange={(event) => setSelectedPatientId(event.target.value)}
              >
                <option value="">Unassigned extraction</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.patient_code} - {patient.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block-label">
              OCR / Clinical Note Text
              <textarea
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                rows={10}
                placeholder="OCR output or manual clinical note"
              />
            </label>

            <div className="actions">
              <button type="button" onClick={handleStreamExtraction} disabled={extracting}>
                {extracting ? 'Streaming...' : 'Stream Extraction'}
              </button>
              <button type="button" className="ghost" onClick={handleSyncExtraction} disabled={extracting}>
                Quick Extract
              </button>
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <h2>Model and Output Console</h2>
              <p>Model selection, live stream window, and validated JSON result.</p>
            </div>

            <div className="model-row">
              <select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)}>
                {models.length === 0 ? <option value="">No models</option> : null}
                {models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
              <button type="button" onClick={handleModelSelect} disabled={modelSaving || !selectedModel}>
                {modelSaving ? 'Saving...' : 'Apply Model'}
              </button>
            </div>

            <div className="console-grid">
              <div>
                <h3>Streaming Buffer {activeModel ? `(${activeModel})` : ''}</h3>
                <pre>{streamText || 'Waiting for stream output...'}</pre>
              </div>
              <div>
                <h3>Validated JSON</h3>
                <pre>{extraction ? JSON.stringify(extraction, null, 2) : 'No parsed JSON yet.'}</pre>
              </div>
            </div>

            <label className="block-label">
              OCR Snapshot
              <textarea value={ocrText} readOnly rows={5} />
            </label>
          </article>
        </section>

        <section className="triage-grid" id="triage">
          <article className="panel">
            <div className="panel-head">
              <h2>Clinical Risk Flags</h2>
              <p>Auto-derived signal list from extraction output.</p>
            </div>
            <ul className="flag-list">
              {flags.map((flag, index) => (
                <li key={`${flag.severity}-${index}`} className={`flag ${flag.severity}`}>
                  <strong>{flag.severity.toUpperCase()}</strong>
                  <span>{flag.text}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="panel">
            <div className="panel-head">
              <h2>Operational Queue</h2>
              <p>Prioritized cases waiting for extraction or review.</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Unit</th>
                  <th>Status</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {quickQueue.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.unit}</td>
                    <td>{item.status}</td>
                    <td>{item.priority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </section>

        <section className="ops-grid" id="ops">
          <article className="panel">
            <div className="panel-head">
              <h2>Compliance and Security</h2>
              <p>Offline controls aligned for regulated clinical environments.</p>
            </div>
            <ul className="check-list">
              <li>All inference calls resolved to local Ollama runtime.</li>
              <li>Protected endpoints require JWT bearer token.</li>
              <li>Audit-ready action history maintained in backend logs.</li>
              <li>No cloud LLM dependency for extraction tasks.</li>
            </ul>
          </article>

          <article className="panel">
            <div className="panel-head">
              <h2>Session Activity</h2>
              <p>Recent operator actions for quick situational awareness.</p>
            </div>
            <ul className="activity-list">
              {activity.length === 0 ? <li>No actions logged in this session yet.</li> : null}
              {activity.map((item, index) => (
                <li key={`${item.ts}-${index}`}>
                  <span>{item.ts}</span>
                  <p>{item.message}</p>
                </li>
              ))}
            </ul>
          </article>
        </section>

        {globalError ? <p className="status error">{globalError}</p> : null}
        {info ? <p className="status info">{info}</p> : null}
      </section>
    </main>
  );
}
