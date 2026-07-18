import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Paginated loader for an entity (handles datasets larger than 500 records)
    const loadAll = async (entity, sort = '-created_date') => {
      const all = [];
      let skip = 0;
      while (true) {
        const batch = await base44.asServiceRole.entities[entity].list(sort, 500, skip);
        all.push(...batch);
        if (batch.length < 500) break;
        skip += 500;
      }
      return all;
    };

    const [orgs, users, locations, departments, documents, customFields, fieldConfigs, teams, orgMembers, notifications] = await Promise.all([
      loadAll('Organization'),
      loadAll('User'),
      loadAll('Location'),
      loadAll('Department'),
      loadAll('KBBDocument'),
      loadAll('CustomField', 'display_order'),
      loadAll('FieldConfig'),
      loadAll('Team'),
      loadAll('OrgMember'),
      loadAll('Notification'),
    ]);

    // ---- SQL helpers ----
    const q = (s) => (s === null || s === undefined) ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`;
    const j = (v, fallback = '[]') => (v === null || v === undefined) ? `'${fallback}'` : `'${JSON.stringify(v).replace(/'/g, "''")}'`;

    const parts = [];
    parts.push(`-- =====================================================================
-- KBB Portal — Data Import (SQLite / Turso)
-- Run AFTER applying schema.sql
-- Source: Base44 entity dump — generated ${new Date().toISOString().slice(0, 10)}
-- Strings use SQL single quotes; embedded apostrophes are doubled ('').
-- Arrays and objects are stored as JSON-encoded text.
-- =====================================================================

PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;
`);

    // --- Organizations ---
    parts.push(`-- organizations (${orgs.length} records)`);
    for (const r of orgs) {
      parts.push(`INSERT INTO organizations (id,name,description,admin_user_ids,slug,is_active,created_date,updated_date,created_by_id) VALUES (${q(r.id)},${q(r.name)},${q(r.description)},${j(r.admin_user_ids)},${q(r.slug)},${r.is_active ? 1 : 0},${q(r.created_date)},${q(r.updated_date)},${q(r.created_by_id)});`);
    }

    // --- Users ---
    parts.push(`-- users (${users.length} records)`);
    for (const r of users) {
      parts.push(`INSERT INTO users (id,full_name,email,role,created_date,updated_date) VALUES (${q(r.id)},${q(r.full_name)},${q(r.email)},${q(r.role)},${q(r.created_date)},${q(r.updated_date)});`);
    }

    // --- Org members ---
    parts.push(`-- org_members (${orgMembers.length} records)`);
    for (const r of orgMembers) {
      parts.push(`INSERT INTO org_members (id,org_id,user_id,role,created_date,updated_date,created_by_id) VALUES (${q(r.id)},${q(r.org_id)},${q(r.user_id)},${q(r.role)},${q(r.created_date)},${q(r.updated_date)},${q(r.created_by_id)});`);
    }

    // --- Locations ---
    parts.push(`-- locations (${locations.length} records)`);
    for (const r of locations) {
      parts.push(`INSERT INTO locations (id,org_id,name,is_active,pinned,created_date,updated_date,created_by_id) VALUES (${q(r.id)},${q(r.org_id)},${q(r.name)},${r.is_active ? 1 : 0},${r.pinned ? 1 : 0},${q(r.created_date)},${q(r.updated_date)},${q(r.created_by_id)});`);
    }

    // --- Departments ---
    parts.push(`-- departments (${departments.length} records)`);
    for (const r of departments) {
      parts.push(`INSERT INTO departments (id,org_id,name,is_active,pinned,created_date,updated_date,created_by_id) VALUES (${q(r.id)},${q(r.org_id)},${q(r.name)},${r.is_active ? 1 : 0},${r.pinned ? 1 : 0},${q(r.created_date)},${q(r.updated_date)},${q(r.created_by_id)});`);
    }

    // --- Teams ---
    parts.push(`-- teams (${teams.length} records)`);
    for (const r of teams) {
      parts.push(`INSERT INTO teams (id,org_id,name,description,member_user_ids,created_date,updated_date,created_by_id) VALUES (${q(r.id)},${q(r.org_id)},${q(r.name)},${q(r.description)},${j(r.member_user_ids)},${q(r.created_date)},${q(r.updated_date)},${q(r.created_by_id)});`);
    }

    // --- Custom fields ---
    parts.push(`-- custom_fields (${customFields.length} records)`);
    for (const r of customFields) {
      parts.push(`INSERT INTO custom_fields (id,org_id,name,input_type,options,display_order,status,created_date,updated_date,created_by_id) VALUES (${q(r.id)},${q(r.org_id)},${q(r.name)},${q(r.input_type)},${q(JSON.stringify(r.options || []))},${(r.display_order || 0)},${q(r.status)},${q(r.created_date)},${q(r.updated_date)},${q(r.created_by_id)});`);
    }

    // --- Field configs ---
    parts.push(`-- field_configs (${fieldConfigs.length} records)`);
    for (const r of fieldConfigs) {
      parts.push(`INSERT INTO field_configs (id,org_id,hidden_required_fields,add_screen_order,view_screen_order,dashboard_columns,created_date,updated_date,created_by_id) VALUES (${q(r.id)},${q(r.org_id)},${q(JSON.stringify(r.hidden_required_fields || []))},${q(JSON.stringify(r.add_screen_order || []))},${q(JSON.stringify(r.view_screen_order || []))},${q(JSON.stringify(r.dashboard_columns || []))},${q(r.created_date)},${q(r.updated_date)},${q(r.created_by_id)});`);
    }

    // --- KBB Documents ---
    parts.push(`-- kbb_documents (${documents.length} records)`);
    for (const r of documents) {
      parts.push(`INSERT INTO kbb_documents (id,org_id,title,description,document_id,link_url,file_url,file_type,tags,location,department,renew_date,renew_notified_30,renew_notified_7,visibility,allowed_team_ids,creator_user_id,custom_field_values,is_archived,created_date,updated_date,created_by_id) VALUES (${q(r.id)},${q(r.org_id)},${q(r.title)},${q(r.description)},${q(r.document_id)},${q(r.link_url)},${q(r.file_url)},${q(r.file_type)},${j(r.tags)},${j(r.location)},${j(r.department)},${q(r.renew_date)},${r.renew_notified_30 ? 1 : 0},${r.renew_notified_7 ? 1 : 0},${q(r.visibility)},${j(r.allowed_team_ids)},${q(r.creator_user_id)},${j(r.custom_field_values, '{}').replace(/^'\{/, "'{").replace(/\}'$/, "}'")},${r.is_archived ? 1 : 0},${q(r.created_date)},${q(r.updated_date)},${q(r.created_by_id)});`);
    }

    // --- Notifications ---
    parts.push(`-- notifications (${notifications.length} records)`);
    for (const r of notifications) {
      parts.push(`INSERT INTO notifications (id,user_id,org_id,document_id,type,message,is_read,document_title,created_date,updated_date,created_by_id) VALUES (${q(r.id)},${q(r.user_id)},${q(r.org_id)},${q(r.document_id)},${q(r.type)},${q(r.message)},${r.is_read ? 1 : 0},${q(r.document_title)},${q(r.created_date)},${q(r.updated_date)},${q(r.created_by_id)});`);
    }

    parts.push(`COMMIT;
PRAGMA foreign_keys = ON;`);

    const sqlContent = parts.join('\n');
    const blob = new Blob([sqlContent], { type: 'text/plain' });
    const file = new File([blob], 'data.sql', { type: 'text/plain' });
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });

    return Response.json({
      file_url,
      counts: {
        organizations: orgs.length,
        users: users.length,
        locations: locations.length,
        departments: departments.length,
        documents: documents.length,
        custom_fields: customFields.length,
        field_configs: fieldConfigs.length,
        teams: teams.length,
        org_members: orgMembers.length,
        notifications: notifications.length,
      },
      bytes: sqlContent.length,
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});