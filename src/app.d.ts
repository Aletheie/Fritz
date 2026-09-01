declare global {
  const FRITZ_APP_VERSION: string;

  namespace App {
    // oxlint-disable-next-line typescript/consistent-type-definitions -- SvelteKit augments Locals through interface merging.
    interface Locals {
      user?: {
        username: string;
      };
    }
  }
}

export type FritzAppTypes = never;
