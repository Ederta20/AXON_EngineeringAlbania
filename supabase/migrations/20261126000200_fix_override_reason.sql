-- "Validate" in C5 confirms an Independent proposal (decided_level = validated); that is not an override.
-- Only a real override (a different level than proposed) needs a reason.
alter table validations drop constraint override_needs_reason;
alter table validations add constraint override_needs_reason check (
  decided_level is null
  or decided_level = proposed_level
  or (decided_level = 'validated' and proposed_level = 'independent')
  or reason is not null
);
