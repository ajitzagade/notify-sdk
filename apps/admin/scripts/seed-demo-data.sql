-- Demo/review data for the AZentis tenant (88dd8003-c92e-4bb1-a9b0-9eeb3fb9cc02).
-- Purely for exercising the admin console & tenant portal UI with realistic
-- volumes: contacts with tags, a broadcast list, a completed + a draft
-- campaign, a week of message logs across every status, inbound replies, and
-- open/closed conversations. Idempotent: every row has a fixed UUID and
-- ON CONFLICT DO NOTHING, so re-running is a no-op.
--
--   PGPASSWORD=notify psql -h localhost -p 5434 -U notify -d notify_sdk -f apps/admin/scripts/seed-demo-data.sql

\set tenant '88dd8003-c92e-4bb1-a9b0-9eeb3fb9cc02'

-- ── Contacts ────────────────────────────────────────────────────────────────
INSERT INTO contacts (id, tenant_id, phone, name, tags) VALUES
  ('d0000000-0000-4000-8000-000000000001', :'tenant', '919876543210', 'Priya Sharma',   '{vip}'),
  ('d0000000-0000-4000-8000-000000000002', :'tenant', '919123456789', 'Rahul Verma',    '{vip,wholesale}'),
  ('d0000000-0000-4000-8000-000000000003', :'tenant', '919812345670', 'Ananya Iyer',    '{trial-expiring}'),
  ('d0000000-0000-4000-8000-000000000004', :'tenant', '919900112233', 'Vikram Singh',   '{wholesale}'),
  ('d0000000-0000-4000-8000-000000000005', :'tenant', '918877665544', 'Meera Krishnan', '{vip}'),
  ('d0000000-0000-4000-8000-000000000006', :'tenant', '917788990011', 'Arjun Nair',     '{}'),
  ('d0000000-0000-4000-8000-000000000007', :'tenant', '916655443322', 'Sneha Patil',    '{trial-expiring}'),
  ('d0000000-0000-4000-8000-000000000008', :'tenant', '915544332211', 'Karan Malhotra', '{wholesale}')
ON CONFLICT DO NOTHING;

