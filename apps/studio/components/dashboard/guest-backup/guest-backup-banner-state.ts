/** Session storage: the reminder returns in each new browser session until the guest acts. */
export const GUEST_BACKUP_DISMISSED_KEY = "veriworkly:guest-backup-reminder:dismissed";

type DismissalStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * A guest's documents exist only in this browser, so once one is saved the guest is told so.
 * Not before the signed-in state is known (a signed-in user would see a flash of it), and
 * never for a signed-in user, whose documents sync.
 */
export function shouldShowGuestBackupBanner({
  authResolved,
  isLoggedIn,
  documentCount,
  dismissed,
}: {
  authResolved: boolean;
  isLoggedIn: boolean;
  documentCount: number;
  dismissed: boolean;
}) {
  return authResolved && !isLoggedIn && documentCount > 0 && !dismissed;
}

/**
 * A storage the browser refuses (private mode, blocked site data) reads as "not dismissed":
 * the reminder shows again, which is the safe side for data that lives only here.
 */
export function readGuestBackupDismissed(storage: () => DismissalStorage) {
  try {
    return storage().getItem(GUEST_BACKUP_DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * When the browser refuses the write, the banner still closes for this page and only comes
 * back on the next load, so there is nothing to report to the user.
 */
export function rememberGuestBackupDismissed(storage: () => DismissalStorage) {
  try {
    storage().setItem(GUEST_BACKUP_DISMISSED_KEY, "true");
  } catch {
    // See above: the in-memory dismissal already hid the banner.
  }
}
