-- Add due_diligence_date to properties
-- This is an admin-only field; it is NOT exposed to buyer-facing queries.
-- When a property is "Under Contract" and its due_diligence_date has passed
-- the due-diligence-check edge function will archive it as closed_outcome = 'lost'.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS due_diligence_date date DEFAULT NULL;

COMMENT ON COLUMN properties.due_diligence_date IS
  'Admin-only. The date due diligence expires. If the property is still Under Contract on this date the deal is auto-archived as Closed Lost.';
