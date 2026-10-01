/**
 * Question-bank steps. Each is written against the draft API in the
 * overhaul plan (fabric.draft, moves, holes, fill, plan) and stays pending
 * until the phase that delivers it lands. A pending step fails its
 * scenario, so the bank count only rises when the system can really answer.
 */
import { Given, When, Then } from '@cucumber/cucumber';

const PENDING = 'pending';

Given('a fabric over the recorded Tranquility fixture', () => PENDING);
Given('the example incursions pack is installed', () => PENDING);
Given('I am a character with the scope {string}', (_scope: string) => PENDING);
Given('I am a character without the scope {string}', (_scope: string) => PENDING);
Given('a weave exported from Q3 by another fabric', () => PENDING);

When('I start a draft from the type {string}', (_name: string) => PENDING);
When('I start a draft from the system {string}', (_name: string) => PENDING);
When('I start a draft from {string}', (_subject: string) => PENDING);
When('I start a draft from my character', () => PENDING);
When('I apply the move {string}', (_move: string) => PENDING);
When('I fill the hole {string} with {string}', (_hole: string, _value: string) => PENDING);
When('I run the draft', () => PENDING);
When('I import the weave', () => PENDING);

Then('the draft has no holes', () => PENDING);
Then('the plan has {int} steps', (_n: number) => PENDING);
Then('the plan makes {int} ESI call', (_n: number) => PENDING);
Then('the plan needs no scopes', () => PENDING);
Then('the plan reports a per-item step with a call count', () => PENDING);
Then('the plan runs the two order lookups in parallel', () => PENDING);
Then('the answer names a solar system with a security status', () => PENDING);
Then('the answer is an ISK amount', () => PENDING);
Then('the answer has a jump count and a security status', () => PENDING);
Then('the answer is a list of solar systems', () => PENDING);
Then('the answer is a list of market orders', () => PENDING);
Then('the move {string} is unavailable for want of {string}', (_m: string, _s: string) => PENDING);
Then('the move {string} is offered', (_move: string) => PENDING);
