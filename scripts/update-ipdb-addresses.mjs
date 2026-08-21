import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const DEFAULT_API_URL = 'https://ipdb.api.030101.xyz/';
const DEFAULT_TYPES = 'bestcf;bestproxy';
const DEFAULT_OUTPUT = 'addressesapi.txt';
const DEFAULT_PORT = '443';
const DEFAULT_REMARK = 'IPDB';

const apiUrl = process.env.IPDB_API_URL || DEFAULT_API_URL;
const types = process.env.IPDB_TYPES || DEFAULT_TYPES;
const output = process.env.IPDB_OUTPUT || DEFAULT_OUTPUT;
const port = String(process.env.IPDB_PORT || DEFAULT_PORT).trim();
const remarkPrefix = String(process.env.IPDB_REMARK || DEFAULT_REMARK).trim();

const url = new URL(apiUrl);
url.searchParams.set('type', types);
url.searchParams.set('country', 'true');

const response = await fetch(url, {
  headers: {
    Accept: 'text/plain,*/*;q=0.8',
    'User-Agent': 'WorkerVless2sub-IPDB-Updater/1.0',
  },
});

if (!response.ok) {
  throw new Error(`IPDB request failed: ${response.status} ${response.statusText}`);
}

const text = await response.text();
const entries = normalizeIpdbEntries(text);

if (entries.length === 0) {
  throw new Error('IPDB returned no usable addresses');
}

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${entries.join('\n')}\n`, 'utf8');

console.log(`Updated ${output} with ${entries.length} IPDB addresses from ${url}`);

function normalizeIpdbEntries(source) {
  const seen = new Set();
  const normalized = [];

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const entry = normalizeEntry(line);
    if (!entry || seen.has(entry)) continue;

    seen.add(entry);
    normalized.push(entry);
  }

  return normalized;
}

function normalizeEntry(line) {
  const [addressPart, rawRemark = ''] = line.split('#', 2);
  const address = addressPart.trim();
  if (!address) return null;

  const host = stripExistingPort(address);
  if (!isIpAddress(host)) return null;

  const suffix = rawRemark.trim() ? `${remarkPrefix}-${rawRemark.trim()}` : remarkPrefix;
  return `${formatHost(host)}:${port}#${suffix}`;
}

function stripExistingPort(address) {
  if (address.startsWith('[')) {
    const end = address.indexOf(']');
    return end > 0 ? address.slice(1, end) : address;
  }

  const colonCount = (address.match(/:/g) || []).length;
  if (colonCount === 1) {
    const [host, maybePort] = address.split(':');
    return /^\d+$/.test(maybePort) ? host : address;
  }

  return address;
}

function formatHost(host) {
  return host.includes(':') ? `[${host}]` : host;
}

function isIpAddress(value) {
  return isIpv4(value) || isIpv6(value);
}

function isIpv4(value) {
  const parts = value.split('.');
  return parts.length === 4 && parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const number = Number(part);
    return number >= 0 && number <= 255;
  });
}

function isIpv6(value) {
  return value.includes(':') && /^[0-9a-fA-F:.]+$/.test(value);
}
