-- Diagnostic: identifies the client and participant(s) blocking
-- one-off-remove-duplicate-apeiro-clients.sql's final delete.

select c.id as client_id, c.slug, c.name
from clients c
where c.id = '87283dbf-d590-4f66-b28d-ffe8023a1f54';

select p.id, p.name, p.email, p.access_tier, p.disabled_at
from participants p
where p.client_id = '87283dbf-d590-4f66-b28d-ffe8023a1f54';
