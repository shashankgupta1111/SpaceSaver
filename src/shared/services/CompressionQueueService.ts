import {MMKV} from 'react-native-mmkv';
import {CompressionOptions, CompressionResult} from '../../app/navigation/types';
import {CompressionService} from './CompressionService';
import {ForegroundServiceBridge} from './ForegroundServiceBridge';
import {HistoryService} from './HistoryService';
import {StorageService} from './StorageService';

const storage = new MMKV({id: 'compression-queue-storage'});
const QUEUE_JOBS_KEY = 'compression_queue_jobs';

export type QueueJobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'interrupted';

export interface QueueJob {
  id: string;
  name: string;
  type: 'image' | 'video';
  uris: string[];
  options: CompressionOptions;
  status: QueueJobStatus;
  progress: number; // 0 to 100
  completedFiles: number;
  totalFiles: number;
  currentFileName?: string;
  originalSizeBytes: number;
  actualOutputSizeBytes: number;
  actualSavedBytes: number;
  error?: string;
  results?: CompressionResult[];
  createdAt: number;
  completedAt?: number;
}

type QueueListener = (jobs: QueueJob[]) => void;

class CompressionQueueServiceClass {
  private isProcessing = false;
  private isPaused = false;
  private cancelCurrentToken = {cancelled: false};
  private listeners: Set<QueueListener> = new Set();

  constructor() {
    this.sanitizeInterruptedJobs();
  }

  /**
   * On startup, any jobs that were in 'processing' state are marked 'interrupted'
   * because the app process died or was killed mid-job.
   */
  private sanitizeInterruptedJobs(): void {
    const jobs = this.getJobs();
    let hasChanges = false;
    const sanitized = jobs.map(job => {
      if (job.status === 'processing') {
        hasChanges = true;
        return {
          ...job,
          status: 'interrupted' as QueueJobStatus,
          error: 'Process was interrupted by app close/restart',
        };
      }
      return job;
    });

    if (hasChanges) {
      this.saveJobs(sanitized);
    }
  }

  getJobs(): QueueJob[] {
    try {
      const raw = storage.getString(QUEUE_JOBS_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as QueueJob[];
    } catch {
      return [];
    }
  }

  private saveJobs(jobs: QueueJob[]): void {
    storage.set(QUEUE_JOBS_KEY, JSON.stringify(jobs));
    this.notifyListeners(jobs);
  }

  subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    listener(this.getJobs());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(jobs: QueueJob[]): void {
    this.listeners.forEach(l => {
      try {
        l(jobs);
      } catch {}
    });
  }

  /**
   * Enqueue a new compression job.
   */
  addJob(
    name: string,
    type: 'image' | 'video',
    uris: string[],
    options: CompressionOptions,
    originalSizeBytes: number,
    autoStart = true,
  ): QueueJob {
    const newJob: QueueJob = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      type,
      uris,
      options,
      status: 'pending',
      progress: 0,
      completedFiles: 0,
      totalFiles: uris.length,
      originalSizeBytes,
      actualOutputSizeBytes: 0,
      actualSavedBytes: 0,
      createdAt: Date.now(),
    };

    const jobs = this.getJobs();
    const updated = [newJob, ...jobs];
    this.saveJobs(updated);

    if (autoStart && !this.isProcessing && !this.isPaused) {
      this.processNext();
    }

    return newJob;
  }

