import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Use service role for scheduled/system operations
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allDocs = await base44.asServiceRole.entities.KBBDocument.list();
    const docsWithRenew = allDocs.filter(d => d.renew_date);

    const notifications = [];

    for (const doc of docsWithRenew) {
      const renewDate = new Date(doc.renew_date);
      renewDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.round((renewDate - today) / (1000 * 60 * 60 * 24));

      // Get the org admins for this document
      const orgs = await base44.asServiceRole.entities.Organization.filter({ id: doc.org_id });
      const org = orgs[0];
      const recipientIds = new Set();

      // Add document creator
      if (doc.creator_user_id) recipientIds.add(doc.creator_user_id);

      // Add org admins
      if (org?.admin_user_ids) {
        org.admin_user_ids.forEach(id => recipientIds.add(id));
      }

      const createNotifs = async (type, message, updateFlag) => {
        const flagField = type === 'renewal_30' ? 'renew_notified_30' : 'renew_notified_7';
        if (doc[flagField]) return; // already sent

        for (const userId of recipientIds) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: userId,
            org_id: doc.org_id,
            document_id: doc.id,
            document_title: doc.title,
            type,
            message,
            is_read: false,
          });
        }

        await base44.asServiceRole.entities.KBBDocument.update(doc.id, { [flagField]: true });

        // Send email via Core integration
        for (const userId of recipientIds) {
          const users = await base44.asServiceRole.entities.User.filter({ id: userId });
          const user = users[0];
          if (user?.email) {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: user.email,
              subject: `[KBB Pro] Document Renewal: ${doc.title}`,
              body: `Hello ${user.full_name || ''},\n\n${message}\n\nDocument: ${doc.title}\nRenew By: ${doc.renew_date}\n\nPlease log in to KBB Pro to review and renew this document.\n\nKBB Pro`
            });
          }
        }
      };

      if (daysUntil === 30) {
        await createNotifs('renewal_30', `Document "${doc.title}" is due for renewal in 30 days.`, 'renew_notified_30');
      } else if (daysUntil === 7) {
        await createNotifs('renewal_7', `Document "${doc.title}" is due for renewal in 7 days.`, 'renew_notified_7');
      } else if (daysUntil < 0 && daysUntil > -2) {
        await createNotifs('renewal_overdue', `Document "${doc.title}" is overdue for renewal.`, 'renew_notified_7');
      }
    }

    return Response.json({ success: true, processed: docsWithRenew.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});