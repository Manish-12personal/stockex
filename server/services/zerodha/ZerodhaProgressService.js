/**
 * Zerodha Progress Service
 * 
 * Tracks and manages progress of long-running operations.
 * Follows SOLID principles with single responsibility for progress tracking.
 */

export class ZerodhaProgressService {
  constructor(loggerService) {
    this.loggerService = loggerService;
    this.jobs = new Map();
    this.jobTimeout = 3600000; // 1 hour
  }

  /**
   * Start a new job
   */
  startJob(jobId, config) {
    const job = {
      id: jobId,
      status: 'running',
      startTime: new Date(),
      endTime: null,
      progress: 0,
      currentStep: 0,
      totalSteps: config.totalSteps || 1,
      message: config.message || 'Job started',
      description: config.description || '',
      type: config.type || 'unknown',
      result: null,
      error: null,
      metadata: config.metadata || {}
    };

    this.jobs.set(jobId, job);
    
    // Set timeout to clean up old jobs
    setTimeout(() => {
      this.cleanupJob(jobId);
    }, this.jobTimeout);

    this.loggerService.info(`Job started: ${jobId}`, { type: job.type, description: job.description });
    
    return job;
  }

  /**
   * Update job progress
   */
  updateJob(jobId, updates) {
    const job = this.jobs.get(jobId);
    if (!job) {
      this.loggerService.warn(`Job not found: ${jobId}`);
      return null;
    }

    if (job.status !== 'running') {
      this.loggerService.warn(`Cannot update completed job: ${jobId}`);
      return job;
    }

    // Update job properties
    Object.assign(job, updates);

    // Calculate progress percentage
    if (updates.step !== undefined) {
      job.currentStep = updates.step;
      job.progress = (job.currentStep / job.totalSteps) * 100;
    }

    // Update timestamp
    job.lastUpdated = new Date();

    this.loggerService.info(`Job updated: ${jobId}`, {
      step: job.currentStep,
      progress: job.progress,
      message: job.message
    });

    return job;
  }

  /**
   * Update progress percentage
   */
  updateProgress(jobId, updates) {
    return this.updateJob(jobId, updates);
  }

  /**
   * Complete a job successfully
   */
  completeJob(jobId, result = null) {
    const job = this.jobs.get(jobId);
    if (!job) {
      this.loggerService.warn(`Job not found: ${jobId}`);
      return null;
    }

    job.status = 'completed';
    job.endTime = new Date();
    job.progress = 100;
    job.result = result;
    job.message = job.message || 'Job completed successfully';

    const duration = job.endTime - job.startTime;
    
    this.loggerService.info(`Job completed: ${jobId}`, {
      duration: `${duration}ms`,
      result: result ? 'success' : 'no result'
    });

    return job;
  }

  /**
   * Fail a job
   */
  failJob(jobId, error = null) {
    const job = this.jobs.get(jobId);
    if (!job) {
      this.loggerService.warn(`Job not found: ${jobId}`);
      return null;
    }

    job.status = 'failed';
    job.endTime = new Date();
    job.error = error;
    job.message = error?.message || 'Job failed';

    const duration = job.endTime - job.startTime;
    
    this.loggerService.error(`Job failed: ${jobId}`, {
      duration: `${duration}ms`,
      error: error?.message || 'Unknown error'
    });

    return job;
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId, reason = null) {
    const job = this.jobs.get(jobId);
    if (!job) {
      this.loggerService.warn(`Job not found: ${jobId}`);
      return null;
    }

    if (job.status === 'completed' || job.status === 'failed') {
      this.loggerService.warn(`Cannot cancel completed job: ${jobId}`);
      return job;
    }

    job.status = 'cancelled';
    job.endTime = new Date();
    job.error = reason ? new Error(reason) : null;
    job.message = reason || 'Job cancelled';

    this.loggerService.info(`Job cancelled: ${jobId}`, { reason });

    return job;
  }

