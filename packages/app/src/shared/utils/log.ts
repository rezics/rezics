export const log = <I extends any[], R, F extends (...any: I) => R>(
  name: string,
  fn: F,
): F =>
  ((...params: I) => {
    const result = fn(...params);
    (async () => {
      console.log(`${name} = ${await result}`);
    })();
    return result;
  }) as F;
