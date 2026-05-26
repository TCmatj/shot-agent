export type ObjectStorageConfig = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseURL: string;
};

type UploadBlobToR2Input = {
  config: ObjectStorageConfig;
  key: string;
  blob: Blob;
  fetcher?: typeof fetch;
  now?: Date;
};

export function createObjectStorageConfig(
  value?: Partial<ObjectStorageConfig>,
): ObjectStorageConfig {
  return {
    endpoint: value?.endpoint?.trim() ?? '',
    bucket: value?.bucket?.trim() ?? '',
    accessKeyId: value?.accessKeyId?.trim() ?? '',
    secretAccessKey: value?.secretAccessKey?.trim() ?? '',
    publicBaseURL: value?.publicBaseURL?.trim() ?? '',
  };
}

export function parseObjectStorageConfig(
  value: string | null,
): ObjectStorageConfig {
  if (!value) {
    return createObjectStorageConfig();
  }

  try {
    const parsed = JSON.parse(value) as Partial<ObjectStorageConfig>;
    return createObjectStorageConfig(parsed);
  } catch {
    return createObjectStorageConfig();
  }
}

export function isObjectStorageConfigured(config: ObjectStorageConfig): boolean {
  return Boolean(
    config.endpoint &&
      config.bucket &&
      config.accessKeyId &&
      config.secretAccessKey &&
      config.publicBaseURL,
  );
}

export function isRemoteAssetUrl(value?: string): boolean {
  if (!value) {
    return false;
  }

  return /^https?:\/\//i.test(value) || value.startsWith('asset://');
}

export async function uploadBlobToR2(input: UploadBlobToR2Input): Promise<string> {
  const fetcher = input.fetcher ?? fetch;
  const endpoint = normalizeUrlBase(input.config.endpoint);
  const publicBaseURL = normalizeUrlBase(input.config.publicBaseURL);
  const objectKey = normalizeObjectKey(input.key);
  const uploadUrl = `${endpoint}/${encodeURIComponent(input.config.bucket)}/${encodeObjectKey(objectKey)}`;
  const url = new URL(uploadUrl);
  const now = input.now ?? new Date();
  const amzDate = toAmzDate(now);
  const shortDate = amzDate.slice(0, 8);
  const region = 'auto';
  const service = 's3';
  const payloadHash = await sha256Hex(await readBlobAsArrayBuffer(input.blob));

  const canonicalHeaders =
    `content-type:${input.blob.type || 'application/octet-stream'}\n` +
    `host:${url.host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    'PUT',
    url.pathname,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const credentialScope = `${shortDate}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');
  const signingKey = await deriveSigningKey(
    input.config.secretAccessKey,
    shortDate,
    region,
    service,
  );
  const signature = toHex(await hmacSha256(signingKey, stringToSign));
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${input.config.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetcher(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: authorization,
      'Content-Type': input.blob.type || 'application/octet-stream',
      Host: url.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    },
    body: input.blob,
  });

  if (!response.ok) {
    const message = typeof response.text === 'function' ? await response.text() : '';
    throw new Error(message || `上传到 Cloudflare R2 失败，HTTP ${response.status}`);
  }

  return `${publicBaseURL}/${encodeObjectKey(objectKey)}`;
}

export async function readAssetSourceAsBlob(source: string): Promise<Blob> {
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`读取本地素材失败，HTTP ${response.status}`);
  }

  return response.blob();
}

function normalizeUrlBase(value: string): string {
  return value.trim().replace(/\/+$/g, '');
}

function normalizeObjectKey(value: string): string {
  return value
    .replace(/^\/+/g, '')
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/');
}

function encodeObjectKey(value: string): string {
  return value
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function toAmzDate(date: Date): string {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return iso.slice(0, 15) + 'Z';
}

async function deriveSigningKey(
  secretAccessKey: string,
  date: string,
  region: string,
  service: string,
): Promise<ArrayBuffer> {
  const dateKey = await hmacSha256(`AWS4${secretAccessKey}`, date);
  const regionKey = await hmacSha256(dateKey, region);
  const serviceKey = await hmacSha256(regionKey, service);
  return hmacSha256(serviceKey, 'aws4_request');
}

async function hmacSha256(
  key: string | BufferSource,
  value: string,
): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? encoder.encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value));
}

async function sha256Hex(value: string | BufferSource): Promise<string> {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value;
  return toHex(await crypto.subtle.digest('SHA-256', bytes));
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

const encoder = new TextEncoder();

async function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }

  return new Response(blob).arrayBuffer();
}
