export const reversePromiseState = async (promise: Promise<any>) => {
  let error = await promise.then(() => false).catch(() => true);
  return new Promise((rs: Function, rj: Function) => {
    if (error) {
      rs();
    } else {
      rj();
    }
  });
};
