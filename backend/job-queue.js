export const jobStatuses = new Set(["PENDING", "RUNNING", "COMPLETED", "FAILED"]);

export class InProcessJobQueue {
  constructor({ readStore, writeStore, concurrency = 1, logger = () => {} }) {
    this.readStore = readStore; this.writeStore = writeStore; this.concurrency = Math.max(1, Math.min(4, Number(concurrency) || 1));
    this.logger = logger; this.handlers = new Map(); this.running = 0; this.accepting = true;
  }
  register(type, handler) { this.handlers.set(type, handler); }
  async enqueue(store, { type, userId, resourceId, payload = {} }) {
    if (!this.accepting) throw Object.assign(new Error("Job worker is shutting down"), { code: "JOB_QUEUE_STOPPING", status: 503 });
    if (!this.handlers.has(type)) throw Object.assign(new Error("Job type is not supported"), { code: "JOB_TYPE_INVALID", status: 400 });
    store.jobs ||= [];
    const id = store.jobs.reduce((max, job) => Math.max(max, Number(job.id) || 0), 0) + 1;
    const job = { id, type, userId, resourceId, status: "PENDING", progress: 0, failureCode: null, createdAt: new Date().toISOString(), startedAt: null, completedAt: null, payload };
    store.jobs.push(job); await this.writeStore(store); queueMicrotask(() => this.drain()); return job;
  }
  async drain() {
    while (this.accepting && this.running < this.concurrency) {
      const store = await this.readStore(); const job = (store.jobs || []).find((item) => item.status === "PENDING");
      if (!job) return;
      this.running += 1; void this.run(job.id).finally(() => { this.running -= 1; void this.drain(); });
    }
  }
  async run(jobId) {
    const store = await this.readStore(); const job = (store.jobs || []).find((item) => item.id === jobId && item.status === "PENDING"); if (!job) return;
    const handler = this.handlers.get(job.type); job.status = "RUNNING"; job.progress = 5; job.startedAt = new Date().toISOString(); await this.writeStore(store);
    try {
      await handler({ job, store, setProgress: async (progress) => { job.progress = Math.max(5, Math.min(95, Number(progress) || 5)); await this.writeStore(store); } });
      job.status = "COMPLETED"; job.progress = 100; job.completedAt = new Date().toISOString(); await this.writeStore(store);
      this.logger({ operation: "job", resourceId: job.resourceId, status: job.status, failureCode: null });
    } catch (error) {
      job.status = "FAILED"; job.failureCode = error?.code || "JOB_EXECUTION_FAILED"; job.progress = 100; job.completedAt = new Date().toISOString(); await this.writeStore(store);
      this.logger({ operation: "job", resourceId: job.resourceId, status: job.status, failureCode: job.failureCode });
    }
  }
  async shutdown() { this.accepting = false; }
}

export function publicJob(job) { const { payload, ...safe } = job; return safe; }
