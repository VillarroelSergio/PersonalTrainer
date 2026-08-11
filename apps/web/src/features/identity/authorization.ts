export type OwnedResource = { id: string; ownerId: string };

/** Returns null for absent and foreign resources, preventing ownership disclosure. */
export function requireOwnedResource<T extends OwnedResource>(resource: T | undefined, authenticatedUserId: string): T | null {
  return resource?.ownerId === authenticatedUserId ? resource : null;
}
