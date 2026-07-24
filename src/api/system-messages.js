import { fetchApi } from './apiClient';

/**
 * Get active system-wide messages for an organization (public endpoint).
 * @param {string} orgId
 * @returns {Promise<Array>}
 */
export async function getActiveMessages(orgId) {
  return fetchApi(`/api/system-messages/org/${orgId}`);
}

/**
 * Get dismissed message IDs for the current authenticated user.
 * @param {string} orgId
 * @returns {Promise<string[]>}
 */
export async function getDismissedMessageIds(orgId) {
  return fetchApi(`/api/system-messages/org/${orgId}/dismissed`);
}

/**
 * Admin: Create a new system-wide message.
 * @param {Object} data - { org_id, title, text, pastel_color, is_dismissable }
 * @returns {Promise<Object>}
 */
export async function createMessage(data) {
  return fetchApi('/api/system-messages', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Admin: Update a system-wide message.
 * @param {string} id
 * @param {Object} data - { title?, text?, pastel_color?, is_dismissable?, is_active? }
 * @returns {Promise<Object>}
 */
export async function updateMessage(id, data) {
  return fetchApi(`/api/system-messages/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Admin: Soft-delete a system-wide message.
 * @param {string} id
 * @returns {Promise<null>}
 */
export async function deleteMessage(id) {
  return fetchApi(`/api/system-messages/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Authenticated user: Dismiss a system-wide message (persisted to DB).
 * @param {string} messageId
 * @returns {Promise<Object>}
 */
export async function dismissMessage(messageId) {
  return fetchApi(`/api/system-messages/${messageId}/dismiss`, {
    method: 'POST',
  });
}