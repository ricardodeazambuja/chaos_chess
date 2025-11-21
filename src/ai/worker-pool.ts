/**
 * Worker Pool Manager for Parallel Minimax Search
 *
 * Manages a pool of Web Workers to evaluate chess moves in parallel,
 * distributing work across CPU cores for significant performance improvements.
 */

import type { Board, Move, LastMove } from '../chess-logic';
// @ts-ignore - Vite worker import
import MinimaxWorker from './minimax.worker.ts?worker';

interface WorkerTask {
  id: string;
  resolve: (results: Array<{ move: Move; score: number }>) => void;
  reject: (error: Error) => void;
}

export class WorkerPool {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private pendingTasks: Map<string, WorkerTask> = new Map();
  private poolSize: number;

  constructor(poolSize: number = navigator.hardwareConcurrency || 4) {
    this.poolSize = Math.min(poolSize, 8); // Cap at 8 workers
    this.initialize();
  }

  private initialize() {
    console.log(`[WorkerPool] Initializing pool with ${this.poolSize} workers`);

    for (let i = 0; i < this.poolSize; i++) {
      const worker = new MinimaxWorker();

      worker.addEventListener('message', (event) => {
        const { id, results, error } = event.data;
        console.log(`[WorkerPool] Worker message received for task ${id}, results: ${results?.length}, error: ${error}`);

        const task = this.pendingTasks.get(id);
        if (task) {
          console.log(`[WorkerPool] Task found, resolving with ${results?.length} results`);
          this.pendingTasks.delete(id);
          this.availableWorkers.push(worker);

          if (error) {
            console.error(`[WorkerPool] Task ${id} failed:`, error);
            task.reject(new Error(error));
          } else {
            console.log(`[WorkerPool] Task ${id} succeeded, resolving promise`);
            task.resolve(results);
          }
        } else {
          console.warn(`[WorkerPool] Received message for unknown task ${id}`);
        }
      });

      worker.addEventListener('error', (event) => {
        console.error('[WorkerPool] Worker error:', event);
        // Find and reject any pending task for this worker
        for (const [id, task] of this.pendingTasks) {
          task.reject(new Error(`Worker error: ${event.message}`));
          this.pendingTasks.delete(id);
        }
      });

      this.workers.push(worker);
      this.availableWorkers.push(worker);
    }
  }

  /**
   * Evaluate moves in parallel across the worker pool
   *
   * @param moves All moves to evaluate
   * @param board Current board state
   * @param aiColor AI color
   * @param lastMove Last move made
   * @param searchDepth Search depth
   * @param gameMode Game mode
   * @param isPointsGame Whether this is a points-based game
   * @param playerScores Current scores
   * @param targetScore Target score to win
   * @param currentPlayerIndex AI player index
   * @returns Array of move evaluations with scores
   */
  async evaluateMovesParallel(
    moves: Move[],
    board: Board,
    aiColor: 'white' | 'black',
    lastMove: LastMove | null,
    searchDepth: number,
    gameMode?: 'rotating' | 'random' | 'normie',
    isPointsGame?: boolean,
    playerScores?: number[],
    targetScore?: number,
    currentPlayerIndex?: number
  ): Promise<Array<{ move: Move; score: number }>> {
    const parallelStartTime = performance.now();

    if (moves.length === 0) {
      return [];
    }

    // If very few moves, just use one worker
    if (moves.length <= 3) {
      console.log(`[WorkerPool] Only ${moves.length} moves - using single worker`);
      return this.evaluateBatch(moves, board, aiColor, lastMove, searchDepth, gameMode, isPointsGame, playerScores, targetScore, currentPlayerIndex);
    }

    // Distribute moves across workers
    const movesPerWorker = Math.ceil(moves.length / this.poolSize);
    const batches: Move[][] = [];

    for (let i = 0; i < moves.length; i += movesPerWorker) {
      batches.push(moves.slice(i, i + movesPerWorker));
    }

    console.log(`[WorkerPool] 🚀 PARALLEL MODE: ${moves.length} moves → ${batches.length} workers (${movesPerWorker} moves/worker, depth ${searchDepth})`);

    // Evaluate all batches in parallel - track individual times
    const batchTimings: number[] = [];
    const batchPromises = batches.map((batch, index) => {
      console.log(`[WorkerPool] Worker ${index + 1}: Assigned ${batch.length} moves`);
      const startTime = performance.now();
      return this.evaluateBatch(batch, board, aiColor, lastMove, searchDepth, gameMode, isPointsGame, playerScores, targetScore, currentPlayerIndex)
        .then(result => {
          const batchTime = performance.now() - startTime;
          batchTimings.push(batchTime);
          console.log(`[WorkerPool] Worker ${index + 1}: Completed in ${batchTime.toFixed(0)}ms`);
          return result;
        });
    });

    const results = await Promise.all(batchPromises);

    const parallelTime = performance.now() - parallelStartTime;
    const sequentialTime = batchTimings.reduce((a, b) => a + b, 0);
    const speedup = (sequentialTime / parallelTime).toFixed(2);

    console.log(`[WorkerPool] ✅ PARALLEL: ${parallelTime.toFixed(0)}ms | Sequential would be: ${sequentialTime.toFixed(0)}ms | Speedup: ${speedup}x`);

    // Flatten results from all workers
    return results.flat();
  }

  private evaluateBatch(
    moves: Move[],
    board: Board,
    aiColor: 'white' | 'black',
    lastMove: LastMove | null,
    searchDepth: number,
    gameMode?: 'rotating' | 'random' | 'normie',
    isPointsGame?: boolean,
    playerScores?: number[],
    targetScore?: number,
    currentPlayerIndex?: number
  ): Promise<Array<{ move: Move; score: number }>> {
    return new Promise((resolve, reject) => {
      const id = `task_${Date.now()}_${Math.random()}`;

      // Wait for an available worker
      const waitForWorker = () => {
        if (this.availableWorkers.length > 0) {
          const worker = this.availableWorkers.pop()!;

          this.pendingTasks.set(id, { id, resolve, reject });

          worker.postMessage({
            id,
            moves,
            board,
            aiColor,
            lastMove,
            searchDepth,
            gameMode,
            isPointsGame,
            playerScores,
            targetScore,
            currentPlayerIndex,
          });
        } else {
          // No workers available, try again in 10ms
          setTimeout(waitForWorker, 10);
        }
      };

      waitForWorker();
    });
  }

  /**
   * Terminate all workers and clean up
   */
  terminate() {
    console.log('[WorkerPool] Terminating all workers');
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.availableWorkers = [];
    this.pendingTasks.clear();
  }
}

// Singleton instance for the app
let globalWorkerPool: WorkerPool | null = null;

export function getWorkerPool(): WorkerPool {
  if (!globalWorkerPool) {
    globalWorkerPool = new WorkerPool();
  }
  return globalWorkerPool;
}

export function terminateWorkerPool() {
  if (globalWorkerPool) {
    globalWorkerPool.terminate();
    globalWorkerPool = null;
  }
}
