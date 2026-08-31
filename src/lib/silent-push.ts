/** Silent FCM di layout publik hanya untuk yang sudah grant izin. */
export function shouldMountSilentPush(
  permission: string | undefined,
): boolean {
  return permission === "granted";
}
