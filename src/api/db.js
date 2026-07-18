import { fetchApi } from './apiClient';

const ENTITY_NAMES = [
  'Organization',
  'Location',
  'Department',
  'KBBDocument',
  'CustomField',
  'FieldConfig',
  'Team',
  'OrgMember',
  'Notification',
  'User',
];

function makeEntity(table) {
  return {
    async list() {
      return fetchApi(`/api/${table}`);
    },

    async filter(where = {}, sort = null, limit = null) {
      return fetchApi(`/api/${table}/filter`, {
        method: 'POST',
        body: JSON.stringify({ where, sort, limit }),
      });
    },

    async get(id) {
      return fetchApi(`/api/${table}/${id}`);
    },

    async create(data) {
      return fetchApi(`/api/${table}`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async update(id, data) {
      return fetchApi(`/api/${table}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async delete(id) {
      return fetchApi(`/api/${table}/${id}`, {
        method: 'DELETE',
      });
    },
  };
}

export const db = Object.fromEntries(ENTITY_NAMES.map(name => [name, makeEntity(name)]));

export async function getOrgsForUser(userId, userRole) {
  return fetchApi('/api/rpc/getOrgsForUser', {
    method: 'POST',
    body: JSON.stringify({ userId, userRole }),
  });
}

export async function getOrgMembersWithUsers(orgId) {
  return fetchApi('/api/rpc/getOrgMembersWithUsers', {
    method: 'POST',
    body: JSON.stringify({ orgId }),
  });
}

export async function addOrgMember(orgId, form) {
  return fetchApi('/api/rpc/addOrgMember', {
    method: 'POST',
    body: JSON.stringify({ orgId, form }),
  });
}

export async function addExistingUserToOrg(orgId, userId, role) {
  return fetchApi('/api/rpc/addExistingUserToOrg', {
    method: 'POST',
    body: JSON.stringify({ orgId, userId, role }),
  });
}

export async function updateOrgMember(memberId, userId, data) {
  return fetchApi('/api/rpc/updateOrgMember', {
    method: 'POST',
    body: JSON.stringify({ memberId, userId, data }),
  });
}

export async function removeOrgMember(memberId) {
  return fetchApi('/api/rpc/removeOrgMember', {
    method: 'POST',
    body: JSON.stringify({ memberId }),
  });
}
