type Task = () => void;

/**
 * 每隔 interval 毫秒重复执行 task，运行总时长不超过 duration（可选）。
 *
 * @param task      要执行的函数
 * @param interval  重复间隔，单位毫秒
 * @param duration  （可选）任务总时长，单位毫秒；若不传则无限循环
 * @returns         一个停止任务的函数
 */
export function repeatTask(
  task: Task,
  interval: number,
  duration?: number,
): () => void {
  // 1. 先启动一个 interval
  const timerId = window.setInterval(task, interval);

  // 2. 如果指定了 duration，就设一个 timeout，到时清理 interval
  let timeoutId: number | undefined;
  if (duration !== undefined) {
    timeoutId = window.setTimeout(() => {
      window.clearInterval(timerId);
    }, duration);
  }

  // 3. 返回一个 stop 函数，同时清理两者
  return () => {
    window.clearInterval(timerId);
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  };
}