-- Everyone except Karan is opted in (he's the "skipped" case in campaign runs).
INSERT INTO notify_preferences (tenant_id, phone, opted_in)
SELECT :'tenant', phone, phone <> '915544332211'
FROM contacts WHERE tenant_id = :'tenant'
ON CONFLICT DO NOTHING;

-- ── Broadcast list ──────────────────────────────────────────────────────────
INSERT INTO broadcast_lists (id, tenant_id, name, description) VALUES
  ('b0000000-0000-4000-8000-000000000001', :'tenant', 'VIP customers', 'High-value repeat buyers')
ON CONFLICT DO NOTHING;

INSERT INTO broadcast_list_members (list_id, contact_id)
SELECT 'b0000000-0000-4000-8000-000000000001', id
FROM contacts WHERE tenant_id = :'tenant'
ON CONFLICT DO NOTHING;

-- ── Campaigns: one completed (with live stats via notify_log), one draft ────
INSERT INTO campaigns (id, tenant_id, name, broadcast_list_id, hsm_template_name, hsm_language, hsm_params, status, broadcast_id, created_at, completed_at) VALUES
  ('ca000000-0000-4000-8000-000000000001', :'tenant', 'July flash sale', 'b0000000-0000-4000-8000-000000000001',
   'summer_promo_2026', 'en', '["40%"]', 'completed', 'bc000000-0000-4000-8000-000000000001',
   NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '4 minutes'),
  ('ca000000-0000-4000-8000-000000000002', :'tenant', 'Monsoon collection teaser', 'b0000000-0000-4000-8000-000000000001',
   'new_arrivals', 'en', '[]', 'draft', NULL, NOW() - INTERVAL '1 day', NULL)
ON CONFLICT DO NOTHING;

-- ── Message log: campaign sends (3 days ago) + a week of ad-hoc sends ───────
INSERT INTO notify_log (id, tenant_id, to_phone, template, status, wa_message_id, sent_at, delivered_at, read_at, error_message, meta, body_preview, created_at) VALUES
  -- July flash sale broadcast: 5 read, 1 delivered, 1 sent, 1 failed
  ('a0000000-0000-4000-8000-000000000001', :'tenant', '919876543210', 'summer_promo_2026', 'read',      'wamid.demo001', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '2 minutes', NOW() - INTERVAL '3 days' + INTERVAL '11 minutes', NULL, '{"broadcastId":"bc000000-0000-4000-8000-000000000001"}', 'Flash sale: 40% off everything this weekend only 🎉', NOW() - INTERVAL '3 days'),
  ('a0000000-0000-4000-8000-000000000002', :'tenant', '919123456789', 'summer_promo_2026', 'read',      'wamid.demo002', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '1 minute',  NOW() - INTERVAL '3 days' + INTERVAL '25 minutes', NULL, '{"broadcastId":"bc000000-0000-4000-8000-000000000001"}', 'Flash sale: 40% off everything this weekend only 🎉', NOW() - INTERVAL '3 days'),
  ('a0000000-0000-4000-8000-000000000003', :'tenant', '919812345670', 'summer_promo_2026', 'read',      'wamid.demo003', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '3 minutes', NOW() - INTERVAL '3 days' + INTERVAL '2 hours',    NULL, '{"broadcastId":"bc000000-0000-4000-8000-000000000001"}', 'Flash sale: 40% off everything this weekend only 🎉', NOW() - INTERVAL '3 days'),
  ('a0000000-0000-4000-8000-000000000004', :'tenant', '919900112233', 'summer_promo_2026', 'read',      'wamid.demo004', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '5 minutes', NOW() - INTERVAL '2 days',                        NULL, '{"broadcastId":"bc000000-0000-4000-8000-000000000001"}', 'Flash sale: 40% off everything this weekend only 🎉', NOW() - INTERVAL '3 days'),
  ('a0000000-0000-4000-8000-000000000005', :'tenant', '918877665544', 'summer_promo_2026', 'read',      'wamid.demo005', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '2 minutes', NOW() - INTERVAL '3 days' + INTERVAL '40 minutes', NULL, '{"broadcastId":"bc000000-0000-4000-8000-000000000001"}', 'Flash sale: 40% off everything this weekend only 🎉', NOW() - INTERVAL '3 days'),
  ('a0000000-0000-4000-8000-000000000006', :'tenant', '917788990011', 'summer_promo_2026', 'delivered', 'wamid.demo006', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '8 minutes', NULL, NULL, '{"broadcastId":"bc000000-0000-4000-8000-000000000001"}', 'Flash sale: 40% off everything this weekend only 🎉', NOW() - INTERVAL '3 days'),
  ('a0000000-0000-4000-8000-000000000007', :'tenant', '916655443322', 'summer_promo_2026', 'sent',      'wamid.demo007', NOW() - INTERVAL '3 days', NULL, NULL, NULL, '{"broadcastId":"bc000000-0000-4000-8000-000000000001"}', 'Flash sale: 40% off everything this weekend only 🎉', NOW() - INTERVAL '3 days'),
  ('a0000000-0000-4000-8000-000000000008', :'tenant', '915544332211', 'summer_promo_2026', 'failed',    NULL,            NOW() - INTERVAL '3 days', NULL, NULL, 'Recipient has not opted in', '{"broadcastId":"bc000000-0000-4000-8000-000000000001"}', 'Flash sale: 40% off everything this weekend only 🎉', NOW() - INTERVAL '3 days'),
  -- Ad-hoc transactional sends over the past week
  ('a0000000-0000-4000-8000-000000000011', :'tenant', '919876543210', 'order_update', 'read',      'wamid.demo011', NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days' + INTERVAL '1 minute', NOW() - INTERVAL '6 days' + INTERVAL '9 minutes', NULL, '{}', 'Your order #4821 has shipped 📦 Track: https://azentis.example/t/4821', NOW() - INTERVAL '6 days'),
  ('a0000000-0000-4000-8000-000000000012', :'tenant', '919123456789', 'otp',          'read',      'wamid.demo012', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '30 seconds', NOW() - INTERVAL '5 days' + INTERVAL '1 minute', NULL, '{}', 'Your verification code is 482913. Valid for 10 minutes.', NOW() - INTERVAL '5 days'),
  ('a0000000-0000-4000-8000-000000000013', :'tenant', '919812345670', 'payment_reminder', 'delivered', 'wamid.demo013', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '4 minutes', NULL, NULL, '{}', 'Reminder: invoice INV-2207 (₹12,400) is due this Friday.', NOW() - INTERVAL '2 days'),
  ('a0000000-0000-4000-8000-000000000014', :'tenant', '918877665544', 'order_update', 'read',      'wamid.demo014', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '2 minutes', NOW() - INTERVAL '1 day' + INTERVAL '15 minutes', NULL, '{}', 'Good news — your order #4839 is out for delivery today 🚚', NOW() - INTERVAL '1 day'),
  ('a0000000-0000-4000-8000-000000000015', :'tenant', '917788990011', 'welcome',      'delivered', 'wamid.demo015', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours' + INTERVAL '1 minute', NULL, NULL, '{}', 'Welcome to AZentis! Reply START anytime to get updates.', NOW() - INTERVAL '5 hours'),
  ('a0000000-0000-4000-8000-000000000016', :'tenant', '919900112233', 'payment_reminder', 'failed', NULL,           NOW() - INTERVAL '3 hours', NULL, NULL, 'Message failed to send: recipient phone unreachable (131026)', '{}', 'Reminder: invoice INV-2211 (₹8,150) is due tomorrow.', NOW() - INTERVAL '3 hours')
ON CONFLICT DO NOTHING;

-- ── Inbound replies ─────────────────────────────────────────────────────────
INSERT INTO message_replies (id, tenant_id, wa_message_id, in_reply_to_wa_message_id, from_phone, type, button_id, button_title, body, received_at) VALUES
  ('e0000000-0000-4000-8000-000000000001', :'tenant', 'wamid.reply001', 'wamid.demo001', '919876543210', 'text',   NULL, NULL, 'Is the 40% valid on the new arrivals too?', NOW() - INTERVAL '3 days' + INTERVAL '15 minutes'),
  ('e0000000-0000-4000-8000-000000000002', :'tenant', 'wamid.reply002', 'wamid.demo002', '919123456789', 'button', 'shop_now', 'Shop now', NULL, NOW() - INTERVAL '3 days' + INTERVAL '30 minutes'),
  ('e0000000-0000-4000-8000-000000000003', :'tenant', 'wamid.reply003', NULL, '919876543210', 'text', NULL, NULL, 'Also — can I change the delivery address for order #4821?', NOW() - INTERVAL '1 day' + INTERVAL '2 hours'),
  ('e0000000-0000-4000-8000-000000000004', :'tenant', 'wamid.reply004', 'wamid.demo013', '919812345670', 'text', NULL, NULL, 'Paid just now via UPI, please confirm.', NOW() - INTERVAL '2 days' + INTERVAL '1 hour'),
  ('e0000000-0000-4000-8000-000000000005', :'tenant', 'wamid.reply005', NULL, '918877665544', 'text', NULL, NULL, 'Received the order, packaging was great. Thanks!', NOW() - INTERVAL '6 hours')
ON CONFLICT DO NOTHING;

-- ── Conversations (shared inbox) ────────────────────────────────────────────
INSERT INTO conversations (id, tenant_id, contact_phone, status, has_unread, last_message_at) VALUES
  ('f0000000-0000-4000-8000-000000000001', :'tenant', '919876543210', 'open',   true,  NOW() - INTERVAL '1 day' + INTERVAL '2 hours'),
  ('f0000000-0000-4000-8000-000000000002', :'tenant', '919123456789', 'open',   false, NOW() - INTERVAL '3 days' + INTERVAL '30 minutes'),
  ('f0000000-0000-4000-8000-000000000003', :'tenant', '919812345670', 'open',   true,  NOW() - INTERVAL '2 days' + INTERVAL '1 hour'),
  ('f0000000-0000-4000-8000-000000000004', :'tenant', '918877665544', 'closed', false, NOW() - INTERVAL '6 hours')
ON CONFLICT DO NOTHING;
