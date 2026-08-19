import { World, IWorldOptions } from '@cucumber/cucumber';

export class GatewayWorld extends World {
  public result: unknown = undefined;
  public error: Error | undefined = undefined;

  constructor(options: IWorldOptions) {
    super(options);
  }

  setResult(value: unknown): void {
    this.result = value;
    this.error = undefined;
  }

  setError(error: Error): void {
    this.error = error;
    this.result = undefined;
  }
}
