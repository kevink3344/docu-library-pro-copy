const PREFIX = 'kbb_dismissed_msgs_';

/**
 * Get the set of message IDs a guest has dismissed for a given org.
 * Stored in localStorage, scoped per organization.
 * @param {string} orgId
 * @returns {string[]}
 */
export function getGuestDismissed(orgId) {
  try {
    const raw = localStorage.getItem(PREFIX + orgId);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Record that a guest dismissed a message for a given org.
 * @param {string} orgId
 * @param {string} messageId
 */
export function addGuestDismissal(orgId, messageId) {
  const dismissed = getGuestDismissed(orgId);
  if (!dismissed.includes(messageId)) {
    dismissed.push(messageId);
    localStorage.setItem(PREFIX + orgId, JSON.stringify(dismissed));
  }
}

/**
 * Clear all guest dismissals for a given org.
 * @param {string} orgId
 */
export function clearGuestDismissals(orgId) {
  localStorage.removeItem(PREFIX + orgId);
}