import { Worker } from 'worker_threads';
import { config } from '../config/index.js';
import { logger } from '../logger/index.js';

export class WorkerPool {
  constructor() {
    this.workers = [];
    this.taskQueue = [];
    this.maxWorkers = config.workerPoolSize;
    this.queueLimit = config.queueLimit;
    this.taskTimeoutMs = 5000; // 5 seconds processing timeout
    this.isShuttingDown = false;
    this.nextWorkerId = 1;
    this.rrIndex = 0; // For Round-Robin scheduling
  }

  /**
   * Initializes the pool by pre-warming all workers.
   */
  initialize() {
    logger.info(`⚙️ Initializing WorkerPool with size: ${this.maxWorkers}`);
    for (let i = 0; i < this.maxWorkers; i++) {
      this.spawnWorker();
    }
  }

  /**
   * Spawns a single worker thread and sets up listeners.
   */
  spawnWorker() {
    const workerId = this.nextWorkerId++;

    logger.debug(`Spawning Worker thread #${workerId}...`);

    // Use ESM-safe URL relative to this file to resolve the worker script
    const workerUrl = new URL('./telemetry.worker.js', import.meta.url);
    const worker = new Worker(workerUrl);

    const workerInfo = {
      id: workerId,
      worker,
      busy: false,
      activeTask: null,
    };

    worker.on('message', (response) => {
      this.handleWorkerResponse(workerInfo, response);
    });

    worker.on('error', (err) => {
      logger.error(`Worker #${workerId} encountered error:`, err);
      this.handleWorkerCrash(workerInfo, err);
    });

    worker.on('exit', (code) => {
      if (code !== 0 && !this.isShuttingDown) {
        logger.error(`Worker #${workerId} exited unexpectedly with code ${code}`);
        this.handleWorkerCrash(
          workerInfo,
          new Error(`Worker exited unexpectedly with code ${code}`),
        );
      } else {
        logger.debug(`Worker #${workerId} exited cleanly.`);
      }
    });

    this.workers.push(workerInfo);
    return workerInfo;
  }

  /**
   * Submits a telemetry payload to the pool.
   * Returns a promise that resolves with the processed telemetry object.
   */
  execute(payload) {
    return new Promise((resolve, reject) => {
      if (this.isShuttingDown) {
        return reject(new Error('WorkerPool is shutting down'));
      }

      const taskId = `${payload.vehicleId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const task = {
        taskId,
        payload,
        resolve,
        reject,
        createdAt: Date.now(),
      };

      // 1. Queue Overflow Protection
      if (this.taskQueue.length >= this.queueLimit) {
        logger.warn(
          `WorkerPool Queue Overflow! Size: ${this.taskQueue.length}. Rejecting task ${taskId}`,
        );
        const overflowErr = new Error(
          'Ingestion pipeline capacity reached. Please try again later.',
        );
        overflowErr.statusCode = 503;
        return reject(overflowErr);
      }

      // 2. Select worker using Least-Busy / Round-Robin scheduling
      const worker = this.getAvailableWorker();

      if (worker) {
        this.runTask(worker, task);
      } else {
        // Enqueue task if all workers are busy
        logger.debug(
          `All workers busy. Enqueuing task ${taskId} (Queue size: ${this.taskQueue.length + 1})`,
        );
        this.taskQueue.push(task);
      }
    });
  }

  /**
   * Retrieves an idle worker using round-robin scan for fairness.
   */
  getAvailableWorker() {
    const total = this.workers.length;
    for (let i = 0; i < total; i++) {
      const idx = (this.rrIndex + i) % total;
      const worker = this.workers[idx];
      if (!worker.busy) {
        this.rrIndex = (idx + 1) % total;
        return worker;
      }
    }
    return null;
  }

  /**
   * Assigns and starts a task on a specific worker.
   */
  runTask(workerInfo, task) {
    workerInfo.busy = true;
    workerInfo.activeTask = task;

    // Enforce Task processing timeout
    task.timeoutTimer = setTimeout(() => {
      logger.error(
        `Task ${task.taskId} timed out on Worker #${workerInfo.id}. Terminating worker...`,
      );
      this.handleWorkerTimeout(workerInfo);
    }, this.taskTimeoutMs);

