import type { CorporateProfileRecord } from '../types/legal';

export interface CorporateLookupInput {
  query: string; // CIN or company name
  organizationId: string;
  userId: string;
  matterId?: string;
}

export function isCorporateProviderConfigured(): boolean {
  const key = (
    process.env.MCA_API_KEY ||
    process.env.SUREPASS_API_KEY ||
    process.env.KARZA_API_KEY ||
    ''
  ).trim();
  return Boolean(key && !key.startsWith('MY_'));
}

/**
 * Corporate Intelligence lookup abstraction.
 * Does NOT scrape protected MCA portals or bypass access controls.
 * Uses licensed MCA provider when configured, or returns a clearly-labeled sandbox mock record for development/testing.
 */
export async function lookupCorporateEntity(
  input: CorporateLookupInput
): Promise<Omit<CorporateProfileRecord, 'id' | 'createdAt'>> {
  const cleanQuery = input.query.trim();
  const isCin = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/i.test(cleanQuery);
  const nowDate = new Date().toISOString().slice(0, 10);

  if (isCorporateProviderConfigured()) {
    // Provider hook placeholder: in production, call the configured licensed MCAv3/Karza/Surepass endpoint.
    // Until endpoint URL + credentials are supplied, avoid fabricating live MCA responses.
    const apiUrl = (process.env.MCA_API_URL || '').trim();
    const apiKey = (
      process.env.MCA_API_KEY ||
      process.env.SUREPASS_API_KEY ||
      process.env.KARZA_API_KEY ||
      ''
    ).trim();

    if (apiUrl && apiKey) {
      const res = await fetch(`${apiUrl}?query=${encodeURIComponent(cleanQuery)}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        throw new Error(`Licensed Corporate API returned HTTP ${res.status}.`);
      }
      const data = (await res.json()) as Partial<CorporateProfileRecord>;
      return {
        organizationId: input.organizationId,
        userId: input.userId,
        matterId: input.matterId,
        cin: data.cin || (isCin ? cleanQuery.toUpperCase() : 'UNVERIFIED'),
        companyName: data.companyName || cleanQuery,
        roc: data.roc || 'Registrar of Companies',
        status: data.status || 'Active',
        incorporationDate: data.incorporationDate || '',
        authorizedCapital: data.authorizedCapital || '',
        paidUpCapital: data.paidUpCapital || '',
        registeredAddress: data.registeredAddress || '',
        directors: data.directors || [],
        charges: data.charges || [],
        filings: data.filings || [],
        aiDueDiligenceSummary:
          data.aiDueDiligenceSummary ||
          'Corporate master record fetched from configured licensed provider. Conduct independent statutory inspection of original certified filings before transaction closing.',
        redFlags: data.redFlags || [],
        sourceProvider: 'Configured Licensed Corporate API',
        sourceDate: nowDate,
        isMockData: false,
      };
    }
  }

  // Development/Sandbox Mock Provider — clearly labeled as mock data
  const normalizedName = isCin
    ? `Sample Infrastructure Entity (${cleanQuery.toUpperCase()})`
    : cleanQuery.replace(/\s+/g, ' ');
  const mockCin = isCin ? cleanQuery.toUpperCase() : 'U45200MH2019PTC321845';

  return {
    organizationId: input.organizationId,
    userId: input.userId,
    matterId: input.matterId,
    cin: mockCin,
    companyName: normalizedName,
    roc: 'RoC Mumbai (Sandbox Sample)',
    status: 'Active (Sandbox Demo Record)',
    incorporationDate: '2019-03-14',
    authorizedCapital: '₹5,00,00,000',
    paidUpCapital: '₹3,25,00,000',
    registeredAddress: 'Suite 402, Nariman Bhavan, Nariman Point, Mumbai - 400021 (Sample Address)',
    directors: [
      {
        din: '08123456',
        name: 'Vikramaditya Kulkarni (Sample)',
        designation: 'Managing Director',
        appointmentDate: '2019-03-14',
      },
      {
        din: '08123499',
        name: 'Ananya Deshmukh (Sample)',
        designation: 'Whole-time Director',
        appointmentDate: '2021-07-01',
      },
    ],
    charges: [
      {
        chargeId: 'CHG-10094218',
        holder: 'HDFC Bank Limited (Sample)',
        amount: '₹4,50,00,000',
        status: 'OPEN',
        date: '2024-02-18',
      },
    ],
    filings: [
      {
        form: 'AOC-4',
        date: '2025-10-28',
        description: 'Financial Statements for FY 2024-25',
        status: 'Filed (Sample)',
      },
      {
        form: 'MGT-7',
        date: '2025-11-21',
        description: 'Annual Return under Sec. 92 Companies Act, 2013',
        status: 'Filed (Sample)',
      },
      {
        form: 'DIR-12',
        date: '2024-08-12',
        description: 'Change in Director particulars',
        status: 'Approved (Sample)',
      },
    ],
    aiDueDiligenceSummary:
      '[SANDBOX MOCK DATA] Preliminary corporate profile generated for workflow evaluation. Configure MCA_API_URL and MCA_API_KEY (or SUREPASS_API_KEY / KARZA_API_KEY) to retrieve live official MCA v3 master data, certified charges, and filings. Note: Open charges or delayed filings indicate items requiring verification, not proven misconduct.',
    redFlags: [
      'Open charge of ₹4.50 Cr registered with HDFC Bank (requires NOC / satisfaction check prior to M&A closing).',
      'Live MCA v3 verification pending: configure licensed MCA provider credentials for statutory sign-off.',
    ],
    sourceProvider: 'VidhiOS Sandbox Mock Provider (Licensed MCA API Not Configured)',
    sourceDate: nowDate,
    isMockData: true,
  };
}
