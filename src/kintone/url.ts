// URL building with guest-space support (FR-4, FR-5, FR-7, EC-8). These
// functions are pure (they take pathname / ids as input) so they can be unit
// tested without a kintone runtime.

export interface GuestContext {
  // Path prefix used for record/app/view URLs: "/k" or "/k/guest/<spaceId>".
  prefix: string;
  // Guest space id when inside a guest space, otherwise null.
  spaceId: string | null;
}

/**
 * Derive the URL prefix from location.pathname. Guest space paths look like
 * `/k/guest/<spaceId>/...`; everything else uses `/k`.
 */
export function deriveGuestContext(pathname: string): GuestContext {
  const match = pathname.match(/^\/k\/guest\/(\d+)/);
  if (match) {
    return { prefix: `/k/guest/${match[1]}`, spaceId: match[1] };
  }
  return { prefix: "/k", spaceId: null };
}

export function appUrl(ctx: GuestContext, appId: string | number): string {
  return `${ctx.prefix}/${appId}/`;
}

export function viewUrl(
  ctx: GuestContext,
  appId: string | number,
  viewId: string | number,
): string {
  return `${ctx.prefix}/${appId}/?view=${viewId}`;
}

export function recordUrl(
  ctx: GuestContext,
  appId: string | number,
  recordId: string | number,
): string {
  return `${ctx.prefix}/${appId}/show#record=${recordId}`;
}

export function newRecordUrl(ctx: GuestContext, appId: string | number): string {
  return `${ctx.prefix}/${appId}/edit`;
}

/**
 * App settings (process flow) URL. In a guest space the prefix already carries
 * `/k/guest/<spaceId>`, so `${prefix}/admin/app/flow` produces the guest form.
 */
export function appSettingsUrl(ctx: GuestContext, appId: string | number): string {
  return `${ctx.prefix}/admin/app/flow?app=${appId}`;
}