  /**
   * Enqueue multiple jobs at once.
   */
  addBatchJobs(
    newJobsData: Array<{
      name: string;
      type: 'image' | 'video';
      uris: string[];
      options: CompressionOptions;
      originalSizeBytes: number;
    }>,
    autoStart = true,
  ): QueueJob[] {
    const created: QueueJob[] = newJobsData.map((d, index) => ({
      id: `${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
      name: d.name,
      type: d.type,
      uris: d.uris,
      options: d.options,
      status: 'pending',
      progress: 0,
      completedFiles: 0,
      totalFiles: d.uris.length,
      originalSizeBytes: d.originalSizeBytes,
      actualOutputSizeBytes: 0,
      actualSavedBytes: 0,
      createdAt: Date.now(),
    }));

    const jobs = this.getJobs();
    const updated = [...created, ...jobs];
    this.saveJobs(updated);

    if (autoStart && !this.isProcessing && !this.isPaused) {
      this.processNext();
    }

    return created;
  }

  /**
   * Starts or resumes processing the queue sequentially.
   */
  async startQueue(): Promise<void> {
    this.isPaused = false;
    if (!this.isProcessing) {
      await this.processNext();
    }
  }

  /**
   * Pauses the queue. The currently executing file will finish or pause on next iteration.
   */
  pauseQueue(): void {
    this.isPaused = true;
  }

  /**
   * Resumes the queue.
   */
  resumeQueue(): void {
    this.isPaused = false;
    if (!this.isProcessing) {
      this.processNext();
    }
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  getIsProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Cancels the active queue.
   */
  cancelQueue(): void {
    this.cancelCurrentToken.cancelled = true;
    this.isPaused = false;
    const jobs = this.getJobs().map(j => {
      if (j.status === 'pending' || j.status === 'processing') {
        return {...j, status: 'cancelled' as QueueJobStatus};
      }
      return j;
    });
    this.saveJobs(jobs);
    ForegroundServiceBridge.stopService();
    this.isProcessing = false;
  }

  /**
   * Cancel an individual job.
   */
  cancelJob(jobId: string): void {
    const jobs = this.getJobs();
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    if (job.status === 'processing') {
      this.cancelCurrentToken.cancelled = true;
    }

    const updated = jobs.map(j => {
      if (j.id === jobId) {
        return {...j, status: 'cancelled' as QueueJobStatus};
      }
      return j;
    });
    this.saveJobs(updated);
  }

  /**
   * Retry a failed, interrupted, or cancelled job.
   */
  retryJob(jobId: string): void {
    const jobs = this.getJobs();
    const updated = jobs.map(j => {
      if (j.id === jobId) {
        return {
          ...j,
          status: 'pending' as QueueJobStatus,
          progress: 0,
          completedFiles: 0,
          error: undefined,
          results: [],
        };
      }
      return j;
    });
    this.saveJobs(updated);

    if (!this.isProcessing && !this.isPaused) {
      this.processNext();
    }
  }

  /**
   * Retry all failed and interrupted jobs.
   */
  retryAllFailed(): void {
    const jobs = this.getJobs();
    const updated = jobs.map(j => {
      if (j.status === 'failed' || j.status === 'interrupted' || j.status === 'cancelled') {
        return {
          ...j,
          status: 'pending' as QueueJobStatus,
          progress: 0,
          completedFiles: 0,
          error: undefined,
          results: [],
        };
      }
      return j;
    });
    this.saveJobs(updated);

    if (!this.isProcessing && !this.isPaused) {
      this.processNext();
    }
  }

  /**
   * Removes completed, cancelled, or failed jobs from the queue history list.
   */
  clearCompleted(): void {
    const jobs = this.getJobs().filter(
      j => j.status === 'processing' || j.status === 'pending',
    );
    this.saveJobs(jobs);
  }

  /**
   * Delete an individual job from list.
   */
  deleteJob(jobId: string): void {
    const jobs = this.getJobs();
    const job = jobs.find(j => j.id === jobId);
    if (job?.status === 'processing') {
      this.cancelCurrentToken.cancelled = true;
    }
    const updated = jobs.filter(j => j.id !== jobId);
    this.saveJobs(updated);
  }

  /**
   * Main sequential processing loop.
   */
  private async processNext(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (!this.isPaused) {
        const jobs = this.getJobs();
        const pendingJob = jobs.find(j => j.id && j.status === 'pending');

        if (!pendingJob) {
          // No more pending jobs
          break;
        }

        // Process this job
        this.cancelCurrentToken = {cancelled: false};
        await this.executeJob(pendingJob.id);
      }
    } finally {
      this.isProcessing = false;
      await ForegroundServiceBridge.stopService();
    }
  }

  /**
   * Executes a single job file-by-file with progress and failure isolation.
   */
  private async executeJob(jobId: string): Promise<void> {
    let jobs = this.getJobs();
    const job = jobs.find(j => j.id === jobId);
    if (!job || job.status !== 'pending') return;

    // Mark job as processing
    this.updateJobState(jobId, {
      status: 'processing',
      progress: 0,
      completedFiles: 0,
    });

    await ForegroundServiceBridge.startService(job.uris.length);

    const results: CompressionResult[] = [];
    let hadError: string | undefined;

    for (let i = 0; i < job.uris.length; i++) {
      if (this.cancelCurrentToken.cancelled) {
        this.updateJobState(jobId, {status: 'cancelled'});
        return;
      }

      // Check if paused
      while (this.isPaused && !this.cancelCurrentToken.cancelled) {
        await new Promise<void>(resolve => setTimeout(() => resolve(), 250));
      }

      if (this.cancelCurrentToken.cancelled) {
        this.updateJobState(jobId, {status: 'cancelled'});
        return;
      }

      const uri = job.uris[i];
      const rawName = uri.split('/').pop()?.split('?')[0] ?? 'file';

      const fileBaseProgress = (i / job.uris.length) * 100;
      this.updateJobState(jobId, {
        currentFileName: rawName,
        completedFiles: i,
        progress: Math.round(fileBaseProgress),
      });

      try {
        await ForegroundServiceBridge.updateProgress(
          Math.round(fileBaseProgress),
          rawName,
          i,
          job.uris.length,
        );

        const result =
          job.type === 'image'
            ? await CompressionService.compressImage(
                uri,
                job.options,
                progress => {
                  const currentFilePct = (progress / job.uris.length) * 100;
                  const totalPct = Math.min(99, Math.round(fileBaseProgress + currentFilePct));
                  this.updateJobState(jobId, {progress: totalPct});
                  ForegroundServiceBridge.updateProgress(
                    totalPct,
                    rawName,
                    i,
                    job.uris.length,
                  );
                },
                this.cancelCurrentToken,
              )
            : await CompressionService.compressVideo(
                uri,
                job.options,
                progress => {
                  const currentFilePct = (progress / job.uris.length) * 100;
                  const totalPct = Math.min(99, Math.round(fileBaseProgress + currentFilePct));
                  this.updateJobState(jobId, {progress: totalPct});
                  ForegroundServiceBridge.updateProgress(
                    totalPct,
                    rawName,
                    i,
                    job.uris.length,
                  );
                },
                this.cancelCurrentToken,
              );

        results.push(result);
        StorageService.recordSaving(result.savedBytes);
      } catch (err) {
        if ((err as Error).message === 'CANCELLED' || this.cancelCurrentToken.cancelled) {
          this.updateJobState(jobId, {status: 'cancelled'});
          return;
        }
        // One failed file does not destroy the rest of the queue
        hadError = (err as Error).message || 'Compression failed on item';
      }
    }

    const totalSavedBytes = results.reduce((acc, r) => acc + r.savedBytes, 0);
    const totalOutputBytes = results.reduce((acc, r) => acc + r.compressedSize, 0);

    // Save to history if any items succeeded
    if (results.length > 0) {
      HistoryService.addBatch(
        results.map(r => ({...r, saveOption: 'new' as const})),
      );
    }

    if (results.length === 0 && hadError) {
      // Entire job failed
      this.updateJobState(jobId, {
        status: 'failed',
        error: hadError,
        progress: 0,
        completedFiles: 0,
      });
    } else {
      // Job completed (fully or partially)
      this.updateJobState(jobId, {
        status: 'completed',
        progress: 100,
        completedFiles: results.length,
        actualOutputSizeBytes: totalOutputBytes,
        actualSavedBytes: totalSavedBytes,
        results,
        completedAt: Date.now(),
        error: hadError ? `Completed with warning: ${hadError}` : undefined,
      });
    }
  }

  private updateJobState(jobId: string, update: Partial<QueueJob>): void {
    const jobs = this.getJobs();
    const updated = jobs.map(j => {
      if (j.id === jobId) {
        return {...j, ...update};
      }
      return j;
    });
    this.saveJobs(updated);
  }
}

export const CompressionQueueService = new CompressionQueueServiceClass();
