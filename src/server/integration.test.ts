import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

// Clear env BEFORE dynamic import of createApp so dotenv/config does not connect to Neon or external LLMs
process.env.DATABASE_URL = '';
process.env.NEON_DATABASE_URL = '';
process.env.NVIDIA_API_KEY = '';
process.env.GEMINI_API_KEY = '';
process.env.DISABLE_RATE_LIMIT = 'true';
process.env.NODE_ENV = 'test';

const { createExpressApp } = await import('./createApp');

let server: http.Server;
let baseUrl = '';

async function reqJson<T>(
  path: string,
  options: RequestInit & { token?: string; csrf?: string } = {}
): Promise<{ status: number; body: T; headers: Headers }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.csrf) headers['x-csrf-token'] = options.csrf;

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });
  const text = await res.text();
  let parsed: any = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, body: parsed as T, headers: res.headers };
}

test('integration suite: auth, multi-tenant isolation, core CRUD, AI workflows & error handling', async (t) => {
  const app = await createExpressApp({ includeStatic: false });
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const addr = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}`;

  t.after(() => {
    server.closeAllConnections?.();
    server.close();
  });

  // 1. Health check
  const health = await reqJson<{ ok: boolean; storageEngine: string }>('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.ok, true);

  // 2. Demo login must NOT have admin privileges
  const demoRes = await reqJson<{ token: string; user: any }>('/api/auth/demo', { method: 'POST' });
  assert.equal(demoRes.status, 200);
  assert.equal(Boolean(demoRes.body.user.isAdmin), false);
  const demoAdminAttempt = await reqJson('/api/admin/users', { token: demoRes.body.token });
  assert.equal(demoAdminAttempt.status, 403);

  // 3. Register two users in separate organizations (Org A & Org B)
  const suffix = Date.now();
  const userARes = await reqJson<{ token: string; user: any }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: `usera_${suffix}@chambers.in`,
      password: 'Password@1234',
      fullName: 'Adv. Alpha Sharma',
      organization: `Alpha Chambers ${suffix}`,
    }),
  });
  assert.equal(userARes.status, 201);
  const tokenA = userARes.body.token;

  const userBRes = await reqJson<{ token: string; user: any }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: `userb_${suffix}@chambers.in`,
      password: 'Password@1234',
      fullName: 'Adv. Beta Verma',
      organization: `Beta Chambers ${suffix}`,
    }),
  });
  assert.equal(userBRes.status, 201);
  const tokenB = userBRes.body.token;

  // 4. User A creates a confidential matter, draft, deadline, task, and client
  const matterA = await reqJson<any>('/api/matters', {
    method: 'POST',
    token: tokenA,
    body: JSON.stringify({
      title: 'Confidential Merger Dispute A',
      matterCode: `CONF-A-${suffix}`,
      clientName: 'Confidential Client A',
      opposingParty: 'Counterparty Z',
      jurisdiction: 'india_litigation',
      forum: 'High Court of Delhi',
      status: 'active',
      summaryFacts: 'Application u/s 438 CrPC and Section 420 IPC over commercial escrow.',
    }),
  });
  assert.equal(matterA.status, 201);
  const matterAId = matterA.body.id;

  const draftA = await reqJson<any>('/api/drafts', {
    method: 'POST',
    token: tokenA,
    body: JSON.stringify({
      matterId: matterAId,
      title: 'Confidential Petition A',
      docType: 'Writ Petition',
      content: 'Paragraph 1 of Confidential Petition A.',
    }),
  });
  assert.equal(draftA.status, 201);
  assert.equal(draftA.body.version, 1);

  const draftAUpdate = await reqJson<any>(`/api/drafts/${draftA.body.id}`, {
    method: 'PATCH',
    token: tokenA,
    body: JSON.stringify({
      content: 'Updated Paragraph 1 of Confidential Petition A.',
      status: 'awaiting_review',
    }),
  });
  assert.equal(draftAUpdate.status, 200);
  assert.equal(draftAUpdate.body.version, 2);
  assert.equal(draftAUpdate.body.status, 'awaiting_review');

  // 5. Cross-Organization Security Isolation Tests: User B MUST NOT access or mutate User A's data
  const crossDraftAttempt = await reqJson('/api/drafts', {
    method: 'POST',
    token: tokenB,
    body: JSON.stringify({
      matterId: matterAId,
      title: 'Intrusion Draft',
      docType: 'Writ Petition',
      content: 'Unauthorized',
    }),
  });
  assert.equal(crossDraftAttempt.status, 404);

  const crossPatchDraft = await reqJson(`/api/drafts/${draftA.body.id}`, {
    method: 'PATCH',
    token: tokenB,
    body: JSON.stringify({ title: 'Tampered Title' }),
  });
  assert.equal(crossPatchDraft.status, 404);

  const crossDeleteMatter = await reqJson(`/api/matters/${matterAId}`, {
    method: 'DELETE',
    token: tokenB,
  });
  assert.equal(crossDeleteMatter.status, 404);

  const wsB = await reqJson<any>('/api/workspace', { token: tokenB });
  assert.equal(wsB.status, 200);
  assert.equal(wsB.body.matters.some((m: any) => m.id === matterAId), false);

  // 6. WhatsApp Command, Tasks, Hearings, Corporate Mock, Knowledge Graph, Workflows, DOCX Export
  const waRes = await reqJson<any>('/api/whatsapp/command', {
    method: 'POST',
    token: tokenA,
    body: JSON.stringify({ matterId: matterAId, text: '/bns 420' }),
  });
  assert.equal(waRes.status, 200);
  assert.ok(waRes.body.assistantMsg.body.includes('318'));

  const taskRes = await reqJson<any>('/api/tasks', {
    method: 'POST',
    token: tokenA,
    body: JSON.stringify({
      matterId: matterAId,
      title: 'File Sec 63 BSA Certificate',
      priority: 'high',
      dueDate: '2026-12-10',
    }),
  });
  assert.equal(taskRes.status, 201);

  const wfRes = await reqJson<any>('/api/ai/workflows/run', {
    method: 'POST',
    token: tokenA,
    body: JSON.stringify({
      matterId: matterAId,
      workflowType: 'compliance_deadline_check',
      goal: 'Audit legacy IPC 420 and CrPC 438 references in matter.',
    }),
  });
  assert.equal(wfRes.status, 201);
  assert.equal(wfRes.body.status, 'awaiting_approval');
  assert.ok(wfRes.body.steps.length >= 2);

  const approveRes = await reqJson<any>(`/api/ai/workflows/${wfRes.body.id}/approve`, {
    method: 'POST',
    token: tokenA,
  });
  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.body.status, 'completed');

  const corpRes = await reqJson<any>('/api/corporate/lookup', {
    method: 'POST',
    token: tokenA,
    body: JSON.stringify({ query: 'U45200MH2019PTC321845', matterId: matterAId }),
  });
  assert.equal(corpRes.status, 201);
  assert.equal(corpRes.body.profile.isMockData, true);

  const graphRes = await reqJson<any>(`/api/intelligence/graph?matterId=${matterAId}`, {
    token: tokenA,
  });
  assert.equal(graphRes.status, 200);
  assert.ok(graphRes.body.graph.nodes.length >= 3);

  // DOCX export check (must return valid ZIP magic bytes 'PK')
  const docxHttp = await fetch(`${baseUrl}/api/export/docx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      title: 'Test Filing',
      content: 'IN THE HIGH COURT OF DELHI\n1. Sworn facts.',
    }),
  });
  assert.equal(docxHttp.status, 200);
  const buf = new Uint8Array(await docxHttp.arrayBuffer());
  assert.equal(buf[0], 0x50); // 'P'
  assert.equal(buf[1], 0x4b); // 'K'

  // 7. Failure testing: unauthorized, unsupported upload MIME, invalid input
  const unauthRes = await reqJson('/api/workspace');
  assert.equal(unauthRes.status, 401);

  const badMimeRes = await reqJson('/api/ai/vault-process', {
    method: 'POST',
    token: tokenA,
    body: JSON.stringify({
      matterId: matterAId,
      fileName: 'payload.exe',
      mimeType: 'application/x-msdownload',
      base64Data: 'TVqQAAMAAAAEAAAA',
    }),
  });
  assert.equal(badMimeRes.status, 400);

  // 8. Logout & Token Revocation test
  const logoutRes = await reqJson('/api/auth/logout', { method: 'POST', token: tokenA });
  assert.equal(logoutRes.status, 200);

  const postLogoutRes = await reqJson('/api/workspace', { token: tokenA });
  assert.equal(postLogoutRes.status, 401);
});
