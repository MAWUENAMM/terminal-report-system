-- Tighten custom SMS audit invariant: an Administrator's authorization reason
-- must exist for the message and remain 8-120 characters.
alter table public.sms_outbox drop constraint sms_recipient_kind_valid;
alter table public.sms_outbox add constraint sms_recipient_kind_valid check (
  (recipient_kind='STAFF' and recipient_staff_id is not null and consent_confirmed_at is null)
  or
  (recipient_kind='CUSTOM' and recipient_staff_id is null
   and consent_confirmed_at is not null and recipient_reason is not null
   and char_length(btrim(recipient_reason)) between 8 and 120)
);
