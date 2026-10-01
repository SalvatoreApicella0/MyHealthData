import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { test } from 'node:test';

const capability = 'test-capability-secret-that-is-long-enough-123456';
const request = (id, method, params = {}) => JSON.stringify({ jsonrpc: '2.0', id, method, params });

function waitForMessages(child, expectedCount) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let output = [];
    let stderr = '';
    const timeout = setTimeout(() => {
      finish(new Error(`Timed out waiting for MCP responses. stderr=${stderr || '<empty>'}`));
    }, 2_000);

    const finish = (error, messages) => {
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(messages);
    };

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (data) => {
      buffer += data;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          output.push(JSON.parse(line));
        } catch (error) {
          finish(error);
          return;
        }
      }
      if (output.length >= expectedCount) finish(null, output);
    });
    child.stderr.on('data', (data) => { stderr += data; });
    child.once('error', finish);
    child.once('exit', (code, signal) => {
      if (output.length < expectedCount) {
        finish(new Error(`MCP process exited before responding: code=${code} signal=${signal} stderr=${stderr || '<empty>'}`));
      }
    });
  });
}

test('MCP requires its capability and exposes only granted scopes', async () => {
  const child = spawn(process.execPath, ['sync-server/mcp.mjs'], { cwd: process.cwd(), env: { ...process.env, MHD_MCP_CAPABILITY: capability, MHD_MCP_SCOPES: 'measurements:read' }, stdio: ['pipe', 'pipe', 'pipe'] });
  try {
    child.stdin.write(`${request(1, 'initialize')}\n`);
    child.stdin.write(`${request(2, 'tools/list', { _meta: { 'io.myhealthdata/capability': capability } })}\n`);
    const messages = await waitForMessages(child, 2);
    assert.equal(messages[0].error.message, 'unauthorized_capability');
    assert.deepEqual(messages[1].result.tools.map((tool) => tool.name), ['get_recent_measurements']);
  } finally { child.kill(); }
});
