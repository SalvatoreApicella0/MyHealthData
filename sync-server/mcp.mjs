import crypto from 'node:crypto';
import readline from 'node:readline';

const endpoint = process.env.MHD_HUB_URL || 'http://127.0.0.1:8472';
const capability = process.env.MHD_MCP_CAPABILITY;
const scopes = new Set((process.env.MHD_MCP_SCOPES || 'measurements:read').split(',').map((scope) => scope.trim()).filter(Boolean));
if (!capability || capability.length < 32) throw new Error('MHD_MCP_CAPABILITY must be a high-entropy capability secret');
const respond = (id, result) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
const fail = (id, message) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32602, message } })}\n`);
const hasScope = (scope) => scopes.has(scope);
const tools = [
  ...(hasScope('measurements:read') ? [{ name: 'get_recent_measurements', description: 'Read recent measurements from the local MyHealthData Hub.', inputSchema: { type: 'object', properties: {} } }] : []),
  ...(hasScope('measurements:write') ? [{ name: 'add_measurement', description: 'Create a measurement in the local MyHealthData Hub.', inputSchema: { type: 'object', required: ['type', 'value', 'unit', 'measuredAt'], properties: { type: { type: 'string' }, value: { type: 'number' }, unit: { type: 'string' }, measuredAt: { type: 'string' }, note: { type: 'string' } } } }] : []),
];
function authorized(request) {
  const supplied = request.params?._meta?.['io.myhealthdata/capability']; const left = Buffer.from(supplied || ''); const right = Buffer.from(capability);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
async function callTool(name, args) {
  if (name === 'get_recent_measurements' && hasScope('measurements:read')) { const response = await fetch(`${endpoint}/api/v1/measurements`); if (!response.ok) throw new Error('hub_unavailable'); return await response.json(); }
  if (name === 'add_measurement' && hasScope('measurements:write')) { const response = await fetch(`${endpoint}/api/v1/measurements`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...args, provenance: 'mcp' }) }); if (!response.ok) throw new Error((await response.json()).error || 'hub_write_failed'); return await response.json(); }
  throw new Error('tool_not_permitted');
}
readline.createInterface({ input: process.stdin, crlfDelay: Infinity }).on('line', async (line) => {
  try { const request = JSON.parse(line); if (!authorized(request)) return fail(request.id, 'unauthorized_capability', -32001); if (request.method === 'initialize') return respond(request.id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'myhealthdata-hub', version: '0.1.0' } }); if (request.method === 'tools/list') return respond(request.id, { tools }); if (request.method === 'tools/call') { const value = await callTool(request.params.name, request.params.arguments || {}); return respond(request.id, { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value }); } fail(request.id, 'method_not_found'); } catch (error) { fail(undefined, error instanceof Error ? error.message : 'invalid_request'); }
});
