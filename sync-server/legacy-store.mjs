import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Small serialized JSON/blob store for the legacy opaque-ciphertext relay.
 *
 * The legacy protocol intentionally has no database dependency, but its
 * read-modify-write collections still need one important database property:
 * concurrent requests must not lose each other's updates. All mutations are
 * therefore chained in-process and each file replacement is atomic.
 */
export class LegacyStore {
  #root;
  #writeChain = Promise.resolve();

  constructor(root) {
    this.#root = root;
  }

  async open() {
    await fs.mkdir(this.#root, { recursive: true, mode: 0o700 });
  }

  async readJSON(file, fallback) {
    await this.#writeChain;
    return this.#readJSON(file, fallback);
  }

  async collection(name) {
    return this.readJSON(`${name}.json`, []);
  }

  async appendMany(name, items) {
    if (items.length === 0) return [];
    return this.#enqueue(async () => {
      const values = await this.#readJSON(`${name}.json`, []);
      values.push(...items);
      await this.#writeJSON(`${name}.json`, values);
      return items;
    });
  }

  async updateCollection(name, update) {
    return this.#enqueue(async () => {
      const values = await this.#readJSON(`${name}.json`, []);
      const next = await update(values);
      await this.#writeJSON(`${name}.json`, next);
      return next;
    });
  }

  async putBlob(hash, data) {
    return this.#enqueue(async () => {
      const directory = path.join(this.#root, 'blobs');
      await fs.mkdir(directory, { recursive: true, mode: 0o700 });
      await this.#writeFileAtomic(path.join(directory, hash), data, 0o600);
    });
  }

  async getBlob(hash) {
    await this.#writeChain;
    return fs.readFile(path.join(this.#root, 'blobs', hash));
  }

  async reset() {
    return this.#enqueue(async () => {
      await fs.rm(this.#root, { recursive: true, force: true });
      await fs.mkdir(this.#root, { recursive: true, mode: 0o700 });
    });
  }

  #enqueue(operation) {
    const result = this.#writeChain.then(operation);
    // A failed write must not permanently poison the queue. The failed
    // operation still rejects its own caller, while later requests can run.
    this.#writeChain = result.catch(() => undefined);
    return result;
  }

  async #readJSON(file, fallback) {
    try {
      return JSON.parse(await fs.readFile(path.join(this.#root, file), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return fallback;
      throw error;
    }
  }

  async #writeJSON(file, value) {
    await this.#writeFileAtomic(path.join(this.#root, file), JSON.stringify(value), 0o600);
  }

  async #writeFileAtomic(target, data, mode) {
    const temporary = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, data, { mode });
      await fs.rename(temporary, target);
    } finally {
      await fs.rm(temporary, { force: true }).catch(() => undefined);
    }
  }
}
