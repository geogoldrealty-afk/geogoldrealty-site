import { createHash, randomBytes } from 'node:crypto';

const RETS_VERSION = 'RETS/1.7.2';

function md5(value) {
  return createHash('md5').update(value).digest('hex');
}

function parseDigestChallenge(header = '') {
  const values = {};
  const source = header.replace(/^Digest\s+/i, '');
  const pattern = /(\w+)=(?:"([^"]*)"|([^,\s]+))/g;
  let match;
  while ((match = pattern.exec(source))) values[match[1].toLowerCase()] = match[2] ?? match[3];
  return values;
}

function cookieValue(setCookie = '', name) {
  const match = setCookie.match(new RegExp(`(?:^|[,;]\\s*)${name}=([^;,]+)`, 'i'));
  return match?.[1] || '';
}

function replyError(body) {
  const match = body.match(/<RETS\s+ReplyCode="([^"]+)"\s+ReplyText="([^"]*)"/i);
  if (match && match[1] !== '0' && match[1] !== '20201') return new Error(`GSMLS returned ${match[1]}: ${match[2]}`);
  return null;
}

export class RetsSession {
  constructor({ loginUrl, username, password, userAgent, userAgentPassword }) {
    this.loginUrl = loginUrl;
    this.username = username;
    this.password = password;
    this.userAgent = userAgent;
    this.userAgentPassword = userAgentPassword;
    this.origin = new URL(loginUrl).origin;
    this.challenge = null;
    this.sessionId = '';
    this.cookie = '';
    this.nonceCount = 0;
    this.capabilities = {};
  }

  baseHeaders() {
    return {
      'User-Agent': this.userAgent,
      'RETS-Version': RETS_VERSION,
    };
  }

  authorization(url, method = 'GET') {
    const challenge = this.challenge;
    const uri = `${url.pathname}${url.search}`;
    const nc = (++this.nonceCount).toString(16).padStart(8, '0');
    const cnonce = randomBytes(12).toString('hex');
    const qop = (challenge.qop || 'auth').split(',')[0].trim();
    const ha1 = md5(`${this.username}:${challenge.realm}:${this.password}`);
    const ha2 = md5(`${method}:${uri}`);
    const response = md5(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
    const parts = [
      `username="${this.username}"`,
      `realm="${challenge.realm}"`,
      `nonce="${challenge.nonce}"`,
      `uri="${uri}"`,
      `response="${response}"`,
      `qop=${qop}`,
      `nc=${nc}`,
      `cnonce="${cnonce}"`,
    ];
    if (challenge.opaque) parts.push(`opaque="${challenge.opaque}"`);
    return `Digest ${parts.join(', ')}`;
  }

  uaAuthorization() {
    const a1 = md5(`${this.userAgent}:${this.userAgentPassword}`);
    return `Digest ${md5(`${a1}::${this.sessionId}:${RETS_VERSION}`)}`;
  }

  async start() {
    const challengeResponse = await fetch(this.loginUrl, {
      headers: this.baseHeaders(),
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    });
    this.challenge = parseDigestChallenge(challengeResponse.headers.get('www-authenticate'));
    const setCookies = challengeResponse.headers.getSetCookie?.()
      || [challengeResponse.headers.get('set-cookie') || ''];
    this.cookie = setCookies.map((value) => value.split(';')[0]).filter(Boolean).join('; ');
    this.sessionId = cookieValue(this.cookie, 'RETS-Session-ID');
    if (!this.challenge.nonce || !this.sessionId) throw new Error('GSMLS did not start a RETS session.');

    const response = await this.request(this.loginUrl);
    const body = await response.text();
    const error = replyError(body);
    if (error) throw error;

    for (const line of body.split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z]+)=(.+)$/);
      if (match) this.capabilities[match[1]] = match[2].trim();
    }
    return this;
  }

  async request(target, params = {}) {
    const url = new URL(target, this.origin);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }

    const response = await fetch(url, {
      headers: {
        ...this.baseHeaders(),
        Authorization: this.authorization(url),
        Cookie: this.cookie,
        'RETS-UA-Authorization': this.uaAuthorization(),
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    });

    if (response.status === 401) throw new Error('GSMLS rejected the RETS session.');
    return response;
  }

  async text(capability, params = {}) {
    const response = await this.request(this.capabilities[capability], params);
    const body = Buffer.from(await response.arrayBuffer()).toString('latin1');
    const error = replyError(body);
    if (error) throw error;
    return body;
  }

  async close() {
    if (!this.capabilities.Logout) return;
    try {
      await this.request(this.capabilities.Logout);
    } catch {
      // The short-lived server session will expire even if logout fails.
    }
  }
}

export function parseCompact(body) {
  const columnsMatch = body.match(/<COLUMNS>\s*([\s\S]*?)\s*<\/COLUMNS>/i);
  if (!columnsMatch) return [];
  const columns = columnsMatch[1].split('\t').filter(Boolean);
  return [...body.matchAll(/<DATA>\s*([\s\S]*?)\s*<\/DATA>/gi)].map((match) => {
    const values = match[1].split('\t');
    if (values[0] === '') values.shift();
    if (values.at(-1) === '') values.pop();
    return Object.fromEntries(columns.map((column, index) => [column, decodeEntities(values[index] || '')]));
  });
}

function decodeEntities(value) {
  return value
    .replaceAll('&apos;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

export function retsConfigFromEnv() {
  const config = {
    loginUrl: process.env.GSMLS_RETS_LOGIN_URL,
    username: process.env.GSMLS_RETS_USERNAME,
    password: process.env.GSMLS_RETS_PASSWORD,
    userAgent: process.env.GSMLS_RETS_USER_AGENT,
    userAgentPassword: process.env.GSMLS_RETS_USER_AGENT_PASSWORD,
  };
  if (Object.values(config).some((value) => !value)) throw new Error('The GSMLS feed settings are incomplete.');
  return config;
}