  /**
   * Get job status
   */
  getJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }

    // Return a copy to prevent external modifications
    return { ...job };
  }

  /**
   * Get all jobs
   */
  getAllJobs() {
    const jobs = Array.from(this.jobs.values());
    
    // Return copies to prevent external modifications
    return jobs.map(job => ({ ...job }));
  }

  /**
   * Get running jobs
   */
  getRunningJobs() {
    const jobs = Array.from(this.jobs.values())
      .filter(job => job.status === 'running');
    
    return jobs.map(job => ({ ...job }));
  }

  /**
   * Get jobs by type
   */
  getJobsByType(type) {
    const jobs = Array.from(this.jobs.values())
      .filter(job => job.type === type);
    
    return jobs.map(job => ({ ...job }));
  }

  /**
   * Clean up old jobs
   */
  cleanupJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    // Don't clean up running jobs
    if (job.status === 'running') {
      // Extend timeout and check again later
      setTimeout(() => {
        this.cleanupJob(jobId);
      }, this.jobTimeout);
      return;
    }

    this.jobs.delete(jobId);
    this.loggerService.debug(`Cleaned up job: ${jobId}`);
  }

  /**
   * Clean up all old jobs
   */
  cleanupAllJobs() {
    const now = Date.now();
    const jobsToRemove = [];

    for (const [jobId, job] of this.jobs) {
      const age = now - job.startTime.getTime();
      
      // Remove completed/failed jobs older than timeout
      if (age > this.jobTimeout && job.status !== 'running') {
        jobsToRemove.push(jobId);
      }
    }

    jobsToRemove.forEach(jobId => {
      this.jobs.delete(jobId);
    });

    if (jobsToRemove.length > 0) {
      this.loggerService.info(`Cleaned up ${jobsToRemove.length} old jobs`);
    }

    return jobsToRemove.length;
  }

  /**
   * Get job statistics
   */
  getJobStats() {
    const jobs = Array.from(this.jobs.values());
    
    const stats = {
      total: jobs.length,
      running: jobs.filter(j => j.status === 'running').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      cancelled: jobs.filter(j => j.status === 'cancelled').length,
      byType: {},
      averageDuration: 0
    };

    // Calculate stats by type
    jobs.forEach(job => {
      if (!stats.byType[job.type]) {
        stats.byType[job.type] = { total: 0, running: 0, completed: 0, failed: 0 };
      }
      
      stats.byType[job.type].total++;
      stats.byType[job.type][job.status]++;
    });

    // Calculate average duration for completed jobs
    const completedJobs = jobs.filter(j => j.status === 'completed' && j.endTime);
    if (completedJobs.length > 0) {
      const totalDuration = completedJobs.reduce((sum, job) => sum + (job.endTime - job.startTime), 0);
      stats.averageDuration = totalDuration / completedJobs.length;
    }

    return stats;
  }

  /**
   * Create progress callback for external usage
   */
  createProgressCallback(jobId) {
    return (updates) => {
      this.updateJob(jobId, updates);
    };
  }

  /**
   * Check if job is still running
   */
  isJobRunning(jobId) {
    const job = this.jobs.get(jobId);
    return job && job.status === 'running';
  }

  /**
   * Wait for job completion
   */
  async waitForJob(jobId, options = {}) {
    const timeout = options.timeout || 300000; // 5 minutes default
    const interval = options.interval || 1000; // 1 second default
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkJob = () => {
        const job = this.getJob(jobId);
        
        if (!job) {
          reject(new Error(`Job not found: ${jobId}`));
          return;
        }

        if (job.status === 'completed') {
          resolve(job);
          return;
        }

        if (job.status === 'failed' || job.status === 'cancelled') {
          reject(new Error(job.error?.message || `Job ${job.status}`));
          return;
        }

        // Check timeout
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Job timeout after ${timeout}ms`));
          return;
        }

        // Continue checking
        setTimeout(checkJob, interval);
      };

      checkJob();
    });
  }
}
