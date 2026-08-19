export abstract class GatewayError extends Error {
  abstract readonly code: string;
  abstract readonly category: 'compiler' | 'runtime';

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
