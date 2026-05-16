'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createPatient, getPatientHistory, listPatients } from '../../lib/api';

export default function PatientsPage() {
  const [token, setToken] = useState('');
  const [patients, setPatients] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [history, setHistory] = useState([]);
  const [patientInfo, setPatientInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [patientCode, setPatientCode] = useState('');
  const [patientName, setPatientName] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('ocip_token') || '';
    setToken(saved);
  }, []);

  async function loadPatients(authToken) {
    setLoading(true);
    setError('');
    try {
      const data = await listPatients(authToken);
      const items = data?.items || [];
      setPatients(items);
      if (items.length > 0 && !selectedId) {
        setSelectedId(String(items[0].id));
      }
    } catch (requestError) {
      setError(requestError.message || 'Failed to load patients');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    loadPatients(token);
  }, [token]);

  useEffect(() => {
    if (!token || !selectedId) return;

    async function loadHistory() {
      setError('');
      try {
        const data = await getPatientHistory(selectedId, token);
        setPatientInfo(data?.patient || null);
        setHistory(data?.items || []);
      } catch (requestError) {
        setError(requestError.message || 'Failed to load patient history');
      }
    }

    loadHistory();
  }, [selectedId, token]);

  const selectedPatient = useMemo(
    () => patients.find((item) => String(item.id) === String(selectedId)) || null,
    [patients, selectedId]
  );

  async function handleCreatePatient(event) {
    event.preventDefault();
    if (!patientCode.trim() || !patientName.trim()) {
      setError('Patient code and name are required.');
      return;
    }

    setSaving(true);
    setError('');
    setInfo('');
    try {
      const created = await createPatient(
        {
          patient_code: patientCode.trim(),
          name: patientName.trim(),
        },
        token
      );
      setInfo(`Patient created: ${created.patient_code}`);
      setPatientCode('');
      setPatientName('');
      await loadPatients(token);
      setSelectedId(String(created.id));
    } catch (requestError) {
      setError(requestError.message || 'Patient creation failed');
    } finally {
      setSaving(false);
    }
  }

  if (!token) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <h1>Public Display Mode</h1>
          <p>Patient management requires an authenticated local backend session.</p>
          <Link href="/">Back to Dashboard</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="side-panel">
        <div>
          <p className="eyebrow">Clinical Data</p>
          <h2>Patients</h2>
          <p className="muted">Registry and extraction timeline for each patient record.</p>
        </div>
        <nav className="side-nav">
          <Link href="/">Dashboard</Link>
          <Link href="/extractions">Extraction History</Link>
        </nav>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div>
            <h1>Patient Registry</h1>
            <p>Create patient profiles and inspect associated extraction history.</p>
          </div>
        </header>

        <section className="workspace">
          <article className="panel">
            <div className="panel-head">
              <h2>Create Patient</h2>
              <p>Use hospital MRN or your internal patient code format.</p>
            </div>
            <form className="login-form" onSubmit={handleCreatePatient}>
              <label>
                Patient Code
                <input
                  value={patientCode}
                  onChange={(event) => setPatientCode(event.target.value)}
                  placeholder="PT-10001"
                />
              </label>
              <label>
                Patient Name
                <input
                  value={patientName}
                  onChange={(event) => setPatientName(event.target.value)}
                  placeholder="Jane Doe"
                />
              </label>
              <button type="submit" disabled={saving}>
                {saving ? 'Creating...' : 'Create Patient'}
              </button>
            </form>
          </article>

          <article className="panel">
            <div className="panel-head">
              <h2>Patient List</h2>
              <p>{loading ? 'Loading records...' : `${patients.length} patient records`}</p>
            </div>
            <label>
              Select Patient
              <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                {patients.length === 0 ? <option value="">No patients</option> : null}
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.patient_code} - {patient.name}
                  </option>
                ))}
              </select>
            </label>
            {selectedPatient ? (
              <div className="check-list">
                <li>Code: {selectedPatient.patient_code}</li>
                <li>Name: {selectedPatient.name}</li>
                <li>Created: {selectedPatient.created_at}</li>
              </div>
            ) : null}
          </article>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Patient Extraction History</h2>
            <p>
              {patientInfo
                ? `Showing ${history.length} extraction entries for ${patientInfo.patient_code}`
                : 'Select a patient to view history'}
            </p>
          </div>

          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Model</th>
                <th>Symptoms</th>
                <th>Conditions</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5}>No extraction records yet.</td>
                </tr>
              ) : null}
              {history.map((item) => {
                const symptoms = Array.isArray(item.structured_json?.symptoms)
                  ? item.structured_json.symptoms.join(', ')
                  : '';
                const conditions = Array.isArray(item.structured_json?.conditions)
                  ? item.structured_json.conditions.join(', ')
                  : '';
                return (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.model_name}</td>
                    <td>{symptoms || '-'}</td>
                    <td>{conditions || '-'}</td>
                    <td>{item.created_at}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {error ? <p className="status error">{error}</p> : null}
        {info ? <p className="status info">{info}</p> : null}
      </section>
    </main>
  );
}
