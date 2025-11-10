// types/dotprompt-fix.d.ts

declare namespace Handlebars {
  // Add missing type expected by dotprompt
  export type HelperDelegate = (...args: any[]) => any;
}