    // Send payload to worker thread
    workerInfo.worker.postMessage({
      taskId: task.taskId,
      payload: task.payload,
    });
  }

  /**
   * Processes the response posted back by the worker.
   */
  handleWorkerResponse(workerInfo, response) {
    const { taskId, success, data, errors, type, message } = response;
    const task = workerInfo.activeTask;

    // Verify response matches active task
    if (!task || task.taskId !== taskId) {
      logger.warn(`Received response for inactive task ${taskId} on Worker #${workerInfo.id}`);
      return;
    }

    // Clear timeout timer
    if (task.timeoutTimer) {
      clearTimeout(task.timeoutTimer);
    }

    // Cleanup worker state
    workerInfo.busy = false;
    workerInfo.activeTask = null;

    // Resolve or reject the caller's promise
    if (success && data) {
      const formattedData = {
        ...data,
        timestamp: new Date(data.timestamp),
        ingestedAt: new Date(data.ingestedAt),
      };
      task.resolve(formattedData);
    } else {
      if (type === 'VALIDATION_ERROR') {
        const validationErr = new Error('Validation failed');
        validationErr.errors = errors;
        validationErr.statusCode = 400;
        task.reject(validationErr);
      } else {
        const procErr = new Error(message || 'Worker processing failure');
        procErr.statusCode = 500;
        task.reject(procErr);
      }
    }

    // Check for next queued task
    this.processNextTask(workerInfo);
  }

  /**
   * Pulls the next task from queue and runs it on the worker.
   */
  processNextTask(workerInfo) {
    if (this.taskQueue.length > 0 && !this.isShuttingDown) {
      const nextTask = this.taskQueue.shift();
      this.runTask(workerInfo, nextTask);
    }
  }

  /**
   * Handles task timeout by terminating worker and spawning a new one.
   */
  handleWorkerTimeout(workerInfo) {
    const task = workerInfo.activeTask;
    if (task) {
      const timeoutErr = new Error('Telemetry ingestion processing timed out');
      timeoutErr.statusCode = 504;
      task.reject(timeoutErr);
    }

    // Force terminate the stalled worker
    workerInfo.worker.terminate();
    this.removeWorkerInfo(workerInfo);

    // Spawn a clean worker replacement and feed queue
    if (!this.isShuttingDown) {
      const newWorker = this.spawnWorker();
      this.processNextTask(newWorker);
    }
  }

  /**
   * Recovers system state from worker crash.
   */
  handleWorkerCrash(workerInfo, error) {
    const task = workerInfo.activeTask;
    if (task) {
      if (task.timeoutTimer) {
        clearTimeout(task.timeoutTimer);
      }
      const crashErr = new Error(`Telemetry processor crashed: ${error.message}`);
      crashErr.statusCode = 500;
      task.reject(crashErr);
    }

    // Remove crashed worker
    this.removeWorkerInfo(workerInfo);

    // Boot replacement worker and read queue
    if (!this.isShuttingDown) {
      const newWorker = this.spawnWorker();
      this.processNextTask(newWorker);
    }
  }

  /**
   * Helper to remove worker from tracking list.
   */
  removeWorkerInfo(workerInfo) {
    const index = this.workers.indexOf(workerInfo);
    if (index !== -1) {
      this.workers.splice(index, 1);
    }
  }

  /**
   * Graceful shutdown of all workers and rejection of pending queues.
   */
  async shutdown() {
    logger.warn('⚠️ Shutting down WorkerPool...');
    this.isShuttingDown = true;

    // Reject all queued tasks
    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      const shutErr = new Error('Ingestion service is shutting down');
      shutErr.statusCode = 503;
      task.reject(shutErr);
    }

    // Terminate all workers
    const terminationPromises = this.workers.map(async (workerInfo) => {
      const task = workerInfo.activeTask;
      if (task) {
        if (task.timeoutTimer) {
          clearTimeout(task.timeoutTimer);
        }
        const termErr = new Error('Ingestion service was terminated');
        termErr.statusCode = 503;
        task.reject(termErr);
      }
      await workerInfo.worker.terminate();
    });

    await Promise.all(terminationPromises);
    this.workers = [];
    logger.info('WorkerPool shutdown completed.');
  }

  getActiveQueueLength() {
    return this.taskQueue.length;
  }

  getBusyWorkerCount() {
    return this.workers.filter((w) => w.busy).length;
  }

  getPoolSize() {
    return this.workers.length;
  }
}

// Export singleton instance of WorkerPool
export const workerPool = new WorkerPool();
export default workerPool;
