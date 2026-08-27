'use strict';

/**
 * Contrato de `setAccountStatus` —
 * PATCH /v1/auth/accounts/{accountId}/status.
 *
 * Única vía de reactivación de una cuenta; exige rol ADMIN.
 */

const api = require('../support/api');
const db = require('../support/db');

const setStatus = (accountId, token, body) => {
  const req = api.request(api.app).patch(`/v1/auth/accounts/${accountId}/status`);

  if (token) req.set(api.bearer(token));

  return req.send(body);
};

/**
 * La especificación no publica ninguna operación que cree un administrador
 * —por diseño: el rol se asigna siempre como CUSTOMER en el registro—, así que
 * el único modo de disponer de uno es sembrarlo en la base de datos.
 */
const createAdmin = async () => {
  const account = await api.createAccount({ email: api.uniqueEmail('admin') });
  await db.patchAccountDocument(account.email, { role: 'ADMIN' });

  const session = await api.login({
    email: account.email,
    password: account.password,
  });

  return { ...account, token: session.body?.token ?? api.MISSING_TOKEN };
};

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.disconnect);

describe('PATCH /v1/auth/accounts/{accountId}/status', () => {
  it('200 — un ADMIN reactiva una cuenta suspendida', async () => {
    const admin = await createAdmin();
    const target = await api.createAccount();
    await db.patchAccountDocument(target.email, { status: 'suspended' });

    const res = await setStatus(target.accountId, admin.token, {
      status: 'active',
    });

    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
  });

  it('401 — sin credencial', async () => {
    const target = await api.createAccount();

    const res = await setStatus(target.accountId, null, { status: 'suspended' });

    expect(res.status).toBe(401);
    expect(res).toSatisfyApiSpec();
  });

  it('403 — credencial válida sin rol ADMIN', async () => {
    const customer = await api.createAuthenticatedAccount();
    const target = await api.createAccount();

    const res = await setStatus(target.accountId, customer.token, {
      status: 'suspended',
    });

    expect(res.status).toBe(403);
    expect(res).toSatisfyApiSpec();
  });

  it('404 — la cuenta indicada no existe', async () => {
    const admin = await createAdmin();

    const res = await setStatus(api.MISSING_ACCOUNT_ID, admin.token, {
      status: 'suspended',
    });

    expect(res.status).toBe(404);
    expect(res).toSatisfyApiSpec();
  });
});
