import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../lib/auth.js';
import {
  listSettingsTabs,
  listVisibleSettingsTabs,
  createSettingsTab,
  updateSettingsTab,
  deleteSettingsTab,
  reorderSettingsTabs,
  updateTabSections,
} from '../settings-tabs.js';

export const settingsTabsRouter = Router();

// All routes require authentication + admin role
settingsTabsRouter.use(authenticateToken, requireAdmin);

/**
 * @openapi
 * /api/settings/tabs:
 *   get:
 *     summary: List settings tabs (filtered by user role)
 *     tags: [Settings Tabs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of tabs with sections
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
settingsTabsRouter.get('/tabs', async (req, res) => {
  try {
    const user = req.user;
    // Super Admin (admin) sees all tabs; Admin sees only visible_to = 'all'
    const tabs = await listVisibleSettingsTabs(user.role);
    res.json({ tabs });
  } catch (error) {
    console.error('Failed to list settings tabs.', error);
    res.status(500).json({ error: 'settings_tabs_list_failed' });
  }
});

/**
 * @openapi
 * /api/settings/tabs:
 *   post:
 *     summary: Create a new settings tab
 *     tags: [Settings Tabs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               slug: { type: string }
 *               visible_to: { type: string, enum: [all, super_admin] }
 *     responses:
 *       201:
 *         description: Tab created
 *       400:
 *         description: Invalid input
 *       409:
 *         description: Slug conflict
 */
settingsTabsRouter.post('/tabs', async (req, res) => {
  const { name, slug, visible_to } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'tab_name_required' });
    return;
  }
  if (typeof slug !== 'string' || !slug.trim()) {
    res.status(400).json({ error: 'tab_slug_required' });
    return;
  }
  if (visible_to !== 'all' && visible_to !== 'super_admin') {
    res.status(400).json({ error: 'invalid_visible_to', allowed: ['all', 'super_admin'] });
    return;
  }

  try {
    const tab = await createSettingsTab({ name: name.trim(), slug: slug.trim(), visible_to });
    if (!tab) {
      res.status(409).json({ error: 'tab_slug_conflict' });
      return;
    }
    // Return full tab list for verification
    const tabs = await listSettingsTabs();
    res.status(201).json({ tab, tabs });
  } catch (error) {
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('unique') || msg.includes('slug')) {
      res.status(409).json({ error: 'tab_slug_conflict' });
      return;
    }
    console.error('Failed to create settings tab.', error);
    res.status(500).json({ error: 'settings_tab_create_failed' });
  }
});

/**
 * @openapi
 * /api/settings/tabs/{tabId}:
 *   patch:
 *     summary: Update a settings tab
 *     tags: [Settings Tabs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tabId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               visible_to: { type: string, enum: [all, super_admin] }
 *     responses:
 *       200:
 *         description: Tab updated
 *       400:
 *         description: No valid fields to update
 *       404:
 *         description: Tab not found
 */
settingsTabsRouter.patch('/tabs/:tabId', async (req, res) => {
  const tabId = req.params.tabId;
  if (!tabId) {
    res.status(400).json({ error: 'invalid_tab_id' });
    return;
  }

  /** @type {{ name?: string; visible_to?: 'all' | 'super_admin' }} */
  const patch = {};
  if (typeof req.body?.name === 'string' && req.body.name.trim()) {
    patch.name = req.body.name.trim();
  }
  if (req.body?.visible_to === 'all' || req.body?.visible_to === 'super_admin') {
    patch.visible_to = req.body.visible_to;
  }

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: 'no_valid_fields_to_update' });
    return;
  }

  try {
    const tab = await updateSettingsTab(tabId, patch);
    if (!tab) {
      res.status(404).json({ error: 'tab_not_found' });
      return;
    }
    // Return full tab list for verification
    const tabs = await listSettingsTabs();
    res.json({ tab, tabs });
  } catch (error) {
    console.error('Failed to update settings tab.', error);
    res.status(500).json({ error: 'settings_tab_update_failed' });
  }
});

/**
 * @openapi
 * /api/settings/tabs/{tabId}:
 *   delete:
 *     summary: Delete a settings tab
 *     tags: [Settings Tabs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tabId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Tab deleted
 *       404:
 *         description: Tab not found
 */
settingsTabsRouter.delete('/tabs/:tabId', async (req, res) => {
  const tabId = req.params.tabId;
  if (!tabId) {
    res.status(400).json({ error: 'invalid_tab_id' });
    return;
  }

  try {
    const deleted = await deleteSettingsTab(tabId);
    if (!deleted) {
      res.status(404).json({ error: 'tab_not_found' });
      return;
    }
    // Return remaining tabs for verification
    const tabs = await listSettingsTabs();
    res.json({ deleted: true, tabs });
  } catch (error) {
    console.error('Failed to delete settings tab.', error);
    res.status(500).json({ error: 'settings_tab_delete_failed' });
  }
});

/**
 * @openapi
 * /api/settings/tabs/reorder:
 *   put:
 *     summary: Reorder settings tabs
 *     tags: [Settings Tabs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderedIds:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: Tabs reordered
 *       400:
 *         description: Invalid input
 */
settingsTabsRouter.put('/tabs/reorder', async (req, res) => {
  const orderedIds = req.body?.orderedIds;
  if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== 'string')) {
    res.status(400).json({ error: 'ordered_ids_array_required' });
    return;
  }

  try {
    const tabs = await reorderSettingsTabs(orderedIds);
    res.json({ tabs });
  } catch (error) {
    console.error('Failed to reorder settings tabs.', error);
    res.status(500).json({ error: 'settings_tabs_reorder_failed' });
  }
});

/**
 * @openapi
 * /api/settings/tabs/{tabId}/sections:
 *   put:
 *     summary: Replace sections in a tab
 *     tags: [Settings Tabs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tabId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sectionKeys:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: Sections updated
 *       400:
 *         description: Invalid input
 */
settingsTabsRouter.put('/tabs/:tabId/sections', async (req, res) => {
  const tabId = req.params.tabId;
  const sectionKeys = req.body?.sectionKeys;

  if (!tabId) {
    res.status(400).json({ error: 'invalid_tab_id' });
    return;
  }
  if (!Array.isArray(sectionKeys) || sectionKeys.some((k) => typeof k !== 'string')) {
    res.status(400).json({ error: 'section_keys_array_required' });
    return;
  }

  try {
    const sections = await updateTabSections(tabId, sectionKeys);
    // Return full tabs for verification
    const tabs = await listSettingsTabs();
    res.json({ sections, tabs });
  } catch (error) {
    const msg = error?.message || error?.toString?.() || 'unknown error';
    console.error('Failed to update tab sections for tabId=%s sectionKeys=%j — %s', tabId, sectionKeys, msg);
    res.status(500).json({ error: 'tab_sections_update_failed', detail: msg });
  }
});