export function tryCatchException<
  T extends new (...args: any[]) => Error,
  K extends (...args: any[]) => any
>(func: K, args: any[], exception: T): InstanceType<T> | never | ReturnType<K> {
  try {
    return func(...args);
  } catch (err) {
    if (err instanceof exception) {
      return err as InstanceType<T>;
    }
    throw err;
  }
}
