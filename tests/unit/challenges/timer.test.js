import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTimer, formatTime } from '../../../src/challenges/timer.js';

describe('formatTime', () => {
  it('formats 90 seconds as 1:30', () => {
    expect(formatTime(90)).toBe('1:30');
  });

  it('formats 65 seconds as 1:05 (zero-pads seconds)', () => {
    expect(formatTime(65)).toBe('1:05');
  });

  it('formats 9 seconds as 0:09 (zero-pads single digit)', () => {
    expect(formatTime(9)).toBe('0:09');
  });

  it('formats 0 seconds as 0:00', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('formats 3661 seconds as 1:01:01 (hours format)', () => {
    expect(formatTime(3661)).toBe('1:01:01');
  });

  it('formats 3600 seconds as 1:00:00', () => {
    expect(formatTime(3600)).toBe('1:00:00');
  });
});

describe('createTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls onTick every second after start', () => {
    const onTick = vi.fn();
    const timer = createTimer(1, { onTick, onComplete: vi.fn() });
    timer.start();

    vi.advanceTimersByTime(3000);
    expect(onTick).toHaveBeenCalledTimes(3);
  });

  it('passes correct values to onTick after first tick of 1-minute timer', () => {
    const onTick = vi.fn();
    const timer = createTimer(1, { onTick, onComplete: vi.fn() });
    timer.start();

    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalledTimes(1);

    const tickArg = onTick.mock.calls[0][0];
    expect(tickArg.minutes).toBe(0);
    expect(tickArg.seconds).toBe(59);
    expect(tickArg.remainingSeconds).toBe(59);
    // progress = (60 - 59) / 60 * 100 = 1.6667
    expect(tickArg.progress).toBeCloseTo(1.6667, 1);
  });

  it('calls onComplete when timer reaches zero', () => {
    const onComplete = vi.fn();
    const timer = createTimer(1, { onTick: vi.fn(), onComplete });
    timer.start();

    // 1 minute = 60 seconds = 60,000ms
    vi.advanceTimersByTime(60000);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('pause() stops the ticking', () => {
    const onTick = vi.fn();
    const timer = createTimer(1, { onTick, onComplete: vi.fn() });
    timer.start();

    vi.advanceTimersByTime(2000);
    expect(onTick).toHaveBeenCalledTimes(2);

    timer.pause();
    vi.advanceTimersByTime(3000);
    // Should still be 2 after pause
    expect(onTick).toHaveBeenCalledTimes(2);
  });

  it('resume() continues ticking after pause', () => {
    const onTick = vi.fn();
    const timer = createTimer(1, { onTick, onComplete: vi.fn() });
    timer.start();

    vi.advanceTimersByTime(2000); // 2 ticks
    timer.pause();
    vi.advanceTimersByTime(5000); // no ticks during pause
    timer.resume();
    vi.advanceTimersByTime(2000); // 2 more ticks

    expect(onTick).toHaveBeenCalledTimes(4);
  });

  it('calls onPause callback when pausing', () => {
    const onPause = vi.fn();
    const timer = createTimer(1, { onTick: vi.fn(), onComplete: vi.fn(), onPause });
    timer.start();

    vi.advanceTimersByTime(5000);
    timer.pause();
    expect(onPause).toHaveBeenCalledTimes(1);
    // Should receive remainingSeconds (60 - 5 = 55)
    expect(onPause).toHaveBeenCalledWith(55);
  });

  it('calls onResume callback when resuming', () => {
    const onResume = vi.fn();
    const timer = createTimer(1, { onTick: vi.fn(), onComplete: vi.fn(), onResume });
    timer.start();

    vi.advanceTimersByTime(5000);
    timer.pause();
    timer.resume();
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(onResume).toHaveBeenCalledWith(55);
  });

  it('stop() clears interval and allows restart', () => {
    const onTick = vi.fn();
    const timer = createTimer(1, { onTick, onComplete: vi.fn() });
    timer.start();

    vi.advanceTimersByTime(2000);
    timer.stop();
    vi.advanceTimersByTime(5000);
    expect(onTick).toHaveBeenCalledTimes(2);
  });

  it('getRemaining() returns remaining seconds', () => {
    const timer = createTimer(2, { onTick: vi.fn(), onComplete: vi.fn() });
    expect(timer.getRemaining()).toBe(120); // 2 minutes = 120 seconds

    timer.start();
    vi.advanceTimersByTime(10000);
    expect(timer.getRemaining()).toBe(110);
  });

  it('start() is idempotent (calling twice does not double intervals)', () => {
    const onTick = vi.fn();
    const timer = createTimer(1, { onTick, onComplete: vi.fn() });
    timer.start();
    timer.start(); // second call should be no-op

    vi.advanceTimersByTime(3000);
    expect(onTick).toHaveBeenCalledTimes(3); // not 6
  });
});
