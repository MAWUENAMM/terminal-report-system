-- Use an unambiguous literal + in the Ghana E.164 validator.
alter table public.sms_test_outbox drop constraint sms_test_outbox_phone_e164_check; alter table public.sms_test_outbox add constraint sms_test_outbox_phone_e164_check check (phone_e164 ~ '^[+]233[25][0-9]{8}$');
