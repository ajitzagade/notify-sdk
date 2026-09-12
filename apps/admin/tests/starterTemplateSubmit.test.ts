import { submitStarterTemplate } from '@/lib/starterTemplateSubmit';
import { getCredentialStatus } from '@/lib/tenants';
import { getDecryptedTenantCredentials } from '@/lib/tenantRegistry';
import { createWhatsAppTemplate } from '@/lib/metaGraph';
import { upsertTemplates } from '@/lib/templates';

jest.mock('@/lib/tenants', () => ({ getCredentialStatus: jest.fn() }));
jest.mock('@/lib/tenantRegistry', () => ({ getDecryptedTenantCredentials: jest.fn() }));
jest.mock('@/lib/metaGraph', () => ({ createWhatsAppTemplate: jest.fn() }));
jest.mock('@/lib/templates', () => ({ upsertTemplates: jest.fn() }));

const mockStatus = getCredentialStatus as jest.Mock;
const mockCreds = getDecryptedTenantCredentials as jest.Mock;
const mockCreate = createWhatsAppTemplate as jest.Mock;
const mockUpsert = upsertTemplates as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('submitStarterTemplate', () => {
  it('400s on an unknown catalog key without touching credentials', async () => {
    const r = await submitStarterTemplate('t1', 'not_a_template');
    expect(r).toEqual({ ok: false, error: 'Unknown starter template', statusCode: 400 });
    expect(mockStatus).not.toHaveBeenCalled();
  });

  it('409s when credentials are missing', async () => {
    mockStatus.mockResolvedValue({ configured: false });
    const r = await submitStarterTemplate('t1', 'appointment_reminder');
    expect(r).toMatchObject({ ok: false, statusCode: 409 });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('409s when configured but the WABA ID is missing', async () => {
    mockStatus.mockResolvedValue({ configured: true, wabaId: null });
    const r = await submitStarterTemplate('t1', 'appointment_reminder');
    expect(r).toMatchObject({ ok: false, statusCode: 409 });
    expect(r.ok === false && r.error).toContain('Business Account ID');
  });

  it('502s and does not persist when Meta rejects the submission', async () => {
    mockStatus.mockResolvedValue({ configured: true, wabaId: 'waba9' });
    mockCreds.mockResolvedValue({ accessToken: 'tok', phoneNumberId: '123' });
    mockCreate.mockResolvedValue({ ok: false, error: 'Template name already exists' });
    const r = await submitStarterTemplate('t1', 'appointment_reminder');
    expect(r).toEqual({ ok: false, error: 'Template name already exists', statusCode: 502 });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('submits to Meta and mirrors the PENDING row into wa_templates', async () => {
    mockStatus.mockResolvedValue({ configured: true, wabaId: 'waba9' });
    mockCreds.mockResolvedValue({ accessToken: 'tok', phoneNumberId: '123' });
    mockCreate.mockResolvedValue({ ok: true, id: 'meta-t1', status: 'PENDING', category: 'UTILITY' });

    const r = await submitStarterTemplate('t1', 'appointment_reminder');
    expect(r).toEqual({ ok: true, name: 'appointment_reminder', status: 'PENDING' });

    expect(mockCreate).toHaveBeenCalledWith(
      'tok',
      'waba9',
      expect.objectContaining({ name: 'appointment_reminder', language: 'en', category: 'UTILITY' })
    );
    expect(mockUpsert).toHaveBeenCalledWith('t1', [
      expect.objectContaining({ id: 'meta-t1', name: 'appointment_reminder', status: 'PENDING' }),
    ]);
  });
});
