export class CommonUtils {
  static getLastElement<T>(arr: T[]): T | undefined {
    if (!arr.length) {
      return undefined;
    }
    return arr[arr.length - 1];
  }
}
