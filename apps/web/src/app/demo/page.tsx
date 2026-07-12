'use client';

import { useState } from 'react';
import { useNotify, useOptIn, useBulkSend } from '@orgname/notify/react';

export default function DemoPage() {
  const { send, state }         = useNotify();
  const { optIn, optedIn }      = useOptIn();
  const { sendToRecipients, sent, failed, skipped, loading: bulkLoading } = useBulkSend();

  const [phone, setPhone]     = useState('');
  const [result, setResult]   = useState<string>('');
  const [bulkPhones, setBulkPhones] = useState('');

  const handleOptIn = async () => {
    if (!phone) return;
    await optIn(phone);
    setResult('Opt-in confirmation sent!');
  };

  const handleSendOtp = async () => {
    if (!phone) return;
    const code  = String(Math.floor(100000 + Math.random() * 900000));
    const event = await send({ to: phone, template: 'otp', data: { code, expiresIn: '5 minutes' } });
    setResult(JSON.stringify(event, null, 2));
  };

  const handleTaskAssigned = async () => {
    if (!phone) return;
    const event = await send({
      to:       phone,
      template: 'task_assigned',
      data: {
        title:      'Review pull request #482',
        priority:   'high',
        project:    'Mobile App',
        assignedBy: 'Priya (PM)',
        dueDate:    'Tomorrow 5pm',
        taskId:     'task-demo-001',
      },
      tags: ['demo', 'tasks'],
    });
    setResult(JSON.stringify(event, null, 2));
  };

  const handleApproval = async () => {
    if (!phone) return;
    const event = await send({
      to:       phone,
      template: 'approval_request',
      data: {
        title:       'Leave request: 3 days',
        requestedBy: 'Rahul Sharma',
        details:     'Dec 24–26 for family event',
        refId:       'leave-demo-001',
      },
      tags: ['demo', 'hr'],
    });
    setResult(JSON.stringify(event, null, 2));
  };

  const handleAlert = async () => {
    if (!phone) return;
    const event = await send({
      to:       phone,
      template: 'alert',
      data: {
        title:   'Server maintenance',
        body:    'Scheduled downtime tonight 11pm–1am IST',
        buttons: ['Got it', 'Remind me', 'Details'],
        refId:   'maint-demo-001',
      },
    });
    setResult(JSON.stringify(event, null, 2));
  };

  const handleBulk = async () => {
    const phones = bulkPhones.split(',').map((p) => p.trim()).filter(Boolean);
    if (!phones.length) return;
    await sendToRecipients(phones, {
      template: 'alert',
      data: {
        title:   'Team announcement',
        body:    'New version deployed successfully!',
        buttons: ['View changelog'],
        refId:   'bulk-demo-001',
      },
    });
    setResult(`Bulk sent: ${sent} delivered, ${failed} failed, ${skipped} skipped`);
  };

  const handleScheduled = async () => {
    if (!phone) return;
    const in10Mins = new Date(Date.now() + 10 * 60 * 1000);
    const event    = await send({
      to:         phone,
      template:   'reminder',
      data:       { title: 'Scheduled demo', body: 'This was scheduled 10 minutes ago!' },
      scheduleAt: in10Mins.toISOString() as unknown as undefined,
    });
    setResult(`Scheduled for ${in10Mins.toLocaleTimeString()}: ${JSON.stringify(event)}`);
  };

  return (
    <main style={{ maxWidth: 640, margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>@orgname/notify — Demo</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>
        Enter a phone number (with country code, no +) to test each use case.
      </p>

      <label style={{ display: 'block', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: '#444' }}>Phone number</span>
        <input
          type="text"
          placeholder="919876543210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 12px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6 }}
        />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
        {[
          { label: optedIn ? 'Opted in ✓' : 'Opt in',         fn: handleOptIn       },
          { label: 'Send OTP',                                  fn: handleSendOtp     },
          { label: 'Task assigned',                             fn: handleTaskAssigned },
          { label: 'Approval request',                          fn: handleApproval    },
          { label: 'Alert with buttons',                        fn: handleAlert       },
          { label: 'Schedule (10 min)',                         fn: handleScheduled   },
        ].map(({ label, fn }) => (
          <button
            key={label}
            onClick={fn}
            disabled={state.loading || !phone}
            style={{ padding: '10px 16px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: '#fff' }}
          >
            {state.loading ? '...' : label}
          </button>
        ))}
      </div>

      <label style={{ display: 'block', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: '#444' }}>Bulk phones (comma-separated)</span>
        <input
          type="text"
          placeholder="919876543210, 919123456789"
          value={bulkPhones}
          onChange={(e) => setBulkPhones(e.target.value)}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 12px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6 }}
        />
      </label>
      <button
        onClick={handleBulk}
        disabled={bulkLoading || !bulkPhones}
        style={{ width: '100%', padding: '10px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: '#fff', marginBottom: 24 }}
      >
        {bulkLoading ? 'Sending bulk...' : 'Send bulk announcement'}
      </button>

      {state.error && (
        <div style={{ background: '#fff5f5', border: '1px solid #fcc', borderRadius: 6, padding: 12, marginBottom: 16, fontSize: 13, color: '#c00' }}>
          Error: {state.error}
        </div>
      )}

      {result && (
        <pre style={{ background: '#f6f8fa', border: '1px solid #eee', borderRadius: 6, padding: 12, fontSize: 12, overflow: 'auto' }}>
          {result}
        </pre>
      )}
    </main>
  );
}
