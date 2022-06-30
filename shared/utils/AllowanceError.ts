export class AllowanceError extends Error {
  constructor() {
    super("Allowance must be greater or equal than the amount");
    Object.setPrototypeOf(this, AllowanceError.prototype);
  }
}
