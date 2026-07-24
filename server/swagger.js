/**
 * @openapi
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     Organization:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Primary key
 *         name:
 *           type: string
 *           description: Organization name
 *         description:
 *           type: string
 *         admin_user_ids:
 *           type: array
 *           items:
 *             type: string
 *           description: JSON array of admin user IDs
 *         slug:
 *           type: string
 *         is_active:
 *           type: boolean
 *           default: true
 *         created_date:
 *           type: string
 *           format: date-time
 *         updated_date:
 *           type: string
 *           format: date-time
 *         created_by_id:
 *           type: string
 *           format: uuid
 *       required:
 *         - name
 *       example:
 *         id: "550e8400-e29b-41d4-a716-446655440000"
 *         name: "Acme Corp"
 *         description: "Main organization"
 *         admin_user_ids: []
 *         slug: "acme-corp"
 *         is_active: true
 *         created_date: "2026-01-15T10:00:00.000Z"
 *         updated_date: "2026-01-15T10:00:00.000Z"
 *
 *     Location:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         org_id:
 *           type: string
 *           format: uuid
 *           description: FK → organizations.id
 *         name:
 *           type: string
 *         is_active:
 *           type: boolean
 *           default: true
 *         pinned:
 *           type: boolean
 *           default: false
 *         created_date:
 *           type: string
 *           format: date-time
 *         updated_date:
 *           type: string
 *           format: date-time
 *         created_by_id:
 *           type: string
 *           format: uuid
 *       required:
 *         - org_id
 *         - name
 *
 *     Department:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         org_id:
 *           type: string
 *           format: uuid
 *           description: FK → organizations.id
 *         name:
 *           type: string
 *         is_active:
 *           type: boolean
 *           default: true
 *         pinned:
 *           type: boolean
 *           default: false
 *         created_date:
 *           type: string
 *           format: date-time
 *         updated_date:
 *           type: string
 *           format: date-time
 *         created_by_id:
 *           type: string
 *           format: uuid
 *       required:
 *         - org_id
 *         - name
 *
 *     KBBDocument:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         org_id:
 *           type: string
 *           format: uuid
 *           description: FK → organizations.id
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         document_id:
 *           type: string
 *         link_url:
 *           type: string
 *         file_url:
 *           type: string
 *         file_type:
 *           type: string
 *           enum: [pdf, word, excel, google-doc, url]
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         location:
 *           type: array
 *           items:
 *             type: string
 *         department:
 *           type: array
 *           items:
 *             type: string
 *         renew_date:
 *           type: string
 *           format: date
 *         renew_notified_30:
 *           type: boolean
 *         renew_notified_7:
 *           type: boolean
 *         visibility:
 *           type: string
 *           enum: [everyone, teams]
 *         allowed_team_ids:
 *           type: array
 *           items:
 *             type: string
 *         creator_user_id:
 *           type: string
 *         custom_field_values:
 *           type: object
 *         is_archived:
 *           type: boolean
 *         created_date:
 *           type: string
 *           format: date-time
 *         updated_date:
 *           type: string
 *           format: date-time
 *         created_by_id:
 *           type: string
 *           format: uuid
 *       required:
 *         - org_id
 *         - title
 *
 *     CustomField:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         org_id:
 *           type: string
 *           format: uuid
 *           description: FK → organizations.id
 *         name:
 *           type: string
 *         input_type:
 *           type: string
 *           enum: [text-short, text-paragraph, single-select, multi-select]
 *         options:
 *           type: array
 *           items:
 *             type: string
 *         display_order:
 *           type: integer
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *         created_date:
 *           type: string
 *           format: date-time
 *         updated_date:
 *           type: string
 *           format: date-time
 *         created_by_id:
 *           type: string
 *           format: uuid
 *       required:
 *         - org_id
 *         - name
 *         - input_type
 *
 *     FieldConfig:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         org_id:
 *           type: string
 *           format: uuid
 *           description: FK → organizations.id (unique)
 *         hidden_required_fields:
 *           type: array
 *           items:
 *             type: string
 *         add_screen_order:
 *           type: array
 *           items:
 *             type: string
 *         view_screen_order:
 *           type: array
 *           items:
 *             type: string
 *         dashboard_columns:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *               label:
 *                 type: string
 *               display_mode:
 *                 type: string
 *         created_date:
 *           type: string
 *           format: date-time
 *         updated_date:
 *           type: string
 *           format: date-time
 *         created_by_id:
 *           type: string
 *           format: uuid
 *       required:
 *         - org_id
 *
 *     Team:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         org_id:
 *           type: string
 *           format: uuid
 *           description: FK → organizations.id
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         member_user_ids:
 *           type: array
 *           items:
 *             type: string
 *         created_date:
 *           type: string
 *           format: date-time
 *         updated_date:
 *           type: string
 *           format: date-time
 *         created_by_id:
 *           type: string
 *           format: uuid
 *       required:
 *         - org_id
 *         - name
 *
 *     OrgMember:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         org_id:
 *           type: string
 *           format: uuid
 *           description: FK → organizations.id
 *         user_id:
 *           type: string
 *           format: uuid
 *           description: FK → users.id
 *         role:
 *           type: string
 *           enum: [org_admin, team_member, standard_user]
 *         created_date:
 *           type: string
 *           format: date-time
 *         updated_date:
 *           type: string
 *           format: date-time
 *         created_by_id:
 *           type: string
 *           format: uuid
 *       required:
 *         - org_id
 *         - user_id
 *         - role
 *
 *     Notification:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         user_id:
 *           type: string
 *           format: uuid
 *           description: FK → users.id
 *         org_id:
 *           type: string
 *           format: uuid
 *           description: FK → organizations.id
 *         document_id:
 *           type: string
 *           format: uuid
 *           description: FK → kbb_documents.id
 *         type:
 *           type: string
 *           enum: [renewal_30, renewal_7, renewal_overdue]
 *         message:
 *           type: string
 *         is_read:
 *           type: boolean
 *         document_title:
 *           type: string
 *         created_date:
 *           type: string
 *           format: date-time
 *         updated_date:
 *           type: string
 *           format: date-time
 *         created_by_id:
 *           type: string
 *           format: uuid
 *       required:
 *         - user_id
 *         - type
 *         - message
 *
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         full_name:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         role:
 *           type: string
 *           enum: [user, admin]
 *         created_date:
 *           type: string
 *           format: date-time
 *         updated_date:
 *           type: string
 *           format: date-time
 *       required:
 *         - role
 *
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *
 *     HealthResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [ok, error]
 *         db:
 *           type: string
 *         message:
 *           type: string
 *
 *     InfoResponse:
 *       type: object
 *       properties:
 *         version:
 *           type: string
 *         loginModeOverride:
 *           type: string
 *           nullable: true
 *
 *     AuthLoginRequest:
 *       type: object
 *       required:
 *         - userId
 *       properties:
 *         userId:
 *           type: string
 *           format: uuid
 *         organizationId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *
 *     AuthLoginResponse:
 *       type: object
 *       properties:
 *         token:
 *           type: string
 *         user:
 *           $ref: '#/components/schemas/User'
 *         organizationId:
 *           type: string
 *           nullable: true
 *
 *     AuthLoginWithPasswordRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *
 *     SettingsGetResponse:
 *       type: object
 *       properties:
 *         key:
 *           type: string
 *         value:
 *           type: string
 *
 *     SettingsPutRequest:
 *       type: object
 *       required:
 *         - value
 *       properties:
 *         value:
 *           type: string
 *
 *     OrgMembersWithUsersResponse:
 *       type: array
 *       items:
 *         type: object
 *         properties:
 *           id:
 *             type: string
 *           full_name:
 *             type: string
 *           email:
 *             type: string
 *           role:
 *             type: string
 *           member_id:
 *             type: string
 *             nullable: true
 *           org_role:
 *             type: string
 *             nullable: true
 *
 *     AddOrgMemberRequest:
 *       type: object
 *       required:
 *         - orgId
 *         - form
 *       properties:
 *         orgId:
 *           type: string
 *           format: uuid
 *         form:
 *           type: object
 *           required:
 *             - full_name
 *             - email
 *             - role
 *           properties:
 *             full_name:
 *               type: string
 *             email:
 *               type: string
 *               format: email
 *             role:
 *               type: string
 *               enum: [org_admin, team_member, standard_user]
 *
 *     UpdateOrgMemberRequest:
 *       type: object
 *       required:
 *         - memberId
 *         - userId
 *         - data
 *       properties:
 *         memberId:
 *           type: string
 *           format: uuid
 *         userId:
 *           type: string
 *           format: uuid
 *         data:
 *           type: object
 *           properties:
 *             full_name:
 *               type: string
 *             email:
 *               type: string
 *               format: email
 *             role:
 *               type: string
 *               enum: [org_admin, team_member, standard_user]
 *
 *     RemoveOrgMemberRequest:
 *       type: object
 *       required:
 *         - memberId
 *       properties:
 *         memberId:
 *           type: string
 *           format: uuid
 *
 *     RpcGetOrgsForUserRequest:
 *       type: object
 *       properties:
 *         userId:
 *           type: string
 *           format: uuid
 *         userRole:
 *           type: string
 *
 *     RpcGetOrgMembersWithUsersRequest:
 *       type: object
 *       properties:
 *         orgId:
 *           type: string
 *           format: uuid
 *
 *     RpcAddOrgMemberRequest:
 *       type: object
 *       properties:
 *         orgId:
 *           type: string
 *           format: uuid
 *         form:
 *           type: object
 *           properties:
 *             full_name:
 *               type: string
 *             email:
 *               type: string
 *               format: email
 *             role:
 *               type: string
 *
 *     RpcAddExistingUserToOrgRequest:
 *       type: object
 *       properties:
 *         orgId:
 *           type: string
 *           format: uuid
 *         userId:
 *           type: string
 *           format: uuid
 *         role:
 *           type: string
 *
 *     RpcUpdateOrgMemberRequest:
 *       type: object
 *       properties:
 *         memberId:
 *           type: string
 *           format: uuid
 *         userId:
 *           type: string
 *           format: uuid
 *         data:
 *           type: object
 *           properties:
 *             full_name:
 *               type: string
 *             email:
 *               type: string
 *               format: email
 *             role:
 *               type: string
 *
 *     RpcRemoveOrgMemberRequest:
 *       type: object
 *       properties:
 *         memberId:
 *           type: string
 *           format: uuid
 */

export default {};