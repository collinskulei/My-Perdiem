// This file patches the Handlebars type definitions to include HelperDelegate,
// which is expected by a dependency (dotprompt) but was removed in newer
// versions of Handlebars.

import 'handlebars';

declare module 'handlebars' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type HelperDelegate = (...args: any[]) => any;
}
