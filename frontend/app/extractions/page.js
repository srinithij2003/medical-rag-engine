'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { listExtractions, listPatients } from '../../lib/api';

export default function ExtractionsPage() {
  const [token, setToken] = useState('');
  const [patients, setPatients] = useState([]);
  const [patientFilter, setPatientFilter] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('ocip_token') || '';
    setToken(saved);
  }, []);

  async function loadPatients(authToken) {
    try {
      const data = await listPatients(authToken);
      setPatients(data?.items || []);
    } catch {
      setPatients([]);
    }
  }

  async function loadExtractions(authToken, patientId = '') {
    setLoading(true);
    setError('');
    try {
      const data = await listExtractions(authToken, patientId || undefined);
      setItems(data?.items || []);
    } catch (requestError) {
      setError(requestError.message || 'Failed to load extraction history');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    loadPatients(token);
    loadExtractions(token, patientFilter);
  }, [token]);

  async function applyFilter(event) {
    const value = event.target.value;
    setPatientFilter(value);
    await loadExtractions(token, value);
  }

  if (!token) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <h1>Public Display Mode</h1>
          <p>Extraction history requires an authenticated local backend session.</p>
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
          <h2>Extractions</h2>
          <p className="muted">Chronological view of structured extraction results.</p>
        </div>
        <nav className="side-nav">
          <Link href="/">Dashboard</Link>
          <Link href="/patients">Patient Registry</Link>
        </nav>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div>
            <h1>Extraction History</h1>
            <p>Review historical structured outputs for traceability and audits.</p>
          </div>
        </header>

        <section className="panel">
          <div className="panel-head">
            <h2>Filters</h2>
            <p>Limit records by patient when needed.</p>
          </div>
          <label>
            Patient
            <select value={patientFilter} onChange={applyFilter}>
              <option value="">All patients</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.patient_code} - {patient.name}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Records</h2>
            <p>{loading ? 'Loading extraction data...' : `${items.length} records`}</p>
          </div>

          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Patient</th>
                <th>Model</th>
                <th>Symptoms</th>
                <th>Blood Pressure</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6}>No extraction records found.</td>
                </tr>
              ) : null}
              {items.map((item) => {
                const symptoms = Array.isArray(item.structured_json?.symptoms)
                  ? item.structured_json.symptoms.join(', ')
                  : '';
                return (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.patient_code ? `${item.patient_code} (${item.patient_name || 'Unknown'})` : 'Unassigned'}</td>
                    <td>{item.model_name}</td>
                    <td>{symptoms || '-'}</td>
                    <td>{item.structured_json?.blood_pressure || '-'}</td>
                    <td>{item.created_at}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {error ? <p className="status error">{error}</p> : null}
      </section>
    </main>
  );
}
